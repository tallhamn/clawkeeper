import type { Habit } from '@/lib/types';
import { getRelativeTime } from '@/lib/utils';
import { HabitItem } from './HabitItem';
import { AddHabitRow } from './AddHabitRow';

interface HabitsSectionProps {
  habits: Habit[];
  currentHour: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeWindow: (id: string, window: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddReflection: (id: string, reflection: string) => void;
  onAddHabit: (text: string, timeWindow: string) => void;
}

export function HabitsSection({
  habits,
  currentHour,
  onToggle,
  onDelete,
  onChangeWindow,
  onUpdateText,
  onAddReflection,
  onAddHabit,
}: HabitsSectionProps) {
  const completedHabitsToday = habits.filter((h) => h.completedToday).length;
  const totalHabits = habits.length;

  // Sort habits by time window
  const windowOrder = ['morning', 'midday', 'afternoon', 'evening', 'night'];
  const sortedHabits = [...habits].sort(
    (a, b) => windowOrder.indexOf(a.timeWindow) - windowOrder.indexOf(b.timeWindow)
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Habits</span>
        <span className="text-sm text-stone-400">
          {completedHabitsToday} of {totalHabits}
        </span>
      </div>
      <div className="px-5 divide-y divide-stone-50">
        {sortedHabits.map((habit) => {
          const relativeTime = getRelativeTime(habit.timeWindow, currentHour, habit.completedToday);
          return (
            <HabitItem
              key={habit.id}
              habit={habit}
              currentHour={currentHour}
              relativeTime={relativeTime}
              onToggle={onToggle}
              onDelete={onDelete}
              onChangeWindow={onChangeWindow}
              onUpdateText={onUpdateText}
              onAddReflection={onAddReflection}
            />
          );
        })}
      </div>
      <AddHabitRow onAdd={onAddHabit} />
    </div>
  );
}
