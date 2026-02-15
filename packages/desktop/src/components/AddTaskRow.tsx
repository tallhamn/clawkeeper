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
    <div className="px-5 py-3 border-t border-tokyo-border bg-tokyo-surface-alt/50">
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
          className="flex-1 px-3 py-2 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue"
          autoFocus
        />
        <button onClick={handleAdd} className="px-4 py-2 text-sm bg-tokyo-blue text-white rounded-lg hover:bg-tokyo-blue-hover transition-colors">
          Add
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-2 text-sm text-tokyo-text-muted hover:text-tokyo-text"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
