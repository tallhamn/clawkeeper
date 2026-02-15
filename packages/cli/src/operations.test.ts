import { describe, it, expect } from 'vitest';
import type { AppState, Task, Habit } from '@clawkeeper/shared/src/types';
import {
  findTaskById,
  findTaskByText,
  updateTaskInTree,
  removeTaskFromTree,
  listTasks,
  addTask,
  addSubtask,
  completeTask,
  uncompleteTask,
  editTask,
  deleteTask,
  moveTask,
  addTaskNote,
  editTaskNote,
  deleteTaskNote,
  listHabits,
  addHabit,
  editHabit,
  deleteHabit,
  completeHabit,
  addHabitNote,
  showState,
} from './operations';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    text: 'Test task',
    completed: false,
    completedAt: null,
    notes: [],
    children: [],
    ...overrides,
  };
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    text: 'Test habit',
    repeatIntervalHours: 24,
    lastCompleted: null,
    totalCompletions: 0,
    notes: [],
    ...overrides,
  };
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  return { habits: [], tasks: [], ...overrides };
}

// ── Tree helpers ──

describe('findTaskById', () => {
  it('finds a root task', () => {
    const task = makeTask({ id: 'a' });
    expect(findTaskById([task], 'a')).toBe(task);
  });

  it('finds a nested task', () => {
    const child = makeTask({ id: 'child' });
    const parent = makeTask({ id: 'parent', children: [child] });
    expect(findTaskById([parent], 'child')).toBe(child);
  });

  it('returns null for missing id', () => {
    expect(findTaskById([makeTask()], 'nope')).toBeNull();
  });
});

describe('findTaskByText', () => {
  it('finds by exact match (case-insensitive)', () => {
    const task = makeTask({ text: 'Buy Groceries' });
    expect(findTaskByText([task], 'buy groceries')).toBe(task);
  });

  it('finds by substring match', () => {
    const task = makeTask({ text: 'Buy groceries for dinner' });
    expect(findTaskByText([task], 'groceries')).toBe(task);
  });

  it('prefers exact match over substring', () => {
    const exact = makeTask({ id: 'exact', text: 'groceries' });
    const substring = makeTask({ id: 'sub', text: 'Buy groceries' });
    expect(findTaskByText([substring, exact], 'groceries')?.id).toBe('exact');
  });

  it('finds nested tasks by text', () => {
    const child = makeTask({ id: 'child', text: 'Nested item' });
    const parent = makeTask({ id: 'parent', children: [child] });
    expect(findTaskByText([parent], 'nested item')).toBe(child);
  });

  it('returns null for no match', () => {
    expect(findTaskByText([makeTask()], 'nope')).toBeNull();
  });

  it('throws on ambiguous substring match', () => {
    const t1 = makeTask({ id: '1', text: 'Buy groceries' });
    const t2 = makeTask({ id: '2', text: 'Return groceries' });
    expect(() => findTaskByText([t1, t2], 'groceries')).toThrow('Multiple tasks match');
  });

  it('throws on ambiguous exact match (e.g. duplicates)', () => {
    const t1 = makeTask({ id: '1', text: 'Groceries' });
    const t2 = makeTask({ id: '2', text: 'Groceries' });
    expect(() => findTaskByText([t1, t2], 'groceries')).toThrow('Multiple tasks match');
  });

  it('exact match wins even when multiple substring matches exist', () => {
    const exact = makeTask({ id: 'exact', text: 'groceries' });
    const sub1 = makeTask({ id: 's1', text: 'Buy groceries' });
    const sub2 = makeTask({ id: 's2', text: 'Return groceries' });
    expect(findTaskByText([sub1, exact, sub2], 'groceries')?.id).toBe('exact');
  });
});

describe('updateTaskInTree', () => {
  it('updates a root task', () => {
    const task = makeTask({ id: 'a', text: 'old' });
    const result = updateTaskInTree([task], 'a', t => ({ ...t, text: 'new' }));
    expect(result[0].text).toBe('new');
  });

  it('updates a nested task', () => {
    const child = makeTask({ id: 'child', text: 'old' });
    const parent = makeTask({ id: 'parent', children: [child] });
    const result = updateTaskInTree([parent], 'child', t => ({ ...t, text: 'new' }));
    expect(result[0].children[0].text).toBe('new');
  });
});

describe('removeTaskFromTree', () => {
  it('removes a root task', () => {
    const result = removeTaskFromTree([makeTask({ id: 'a' }), makeTask({ id: 'b' })], 'a');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('removes a nested task', () => {
    const child = makeTask({ id: 'child' });
    const parent = makeTask({ id: 'parent', children: [child] });
    const result = removeTaskFromTree([parent], 'child');
    expect(result[0].children).toHaveLength(0);
  });
});

// ── Task operations ──

describe('listTasks', () => {
  it('returns all tasks', () => {
    const state = makeState({ tasks: [makeTask()] });
    expect(listTasks(state)).toEqual(state.tasks);
  });
});

describe('addTask', () => {
  it('adds a task to empty state', () => {
    const { state, task } = addTask(makeState(), 'New task');
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].text).toBe('New task');
    expect(task.text).toBe('New task');
    expect(task.completed).toBe(false);
    expect(task.id).toBeTruthy();
  });

  it('appends to existing tasks', () => {
    const initial = makeState({ tasks: [makeTask()] });
    const { state } = addTask(initial, 'Second');
    expect(state.tasks).toHaveLength(2);
  });

  it('throws on empty text', () => {
    expect(() => addTask(makeState(), '')).toThrow('--text is required');
  });
});

describe('addSubtask', () => {
  it('adds a subtask by parent id', () => {
    const parent = makeTask({ id: 'p1' });
    const initial = makeState({ tasks: [parent] });
    const { state, task } = addSubtask(initial, 'p1', undefined, 'Child task');
    expect(state.tasks[0].children).toHaveLength(1);
    expect(state.tasks[0].children[0].text).toBe('Child task');
    expect(task.text).toBe('Child task');
  });

  it('adds a subtask by parent text', () => {
    const parent = makeTask({ id: 'p1', text: 'Parent' });
    const initial = makeState({ tasks: [parent] });
    const { state } = addSubtask(initial, undefined, 'Parent', 'Child');
    expect(state.tasks[0].children).toHaveLength(1);
  });

  it('throws if parent not found', () => {
    expect(() => addSubtask(makeState(), 'nope', undefined, 'x')).toThrow('Task not found');
  });

  it('throws on empty text', () => {
    const initial = makeState({ tasks: [makeTask({ id: 'p' })] });
    expect(() => addSubtask(initial, 'p', undefined, '')).toThrow('--text is required');
  });
});

describe('completeTask', () => {
  it('completes a task by id', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' })] });
    const state = completeTask(initial, 't1');
    expect(state.tasks[0].completed).toBe(true);
    expect(state.tasks[0].completedAt).toBeTruthy();
  });

  it('completes a task by text', () => {
    const initial = makeState({ tasks: [makeTask({ text: 'Do it' })] });
    const state = completeTask(initial, undefined, 'do it');
    expect(state.tasks[0].completed).toBe(true);
  });

  it('throws if already completed', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1', completed: true })] });
    expect(() => completeTask(initial, 't1')).toThrow('already completed');
  });

  it('throws if task not found', () => {
    expect(() => completeTask(makeState(), 'nope')).toThrow('Task not found');
  });
});

describe('uncompleteTask', () => {
  it('uncompletes a task', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1', completed: true, completedAt: '2025-01-01' })] });
    const state = uncompleteTask(initial, 't1');
    expect(state.tasks[0].completed).toBe(false);
    expect(state.tasks[0].completedAt).toBeNull();
  });

  it('throws if not completed', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' })] });
    expect(() => uncompleteTask(initial, 't1')).toThrow('not completed');
  });
});

describe('editTask', () => {
  it('edits task text by id', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1', text: 'old' })] });
    const state = editTask(initial, 'new text', 't1');
    expect(state.tasks[0].text).toBe('new text');
  });

  it('edits task found by text', () => {
    const initial = makeState({ tasks: [makeTask({ text: 'old text' })] });
    const state = editTask(initial, 'new text', undefined, 'old text');
    expect(state.tasks[0].text).toBe('new text');
  });

  it('throws on empty new text', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' })] });
    expect(() => editTask(initial, '', 't1')).toThrow('--text is required');
  });
});

describe('deleteTask', () => {
  it('deletes a task by id', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' }), makeTask({ id: 't2' })] });
    const state = deleteTask(initial, 't1');
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe('t2');
  });

  it('deletes a nested task', () => {
    const child = makeTask({ id: 'child' });
    const parent = makeTask({ id: 'parent', children: [child] });
    const initial = makeState({ tasks: [parent] });
    const state = deleteTask(initial, 'child');
    expect(state.tasks[0].children).toHaveLength(0);
  });

  it('throws if not found', () => {
    expect(() => deleteTask(makeState(), 'nope')).toThrow('Task not found');
  });
});

describe('moveTask', () => {
  it('moves task to root', () => {
    const child = makeTask({ id: 'child', text: 'Child' });
    const parent = makeTask({ id: 'parent', children: [child] });
    const initial = makeState({ tasks: [parent] });
    const state = moveTask(initial, 'child', undefined, undefined, true);
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks[0].children).toHaveLength(0);
    expect(state.tasks[1].id).toBe('child');
  });

  it('moves task under a new parent', () => {
    const t1 = makeTask({ id: 't1', text: 'Task 1' });
    const t2 = makeTask({ id: 't2', text: 'Task 2' });
    const initial = makeState({ tasks: [t1, t2] });
    const state = moveTask(initial, 't1', undefined, 't2', false);
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe('t2');
    expect(state.tasks[0].children).toHaveLength(1);
    expect(state.tasks[0].children[0].id).toBe('t1');
  });

  it('throws if no destination given', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' })] });
    expect(() => moveTask(initial, 't1', undefined, undefined, false)).toThrow('--parent-id or --root');
  });

  it('throws if parent not found', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' })] });
    expect(() => moveTask(initial, 't1', undefined, 'nope', false)).toThrow('Parent task not found');
  });
});

describe('addTaskNote', () => {
  it('adds a note to a task', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' })] });
    const state = addTaskNote(initial, 'My note', 't1');
    expect(state.tasks[0].notes).toHaveLength(1);
    expect(state.tasks[0].notes[0].text).toBe('My note');
    expect(state.tasks[0].notes[0].createdAt).toBeTruthy();
  });

  it('throws on empty note', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' })] });
    expect(() => addTaskNote(initial, '', 't1')).toThrow('--note is required');
  });
});

describe('editTaskNote', () => {
  it('edits an existing note', () => {
    const task = makeTask({ id: 't1', notes: [{ text: 'old note', createdAt: '2025-01-01' }] });
    const initial = makeState({ tasks: [task] });
    const state = editTaskNote(initial, 'old note', 'new note', 't1');
    expect(state.tasks[0].notes[0].text).toBe('new note');
    expect(state.tasks[0].notes[0].createdAt).toBe('2025-01-01');
  });

  it('throws if note not found', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' })] });
    expect(() => editTaskNote(initial, 'nope', 'new', 't1')).toThrow('Note not found');
  });
});

describe('deleteTaskNote', () => {
  it('deletes a note', () => {
    const task = makeTask({ id: 't1', notes: [{ text: 'to delete', createdAt: '2025-01-01' }] });
    const initial = makeState({ tasks: [task] });
    const state = deleteTaskNote(initial, 'to delete', 't1');
    expect(state.tasks[0].notes).toHaveLength(0);
  });

  it('throws if note not found', () => {
    const initial = makeState({ tasks: [makeTask({ id: 't1' })] });
    expect(() => deleteTaskNote(initial, 'nope', 't1')).toThrow('Note not found');
  });
});

// ── Habit operations ──

describe('listHabits', () => {
  it('returns all habits', () => {
    const state = makeState({ habits: [makeHabit()] });
    expect(listHabits(state)).toEqual(state.habits);
  });
});

describe('addHabit', () => {
  it('adds a habit with default interval', () => {
    const { state, habit } = addHabit(makeState(), 'Meditate');
    expect(state.habits).toHaveLength(1);
    expect(habit.text).toBe('Meditate');
    expect(habit.repeatIntervalHours).toBe(24);
    expect(habit.totalCompletions).toBe(0);
  });

  it('adds a habit with custom interval', () => {
    const { habit } = addHabit(makeState(), 'Drink water', 4);
    expect(habit.repeatIntervalHours).toBe(4);
  });

  it('throws on empty text', () => {
    expect(() => addHabit(makeState(), '')).toThrow('--text is required');
  });
});

describe('editHabit', () => {
  it('edits habit text by id', () => {
    const initial = makeState({ habits: [makeHabit({ id: 'h1', text: 'old' })] });
    const state = editHabit(initial, 'h1', undefined, 'new text');
    expect(state.habits[0].text).toBe('new text');
  });

  it('edits habit interval', () => {
    const initial = makeState({ habits: [makeHabit({ id: 'h1' })] });
    const state = editHabit(initial, 'h1', undefined, undefined, 12);
    expect(state.habits[0].repeatIntervalHours).toBe(12);
  });

  it('edits both text and interval', () => {
    const initial = makeState({ habits: [makeHabit({ id: 'h1', text: 'old' })] });
    const state = editHabit(initial, 'h1', undefined, 'new', 8);
    expect(state.habits[0].text).toBe('new');
    expect(state.habits[0].repeatIntervalHours).toBe(8);
  });

  it('finds habit by text', () => {
    const initial = makeState({ habits: [makeHabit({ text: 'Meditate' })] });
    const state = editHabit(initial, undefined, 'meditate', 'New meditation');
    expect(state.habits[0].text).toBe('New meditation');
  });

  it('throws if habit not found', () => {
    expect(() => editHabit(makeState(), 'nope', undefined)).toThrow('Habit not found');
  });

  it('throws on ambiguous habit text match', () => {
    const initial = makeState({ habits: [
      makeHabit({ id: 'h1', text: 'Morning meditation' }),
      makeHabit({ id: 'h2', text: 'Evening meditation' }),
    ]});
    expect(() => editHabit(initial, undefined, 'meditation', 'New')).toThrow('Multiple habits match');
  });
});

describe('deleteHabit', () => {
  it('deletes a habit by id', () => {
    const initial = makeState({ habits: [makeHabit({ id: 'h1' }), makeHabit({ id: 'h2' })] });
    const state = deleteHabit(initial, 'h1');
    expect(state.habits).toHaveLength(1);
    expect(state.habits[0].id).toBe('h2');
  });

  it('deletes by text match', () => {
    const initial = makeState({ habits: [makeHabit({ text: 'Meditate' })] });
    const state = deleteHabit(initial, undefined, 'meditate');
    expect(state.habits).toHaveLength(0);
  });

  it('throws if not found', () => {
    expect(() => deleteHabit(makeState(), 'nope')).toThrow('Habit not found');
  });
});

describe('completeHabit', () => {
  it('completes a habit', () => {
    const initial = makeState({ habits: [makeHabit({ id: 'h1', totalCompletions: 5 })] });
    const state = completeHabit(initial, 'h1');
    expect(state.habits[0].lastCompleted).toBeTruthy();
    expect(state.habits[0].totalCompletions).toBe(6);
  });

  it('clears forcedAvailable on complete', () => {
    const initial = makeState({ habits: [makeHabit({ id: 'h1', forcedAvailable: true })] });
    const state = completeHabit(initial, 'h1');
    expect(state.habits[0].forcedAvailable).toBe(false);
  });
});

describe('addHabitNote', () => {
  it('adds a note to a habit', () => {
    const initial = makeState({ habits: [makeHabit({ id: 'h1' })] });
    const state = addHabitNote(initial, 'My note', 'h1');
    expect(state.habits[0].notes).toHaveLength(1);
    expect(state.habits[0].notes[0].text).toBe('My note');
  });

  it('throws on empty note', () => {
    const initial = makeState({ habits: [makeHabit({ id: 'h1' })] });
    expect(() => addHabitNote(initial, '', 'h1')).toThrow('--note is required');
  });
});

// ── State ──

describe('showState', () => {
  it('returns the full state', () => {
    const state = makeState({ tasks: [makeTask()], habits: [makeHabit()] });
    expect(showState(state)).toEqual(state);
  });
});

// ── Edge cases ──

describe('edge cases', () => {
  it('operations are immutable - original state unchanged', () => {
    const original = makeState({ tasks: [makeTask({ id: 't1' })] });
    const originalTaskCount = original.tasks.length;
    addTask(original, 'New');
    expect(original.tasks.length).toBe(originalTaskCount);
  });

  it('resolve by text requires --id or --text', () => {
    expect(() => completeTask(makeState())).toThrow('Must provide --id or --text');
  });

  it('deeply nested task operations', () => {
    const grandchild = makeTask({ id: 'gc', text: 'Grandchild' });
    const child = makeTask({ id: 'c', text: 'Child', children: [grandchild] });
    const root = makeTask({ id: 'r', text: 'Root', children: [child] });
    const state = makeState({ tasks: [root] });

    const completed = completeTask(state, 'gc');
    expect(findTaskById(completed.tasks, 'gc')?.completed).toBe(true);

    const edited = editTask(state, 'Updated', 'gc');
    expect(findTaskById(edited.tasks, 'gc')?.text).toBe('Updated');

    const deleted = deleteTask(state, 'gc');
    expect(findTaskById(deleted.tasks, 'gc')).toBeNull();
  });
});
