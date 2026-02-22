import { useState, useEffect, useRef, useCallback } from 'react';
import type { AppState } from '@clawkeeper/shared/src/types';
import * as api from './lib/api';
import { HabitsSection } from './components/HabitsSection';
import { TasksSection } from './components/TasksSection';
import { UndoBar } from './components/UndoBar';

function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentHour, setCurrentHour] = useState(() => {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  });
  const [showCompleted, setShowCompleted] = useState(false);
  const [revealedItem, setRevealedItem] = useState<{
    type: 'habit' | 'task';
    id: string;
    mode: 'reflection' | 'edit' | 'add-subtask' | 'notes';
  } | null>(null);

  // Undo
  const [undoState, setUndoState] = useState<AppState | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load state on mount
  useEffect(() => {
    api.fetchState()
      .then((s) => { setState(s); setIsLoading(false); })
      .catch((err) => { setError(err.message); setIsLoading(false); });
  }, []);

  // Poll for changes every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      api.fetchState()
        .then((s) => setState(s))
        .catch(() => {}); // Silently ignore poll failures
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Update current hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentHour(now.getHours() + now.getMinutes() / 60);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const withUndo = useCallback((message: string, action: () => Promise<AppState>) => {
    if (state) setUndoState(state);
    setUndoMessage(message);
    setShowUndo(true);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 10000);
    action()
      .then((newState) => setState(newState))
      .catch((err) => setError(err.message));
  }, [state]);

  const handleUndo = useCallback(() => {
    // Undo is local-only: restore the previous state snapshot and re-save it
    // Not implemented server-side, just dismiss
    setShowUndo(false);
    setUndoState(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-tokyo-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-tokyo-text-muted">Loading ClawKeeper...</p>
        </div>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-tokyo-red mb-2">Failed to connect</p>
          <p className="text-tokyo-text-muted text-sm">{error}</p>
          <button
            onClick={() => { setError(null); setIsLoading(true); api.fetchState().then((s) => { setState(s); setIsLoading(false); }).catch((e) => { setError(e.message); setIsLoading(false); }); }}
            className="mt-4 px-4 py-2 bg-tokyo-blue text-white rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!state) return null;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-tokyo-surface rounded-2xl p-4 mb-5">
          <h1 className="text-lg font-semibold text-tokyo-blue">CLAWKEEPER</h1>
        </div>

        {/* Habits Section */}
        <HabitsSection
          habits={state.habits}
          currentHour={currentHour}
          onComplete={(id) => withUndo('Completed habit', () => api.completeHabit(id))}
          onDelete={(id) => withUndo('Deleted habit', () => api.deleteHabit(id))}
          onUpdateInterval={(id, hours) => api.editHabit(id, undefined, hours).then((s) => setState(s))}
          onUpdateText={(id, text) => api.editHabit(id, text).then((s) => setState(s))}
          onAddNote={(id, text) => api.addHabitNote(id, text).then((s) => setState(s))}
          onAddHabit={(text, hours) => withUndo(`Added habit: "${text}"`, () => api.addHabit(text, hours))}
          revealedItem={revealedItem}
          onSetRevealed={setRevealedItem}
        />

        <div className="h-5" />

        {/* Tasks Section */}
        <TasksSection
          tasks={state.tasks}
          showCompleted={showCompleted}
          onToggle={(id) => {
            // Determine if completing or uncompleting
            const findTask = (tasks: typeof state.tasks, targetId: string): typeof state.tasks[0] | null => {
              for (const t of tasks) {
                if (t.id === targetId) return t;
                const found = findTask(t.children || [], targetId);
                if (found) return found;
              }
              return null;
            };
            const task = findTask(state.tasks, id);
            if (!task) return;
            if (task.completed) {
              withUndo(`Uncompleted: "${task.text}"`, () => api.uncompleteTask(id));
            } else {
              withUndo(`Completed: "${task.text}"`, () => api.completeTask(id));
            }
          }}
          onAddNote={(id, text) => api.addTaskNote(id, text).then((s) => setState(s))}
          onAddSubtask={(parentId, text) => withUndo(`Added subtask: "${text}"`, () => api.addSubtask(parentId, text))}
          onAddTask={(text) => withUndo(`Added task: "${text}"`, () => api.addTask(text))}
          onDelete={(id) => withUndo('Deleted task', () => api.deleteTask(id))}
          onUpdateText={(id, text) => api.editTask(id, text).then((s) => setState(s))}
          onUpdateDueDate={(id, dueDate) => api.setTaskDueDate(id, dueDate).then((s) => setState(s))}
          revealedItem={revealedItem}
          onSetRevealed={setRevealedItem}
          onToggleShowCompleted={() => setShowCompleted(!showCompleted)}
        />
      </div>

      <UndoBar
        show={showUndo}
        message={undoMessage}
        onUndo={handleUndo}
        onDismiss={() => setShowUndo(false)}
      />
    </div>
  );
}

export default App;
