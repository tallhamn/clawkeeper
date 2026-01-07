import { useState } from 'react';
import type { Task } from '@/lib/types';

interface TaskItemProps {
  task: Task;
  depth: number;
  showCompleted: boolean;
  onToggle: (id: string) => void;
  onAddReflection: (id: string, reflection: string) => void;
  onAddSubtask: (parentId: string, text: string) => void;
}

export function TaskItem({
  task,
  depth,
  showCompleted,
  onToggle,
  onAddReflection,
  onAddSubtask,
}: TaskItemProps) {
  const [showReflectionInput, setShowReflectionInput] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');

  const visibleChildren = showCompleted
    ? task.children
    : task.children?.filter((child) => !child.completed) || [];

  if (!showCompleted && task.completed && visibleChildren.length === 0) {
    return null;
  }

  const handleToggle = () => {
    if (!task.completed) {
      onToggle(task.id);
      setShowReflectionInput(true);
    } else {
      onToggle(task.id);
    }
  };

  const handleSaveReflection = () => {
    if (reflectionText.trim()) {
      onAddReflection(task.id, reflectionText.trim());
    }
    setShowReflectionInput(false);
    setReflectionText('');
  };

  const handleSkipReflection = () => {
    setShowReflectionInput(false);
    setReflectionText('');
  };

  const handleAddSubtask = () => {
    if (subtaskText.trim()) {
      onAddSubtask(task.id, subtaskText.trim());
      setSubtaskText('');
      setShowAddSubtask(false);
    }
  };

  return (
    <div className={`${depth > 0 ? 'ml-5 pl-3 border-l-2 border-l-stone-200' : ''}`}>
      <div className={`group py-2 ${task.completed && !showReflectionInput ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-2.5">
          <button
            onClick={handleToggle}
            className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
              ${
                task.completed
                  ? 'bg-kyoto-red border-kyoto-red text-white'
                  : 'border-stone-300 hover:border-stone-400'
              }`}
          >
            {task.completed && (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="flex-1">
            <span className={`text-sm text-stone-700 ${task.completed ? 'line-through text-stone-400' : ''}`}>
              {task.text}
            </span>
            {task.reflection && !showReflectionInput && (
              <p className="text-xs text-kyoto-red mt-1">{task.reflection}</p>
            )}
          </div>
          {!task.completed && (
            <button
              onClick={() => setShowAddSubtask(true)}
              className="p-1 text-stone-300 hover:text-stone-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Add subtask"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {/* Add subtask input */}
        {showAddSubtask && (
          <div className="mt-2 ml-6 flex gap-2">
            <input
              type="text"
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSubtask();
                if (e.key === 'Escape') {
                  setSubtaskText('');
                  setShowAddSubtask(false);
                }
              }}
              placeholder="Subtask..."
              className="flex-1 px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red"
              autoFocus
            />
            <button onClick={handleAddSubtask} className="px-3 py-1.5 text-xs bg-kyoto-red text-white rounded-lg hover:opacity-90 transition-opacity">
              Add
            </button>
            <button
              onClick={() => {
                setSubtaskText('');
                setShowAddSubtask(false);
              }}
              className="px-2 py-1.5 text-xs text-stone-400 hover:text-stone-600"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Reflection input after completing */}
        {showReflectionInput && (
          <div className="mt-2 ml-6 p-3 bg-kyoto-light rounded-lg border border-kyoto-medium">
            <p className="text-xs text-kyoto-red mb-2 font-medium">How did it go? (optional)</p>
            <textarea
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="What worked? What would you do differently?"
              className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={handleSkipReflection} className="px-3 py-1 text-xs text-stone-600 hover:bg-stone-50 rounded transition-colors">
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

      {/* Recursive render of children */}
      {visibleChildren.map((child) => (
        <TaskItem
          key={child.id}
          task={child}
          depth={depth + 1}
          showCompleted={showCompleted}
          onToggle={onToggle}
          onAddReflection={onAddReflection}
          onAddSubtask={onAddSubtask}
        />
      ))}
    </div>
  );
}
