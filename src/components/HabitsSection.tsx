import { useState } from 'react';
import type { Habit } from '@/lib/types';
import { HabitItem } from './HabitItem';
import { AddHabitRow } from './AddHabitRow';

interface HabitsSectionProps {
  habits: Habit[];
  currentHour: number;
  searchQuery: string;
  showCompleted: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateInterval: (id: string, intervalHours: number) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddReflection: (id: string, reflection: string) => void;
  onAddHabit: (text: string, intervalHours: number) => void;
  revealedItem: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'view-reflections' | 'add-subtask' } | null;
  onSetRevealed: (item: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'view-reflections' | 'add-subtask' } | null) => void;
}

export function HabitsSection({
  habits,
  currentHour: _currentHour,
  searchQuery,
  showCompleted: _showCompleted,
  onToggle,
  onDelete,
  onUpdateInterval,
  onUpdateText,
  onAddReflection,
  onAddHabit,
  revealedItem,
  onSetRevealed,
}: HabitsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Filter habits by search query
  const filteredHabits = habits.filter((habit) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return habit.text.toLowerCase().includes(lowerQuery) ||
           habit.reflections.some((r) => r.toLowerCase().includes(lowerQuery));
  });

  const handleAddHabit = (text: string, intervalHours: number) => {
    onAddHabit(text, intervalHours);
    setIsAdding(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Habits</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditMode(!editMode)}
            className="text-xs text-stone-500 hover:text-stone-700 transition-colors"
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            + Add habit
          </button>
        </div>
      </div>
      {isAdding && (
        <AddHabitRow
          onAdd={handleAddHabit}
          onCancel={() => setIsAdding(false)}
        />
      )}
      <div className="px-5 py-2">
        {filteredHabits.length > 0 ? (
          <div className="divide-y divide-stone-50">
            {filteredHabits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                editMode={editMode}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdateInterval={onUpdateInterval}
                onUpdateText={onUpdateText}
                onAddReflection={onAddReflection}
                revealedItem={revealedItem}
                onSetRevealed={onSetRevealed}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <div className="py-8 text-center text-stone-400 text-sm">
            No habits matching "{searchQuery}"
          </div>
        ) : (
          <div className="py-8 text-center text-stone-400 text-sm">
            No habits yet
          </div>
        )}
      </div>
    </div>
  );
}
