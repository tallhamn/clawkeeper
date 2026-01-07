import { useState } from 'react';
import type { TimeWindow } from '@/lib/types';
import { TIME_WINDOWS } from '@/lib/types';

interface AddHabitRowProps {
  onAdd: (text: string, timeWindow: TimeWindow) => void;
}

export function AddHabitRow({ onAdd }: AddHabitRowProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('morning');

  const handleAdd = () => {
    if (text.trim()) {
      onAdd(text.trim(), timeWindow);
      setText('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full px-5 py-2.5 text-left text-sm text-stone-400 hover:text-stone-600 hover:bg-stone-50 border-t border-stone-100 transition-colors"
      >
        + Add habit
      </button>
    );
  }

  return (
    <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50">
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') {
              setText('');
              setIsAdding(false);
            }
          }}
          placeholder="New habit..."
          className="flex-1 px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red"
          autoFocus
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-sm bg-kyoto-red text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Add
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(TIME_WINDOWS).map(([key, w]) => (
          <button
            key={key}
            onClick={() => setTimeWindow(key as TimeWindow)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              timeWindow === key
                ? 'bg-kyoto-red text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            {w.label}
          </button>
        ))}
        <button
          onClick={() => {
            setText('');
            setIsAdding(false);
          }}
          className="ml-auto text-xs text-stone-400 hover:text-stone-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
