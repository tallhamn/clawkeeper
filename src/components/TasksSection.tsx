import { useState } from 'react';
import type { Task } from '@/lib/types';
import { TaskItem } from './TaskItem';
import { AddTaskRow } from './AddTaskRow';

interface TasksSectionProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onAddReflection: (id: string, reflection: string) => void;
  onAddSubtask: (parentId: string, text: string) => void;
  onAddTask: (text: string) => void;
}

export function TasksSection({ tasks, onToggle, onAddReflection, onAddSubtask, onAddTask }: TasksSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Filter tasks by search query
  const filterTasksBySearch = (task: Task, query: string): boolean => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();

    // Check if task text matches
    if (task.text.toLowerCase().includes(lowerQuery)) return true;

    // Check if reflection matches
    if (task.reflection && task.reflection.toLowerCase().includes(lowerQuery)) return true;

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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-stone-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <span className="font-medium text-stone-800 text-sm">Tasks</span>
          </div>
        </div>

        {/* Search and filters */}
        <div className="space-y-2">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors"
            >
              <div
                className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                  showCompleted ? 'bg-rose-500 border-rose-500' : 'border-stone-300'
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

            <span className="text-xs text-stone-400">
              {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''}
              {searchQuery && ' found'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 py-2">
        {visibleTasks.length > 0 ? (
          visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              depth={0}
              showCompleted={showCompleted}
              onToggle={onToggle}
              onAddReflection={onAddReflection}
              onAddSubtask={onAddSubtask}
            />
          ))
        ) : searchQuery ? (
          <div className="py-8 text-center text-stone-400 text-sm">
            No tasks matching "{searchQuery}"
          </div>
        ) : showCompleted ? (
          <div className="py-8 text-center text-stone-400 text-sm">No tasks yet</div>
        ) : (
          <div className="py-8 text-center text-stone-400 text-sm">All tasks complete! 🎉</div>
        )}
      </div>

      <AddTaskRow onAdd={onAddTask} />
    </div>
  );
}
