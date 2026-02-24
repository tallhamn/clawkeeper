import { useState, useEffect, useRef, useCallback } from 'react';
import type { AppState, Task, LLMAction } from '@clawkeeper/shared/src/types';
import { APP_VERSION } from '@clawkeeper/shared/src/constants';
import * as api from './lib/api';
import { useCoachMessage } from './hooks/useCoachMessage';
import { HabitsSection } from './components/HabitsSection';
import { TasksSection } from './components/TasksSection';
import { ChatPanel } from './components/ChatPanel';
import { UndoBar } from './components/UndoBar';
import { SplashScreen } from './components/SplashScreen';
import { SetupPrompt, useSetupPrompt } from './components/SetupPrompt';

function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentHour, setCurrentHour] = useState(() => {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [revealedItem, setRevealedItem] = useState<{
    type: 'habit' | 'task';
    id: string;
    mode: 'reflection' | 'edit' | 'add-subtask' | 'notes';
  } | null>(null);

  // Undo
  const [showUndo, setShowUndo] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();

  // Agents
  const [agents, setAgents] = useState<Array<{ id: string; name?: string }>>([]);

  const { message: coachMessage, triggerReinforcement } = useCoachMessage(
    state?.habits ?? [],
    currentHour
  );
  const { shouldShow: showSetupPrompt, dismiss: dismissSetupPrompt } = useSetupPrompt();

  // Infer preferredHour and icon for habits that lack them
  const inferringRef = useRef(false);
  const inferMetadata = useCallback(async (currentState: AppState) => {
    const missingHours = currentState.habits.filter((h) => h.preferredHour == null);
    const missingIcons = currentState.habits.filter((h) => h.icon == null);
    if ((missingHours.length === 0 && missingIcons.length === 0) || inferringRef.current) return;

    inferringRef.current = true;
    try {
      const [hourResult, iconResult] = await Promise.all([
        missingHours.length > 0 ? api.inferHours(missingHours.map((h) => h.text)) : {},
        missingIcons.length > 0 ? api.inferIcons(missingIcons.map((h) => h.text)) : {},
      ]);

      const hasHours = Object.keys(hourResult).length > 0;
      const hasIcons = Object.keys(iconResult).length > 0;
      if (hasHours || hasIcons) {
        // Apply inferred metadata via API edits
        for (const h of currentState.habits) {
          const newHour = h.preferredHour == null ? hourResult[h.text] : undefined;
          const newIcon = h.icon == null ? iconResult[h.text] : undefined;
          if (newHour != null) {
            await api.adjustPreferredHour(h.id, newHour);
          }
          if (newIcon != null) {
            // Icon is set along with text edit — but we just want to update the icon
            // For now, refetch state after all updates
          }
        }
        const refreshed = await api.fetchState();
        setState(refreshed);
      }
    } catch {
      // Inference failed, no big deal
    } finally {
      inferringRef.current = false;
    }
  }, []);

  // Splash screen check
  useEffect(() => {
    try {
      const lastSeenVersion = localStorage.getItem('clawkeeper_last_seen_version');
      if (lastSeenVersion !== APP_VERSION) {
        setShowSplash(true);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const handleDismissSplash = () => {
    try {
      localStorage.setItem('clawkeeper_last_seen_version', APP_VERSION);
    } catch {
      // localStorage not available
    }
    setShowSplash(false);
  };

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
        .catch(() => {});
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

  // Infer metadata after initial load
  useEffect(() => {
    if (!isLoading && state && state.habits.length > 0) {
      inferMetadata(state);
    }
  }, [isLoading]); // Only on initial load

  // Load agents once
  useEffect(() => {
    api.fetchAgents().then(setAgents).catch(() => {});
  }, []);

  // Mutate helper: calls API, updates state, shows undo
  const mutate = useCallback((message: string, action: () => Promise<AppState>) => {
    setUndoMessage(message);
    setShowUndo(true);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 10000);
    action()
      .then((newState) => setState(newState))
      .catch((err) => setError(err.message));
  }, []);

  // Silent mutate (no undo bar)
  const silentMutate = useCallback((action: () => Promise<AppState>) => {
    action()
      .then((newState) => setState(newState))
      .catch((err) => setError(err.message));
  }, []);

  const handleUndo = useCallback(() => {
    api.undo()
      .then((newState) => setState(newState))
      .catch(() => {});
    setShowUndo(false);
  }, []);

  // Habit handlers
  const handleHabitToggle = useCallback((id: string, action?: 'complete' | 'wakeup' | 'skip') => {
    const habit = state?.habits.find((h) => h.id === id);
    if (!habit) return;

    if (action === 'skip') {
      mutate(`Skipped "${habit.text}"`, () => api.skipHabit(id));
    } else if (action === 'wakeup') {
      mutate(`Woke up "${habit.text}"`, () => api.wakeupHabit(id));
    } else {
      mutate(`Completed "${habit.text}"`, () => api.completeHabit(id));
      triggerReinforcement(habit.text, habit.totalCompletions);
    }
  }, [state, mutate, triggerReinforcement]);

  // Task handlers
  const handleTaskToggle = useCallback((id: string) => {
    if (!state) return;
    const findTask = (tasks: Task[], targetId: string): Task | null => {
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
      mutate(`Uncompleted: "${task.text}"`, () => api.uncompleteTask(id));
    } else {
      mutate(`Completed: "${task.text}"`, () => api.completeTask(id));
    }
  }, [state, mutate]);

  // Handle LLM actions from chat panel
  const handleLLMAction = useCallback((action: LLMAction) => {
    switch (action.type) {
      case 'add_task':
        if (action.text) {
          mutate(`Added task: "${action.text}"`, () => api.addTask(action.text!, action.dueDate ?? undefined));
        }
        break;
      case 'add_subtask':
        if (action.parentId && action.text) {
          mutate(`Added subtask: "${action.text}"`, () => api.addSubtask(action.parentId!, action.text!));
        }
        break;
      case 'complete_task':
        if (action.taskId) {
          mutate(`Checked off: "${action.taskText || 'task'}"`, () => api.completeTask(action.taskId!));
        }
        break;
      case 'uncomplete_task':
        if (action.taskId) {
          mutate(`Unchecked: "${action.taskText || 'task'}"`, () => api.uncompleteTask(action.taskId!));
        }
        break;
      case 'delete_task':
        if (action.taskId) {
          mutate(`Deleted task: "${action.taskText || 'task'}"`, () => api.deleteTask(action.taskId!));
        }
        break;
      case 'edit_task':
        if (action.taskId && action.text) {
          mutate(`Updated task`, () => api.editTask(action.taskId!, action.text!, action.dueDate));
        }
        break;
      case 'add_note':
        if (action.taskId && action.noteText) {
          mutate(`Added note to "${action.taskText || 'task'}"`, () => api.addTaskNote(action.taskId!, action.noteText!));
        }
        break;
      case 'edit_note':
        if (action.taskId && action.noteId && action.newNoteText) {
          mutate(`Updated note`, () => api.editTaskNote(action.taskId!, action.noteId!, action.newNoteText!));
        }
        break;
      case 'delete_note':
        if (action.taskId && action.noteId) {
          mutate(`Deleted note`, () => api.deleteTaskNote(action.taskId!, action.noteId!));
        }
        break;
      case 'add_habit':
        if (action.text) {
          mutate(`Added habit: "${action.text}"`, () => api.addHabit(action.text!, action.repeatIntervalHours || 24));
        }
        break;
      case 'delete_habit':
        if (action.habitId) {
          mutate(`Deleted habit: "${action.habitText || 'habit'}"`, () => api.deleteHabit(action.habitId!));
        }
        break;
      case 'edit_habit':
        if (action.habitId) {
          mutate(`Updated habit`, () => api.editHabit(action.habitId!, action.text, action.repeatIntervalHours));
        }
        break;
      default:
        break;
    }
  }, [mutate]);

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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-tokyo-text-muted active:text-tokyo-text"
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
                className="px-3 py-1.5 bg-tokyo-blue-bg text-tokyo-blue text-xs font-semibold rounded-lg active:text-tokyo-blue-hover transition-colors whitespace-nowrap"
              >
                Chat
              </button>
            </div>
          </div>

          {/* Coach Message */}
          {coachMessage && (
            <div className="px-1 mb-5">
              <p className="text-sm text-tokyo-cyan">{coachMessage}</p>
            </div>
          )}

          {/* Habits Section */}
          <HabitsSection
            habits={state.habits}
            currentHour={currentHour}
            searchQuery={searchQuery}
            onToggle={handleHabitToggle}
            onDelete={(id) => mutate('Deleted habit', () => api.deleteHabit(id))}
            onUpdateInterval={(id, hours) => silentMutate(() => api.editHabit(id, undefined, hours))}
            onUpdateText={(id, text) => silentMutate(() => api.editHabit(id, text))}
            onAddNote={(id, text) => silentMutate(() => api.addHabitNote(id, text))}
            onEditNote={(id, noteId, text) => silentMutate(() => api.editHabitNote(id, noteId, text))}
            onDeleteNote={(id, noteId) => silentMutate(() => api.deleteHabitNote(id, noteId))}
            onAddHabit={(text, hours) => mutate(`Added habit: "${text}"`, () => api.addHabit(text, hours))}
            onAdjustPreferredHour={(id, hour) => silentMutate(() => api.adjustPreferredHour(id, hour))}
            onAdjustCompletionTime={(id, ts, hour) => silentMutate(() => api.adjustCompletionTime(id, ts, hour))}
            agents={agents}
            onAssignAgent={(id, agentId) => silentMutate(() => api.assignHabitAgent(id, agentId))}
            onUnassignAgent={(id) => silentMutate(() => api.unassignHabitAgent(id))}
            revealedItem={revealedItem}
            onSetRevealed={setRevealedItem}
          />

          <div className="h-5" />

          {/* Tasks Section */}
          <TasksSection
            tasks={state.tasks}
            searchQuery={searchQuery}
            showCompleted={showCompleted}
            onToggle={handleTaskToggle}
            onAddNote={(id, text) => silentMutate(() => api.addTaskNote(id, text))}
            onEditNote={(id, noteId, text) => silentMutate(() => api.editTaskNote(id, noteId, text))}
            onDeleteNote={(id, noteId) => silentMutate(() => api.deleteTaskNote(id, noteId))}
            onAddSubtask={(parentId, text) => mutate(`Added subtask: "${text}"`, () => api.addSubtask(parentId, text))}
            onAddTask={(text) => mutate(`Added task: "${text}"`, () => api.addTask(text))}
            onDelete={(id) => mutate('Deleted task', () => api.deleteTask(id))}
            onUpdateText={(id, text) => silentMutate(() => api.editTask(id, text))}
            onUpdateDueDate={(id, dueDate) => silentMutate(() => api.setTaskDueDate(id, dueDate))}
            onUpdateAgent={(id, agentId) => {
              if (agentId) silentMutate(() => api.assignTaskAgent(id, agentId));
              else silentMutate(() => api.unassignTaskAgent(id));
            }}
            allAgents={agents}
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
        habits={state.habits}
        tasks={state.tasks}
        currentHour={currentHour}
        onAction={handleLLMAction}
        agents={agents}
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

      {/* Setup Prompt */}
      {!showSplash && showSetupPrompt && <SetupPrompt onDismiss={dismissSetupPrompt} />}
    </div>
  );
}

export default App;
