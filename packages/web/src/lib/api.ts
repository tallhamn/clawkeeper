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
export const editHabitNote = (id: string, noteId: string, newNote: string) => post('/api/habit/edit-note', { id, noteId, newNote });
export const deleteHabitNote = (id: string, noteId: string) => post('/api/habit/delete-note', { id, noteId });
export const skipHabit = (id: string) => post('/api/habit/skip', { id });
export const wakeupHabit = (id: string) => post('/api/habit/wakeup', { id });
export const assignHabitAgent = (id: string, agentId: string) => post('/api/habit/assign-agent', { id, agentId });
export const unassignHabitAgent = (id: string) => post('/api/habit/unassign-agent', { id });
export const adjustPreferredHour = (id: string, hour: number) => post('/api/habit/adjust-preferred-hour', { id, hour });
export const adjustCompletionTime = (id: string, timestamp: string, hour: number) => post('/api/habit/adjust-completion-time', { id, timestamp, hour });

// Task actions
export const addTask = (text: string, dueDate?: string) => post('/api/task/add', { text, dueDate });
export const completeTask = (id: string) => post('/api/task/complete', { id });
export const uncompleteTask = (id: string) => post('/api/task/uncomplete', { id });
export const deleteTask = (id: string) => post('/api/task/delete', { id });
export const editTask = (id: string, text: string, dueDate?: string | null) => post('/api/task/edit', { id, text, dueDate });
export const setTaskDueDate = (id: string, dueDate: string | null) => post('/api/task/set-due-date', { id, dueDate });
export const addSubtask = (parentId: string, text: string) => post('/api/task/add-subtask', { parentId, text });
export const addTaskNote = (id: string, text: string) => post('/api/task/add-note', { id, text });
export const editTaskNote = (id: string, noteId: string, newNote: string) => post('/api/task/edit-note', { id, noteId, newNote });
export const deleteTaskNote = (id: string, noteId: string) => post('/api/task/delete-note', { id, noteId });
export const assignTaskAgent = (id: string, agentId: string) => post('/api/task/assign-agent', { id, agentId });
export const unassignTaskAgent = (id: string) => post('/api/task/unassign-agent', { id });

// General actions
export const undo = () => post('/api/undo');

export async function fetchAgents(): Promise<Array<{ id: string; name?: string }>> {
  const res = await fetch('/api/agents');
  if (!res.ok) return [];
  return res.json();
}

// AI actions
export async function* streamChat(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  agentId?: string
): AsyncGenerator<string, void, unknown> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, messages, agentId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Chat request failed' }));
    throw new Error(err.error || 'Chat request failed');
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function fetchCoachMessage(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  agentId?: string
): Promise<string> {
  const res = await fetch('/api/coach-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, messages, agentId }),
  });
  if (!res.ok) throw new Error('Coach message request failed');
  const data = await res.json();
  return data.text || '';
}

export async function inferHours(habitTexts: string[]): Promise<Record<string, number>> {
  const res = await fetch('/api/infer-hours', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habitTexts }),
  });
  if (!res.ok) return {};
  return res.json();
}

export async function inferIcons(habitTexts: string[]): Promise<Record<string, string>> {
  const res = await fetch('/api/infer-icons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habitTexts }),
  });
  if (!res.ok) return {};
  return res.json();
}
