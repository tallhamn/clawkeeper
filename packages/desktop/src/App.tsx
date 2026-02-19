import { useState, useEffect, useRef, useCallback } from 'react';
import type { Habit, Task, LLMAction, AppState } from '@clawkeeper/shared/src/types';
import { generateId, getTodayDate } from '@clawkeeper/shared/src/utils';
import { useCoachMessage } from '@/hooks/useCoachMessage';
import { HabitsSection } from '@/components/HabitsSection';
import { TasksSection } from '@/components/TasksSection';
import { ChatPanel } from '@/components/ChatPanel';
import { UndoBar } from '@/components/UndoBar';
import { SplashScreen } from '@/components/SplashScreen';
import { SetupPrompt, useSetupPrompt } from '@/components/SetupPrompt';
import { initializeStorage, loadCurrentState, saveCurrentState, archiveOldCompletedTasks, getDefaultState, watchCurrentFile } from '@/lib/storage';
import { inferPreferredHours, inferHabitIcons } from '@/lib/claude';
import { APP_VERSION } from '@clawkeeper/shared/src/constants';

function App() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentHour, setCurrentHour] = useState(() => {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  // File watcher cleanup handle
  const unwatchRef = useRef<(() => void) | null>(null);

  // Track which element is currently revealed (reflection input, edit controls, etc.)
  const [revealedItem, setRevealedItem] = useState<{ type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null>(null);

  // Undo functionality
  const [undoState, setUndoState] = useState<AppState | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');

  const { message: coachMessage, triggerReinforcement } = useCoachMessage(habits, currentHour);
  const { shouldShow: showSetupPrompt, dismiss: dismissSetupPrompt } = useSetupPrompt();

  // Infer preferredHour and icon for habits that lack them
  const inferringRef = useRef(false);
  const assignPreferredHours = useCallback(async (currentHabits: Habit[]) => {
    const missingHours = currentHabits.filter((h) => h.preferredHour == null);
    const missingIcons = currentHabits.filter((h) => h.icon == null);
    if ((missingHours.length === 0 && missingIcons.length === 0) || inferringRef.current) return;

    inferringRef.current = true;
    try {
      const [hourResult, iconResult] = await Promise.all([
        missingHours.length > 0 ? inferPreferredHours(missingHours.map((h) => h.text)) : {},
        missingIcons.length > 0 ? inferHabitIcons(missingIcons.map((h) => h.text)) : {},
      ]);

      const hasHours = Object.keys(hourResult).length > 0;
      const hasIcons = Object.keys(iconResult).length > 0;
      if (hasHours || hasIcons) {
        setHabits((prev) =>
          prev.map((h) => {
            let updated = h;
            if (h.preferredHour == null && hourResult[h.text] != null) {
              updated = { ...updated, preferredHour: hourResult[h.text] };
            }
            if (h.icon == null && iconResult[h.text] != null) {
              updated = { ...updated, icon: iconResult[h.text] };
            }
            return updated;
          })
        );
      }
    } catch (error) {
      console.warn('[App] Failed to infer habit metadata:', error);
    } finally {
      inferringRef.current = false;
    }
  }, []);

  // Check if splash screen should be shown for this version
  useEffect(() => {
    try {
      const lastSeenVersion = localStorage.getItem('clawkeeper_last_seen_version');
      if (lastSeenVersion !== APP_VERSION) {
        setShowSplash(true);
      }
    } catch (error) {
      // localStorage not available (e.g., in tests)
      console.log('[Splash] localStorage not available');
    }
  }, []);

  const handleDismissSplash = () => {
    try {
      localStorage.setItem('clawkeeper_last_seen_version', APP_VERSION);
    } catch (error) {
      console.log('[Splash] localStorage not available');
    }
    setShowSplash(false);
  };

  // Initialize storage and load data on mount
  useEffect(() => {
    const initApp = async () => {
      console.log('[Storage] Starting initialization...');
      try {
        console.log('[Storage] Creating directory structure...');
        await initializeStorage();

        console.log('[Storage] Loading existing state...');
        const state = await loadCurrentState();

        if (state) {
          console.log('[Storage] Loaded state:', {
            habits: state.habits.length,
            tasks: state.tasks.length
          });

          // Archive old completed tasks
          const archivedState = await archiveOldCompletedTasks(state);
          setHabits(archivedState.habits);
          setTasks(archivedState.tasks);
        } else {
          // File doesn't exist yet — first launch only
          console.log('[Storage] First launch - using default data');
          const defaultState = getDefaultState();
          setHabits(defaultState.habits);
          setTasks(defaultState.tasks);
          await saveCurrentState(defaultState);
        }
        // Start watching for external file changes
        unwatchRef.current = await watchCurrentFile((newState) => {
          setHabits(newState.habits);
          setTasks(newState.tasks);
        });
      } catch (error) {
        console.error('[Storage] Failed to initialize storage:', error);
        console.error('[Storage] Error details:', error);
        // Fallback to default data
        const defaultState = getDefaultState();
        setHabits(defaultState.habits);
        setTasks(defaultState.tasks);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
    return () => { unwatchRef.current?.(); };
  }, []);

  // Auto-save when habits or tasks change
  useEffect(() => {
    if (!isLoading && (habits.length > 0 || tasks.length > 0)) {
      saveCurrentState({ habits, tasks }).catch((error) => {
        console.error('Failed to save state:', error);
      });
    }
  }, [habits, tasks, isLoading]);

  // Infer preferredHour for any habits missing it (after initial load)
  useEffect(() => {
    if (!isLoading && habits.length > 0) {
      assignPreferredHours(habits);
    }
  }, [isLoading, habits, assignPreferredHours]);

  // Update current hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentHour(now.getHours() + now.getMinutes() / 60);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Habit handlers
  const toggleHabit = (id: string, action: 'complete' | 'undo' | 'wakeup' = 'complete') => {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;

    if (action === 'complete') {
      // Complete: increment and update lastCompleted + history
      const now = new Date().toISOString();
      setHabits((prev) =>
        prev.map((h) =>
          h.id === id
            ? {
                ...h,
                lastCompleted: now,
                completionHistory: [...(h.completionHistory || []), now],
                totalCompletions: h.totalCompletions + 1,
                forcedAvailable: false, // Clear forced availability when completing
              }
            : h
        )
      );
      triggerReinforcement(habit.text, habit.totalCompletions);
    } else if (action === 'undo') {
      // Undo: decrement, remove last entry from history, restore previous lastCompleted
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h;
          const history = [...(h.completionHistory || [])];
          history.pop(); // remove the most recent completion
          return {
            ...h,
            lastCompleted: history.length > 0 ? history[history.length - 1] : null,
            completionHistory: history,
            totalCompletions: Math.max(0, h.totalCompletions - 1),
            forcedAvailable: false,
          };
        })
      );
      console.log(`[Habit] Unchecked "${habit.text}"`);
    } else if (action === 'wakeup') {
      // Wake up from standby: make habit available without changing completion time/count
      // Just set forcedAvailable flag - preserves real lastCompleted timestamp
      setHabits((prev) =>
        prev.map((h) =>
          h.id === id
            ? {
                ...h,
                forcedAvailable: true,
              }
            : h
        )
      );
      console.log(`[Habit] Woke up "${habit.text}" - now available again (forced)`);
    } else if (action === 'skip') {
      // Skip: reset the cycle timer without counting as a completion
      const now = new Date().toISOString();
      setHabits((prev) =>
        prev.map((h) =>
          h.id === id
            ? {
                ...h,
                lastCompleted: now,
                forcedAvailable: false,
              }
            : h
        )
      );
      console.log(`[Habit] Skipped "${habit.text}" - cycle reset`);
    }
  };

  const deleteHabit = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  };

  const updateHabitInterval = (id: string, intervalHours: number) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, repeatIntervalHours: intervalHours } : h)));
  };

  const updateHabitText = (id: string, text: string) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, text, preferredHour: undefined } : h)));
  };

  const addHabit = (text: string, intervalHours: number) => {
    if (text.trim()) {
      setHabits((prev) => [
        ...prev,
        {
          id: generateId(),
          text: text.trim(),
          totalCompletions: 0,
          lastCompleted: null,
          completionHistory: [],
          repeatIntervalHours: intervalHours,
          notes: [],
        },
      ]);
    }
  };

  // Task handlers
  const findAndUpdate = (tasks: Task[], id: string, updater: (task: Task) => Task): Task[] =>
    tasks.map((task) =>
      task.id === id ? updater(task) : { ...task, children: findAndUpdate(task.children || [], id, updater) }
    );

  const toggleTask = (id: string) => {
    setTasks((prev) => {
      const updated = findAndUpdate(prev, id, (t) => {
        const newCompleted = !t.completed;
        const newCompletedAt = newCompleted ? getTodayDate() : null;
        console.log(`[Toggle] Task "${t.text}": completed ${t.completed} → ${newCompleted}, completedAt ${t.completedAt} → ${newCompletedAt}`);
        return {
          ...t,
          completed: newCompleted,
          completedAt: newCompletedAt,
        };
      });
      return updated;
    });
  };

  const addTaskNote = (id: string, text: string) => {
    setTasks((prev) => findAndUpdate(prev, id, (t) => ({
      ...t,
      notes: [...(t.notes || []), { id: generateId(), text, createdAt: new Date().toISOString() }],
    })));
  };

  const addHabitNote = (id: string, text: string) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, notes: [...(h.notes || []), { id: generateId(), text, createdAt: new Date().toISOString() }] } : h))
    );
  };

  const editTaskNote = (id: string, noteId: string, newNoteText: string) => {
    setTasks((prev) => findAndUpdate(prev, id, (t) => ({
      ...t,
      notes: (t.notes || []).map((n) =>
        n.id === noteId ? { ...n, text: newNoteText } : n
      ),
    })));
  };

  const deleteTaskNote = (id: string, noteId: string) => {
    setTasks((prev) => findAndUpdate(prev, id, (t) => ({
      ...t,
      notes: (t.notes || []).filter((n) => n.id !== noteId),
    })));
  };

  const editHabitNote = (habitId: string, noteId: string, newNoteText: string) => {
    setHabits((prev) =>
      prev.map((h) => h.id === habitId ? {
        ...h,
        notes: (h.notes || []).map((n) => n.id === noteId ? { ...n, text: newNoteText } : n),
      } : h)
    );
  };

  const deleteHabitNote = (habitId: string, noteId: string) => {
    setHabits((prev) =>
      prev.map((h) => h.id === habitId ? {
        ...h,
        notes: (h.notes || []).filter((n) => n.id !== noteId),
      } : h)
    );
  };

  const addTask = (text: string) => {
    if (text.trim()) {
      setTasks((prev) => [
        ...prev,
        {
          id: generateId(),
          text: text.trim(),
          completed: false,
          completedAt: null,
          dueDate: null,
          notes: [],
          children: [],
        },
      ]);
    }
  };

  const addSubtask = (parentId: string, text: string) => {
    setTasks((prev) =>
      findAndUpdate(prev, parentId, (t) => ({
        ...t,
        children: [
          ...(t.children || []),
          {
            id: generateId(),
            text,
            completed: false,
            completedAt: null,
            dueDate: null,
            notes: [],
            children: [],
          },
        ],
      }))
    );
  };

  const deleteTask = (id: string) => {
    const removeTask = (tasks: Task[], targetId: string): Task[] => {
      return tasks
        .filter((t) => t.id !== targetId)
        .map((t) => ({
          ...t,
          children: removeTask(t.children || [], targetId),
        }));
    };
    setTasks((prev) => removeTask(prev, id));
  };

  const updateTaskText = (id: string, text: string) => {
    setTasks((prev) => findAndUpdate(prev, id, (t) => ({ ...t, text })));
  };

  const updateTaskDueDate = (id: string, dueDate: string | null) => {
    setTasks((prev) => findAndUpdate(prev, id, (t) => ({ ...t, dueDate })));
  };

  const moveTask = (taskId: string, newParentId: string | null) => {
    // Find and remove the task from its current location
    let taskToMove: Task | null = null;

    const removeTask = (tasks: Task[]): Task[] => {
      return tasks.reduce((acc: Task[], task) => {
        if (task.id === taskId) {
          taskToMove = task;
          return acc; // Remove this task
        }
        return [...acc, { ...task, children: removeTask(task.children || []) }];
      }, []);
    };

    const tasksWithoutMoved = removeTask(tasks);

    if (!taskToMove) return; // Task not found

    // Add task to new location
    if (newParentId === null) {
      // Move to root level
      setTasks([...tasksWithoutMoved, taskToMove]);
    } else {
      // Move to a specific parent
      setTasks(
        findAndUpdate(tasksWithoutMoved, newParentId, (parent) => ({
          ...parent,
          children: [...(parent.children || []), taskToMove!],
        }))
      );
    }
  };

  // Handle LLM actions
  const handleLLMAction = (action: LLMAction) => {
    // Save current state for undo
    setUndoState({ habits, tasks });

    switch (action.type) {
      // Task actions
      case 'add_task':
        if (action.text) {
          addTask(action.text);
          if (action.dueDate) {
            // Find the just-added task (last in array) and set due date
            setTasks((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.text === action.text) {
                return [...prev.slice(0, -1), { ...last, dueDate: action.dueDate ?? null }];
              }
              return prev;
            });
          }
          setUndoMessage(`Added task: "${action.text}"`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'add_subtask':
        if (action.parentId && action.text) {
          addSubtask(action.parentId, action.text);
          setUndoMessage(`Added subtask: "${action.text.slice(0, 40)}..."`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'complete_task':
        if (action.taskId) {
          toggleTask(action.taskId);
          setUndoMessage(`Checked off: "${action.taskText || 'task'}"`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'uncomplete_task':
        if (action.taskId) {
          toggleTask(action.taskId);
          setUndoMessage(`Unchecked: "${action.taskText || 'task'}"`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'delete_task':
        if (action.taskId) {
          deleteTask(action.taskId);
          setUndoMessage(`Deleted task: "${action.taskText || 'task'}"`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'edit_task':
        if (action.taskId && action.text) {
          updateTaskText(action.taskId, action.text);
          if (action.dueDate !== undefined) {
            updateTaskDueDate(action.taskId, action.dueDate ?? null);
          }
          setUndoMessage(`Updated task text`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'move_task':
        if (action.taskId) {
          moveTask(action.taskId, action.newParentId ?? null);
          const destination = action.newParentText ? `under "${action.newParentText}"` : 'to top level';
          setUndoMessage(`Moved task ${destination}`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'add_note':
        if (action.taskId && action.noteText) {
          addTaskNote(action.taskId, action.noteText);
          setUndoMessage(`Added note to "${action.taskText || 'task'}"`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'edit_note':
        if (action.taskId && action.newNoteText && (action.noteId || action.noteText)) {
          if (action.noteId) {
            editTaskNote(action.taskId, action.noteId, action.newNoteText);
          } else {
            // Legacy text-match fallback: find note by text, then use its id
            const matchTask = tasks.flatMap(function findAll(t: Task): Task[] {
              return t.id === action.taskId ? [t] : (t.children || []).flatMap(findAll);
            })[0];
            const matchNote = matchTask?.notes?.find(n => n.text === action.noteText);
            if (matchNote) editTaskNote(action.taskId, matchNote.id, action.newNoteText);
          }
          setUndoMessage(`Updated note on "${action.taskText || 'task'}"`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'delete_note':
        if (action.taskId && (action.noteId || action.noteText)) {
          if (action.noteId) {
            deleteTaskNote(action.taskId, action.noteId);
          } else {
            const matchTask = tasks.flatMap(function findAll(t: Task): Task[] {
              return t.id === action.taskId ? [t] : (t.children || []).flatMap(findAll);
            })[0];
            const matchNote = matchTask?.notes?.find(n => n.text === action.noteText);
            if (matchNote) deleteTaskNote(action.taskId, matchNote.id);
          }
          setUndoMessage(`Deleted note from "${action.taskText || 'task'}"`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      // Habit actions
      case 'add_habit':
        if (action.text) {
          addHabit(action.text, action.repeatIntervalHours || 24);
          setUndoMessage(`Added habit: "${action.text}"`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'delete_habit':
        if (action.habitId) {
          deleteHabit(action.habitId);
          setUndoMessage(`Deleted habit: "${action.habitText || 'habit'}"`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      case 'edit_habit':
        if (action.habitId) {
          if (action.text) {
            updateHabitText(action.habitId, action.text);
          }
          if (action.repeatIntervalHours) {
            updateHabitInterval(action.habitId, action.repeatIntervalHours);
          }
          setUndoMessage(`Updated habit`);
          setShowUndo(true);
          setTimeout(() => setShowUndo(false), 10000);
        }
        break;

      default:
        console.log('Unhandled action:', action);
    }
  };

  // Undo handler
  const handleUndo = () => {
    if (undoState) {
      setHabits(undoState.habits);
      setTasks(undoState.tasks);
      setUndoState(null);
      setShowUndo(false);
    }
  };

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

  return (
    <div className="min-h-screen">
      <div className={`transition-all duration-300 ${chatOpen ? 'mr-0 sm:mr-96' : ''}`}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="bg-tokyo-surface rounded-2xl p-4 mb-3">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-tokyo-blue">CLAWKEEPER</h1>
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tokyo-text-muted"
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
                    placeholder="Search habits & tasks..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-tokyo-text-muted hover:text-tokyo-text"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setChatOpen(true)}
                className="px-3 py-1.5 bg-tokyo-blue-bg text-tokyo-blue text-xs font-semibold rounded-lg hover:text-tokyo-blue-hover transition-colors whitespace-nowrap"
              >
                Plan
              </button>
            </div>
          </div>

          {/* Coach Message */}
          <div className="px-1 mb-5">
            <p className="text-sm text-tokyo-cyan">{coachMessage}</p>
          </div>

        {/* Habits Section */}
        <HabitsSection
          habits={habits}
          currentHour={currentHour}
          searchQuery={searchQuery}
          showCompleted={showCompleted}
          onToggle={toggleHabit}
          onDelete={deleteHabit}
          onUpdateInterval={updateHabitInterval}
          onUpdateText={updateHabitText}
          onAddNote={addHabitNote}
          onEditNote={editHabitNote}
          onDeleteNote={deleteHabitNote}
          onAddHabit={addHabit}
          revealedItem={revealedItem}
          onSetRevealed={setRevealedItem}
        />

        {/* Spacer */}
        <div className="h-5" />

        {/* Tasks Section */}
        <TasksSection
          tasks={tasks}
          searchQuery={searchQuery}
          showCompleted={showCompleted}
          onToggle={toggleTask}
          onAddNote={addTaskNote}
          onEditNote={editTaskNote}
          onDeleteNote={deleteTaskNote}
          onAddSubtask={addSubtask}
          onAddTask={addTask}
          onDelete={deleteTask}
          onUpdateText={updateTaskText}
          onUpdateDueDate={updateTaskDueDate}
          revealedItem={revealedItem}
          onSetRevealed={setRevealedItem}
          onToggleShowCompleted={() => setShowCompleted(!showCompleted)}
        />
        </div>
      </div>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        habits={habits}
        tasks={tasks}
        currentHour={currentHour}
        onAction={handleLLMAction}
      />

      {/* Undo Bar */}
      <UndoBar
        show={showUndo}
        message={undoMessage}
        onUndo={handleUndo}
        onDismiss={() => setShowUndo(false)}
      />

      {/* Splash Screen */}
      {showSplash && <SplashScreen onDismiss={handleDismissSplash} />}

      {/* OpenClaw Setup Prompt (first launch with OpenClaw detected) */}
      {!showSplash && showSetupPrompt && <SetupPrompt onDismiss={dismissSetupPrompt} />}
    </div>
  );
}

export default App;
