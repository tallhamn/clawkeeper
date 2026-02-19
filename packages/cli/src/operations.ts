import type { AppState, Task, Habit, Note } from '@clawkeeper/shared/src/types';
import { generateId, getTodayDate } from '@clawkeeper/shared/src/utils';

// ── Task tree helpers ──

export function findTaskById(tasks: Task[], id: string): Task | null {
  for (const task of tasks) {
    if (task.id === id) return task;
    const found = findTaskById(task.children, id);
    if (found) return found;
  }
  return null;
}

export function findTaskByText(tasks: Task[], text: string): Task | null {
  const lower = text.toLowerCase();
  // First pass: exact matches
  const exact = collectTasks(tasks, t => t.text.toLowerCase() === lower);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(`Multiple tasks match "${text}": ${exact.map(t => `"${t.text}"`).join(', ')}. Be more specific.`);
  }
  // Second pass: substring matches
  const partial = collectTasks(tasks, t => t.text.toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new Error(`Multiple tasks match "${text}": ${partial.map(t => `"${t.text}"`).join(', ')}. Be more specific.`);
  }
  return null;
}

function collectTasks(tasks: Task[], predicate: (t: Task) => boolean): Task[] {
  const results: Task[] = [];
  for (const task of tasks) {
    if (predicate(task)) results.push(task);
    results.push(...collectTasks(task.children, predicate));
  }
  return results;
}

export function updateTaskInTree(tasks: Task[], id: string, updater: (task: Task) => Task): Task[] {
  return tasks.map(task => {
    if (task.id === id) return updater(task);
    return { ...task, children: updateTaskInTree(task.children, id, updater) };
  });
}

export function removeTaskFromTree(tasks: Task[], id: string): Task[] {
  return tasks
    .filter(task => task.id !== id)
    .map(task => ({ ...task, children: removeTaskFromTree(task.children, id) }));
}

function resolveTask(state: AppState, id?: string, text?: string): Task {
  if (id) {
    const task = findTaskById(state.tasks, id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return task;
  }
  if (text) {
    const task = findTaskByText(state.tasks, text);
    if (!task) throw new Error(`Task not found: ${text}`);
    return task;
  }
  throw new Error('Must provide --id or --text');
}

// ── Task operations ──

function filterIncomplete(tasks: Task[]): Task[] {
  return tasks
    .filter(t => !t.completed)
    .map(t => ({ ...t, children: filterIncomplete(t.children || []) }));
}

export function listTasks(state: AppState, all = false): Task[] {
  return all ? state.tasks : filterIncomplete(state.tasks);
}

export function addTask(state: AppState, text: string, dueDate?: string): { state: AppState; task: Task } {
  if (!text) throw new Error('--text is required');
  const task: Task = {
    id: generateId(),
    text,
    completed: false,
    completedAt: null,
    dueDate: dueDate || null,
    notes: [],
    children: [],
  };
  return { state: { ...state, tasks: [...state.tasks, task] }, task };
}

export function addSubtask(state: AppState, parentId: string | undefined, parentText: string | undefined, text: string, dueDate?: string): { state: AppState; task: Task } {
  if (!text) throw new Error('--text is required');
  const parent = resolveTask(state, parentId, parentText);
  const task: Task = {
    id: generateId(),
    text,
    completed: false,
    completedAt: null,
    dueDate: dueDate || null,
    notes: [],
    children: [],
  };
  const tasks = updateTaskInTree(state.tasks, parent.id, t => ({
    ...t,
    children: [...t.children, task],
  }));
  return { state: { ...state, tasks }, task };
}

export function completeTask(state: AppState, id?: string, text?: string): AppState {
  const task = resolveTask(state, id, text);
  if (task.completed) throw new Error('Task is already completed');
  const tasks = updateTaskInTree(state.tasks, task.id, t => ({
    ...t,
    completed: true,
    completedAt: getTodayDate(),
  }));
  return { ...state, tasks };
}

export function uncompleteTask(state: AppState, id?: string, text?: string): AppState {
  const task = resolveTask(state, id, text);
  if (!task.completed) throw new Error('Task is not completed');
  const tasks = updateTaskInTree(state.tasks, task.id, t => ({
    ...t,
    completed: false,
    completedAt: null,
  }));
  return { ...state, tasks };
}

export function editTask(state: AppState, newText: string, id?: string, text?: string, dueDate?: string | null): AppState {
  if (!newText) throw new Error('--text is required for new text');
  const task = resolveTask(state, id, text);
  const tasks = updateTaskInTree(state.tasks, task.id, t => ({
    ...t,
    text: newText,
    ...(dueDate !== undefined ? { dueDate } : {}),
  }));
  return { ...state, tasks };
}

export function setTaskDueDate(state: AppState, dueDate: string | null, id?: string, text?: string): AppState {
  const task = resolveTask(state, id, text);
  const tasks = updateTaskInTree(state.tasks, task.id, t => ({
    ...t,
    dueDate,
  }));
  return { ...state, tasks };
}

export function deleteTask(state: AppState, id?: string, text?: string): AppState {
  const task = resolveTask(state, id, text);
  const tasks = removeTaskFromTree(state.tasks, task.id);
  return { ...state, tasks };
}

export function moveTask(state: AppState, id: string | undefined, text: string | undefined, parentId: string | undefined, root: boolean): AppState {
  const task = resolveTask(state, id, text);
  // Remove from current position
  const withoutTask = removeTaskFromTree(state.tasks, task.id);
  const detached = { ...task, children: task.children };

  if (root) {
    return { ...state, tasks: [...withoutTask, detached] };
  }
  if (parentId) {
    const parent = findTaskById(withoutTask, parentId);
    if (!parent) throw new Error(`Parent task not found: ${parentId}`);
    if (parent.id === task.id) throw new Error('Cannot move task under itself');
    const tasks = updateTaskInTree(withoutTask, parent.id, t => ({
      ...t,
      children: [...t.children, detached],
    }));
    return { ...state, tasks };
  }
  throw new Error('Must provide --parent-id or --root');
}

export function addTaskNote(state: AppState, noteText: string, id?: string, text?: string): AppState {
  if (!noteText) throw new Error('--note is required');
  const task = resolveTask(state, id, text);
  const note: Note = { id: generateId(), text: noteText, createdAt: new Date().toISOString() };
  const tasks = updateTaskInTree(state.tasks, task.id, t => ({
    ...t,
    notes: [...t.notes, note],
  }));
  return { ...state, tasks };
}

function findNoteIndex(notes: Note[], noteId?: string, noteText?: string): number {
  if (noteId) {
    const idx = notes.findIndex(n => n.id === noteId);
    if (idx !== -1) return idx;
  }
  if (noteText) {
    const idx = notes.findIndex(n => n.text === noteText);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function editTaskNote(state: AppState, oldNote: string, newNote: string, id?: string, text?: string, noteId?: string): AppState {
  if (!oldNote && !noteId) throw new Error('--note or --note-id is required');
  if (!newNote) throw new Error('--new-note is required');
  const task = resolveTask(state, id, text);
  const noteIdx = findNoteIndex(task.notes, noteId, oldNote);
  if (noteIdx === -1) throw new Error(`Note not found: ${noteId || oldNote}`);
  const tasks = updateTaskInTree(state.tasks, task.id, t => ({
    ...t,
    notes: t.notes.map((n, i) => i === noteIdx ? { ...n, text: newNote } : n),
  }));
  return { ...state, tasks };
}

export function deleteTaskNote(state: AppState, noteText: string, id?: string, text?: string, noteId?: string): AppState {
  if (!noteText && !noteId) throw new Error('--note or --note-id is required');
  const task = resolveTask(state, id, text);
  const noteIdx = findNoteIndex(task.notes, noteId, noteText);
  if (noteIdx === -1) throw new Error(`Note not found: ${noteId || noteText}`);
  const tasks = updateTaskInTree(state.tasks, task.id, t => ({
    ...t,
    notes: t.notes.filter((_, i) => i !== noteIdx),
  }));
  return { ...state, tasks };
}

// ── Habit helpers ──

function resolveHabit(state: AppState, id?: string, text?: string): Habit {
  if (id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) throw new Error(`Habit not found: ${id}`);
    return habit;
  }
  if (text) {
    const lower = text.toLowerCase();
    // Exact matches
    const exact = state.habits.filter(h => h.text.toLowerCase() === lower);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      throw new Error(`Multiple habits match "${text}": ${exact.map(h => `"${h.text}"`).join(', ')}. Be more specific.`);
    }
    // Substring matches
    const partial = state.habits.filter(h => h.text.toLowerCase().includes(lower));
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) {
      throw new Error(`Multiple habits match "${text}": ${partial.map(h => `"${h.text}"`).join(', ')}. Be more specific.`);
    }
    throw new Error(`Habit not found: ${text}`);
  }
  throw new Error('Must provide --id or --text');
}

// ── Habit operations ──

export function listHabits(state: AppState): Habit[] {
  return state.habits;
}

export function addHabit(state: AppState, text: string, interval: number = 24): { state: AppState; habit: Habit } {
  if (!text) throw new Error('--text is required');
  const habit: Habit = {
    id: generateId(),
    text,
    repeatIntervalHours: interval,
    lastCompleted: null,
    completionHistory: [],
    totalCompletions: 0,
    notes: [],
  };
  return { state: { ...state, habits: [...state.habits, habit] }, habit };
}

export function editHabit(state: AppState, id: string | undefined, text: string | undefined, newText?: string, interval?: number): AppState {
  const habit = resolveHabit(state, id, text);
  const habits = state.habits.map(h => {
    if (h.id !== habit.id) return h;
    return {
      ...h,
      ...(newText !== undefined ? { text: newText } : {}),
      ...(interval !== undefined ? { repeatIntervalHours: interval } : {}),
    };
  });
  return { ...state, habits };
}

export function deleteHabit(state: AppState, id?: string, text?: string): AppState {
  const habit = resolveHabit(state, id, text);
  return { ...state, habits: state.habits.filter(h => h.id !== habit.id) };
}

export function completeHabit(state: AppState, id?: string, text?: string): AppState {
  const habit = resolveHabit(state, id, text);
  const habits = state.habits.map(h => {
    if (h.id !== habit.id) return h;
    const now = new Date().toISOString();
    return {
      ...h,
      lastCompleted: now,
      completionHistory: [...(h.completionHistory || []), now],
      totalCompletions: h.totalCompletions + 1,
      forcedAvailable: false,
    };
  });
  return { ...state, habits };
}

export function addHabitNote(state: AppState, noteText: string, id?: string, text?: string): AppState {
  if (!noteText) throw new Error('--note is required');
  const habit = resolveHabit(state, id, text);
  const note: Note = { id: generateId(), text: noteText, createdAt: new Date().toISOString() };
  const habits = state.habits.map(h => {
    if (h.id !== habit.id) return h;
    return { ...h, notes: [...h.notes, note] };
  });
  return { ...state, habits };
}

export function editHabitNote(state: AppState, oldNote: string, newNote: string, id?: string, text?: string, noteId?: string): AppState {
  if (!oldNote && !noteId) throw new Error('--note or --note-id is required');
  if (!newNote) throw new Error('--new-note is required');
  const habit = resolveHabit(state, id, text);
  const noteIdx = findNoteIndex(habit.notes, noteId, oldNote);
  if (noteIdx === -1) throw new Error(`Note not found: ${noteId || oldNote}`);
  const habits = state.habits.map(h => {
    if (h.id !== habit.id) return h;
    return { ...h, notes: h.notes.map((n, i) => i === noteIdx ? { ...n, text: newNote } : n) };
  });
  return { ...state, habits };
}

export function deleteHabitNote(state: AppState, noteText: string, id?: string, text?: string, noteId?: string): AppState {
  if (!noteText && !noteId) throw new Error('--note or --note-id is required');
  const habit = resolveHabit(state, id, text);
  const noteIdx = findNoteIndex(habit.notes, noteId, noteText);
  if (noteIdx === -1) throw new Error(`Note not found: ${noteId || noteText}`);
  const habits = state.habits.map(h => {
    if (h.id !== habit.id) return h;
    return { ...h, notes: h.notes.filter((_, i) => i !== noteIdx) };
  });
  return { ...state, habits };
}

// ── State operations ──

export function showState(state: AppState): AppState {
  return state;
}
