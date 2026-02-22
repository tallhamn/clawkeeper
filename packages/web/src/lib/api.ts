import type { AppState } from '@clawkeeper/shared/src/types';

async function post(url: string, body: Record<string, unknown> = {}): Promise<AppState> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export async function fetchState(): Promise<AppState> {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error('Failed to fetch state');
  return res.json();
}

// Habit actions
export const completeHabit = (id: string) => post('/api/habit/complete', { id });
export const addHabit = (text: string, intervalHours: number) => post('/api/habit/add', { text, intervalHours });
export const deleteHabit = (id: string) => post('/api/habit/delete', { id });
export const editHabit = (id: string, text?: string, intervalHours?: number) => post('/api/habit/edit', { id, text, intervalHours });
export const addHabitNote = (id: string, text: string) => post('/api/habit/add-note', { id, text });

// Task actions
export const addTask = (text: string, dueDate?: string) => post('/api/task/add', { text, dueDate });
export const completeTask = (id: string) => post('/api/task/complete', { id });
export const uncompleteTask = (id: string) => post('/api/task/uncomplete', { id });
export const deleteTask = (id: string) => post('/api/task/delete', { id });
export const editTask = (id: string, text: string, dueDate?: string | null) => post('/api/task/edit', { id, text, dueDate });
export const setTaskDueDate = (id: string, dueDate: string | null) => post('/api/task/set-due-date', { id, dueDate });
export const addSubtask = (parentId: string, text: string) => post('/api/task/add-subtask', { parentId, text });
export const addTaskNote = (id: string, text: string) => post('/api/task/add-note', { id, text });
