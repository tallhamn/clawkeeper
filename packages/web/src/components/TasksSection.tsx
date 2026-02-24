import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Task } from '@clawkeeper/shared/src/types';
import { TaskItem } from './TaskItem';
import { AddTaskRow } from './AddTaskRow';

type RevealedItem = { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;

interface TasksSectionProps {
  tasks: Task[];
  searchQuery: string;
  showCompleted: boolean;
  onToggle: (id: string) => void;
  onAddNote: (id: string, text: string) => void;
  onEditNote: (id: string, noteId: string, newNoteText: string) => void;
  onDeleteNote: (id: string, noteId: string) => void;
  onAddSubtask: (parentId: string, text: string) => void;
  onAddTask: (text: string) => void;
  onDelete: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateDueDate: (id: string, dueDate: string | null) => void;
  onUpdateAgent?: (id: string, agentId: string | null) => void;
  allAgents?: Array<{ id: string; name?: string }>;
  revealedItem: RevealedItem;
  onSetRevealed: (item: RevealedItem) => void;
  onToggleShowCompleted: () => void;
  onMoveTask?: (id: string, parentId?: string) => void;
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-root' });
  return (
    <div
      ref={setNodeRef}
      className={`h-8 -mx-5 flex items-center justify-center transition-colors rounded-lg ${
        isOver ? 'bg-tokyo-green/10 border-2 border-dashed border-tokyo-green' : ''
      }`}
    >
      {isOver && (
        <span className="text-[10px] text-tokyo-green font-medium">Drop here to move to root</span>
      )}
    </div>
  );
}

export function TasksSection({
  tasks,
  searchQuery,
  showCompleted,
  onToggle,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onAddSubtask,
  onAddTask,
  onDelete,
  onUpdateText,
  onUpdateDueDate,
  onUpdateAgent,
  allAgents,
  revealedItem,
  onSetRevealed,
  onToggleShowCompleted,
  onMoveTask,
}: TasksSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  });
  const sensors = useSensors(touchSensor, mouseSensor);

  const findTaskById = useCallback((taskList: Task[], id: string): Task | null => {
    for (const t of taskList) {
      if (t.id === id) return t;
      const found = findTaskById(t.children || [], id);
      if (found) return found;
    }
    return null;
  }, []);

  const isDescendantOf = useCallback((taskList: Task[], parentId: string, childId: string): boolean => {
    const parent = findTaskById(taskList, parentId);
    if (!parent) return false;
    const check = (t: Task): boolean => {
      if (t.id === childId) return true;
      return t.children?.some(check) ?? false;
    };
    return parent.children?.some(check) ?? false;
  }, [findTaskById]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    setActiveTask(task ?? null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !onMoveTask) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    if (overId === 'drop-root') {
      onMoveTask(draggedId);
      return;
    }

    // Extract target task id from "drop-{taskId}"
    const targetId = overId.startsWith('drop-') ? overId.slice(5) : null;
    if (!targetId || targetId === draggedId) return;

    // Prevent dropping onto own descendant
    if (isDescendantOf(tasks, draggedId, targetId)) return;

    onMoveTask(draggedId, targetId);
  }, [onMoveTask, tasks, isDescendantOf]);

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
  }, []);

  const filterTasksBySearch = (task: Task, query: string): boolean => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    if (task.text.toLowerCase().includes(lowerQuery)) return true;
    if (task.notes && task.notes.some((n) => n.text.toLowerCase().includes(lowerQuery))) return true;
    if (task.children && task.children.some((child) => filterTasksBySearch(child, query))) return true;
    return false;
  };

  const visibleTasks = tasks.filter((task) => {
    const hasIncomplete = !task.completed || (task.children && task.children.some((c) => !c.completed));
    const passesCompletionFilter = showCompleted || hasIncomplete;
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

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="px-5 py-2">
          <RootDropZone />
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
                onUpdateDueDate={onUpdateDueDate}
                onUpdateAgent={onUpdateAgent}
                allAgents={allAgents}
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
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskItem
              task={activeTask}
              depth={0}
              showCompleted={showCompleted}
              onToggle={() => {}}
              onAddNote={() => {}}
              onEditNote={() => {}}
              onDeleteNote={() => {}}
              onAddSubtask={() => {}}
              onDelete={() => {}}
              onUpdateText={() => {}}
              onUpdateDueDate={() => {}}
              revealedItem={null}
              onSetRevealed={() => {}}
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
