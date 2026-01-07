import { useState } from 'react';
import type { Habit, RelativeTime } from '@/lib/types';
import { TIME_WINDOWS } from '@/lib/types';
import { HABIT_STATE_OPACITY } from '@/lib/constants';

interface HabitItemProps {
  habit: Habit;
  currentHour: number;
  relativeTime: RelativeTime | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeWindow: (id: string, window: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddReflection: (id: string, reflection: string) => void;
}

export function HabitItem({
  habit,
  relativeTime,
  onToggle,
  onDelete,
  onChangeWindow,
  onUpdateText,
  onAddReflection,
}: HabitItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(habit.text);
  const [showReflectionInput, setShowReflectionInput] = useState(false);
  const [reflectionText, setReflectionText] = useState('');

  const handleSave = () => {
    if (editText.trim()) {
      onUpdateText(habit.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleToggle = () => {
    if (!habit.completedToday) {
      onToggle(habit.id);
      setShowReflectionInput(true);
    } else {
      onToggle(habit.id);
    }
  };

  const handleSaveReflection = () => {
    if (reflectionText.trim()) {
      onAddReflection(habit.id, reflectionText.trim());
    }
    setShowReflectionInput(false);
    setReflectionText('');
  };

  const handleSkipReflection = () => {
    setShowReflectionInput(false);
    setReflectionText('');
  };

  const stateOpacity = relativeTime
    ? HABIT_STATE_OPACITY[relativeTime.state]
    : habit.completedToday
    ? ''
    : HABIT_STATE_OPACITY.current;

  return (
    <div className={`group py-3 ${stateOpacity}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0
            ${
              habit.completedToday
                ? 'bg-kyoto-red border-kyoto-red text-white'
                : 'border-stone-300 hover:border-stone-400 bg-white'
            }`}
        >
          {habit.completedToday && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setEditText(habit.text);
                  setIsEditing(false);
                }
              }}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red text-sm"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <span
                onClick={() => setIsEditing(true)}
                className={`text-stone-700 cursor-text hover:text-stone-600 ${
                  habit.completedToday ? 'line-through opacity-50' : ''
                }`}
              >
                {habit.text}
              </span>
              {relativeTime && relativeTime.state === 'current' && !habit.completedToday && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-kyoto-medium text-kyoto-red font-semibold uppercase tracking-wide">
                  now
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 mt-0.5">
            <select
              value={habit.timeWindow}
              onChange={(e) => onChangeWindow(habit.id, e.target.value)}
              className="text-xs bg-transparent text-stone-400 cursor-pointer focus:outline-none hover:text-stone-600"
            >
              {Object.entries(TIME_WINDOWS).map(([key, w]) => (
                <option key={key} value={key}>
                  {w.label}
                </option>
              ))}
            </select>
            {habit.reflections && habit.reflections.length > 0 && (
              <>
                <span className="text-stone-200">·</span>
                <span className="text-xs text-kyoto-red">
                  {habit.reflections.length} reflection{habit.reflections.length > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {habit.streak > 0 && (
          <div className="text-xs text-stone-400 tabular-nums">
            {habit.streak}d
          </div>
        )}

        <button
          onClick={() => onDelete(habit.id)}
          className="p-1.5 text-stone-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Reflection input after completing */}
      {showReflectionInput && (
        <div className="mt-3 ml-8 p-3 bg-kyoto-light rounded-lg border border-kyoto-medium">
          <p className="text-xs text-kyoto-red mb-2 font-medium">Any reflection? (optional)</p>
          <textarea
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
            placeholder="What worked today? Anything to remember?"
            className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={handleSkipReflection}
              className="px-3 py-1 text-xs text-stone-600 hover:bg-stone-50 rounded transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSaveReflection}
              className="px-4 py-2 text-xs bg-kyoto-red text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
