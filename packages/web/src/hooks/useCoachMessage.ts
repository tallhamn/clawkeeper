import { useState, useEffect, useRef } from 'react';
import type { Habit } from '@clawkeeper/shared/src/types';
import { isHabitAvailable, formatTimeSince, getHabitMarkerHours } from '@clawkeeper/shared/src/utils';
import { fetchCoachMessage } from '../lib/api';

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

export function useCoachMessage(habits: Habit[], currentHour: number, agents?: Array<{ id: string; name?: string }>) {
  const [message, setMessage] = useState('');
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const lastGeneratedRef = useRef<number>(0);

  const generateLLMMessage = async () => {
    const now = Date.now();
    if (now - lastGeneratedRef.current < 30000) return;
    if (isGenerating) return;
    if (habits.length === 0) {
      return;
    }

    try {
      setIsGenerating(true);
      lastGeneratedRef.current = now;

      const availableHabits = habits.filter(h => isHabitAvailable(h.lastCompleted, h.repeatIntervalHours, h.forcedAvailable));
      const restingHabits = habits.filter(h => !isHabitAvailable(h.lastCompleted, h.repeatIntervalHours, h.forcedAvailable));

      const overdueHabits = availableHabits.filter(h => {
        if (h.preferredHour == null) return false;
        return getHabitMarkerHours(h).some(hr => hr < currentHour);
      });

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

      const habitContext = habits.map(h => {
        const available = isHabitAvailable(h.lastCompleted, h.repeatIntervalHours, h.forcedAvailable);
        const timeSince = h.lastCompleted ? formatTimeSince(h.lastCompleted) : 'never done';
        const scheduledAt = h.preferredHour != null ? `scheduled ${h.preferredHour}:00` : 'no set time';
        return `- ${h.text} (${scheduledAt}): ${available ? 'AVAILABLE' : 'resting'}, ${timeSince}, ${h.totalCompletions}x lifetime`;
      }).join('\n');

      const timeContext = [
        `Time: ${currentHour}:00 (${getTimeOfDay(currentHour)})`,
        `Progress: ${restingHabits.length}/${habits.length} completed recently`,
        `Available now: ${availableHabits.length}`,
        overdueHabits.length > 0 ? `Overdue: ${overdueHabits.map(h => h.text).join(', ')}` : null,
        nextHabit ? `Next scheduled: "${nextHabit.habit.text}" in ~${nextHabit.inHours}h` : null,
        availableHabits.length === 0 ? 'All habits resting \u2014 nothing to do right now' : null,
      ].filter(Boolean).join('\n');

      // Pick a random agent for the coach message
      const coachAgents = agents && agents.length > 0 ? agents : [{ id: 'main', name: 'Clawcus' }];
      const pickedAgent = coachAgents[Math.floor(Math.random() * coachAgents.length)];
      const agentName = pickedAgent.name || pickedAgent.id;

      const systemPrompt = `Generate ONE short coaching nudge about the user's habits right now. MAXIMUM 120 characters (the name prefix will be added separately). No emojis, no exclamation marks.

Context:
${timeContext}

Habits:
${habitContext}

Rules:
- Reference specific habit names and timing ("evening walk is in 2h", not "you have habits pending")
- If something is overdue, mention it gently ("morning run was scheduled earlier \u2014 still time")
- If everything is done, acknowledge it ("clear until evening walk at 6pm")
- If the next habit is soon, highlight it ("water is up next in 1h")
- Don't list all habits. Focus on what's most relevant RIGHT NOW
- No emojis, no exclamation marks, no generic encouragement
- Be conversational and specific, like a friend glancing at your schedule

Generate one message:`;

      const response = await fetchCoachMessage(systemPrompt, [{ role: 'user', content: 'What should I know right now?' }], pickedAgent.id);
      let text = response.trim().replace(/^["']|["']$/g, '');
      // Enforce max length, truncate gracefully at word boundary
      if (text.length > 120) {
        text = text.slice(0, 117).replace(/\s+\S*$/, '') + '...';
      }
      setMessage(`${agentName}: ${text}`);
    } catch {
      // Fallback to static message
      const availableHabits = habits.filter(h => isHabitAvailable(h.lastCompleted, h.repeatIntervalHours, h.forcedAvailable));
      if (availableHabits.length === 0) {
        setMessage('All habits resting \u2014 nothing due right now.');
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
    const restingCount = habits.filter(h =>
      h.lastCompleted &&
      (Date.now() - new Date(h.lastCompleted).getTime()) < (h.repeatIntervalHours * 60 * 60 * 1000)
    ).length;
    const total = habits.length;

    if (lastAction) {
      const messages = [
        `${lastAction.text} done. ${lastAction.totalCompletions}x completed.`,
        `${restingCount}/${total} complete.`,
        `Nice. ${lastAction.text} checked off.`,
      ];
      setMessage(messages[Math.floor(Math.random() * messages.length)]);
    } else {
      generateLLMMessage();
    }
  }, [habits, currentHour, lastAction]);

  const triggerReinforcement = (habitText: string, habitTotalCompletions: number) => {
    setLastAction({ text: habitText, totalCompletions: habitTotalCompletions });
    setTimeout(() => setLastAction(null), 4000);
  };

  return { message, triggerReinforcement };
}
