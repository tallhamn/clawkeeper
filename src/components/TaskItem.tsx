import { useState } from 'react';
import type { Task } from '@/lib/types';
import { ENABLE_AUTO_REFLECTION } from '@/lib/constants';

interface TaskItemProps {
  task: Task;
  depth: number;
  showCompleted: boolean;
  onToggle: (id: string) => void;
  onAddNote: (id: string, text: string) => void;
  onEditNote: (id: string, noteText: string, newNoteText: string) => void;
  onDeleteNote: (id: string, noteText: string) => void;
  onAddSubtask: (parentId: string, text: string) => void;
  revealedItem: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;
  onSetRevealed: (item: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null) => void;
  onDelete?: (id: string) => void;
  onUpdateText?: (id: string, text: string) => void;
}

export function TaskItem({
  task,
  depth,
  showCompleted,
  onToggle,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onAddSubtask,
  revealedItem,
  onSetRevealed,
  onDelete,
  onUpdateText,
}: TaskItemProps) {
  const [reflectionText, setReflectionText] = useState('');
  const [subtaskText, setSubtaskText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(task.text);

  // Check if this task is currently revealed
  const showReflectionInput = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'reflection';
  const showAddSubtask = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'add-subtask';
  const showNotes = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'notes';
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
      onAddNote(task.id, reflectionText.trim());
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

  const handleSaveNote = () => {
    if (noteText.trim()) {
      onAddNote(task.id, noteText.trim());
      setNoteText('');
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
                      if (showNotes) {
                        onSetRevealed(null);
                      } else {
                        onSetRevealed({ type: 'task', id: task.id, mode: 'notes' });
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
                    onClick={() => onSetRevealed({ type: 'task', id: task.id, mode: 'notes' })}
                    className={`relative p-1 text-stone-300 hover:text-stone-500 rounded transition-opacity flex-shrink-0 ${
                      task.notes && task.notes.length > 0 ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                    }`}
                    title="Notes"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {task.notes && task.notes.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-kyoto-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {task.notes.length}
                      </span>
                    )}
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

        {/* Notes panel */}
        {showNotes && (
          <div className="mt-2 ml-6 p-3 bg-stone-50 rounded-lg border border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-stone-600 font-medium">Notes</p>
              <button
                onClick={() => {
                  onSetRevealed(null);
                  setNoteText('');
                }}
                className="text-xs text-stone-400 hover:text-stone-600"
              >
                Close
              </button>
            </div>

            {/* Show existing notes */}
            {task.notes && task.notes.length > 0 && (
              <div className="space-y-2 mb-3">
                {task.notes.map((note, i) => (
                  <div
                    key={i}
                    className="group/note text-sm text-stone-600 px-3 py-2 border-l-2 border-amber-400"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] text-stone-400 block mb-0.5">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingNoteIndex(i);
                            setEditingNoteText(note.text);
                          }}
                          className="text-[10px] text-stone-400 hover:text-stone-600"
                        >
                          Edit
                        </button>
                        <span className="text-stone-300">·</span>
                        <button
                          onClick={() => onDeleteNote(task.id, note.text)}
                          className="text-[10px] text-rose-400 hover:text-rose-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {editingNoteIndex === i ? (
                      <div className="mt-1">
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red resize-none"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            onClick={() => setEditingNoteIndex(null)}
                            className="px-3 py-1 text-xs text-stone-500 hover:text-stone-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (editingNoteText.trim()) {
                                onEditNote(task.id, note.text, editingNoteText.trim());
                              }
                              setEditingNoteIndex(null);
                            }}
                            className="px-3 py-1 text-xs bg-kyoto-red text-white rounded-lg hover:opacity-90 transition-opacity"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span>{note.text}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add new note */}
            <div>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red resize-none"
                rows={2}
                autoFocus
              />
              {noteText.trim() && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSaveNote}
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
          onAddNote={onAddNote}
          onEditNote={onEditNote}
          onDeleteNote={onDeleteNote}
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
