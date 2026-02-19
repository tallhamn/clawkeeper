import { useState, useEffect, useRef } from 'react';
import type { Habit } from '@clawkeeper/shared/src/types';
import { isHabitAvailable, formatTimeSince } from '@clawkeeper/shared/src/utils';
import { getHabitMarkerHours } from '@/components/HabitTimeline';
import { sendMessage } from '@/lib/claude';

interface LastAction {
  text: string;
  totalCompletions: number;
}

function getTimeOfDay(hour: number): string {
  if (hour < 6) return 'early morning';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function getNextScheduled(habit: Habit, currentHour: number): number | null {
  const hours = getHabitMarkerHours(habit);
  if (hours.length === 0) return null;
  // Find nearest future slot
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const h of hours) {
    const diff = h - currentHour;
    if (diff > 0 && diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return best;
}

export function useCoachMessage(habits: Habit[], currentHour: number) {
  const [message, setMessage] = useState('');
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const lastGeneratedRef = useRef<number>(0);

  // Generate contextual LLM message
  const generateLLMMessage = async () => {
    // Don't generate if we generated recently (within 30 seconds)
    const now = Date.now();
    if (now - lastGeneratedRef.current < 30000) return;

    // Don't generate if already generating
    if (isGenerating) return;

    // Don't generate if no habits
    if (habits.length === 0) {
      setMessage('Add a habit to get started.');
      return;
    }

    try {
      setIsGenerating(true);
      lastGeneratedRef.current = now;

      // Build rich time-aware context
      const availableHabits = habits.filter((h) => isHabitAvailable(h.lastCompleted, h.repeatIntervalHours, h.forcedAvailable));
      const restingHabits = habits.filter((h) => !isHabitAvailable(h.lastCompleted, h.repeatIntervalHours, h.forcedAvailable));

      // Find the most urgent available habit (closest preferred hour to now, or overdue)
      const overdueHabits = availableHabits.filter((h) => {
        if (h.preferredHour == null) return false;
        const hours = getHabitMarkerHours(h);
        return hours.some((hr) => hr < currentHour);
      });

      // Find next upcoming habit
      let nextHabit: { habit: Habit; inHours: number } | null = null;
      for (const h of availableHabits) {
        const next = getNextScheduled(h, currentHour);
        if (next != null) {
          const diff = next - currentHour;
          if (!nextHabit || diff < nextHabit.inHours) {
            nextHabit = { habit: h, inHours: Math.round(diff) };
          }
        }
      }

      const habitContext = habits.map((h) => {
        const available = isHabitAvailable(h.lastCompleted, h.repeatIntervalHours, h.forcedAvailable);
        const timeSince = h.lastCompleted ? formatTimeSince(h.lastCompleted) : 'never done';
        const scheduledAt = h.preferredHour != null ? `scheduled ${h.preferredHour}:00` : 'no set time';
        return `- ${h.text} (${scheduledAt}): ${available ? 'AVAILABLE' : 'resting'}, ${timeSince}, ${h.totalCompletions}x lifetime`;
      }).join('\n');

      const timeContext = [
        `Time: ${currentHour}:00 (${getTimeOfDay(currentHour)})`,
        `Progress: ${restingHabits.length}/${habits.length} completed recently`,
        `Available now: ${availableHabits.length}`,
        overdueHabits.length > 0 ? `Overdue: ${overdueHabits.map((h) => h.text).join(', ')}` : null,
        nextHabit ? `Next scheduled: "${nextHabit.habit.text}" in ~${nextHabit.inHours}h` : null,
        availableHabits.length === 0 ? 'All habits resting — nothing to do right now' : null,
      ].filter(Boolean).join('\n');

      const prompt = `You are a concise personal coach. Generate ONE brief sentence (max 15 words) about the user's habit status right now.

Context:
${timeContext}

Habits:
${habitContext}

Rules:
- Reference specific habit names and timing ("evening walk is in 2h", not "you have habits pending")
- If something is overdue, mention it gently ("morning run was scheduled earlier — still time")
- If everything is done, acknowledge it ("clear until evening walk at 6pm")
- If the next habit is soon, highlight it ("water is up next in 1h")
- Don't list all habits. Focus on what's most relevant RIGHT NOW
- No emojis, no exclamation marks, no generic encouragement
- Be conversational and specific, like a friend glancing at your schedule

Generate one message:`;

      const response = await sendMessage(prompt, [], [], currentHour, []);
      setMessage(response.trim().replace(/^["']|["']$/g, ''));
    } catch (error) {
      console.error('Failed to generate coach message:', error);
      // Fallback: time-aware static message
      const availableHabits = habits.filter((h) => isHabitAvailable(h.lastCompleted, h.repeatIntervalHours, h.forcedAvailable));
      if (availableHabits.length === 0) {
        setMessage('All habits resting — nothing due right now.');
      } else {
        const next = availableHabits[0];
        const nextTime = getNextScheduled(next, currentHour);
        if (nextTime != null) {
          const diff = Math.round(nextTime - currentHour);
          setMessage(`${next.text} ${diff > 0 ? `coming up in ${diff}h` : 'is ready now'}.`);
        } else {
          setMessage(`${next.text} is ready when you are.`);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const restingCount = habits.filter((h) =>
      h.lastCompleted &&
      (Date.now() - new Date(h.lastCompleted).getTime()) < (h.repeatIntervalHours * 60 * 60 * 1000)
    ).length;
    const total = habits.length;

    if (lastAction) {
      // Reinforcing mode - instant feedback
      const messages = [
        `${lastAction.text} done. ${lastAction.totalCompletions}x completed.`,
        `${restingCount}/${total} complete.`,
        `Nice. ${lastAction.text} checked off.`,
      ];
      setMessage(messages[Math.floor(Math.random() * messages.length)]);
    } else {
      // Generate LLM message for general status
      generateLLMMessage();
    }
  }, [habits, currentHour, lastAction]);

  const triggerReinforcement = (habitText: string, habitTotalCompletions: number) => {
    setLastAction({ text: habitText, totalCompletions: habitTotalCompletions });
    setTimeout(() => setLastAction(null), 4000);
  };

  return { message, triggerReinforcement };
}
