import { useState } from 'react';
import type { Task } from '@clawkeeper/shared/src/types';
import { TaskItem } from './TaskItem';
import { AddTaskRow } from './AddTaskRow';

interface TasksSectionProps {
  tasks: Task[];
  searchQuery: string;
  showCompleted: boolean;
  onToggle: (id: string) => void;
  onAddNote: (id: string, text: string) => void;
  onEditNote: (id: string, noteText: string, newNoteText: string) => void;
  onDeleteNote: (id: string, noteText: string) => void;
  onAddSubtask: (parentId: string, text: string) => void;
  onAddTask: (text: string) => void;
  onDelete: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  revealedItem: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;
  onSetRevealed: (item: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null) => void;
  onToggleShowCompleted: () => void;
}

export function TasksSection({ tasks, searchQuery, showCompleted, onToggle, onAddNote, onEditNote, onDeleteNote, onAddSubtask, onAddTask, onDelete, onUpdateText, revealedItem, onSetRevealed, onToggleShowCompleted }: TasksSectionProps) {
  const [isAdding, setIsAdding] = useState(false);

  // Filter tasks by search query
  const filterTasksBySearch = (task: Task, query: string): boolean => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();

    // Check if task text matches
    if (task.text.toLowerCase().includes(lowerQuery)) return true;

    // Check if any notes match
    if (task.notes && task.notes.some((n) => n.text.toLowerCase().includes(lowerQuery))) return true;

    // Check if any children match
    if (task.children && task.children.some((child) => filterTasksBySearch(child, query))) {
      return true;
    }

    return false;
  };

  // Filter by completion status and search
  const visibleTasks = tasks.filter((task) => {
    // Filter by completion status
    const hasIncomplete = !task.completed || (task.children && task.children.some((c) => !c.completed));
    const passesCompletionFilter = showCompleted || hasIncomplete;

    // Filter by search query
    const passesSearchFilter = filterTasksBySearch(task, searchQuery);

    return passesCompletionFilter && passesSearchFilter;
  });

  const handleAddTask = (text: string) => {
    onAddTask(text);
    setIsAdding(false);
  };

  return (
    <div className="bg-tokyo-surface rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-tokyo-border flex items-center justify-between">
        <span className="text-xs font-semibold text-tokyo-blue uppercase tracking-wider">Tasks</span>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleShowCompleted}
            className="flex items-center gap-1.5 text-xs text-tokyo-text-muted hover:text-tokyo-text transition-colors"
          >
            <div
              className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                showCompleted ? 'bg-tokyo-blue border-tokyo-blue' : 'border-tokyo-border'
              }`}
            >
              {showCompleted && (
                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            Show completed
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm text-tokyo-green hover:text-tokyo-text transition-colors"
          >
            + Add task
          </button>
        </div>
      </div>

      {isAdding && (
        <AddTaskRow
          onAdd={handleAddTask}
          onCancel={() => setIsAdding(false)}
        />
      )}

      <div className="px-5 py-2">
        {visibleTasks.length > 0 ? (
          visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              depth={0}
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
          ))
        ) : searchQuery ? (
          <div className="py-8 text-center text-tokyo-text-dim text-sm">
            No tasks matching "{searchQuery}"
          </div>
        ) : showCompleted ? (
          <div className="py-8 text-center text-tokyo-text-dim text-sm">No tasks yet</div>
        ) : (
          <div className="py-8 text-center text-tokyo-text-dim text-sm">All tasks complete</div>
        )}
      </div>
    </div>
  );
}
