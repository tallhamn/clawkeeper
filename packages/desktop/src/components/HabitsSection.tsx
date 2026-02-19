import { useState } from 'react';
import type { Habit } from '@clawkeeper/shared/src/types';
import { sortHabitQueue } from '@clawkeeper/shared/src/utils';
import { HabitItem } from './HabitItem';
import { HabitTimeline } from './HabitTimeline';
import { AddHabitRow } from './AddHabitRow';

interface HabitsSectionProps {
  habits: Habit[];
  currentHour: number;
  searchQuery: string;
  showCompleted: boolean;
  onToggle: (id: string, action?: 'complete' | 'undo' | 'wakeup' | 'skip') => void;
  onDelete: (id: string) => void;
  onUpdateInterval: (id: string, intervalHours: number) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddNote: (id: string, text: string) => void;
  onEditNote: (habitId: string, noteId: string, newNoteText: string) => void;
  onDeleteNote: (habitId: string, noteId: string) => void;
  onAddHabit: (text: string, intervalHours: number) => void;
  revealedItem: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;
  onSetRevealed: (item: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null) => void;
}

export function HabitsSection({
  habits,
  currentHour,
  searchQuery,
  showCompleted: _showCompleted,
  onToggle,
  onDelete,
  onUpdateInterval,
  onUpdateText,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onAddHabit,
  revealedItem,
  onSetRevealed,
}: HabitsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [hoveredHabitId, setHoveredHabitId] = useState<string | null>(null);

  // Filter habits by search query, then sort by priority queue
  const filteredHabits = sortHabitQueue(
    habits.filter((habit) => {
      if (!searchQuery) return true;
      const lowerQuery = searchQuery.toLowerCase();
      return habit.text.toLowerCase().includes(lowerQuery) ||
             (habit.notes && habit.notes.some((n) => n.text.toLowerCase().includes(lowerQuery)));
    }),
    currentHour
  );

  const handleAddHabit = (text: string, intervalHours: number) => {
    onAddHabit(text, intervalHours);
    setIsAdding(false);
  };

  return (
    <div className="bg-tokyo-surface rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-tokyo-border flex items-center justify-between">
        <span className="text-xs font-semibold text-tokyo-magenta uppercase tracking-wider">Habits</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm text-tokyo-green hover:text-tokyo-text transition-colors"
          >
            + Add habit
          </button>
        </div>
      </div>
      <HabitTimeline habits={habits} currentHour={currentHour} highlightHabitId={hoveredHabitId} onHoverHabit={setHoveredHabitId} />
      {isAdding && (
        <AddHabitRow
          onAdd={handleAddHabit}
          onCancel={() => setIsAdding(false)}
        />
      )}
      <div className="px-5 py-2">
        {filteredHabits.length > 0 ? (
          <div className="divide-y divide-tokyo-border/30">
            {filteredHabits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                editMode={false}
                isTimelineHighlighted={hoveredHabitId === habit.id}
                onHoverTimeline={setHoveredHabitId}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdateInterval={onUpdateInterval}
                onUpdateText={onUpdateText}
                onAddNote={onAddNote}
                onEditNote={onEditNote}
                onDeleteNote={onDeleteNote}
                revealedItem={revealedItem}
                onSetRevealed={onSetRevealed}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <div className="py-8 text-center text-tokyo-text-dim text-sm">
            No habits matching "{searchQuery}"
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
