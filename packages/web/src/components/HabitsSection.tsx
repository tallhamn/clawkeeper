import { useState } from 'react';
import type { Habit } from '@clawkeeper/shared/src/types';
import { sortHabitQueue } from '@clawkeeper/shared/src/utils';
import { HabitItem } from './HabitItem';
import { AddHabitRow } from './AddHabitRow';

type RevealedItem = { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;

interface HabitsSectionProps {
  habits: Habit[];
  currentHour: number;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateInterval: (id: string, intervalHours: number) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddNote: (id: string, text: string) => void;
  onAddHabit: (text: string, intervalHours: number) => void;
  revealedItem: RevealedItem;
  onSetRevealed: (item: RevealedItem) => void;
}

export function HabitsSection({
  habits,
  currentHour,
  onComplete,
  onDelete,
  onUpdateInterval,
  onUpdateText,
  onAddNote,
  onAddHabit,
  revealedItem,
  onSetRevealed,
}: HabitsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);

  const sortedHabits = sortHabitQueue(habits, currentHour);

  const handleAddHabit = (text: string, intervalHours: number) => {
    onAddHabit(text, intervalHours);
    setIsAdding(false);
  };

  return (
    <div className="bg-tokyo-surface rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-tokyo-border flex items-center justify-between">
        <span className="text-xs font-semibold text-tokyo-magenta uppercase tracking-wider">Habits</span>
        <button
          onClick={() => setIsAdding(true)}
          className="text-sm text-tokyo-green active:text-tokyo-text transition-colors"
        >
          + Add habit
        </button>
      </div>
      {isAdding && (
        <AddHabitRow onAdd={handleAddHabit} onCancel={() => setIsAdding(false)} />
      )}
      <div className="px-5 py-2">
        {sortedHabits.length > 0 ? (
          <div className="divide-y divide-tokyo-border/30">
            {sortedHabits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                onComplete={onComplete}
                onDelete={onDelete}
                onUpdateInterval={onUpdateInterval}
                onUpdateText={onUpdateText}
                onAddNote={onAddNote}
                revealedItem={revealedItem}
                onSetRevealed={onSetRevealed}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-tokyo-text-dim text-sm">
            No habits yet
          </div>
        )}
      </div>
    </div>
  );
}
