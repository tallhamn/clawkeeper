import type { AppState } from '@clawkeeper/shared/src/types';
import { updateTaskInTree, findTaskById, findTaskByText } from './operations';

export function assignAgent(state: AppState, agentId: string, type: string, id?: string, text?: string): AppState {
  if (type === 'habit') {
    const habit = resolveHabit(state, id, text);
    const habits = state.habits.map(h =>
      h.id === habit.id ? { ...h, agentId } : h
    );
    return { ...state, habits };
  }

  if (type === 'task') {
    const task = resolveTask(state, id, text);
    const tasks = updateTaskInTree(state.tasks, task.id, t => ({ ...t, agentId }));
    return { ...state, tasks };
  }

  throw new Error(`Unknown type: ${type}. Expected: habit, task`);
}

export function unassignAgent(state: AppState, type: string, id?: string, text?: string): AppState {
  if (type === 'habit') {
    const habit = resolveHabit(state, id, text);
    const habits = state.habits.map(h => {
      if (h.id !== habit.id) return h;
      const { agentId: _, ...rest } = h;
      return rest;
    });
    return { ...state, habits };
  }

  if (type === 'task') {
    const task = resolveTask(state, id, text);
    const tasks = updateTaskInTree(state.tasks, task.id, t => {
      const { agentId: _, ...rest } = t;
      return { ...rest, children: t.children };
    });
    return { ...state, tasks };
  }

  throw new Error(`Unknown type: ${type}. Expected: habit, task`);
}

function resolveHabit(state: AppState, id?: string, text?: string) {
  if (id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) throw new Error(`Habit not found: ${id}`);
    return habit;
  }
  if (text) {
    const lower = text.toLowerCase();
    const exact = state.habits.filter(h => h.text.toLowerCase() === lower);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      throw new Error(`Multiple habits match "${text}": ${exact.map(h => `"${h.text}"`).join(', ')}. Be more specific.`);
    }
    const partial = state.habits.filter(h => h.text.toLowerCase().includes(lower));
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) {
      throw new Error(`Multiple habits match "${text}": ${partial.map(h => `"${h.text}"`).join(', ')}. Be more specific.`);
    }
    throw new Error(`Habit not found: ${text}`);
  }
  throw new Error('Must provide --id or --text');
}

function resolveTask(state: AppState, id?: string, text?: string) {
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
