import { useState } from 'react';
import type { Task } from '@/lib/types';
import { ENABLE_AUTO_REFLECTION } from '@/lib/constants';

interface TaskItemProps {
  task: Task;
  depth: number;
  showCompleted: boolean;
  onToggle: (id: string) => void;
  onAddReflection: (id: string, reflection: string) => void;
  onAddSubtask: (parentId: string, text: string) => void;
  revealedItem: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'view-reflections' | 'add-subtask' } | null;
  onSetRevealed: (item: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'view-reflections' | 'add-subtask' } | null) => void;
  onDelete?: (id: string) => void;
  onUpdateText?: (id: string, text: string) => void;
}

export function TaskItem({
  task,
  depth,
  showCompleted,
  onToggle,
  onAddReflection,
  onAddSubtask,
  revealedItem,
  onSetRevealed,
  onDelete,
  onUpdateText,
}: TaskItemProps) {
  const [reflectionText, setReflectionText] = useState('');
  const [newReflectionText, setNewReflectionText] = useState('');
  const [subtaskText, setSubtaskText] = useState('');
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(task.text);

  // Check if this task is currently revealed
  const showReflectionInput = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'reflection';
  const showAddSubtask = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'add-subtask';
  const showReflection = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'view-reflections';
  const isExpanded = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'edit';

  const visibleChildren = showCompleted
    ? task.children
    : task.children?.filter((child) => !child.completed) || [];

  // Keep task visible if reflection input is showing
  if (!showCompleted && task.completed && visibleChildren.length === 0 && !showReflectionInput) {
    return null;
  }

  const isVisuallyCompleted = task.completed || pendingCompletion;

  const handleToggle = () => {
    if (task.completed) {
      // Unchecking a completed task - simple toggle
      onToggle(task.id);
      setPendingCompletion(false);
      onSetRevealed(null); // Close any open panels
    } else if (pendingCompletion) {
      // Cancel pending completion (user clicked checkbox again before saving reflection)
      setPendingCompletion(false);
      onSetRevealed(null);
    } else {
      // Completing a task
      if (ENABLE_AUTO_REFLECTION) {
        // Show reflection input first
        setPendingCompletion(true);
        onSetRevealed({ type: 'task', id: task.id, mode: 'reflection' });
      } else {
        // Complete immediately without reflection
        onToggle(task.id);
      }
    }
  };

  const handleSaveReflection = () => {
    if (reflectionText.trim()) {
      onAddReflection(task.id, reflectionText.trim());
    }
    setReflectionText('');
    setPendingCompletion(false);
    onSetRevealed(null);
    // Now actually mark as completed
    onToggle(task.id);
  };

  const handleSkipReflection = () => {
    setReflectionText('');
    setPendingCompletion(false);
    onSetRevealed(null);
    // Mark as completed even though they skipped
    onToggle(task.id);
  };

  const handleAddSubtask = () => {
    if (subtaskText.trim()) {
      onAddSubtask(task.id, subtaskText.trim());
      setSubtaskText('');
      onSetRevealed(null);
    }
  };

  const handleSaveNewReflection = () => {
    if (newReflectionText.trim()) {
      onAddReflection(task.id, newReflectionText.trim());
      setNewReflectionText('');
    }
  };

  const handleSaveText = () => {
    if (editText.trim() && onUpdateText) {
      onUpdateText(task.id, editText.trim());
    }
    setIsEditingText(false);
  };

  return (
    <div className={`${depth > 0 ? 'ml-2.5 pl-5 border-l-2 border-l-stone-200' : ''}`}>
      <div className={`group py-2 ${task.completed && !showReflectionInput ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-2.5">
          <button
            onClick={handleToggle}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
              ${
                isVisuallyCompleted
                  ? 'bg-kyoto-red border-kyoto-red text-white'
                  : 'border-stone-300 hover:border-stone-400'
              }`}
          >
            {isVisuallyCompleted && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {isEditingText ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleSaveText}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveText();
                      if (e.key === 'Escape') {
                        setEditText(task.text);
                        setIsEditingText(false);
                      }
                    }}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red text-sm"
                    autoFocus
                  />
                ) : (
                  <span
                    onClick={() => {
                      if (showReflection) {
                        onSetRevealed(null);
                      } else {
                        onSetRevealed({ type: 'task', id: task.id, mode: 'view-reflections' });
                      }
                    }}
                    className={`text-sm text-stone-700 ${isVisuallyCompleted && !showReflectionInput ? 'line-through text-stone-400' : ''} cursor-pointer hover:text-stone-600`}
                  >
                    {task.text}
                  </span>
                )}
              </div>

              {/* Three-dot menu for edit */}
              {!isVisuallyCompleted && (
                <>
                  <button
                    onClick={() => onSetRevealed({ type: 'task', id: task.id, mode: 'add-subtask' })}
                    className="p-1 text-stone-300 hover:text-stone-500 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Add subtask"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onSetRevealed({ type: 'task', id: task.id, mode: 'edit' })}
                    className="p-1 text-stone-300 hover:text-stone-500 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Edit task"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            {isExpanded && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <button
                  onClick={() => setIsEditingText(true)}
                  className="text-xs text-stone-500 hover:text-stone-700"
                >
                  Edit name
                </button>
                {onDelete && (
                  <>
                    <span className="text-stone-300">·</span>
                    <button
                      onClick={() => onDelete(task.id)}
                      className="text-xs text-rose-500 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </>
                )}
                <span className="text-stone-300">·</span>
                <button
                  onClick={() => onSetRevealed(null)}
                  className="text-xs text-stone-500 hover:text-stone-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
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
                  onSetRevealed(null);
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
                onSetRevealed(null);
              }}
              className="px-2 py-1.5 text-xs text-stone-400 hover:text-stone-600"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Reflection input after completing */}
        {showReflectionInput && (
          <div className="mt-2 ml-6 p-3 bg-stone-50 rounded-lg border border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-stone-600 font-medium">Any reflection?</p>
              <button
                onClick={handleSkipReflection}
                className="text-xs text-stone-400 hover:text-stone-600"
              >
                Skip
              </button>
            </div>
            <div>
              <textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder="What worked today? Anything to remember?"
                className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red resize-none"
                rows={2}
                autoFocus
              />
              {reflectionText.trim() && (
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setReflectionText('')}
                    className="px-3 py-1 text-xs text-stone-600 hover:bg-stone-50 rounded transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleSaveReflection}
                    className="px-4 py-2 text-xs bg-kyoto-red text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* View/add reflections */}
        {showReflection && (
          <div className="mt-2 ml-6 p-3 bg-stone-50 rounded-lg border border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-stone-600 font-medium">Any reflection?</p>
              <button
                onClick={() => {
                  onSetRevealed(null);
                  setNewReflectionText('');
                }}
                className="text-xs text-stone-400 hover:text-stone-600"
              >
                Close
              </button>
            </div>

            {/* Show existing reflections */}
            {task.reflections && task.reflections.length > 0 && (
              <div className="space-y-2 mb-3">
                {task.reflections.map((reflection, i) => (
                  <div
                    key={i}
                    className="text-sm text-stone-600 italic px-3 py-2 border-l-2 border-stone-300"
                  >
                    {reflection}
                  </div>
                ))}
              </div>
            )}

            {/* Add new reflection */}
            <div>
              <textarea
                value={newReflectionText}
                onChange={(e) => setNewReflectionText(e.target.value)}
                placeholder="Any thoughts on this?"
                className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red resize-none"
                rows={2}
              />
              {newReflectionText.trim() && (
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setNewReflectionText('')}
                    className="px-3 py-1 text-xs text-stone-600 hover:bg-stone-50 rounded transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleSaveNewReflection}
                    className="px-4 py-2 text-xs bg-kyoto-red text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                </div>
              )}
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
          onDelete={onDelete}
          onUpdateText={onUpdateText}
          revealedItem={revealedItem}
          onSetRevealed={onSetRevealed}
        />
      ))}
    </div>
  );
}
