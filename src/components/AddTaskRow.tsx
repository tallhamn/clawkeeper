import { useState } from 'react';

interface AddTaskRowProps {
  onAdd: (text: string) => void;
}

export function AddTaskRow({ onAdd }: AddTaskRowProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');

  const handleAdd = () => {
    if (text.trim()) {
      onAdd(text.trim());
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
        + Add task
      </button>
    );
  }

  return (
    <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50">
      <div className="flex gap-2">
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
          placeholder="New task..."
          className="flex-1 px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red"
          autoFocus
        />
        <button onClick={handleAdd} className="px-4 py-2 text-sm bg-kyoto-red text-white rounded-lg hover:opacity-90 transition-opacity">
          Add
        </button>
        <button
          onClick={() => {
            setText('');
            setIsAdding(false);
          }}
          className="px-3 py-2 text-sm text-stone-400 hover:text-stone-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
