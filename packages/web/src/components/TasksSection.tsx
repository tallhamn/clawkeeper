import { useState } from 'react';
import type { Task } from '@clawkeeper/shared/src/types';
import { TaskItem } from './TaskItem';
import { AddTaskRow } from './AddTaskRow';

type RevealedItem = { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;

interface TasksSectionProps {
  tasks: Task[];
  showCompleted: boolean;
  onToggle: (id: string) => void;
  onAddNote: (id: string, text: string) => void;
  onAddSubtask: (parentId: string, text: string) => void;
  onAddTask: (text: string) => void;
  onDelete: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateDueDate: (id: string, dueDate: string | null) => void;
  revealedItem: RevealedItem;
  onSetRevealed: (item: RevealedItem) => void;
  onToggleShowCompleted: () => void;
}

export function TasksSection({
  tasks,
  showCompleted,
  onToggle,
  onAddNote,
  onAddSubtask,
  onAddTask,
  onDelete,
  onUpdateText,
  onUpdateDueDate,
  revealedItem,
  onSetRevealed,
  onToggleShowCompleted,
}: TasksSectionProps) {
  const [isAdding, setIsAdding] = useState(false);

  const visibleTasks = tasks.filter((task) => {
    const hasIncomplete = !task.completed || (task.children && task.children.some((c) => !c.completed));
    return showCompleted || hasIncomplete;
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
            className="flex items-center gap-1.5 text-xs text-tokyo-text-muted active:text-tokyo-text transition-colors"
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
            className="text-sm text-tokyo-green active:text-tokyo-text transition-colors"
          >
            + Add task
          </button>
        </div>
      </div>

      {isAdding && (
        <AddTaskRow onAdd={handleAddTask} onCancel={() => setIsAdding(false)} />
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
              onAddSubtask={onAddSubtask}
              onDelete={onDelete}
              onUpdateText={onUpdateText}
              onUpdateDueDate={onUpdateDueDate}
              revealedItem={revealedItem}
              onSetRevealed={onSetRevealed}
            />
          ))
        ) : showCompleted ? (
          <div className="py-8 text-center text-tokyo-text-dim text-sm">No tasks yet</div>
        ) : (
          <div className="py-8 text-center text-tokyo-text-dim text-sm">All tasks complete</div>
        )}
      </div>
    </div>
  );
}
