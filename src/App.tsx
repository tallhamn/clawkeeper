import { useState, useEffect } from 'react';
import type { Habit, Task, LLMAction, AppState } from '@/lib/types';
import { generateId, getTodayDate } from '@/lib/utils';
import { useCoachMessage } from '@/hooks/useCoachMessage';
import { HabitsSection } from '@/components/HabitsSection';
import { TasksSection } from '@/components/TasksSection';
import { ChatPanel } from '@/components/ChatPanel';
import { UndoBar } from '@/components/UndoBar';
import { initializeStorage, isInitialized, loadCurrentState, saveCurrentState, archiveOldCompletedTasks, getDefaultState } from '@/lib/storage';

function App() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [chatOpen, setChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Track which element is currently revealed (reflection input, edit controls, etc.)
  const [revealedItem, setRevealedItem] = useState<{ type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'view-reflections' | 'add-subtask' } | null>(null);

  // Undo functionality
  const [undoState, setUndoState] = useState<AppState | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');

  const { message: coachMessage, triggerReinforcement } = useCoachMessage(habits, currentHour);

  // Initialize storage and load data on mount
  useEffect(() => {
    const initApp = async () => {
      console.log('[Storage] Starting initialization...');
      try {
        console.log('[Storage] Creating directory structure...');
        await initializeStorage();
        console.log('[Storage] Checking if initialized...');
        const initialized = await isInitialized();
        console.log('[Storage] Is initialized:', initialized);

        if (initialized) {
          console.log('[Storage] Loading existing state...');
          const state = await loadCurrentState();
          if (state) {
            console.log('[Storage] Loaded state:', {
              habits: state.habits.length,
              tasks: state.tasks.length
            });

            // Archive old completed tasks
            console.log('[Storage] Archiving old completed tasks...');
            const archivedState = await archiveOldCompletedTasks(state);

            setHabits(archivedState.habits);
            setTasks(archivedState.tasks);
          }
        } else {
          // First launch: use default data
          console.log('[Storage] First launch - using default data');
          const defaultState = getDefaultState();
          setHabits(defaultState.habits);
          setTasks(defaultState.tasks);
          console.log('[Storage] Saving initial state...');
          await saveCurrentState(defaultState);
          console.log('[Storage] Initial state saved');
        }
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
  }, []);

  // Auto-save when habits or tasks change
  useEffect(() => {
    if (!isLoading && (habits.length > 0 || tasks.length > 0)) {
      saveCurrentState({ habits, tasks }).catch((error) => {
        console.error('Failed to save state:', error);
      });
    }
  }, [habits, tasks, isLoading]);

  // Update current hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Habit handlers
  const toggleHabit = (id: string) => {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;

    const now = new Date().toISOString();

    // With "+" model, always increment totalCompletions and update lastCompleted
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              lastCompleted: now,
              totalCompletions: h.totalCompletions + 1,
            }
          : h
      )
    );
    triggerReinforcement(habit.text, habit.totalCompletions);
  };

  const deleteHabit = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  };

  const updateHabitInterval = (id: string, intervalHours: number) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, repeatIntervalHours: intervalHours } : h)));
  };

  const updateHabitText = (id: string, text: string) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, text } : h)));
  };

  const addHabitReflection = (id: string, reflection: string) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, reflections: [...(h.reflections || []), reflection] } : h))
    );
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
          repeatIntervalHours: intervalHours,
          reflections: [],
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
    setTasks((prev) =>
      findAndUpdate(prev, id, (t) => ({
        ...t,
        completed: !t.completed,
        completedAt: !t.completed ? getTodayDate() : null,
      }))
    );
  };

  const addTaskReflection = (id: string, reflection: string) => {
    setTasks((prev) => findAndUpdate(prev, id, (t) => ({ ...t, reflections: [...(t.reflections || []), reflection] })));
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
          reflections: [],
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
            reflections: [],
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

  // Handle LLM actions
  const handleLLMAction = (action: LLMAction) => {
    // Save current state for undo
    setUndoState({ habits, tasks });

    switch (action.type) {
      // Task actions
      case 'add_task':
        if (action.text) {
          addTask(action.text);
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
          setUndoMessage(`Updated task text`);
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
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-stone-600">Loading Welltime...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className={`transition-all duration-300 ${chatOpen ? 'mr-0 sm:mr-96' : ''}`}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-stone-800">WELLTIME</h1>
              <div className="flex-1 max-w-md">
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
                    placeholder="Search habits & tasks..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-kyoto-red focus:bg-white transition-colors"
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
              </div>
              <button
                onClick={() => setChatOpen(true)}
                className="px-3 py-1.5 bg-kyoto-light text-kyoto-red text-xs font-semibold rounded-lg hover:bg-kyoto-medium transition-colors whitespace-nowrap"
              >
                Plan
              </button>
            </div>
          </div>

          {/* Coach Message */}
          <div className="px-1 mb-5">
            <p className="text-sm text-stone-600">{coachMessage}</p>
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
          onAddReflection={addHabitReflection}
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
          onAddReflection={addTaskReflection}
          onAddSubtask={addSubtask}
          onAddTask={addTask}
          onDelete={deleteTask}
          onUpdateText={updateTaskText}
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
    </div>
  );
}

export default App;
