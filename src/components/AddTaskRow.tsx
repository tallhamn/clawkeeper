import { useState } from 'react';

interface AddTaskRowProps {
  onAdd: (text: string) => void;
  onCancel: () => void;
}

export function AddTaskRow({ onAdd, onCancel }: AddTaskRowProps) {
  const [text, setText] = useState('');

  const handleAdd = () => {
    if (text.trim()) {
      onAdd(text.trim());
      setText('');
    }
  };

  const handleCancel = () => {
    setText('');
    onCancel();
  };

  return (
    <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder="New task..."
          className="flex-1 px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red"
          autoFocus
        />
        <button onClick={handleAdd} className="px-4 py-2 text-sm bg-kyoto-red text-white rounded-lg hover:opacity-90 transition-opacity">
          Add
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-2 text-sm text-stone-400 hover:text-stone-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
