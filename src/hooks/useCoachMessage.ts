import { useState, useEffect, useRef } from 'react';
import type { Habit } from '@/lib/types';
import { isHabitAvailable, formatTimeSince } from '@/lib/utils';
import { sendMessage } from '@/lib/claude';

interface LastAction {
  text: string;
  totalCompletions: number;
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

      // Build context about habits
      const availableHabits = habits.filter((h) => isHabitAvailable(h.lastCompleted, h.repeatIntervalHours));
      const completedCount = habits.filter((h) =>
        h.lastCompleted &&
        (Date.now() - new Date(h.lastCompleted).getTime()) < (h.repeatIntervalHours * 60 * 60 * 1000)
      ).length;

      const habitContext = habits.map((h) => {
        const available = isHabitAvailable(h.lastCompleted, h.repeatIntervalHours);
        const timeSince = h.lastCompleted ? formatTimeSince(h.lastCompleted) : 'never';
        return `- ${h.text}: ${available ? 'available' : `done ${timeSince}`}, ${h.totalCompletions}x total`;
      }).join('\n');

      const prompt = `Generate a very brief (1 sentence, max 12 words), encouraging status message about the user's habits. Be specific and direct. Don't use emojis.

Habits:
${habitContext}

Stats: ${completedCount}/${habits.length} done
Available: ${availableHabits.length}

Examples of good messages:
- "write code is ready when you are"
- "4/4 habits completed on schedule"
- "light workout available, keep the streak going"
- "All done for now"

Generate one brief message:`;

      const response = await sendMessage(prompt, [], [], currentHour, []);
      setMessage(response.trim());
    } catch (error) {
      console.error('Failed to generate coach message:', error);
      // Fallback to simple message
      const availableHabits = habits.filter((h) => isHabitAvailable(h.lastCompleted, h.repeatIntervalHours));
      if (availableHabits.length > 0) {
        setMessage(`${availableHabits[0].text} is ready when you are.`);
      } else {
        setMessage('All habits complete for now.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const completedCount = habits.filter((h) =>
      h.lastCompleted &&
      (Date.now() - new Date(h.lastCompleted).getTime()) < (h.repeatIntervalHours * 60 * 60 * 1000)
    ).length;
    const total = habits.length;

    if (lastAction) {
      // Reinforcing mode - instant feedback
      const messages = [
        `${lastAction.text} done. ${lastAction.totalCompletions}x completed.`,
        `${completedCount}/${total} complete.`,
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
