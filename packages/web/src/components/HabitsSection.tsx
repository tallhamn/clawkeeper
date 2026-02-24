import { useState } from 'react';
import type { Habit } from '@clawkeeper/shared/src/types';
import { sortHabitQueue } from '@clawkeeper/shared/src/utils';
import { HabitItem } from './HabitItem';
import { HabitTimeline } from './HabitTimeline';
import { AddHabitRow } from './AddHabitRow';

type RevealedItem = { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;

interface HabitsSectionProps {
  habits: Habit[];
  currentHour: number;
  searchQuery: string;
  onToggle: (id: string, action?: 'complete' | 'wakeup' | 'skip') => void;
  onDelete: (id: string) => void;
  onUpdateInterval: (id: string, intervalHours: number) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddNote: (id: string, text: string) => void;
  onEditNote: (habitId: string, noteId: string, newNoteText: string) => void;
  onDeleteNote: (habitId: string, noteId: string) => void;
  onAddHabit: (text: string, intervalHours: number) => void;
  onAdjustPreferredHour?: (habitId: string, newHour: number) => void;
  onAdjustCompletionTime?: (habitId: string, timestamp: string, newHour: number) => void;
  agents?: Array<{ id: string; name?: string }>;
  onAssignAgent?: (habitId: string, agentId: string) => void;
  onUnassignAgent?: (habitId: string) => void;
  revealedItem: RevealedItem;
  onSetRevealed: (item: RevealedItem) => void;
}

export function HabitsSection({
  habits,
  currentHour,
  searchQuery,
  onToggle,
  onDelete,
  onUpdateInterval,
  onUpdateText,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onAddHabit,
  onAdjustPreferredHour,
  onAdjustCompletionTime,
  agents,
  onAssignAgent,
  onUnassignAgent,
  revealedItem,
  onSetRevealed,
}: HabitsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [hoveredHabitId, setHoveredHabitId] = useState<string | null>(null);

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
        <button
          onClick={() => setIsAdding(true)}
          className="text-sm text-tokyo-green active:text-tokyo-text transition-colors"
        >
          + Add habit
        </button>
      </div>
      <HabitTimeline
        habits={habits}
        currentHour={currentHour}
        highlightHabitId={hoveredHabitId}
        onHoverHabit={setHoveredHabitId}
        onAdjustPreferredHour={onAdjustPreferredHour}
        onAdjustCompletionTime={onAdjustCompletionTime}
      />
      {isAdding && (
        <AddHabitRow onAdd={handleAddHabit} onCancel={() => setIsAdding(false)} />
      )}
      <div className="px-5 py-2">
        {filteredHabits.length > 0 ? (
          <div className="divide-y divide-tokyo-border/30">
            {filteredHabits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                isTimelineHighlighted={hoveredHabitId === habit.id}
                onHoverTimeline={setHoveredHabitId}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdateInterval={onUpdateInterval}
                onUpdateText={onUpdateText}
                onAddNote={onAddNote}
                onEditNote={onEditNote}
                onDeleteNote={onDeleteNote}
                agents={agents}
                onAssignAgent={onAssignAgent}
                onUnassignAgent={onUnassignAgent}
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
