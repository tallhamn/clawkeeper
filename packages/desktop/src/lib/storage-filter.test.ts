import { describe, it, expect } from 'vitest';
import type { Task } from '@clawkeeper/shared/src/types';

// Copy the filterCurrentTasks logic to test it in isolation
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function filterCurrentTasks(tasks: Task[]): Task[] {
  const currentMonth = getCurrentMonth();

  const filterTask = (task: Task): Task | null => {
    // Keep if not completed
    if (!task.completed) {
      // Recursively filter children
      return {
        ...task,
        children: task.children?.map(filterTask).filter((t): t is Task => t !== null) || [],
      };
    }

    // Keep if completed this month
    if (task.completedAt && task.completedAt.startsWith(currentMonth)) {
      return {
        ...task,
        children: task.children?.map(filterTask).filter((t): t is Task => t !== null) || [],
      };
    }

    // Filter out if completed in previous months
    return null;
  };

  return tasks.map(filterTask).filter((t): t is Task => t !== null);
}

describe('Storage Filtering - Unchecked Tasks', () => {
  it('should keep unchecked tasks (completed = false, completedAt = null)', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Unchecked Task',
        completed: false,
        completedAt: null,  // Set to null when unchecked
        dueDate: null,
        notes: [],
        children: [],
      },
    ];

    const filtered = filterCurrentTasks(tasks);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe('Unchecked Task');
    expect(filtered[0].completed).toBe(false);
    expect(filtered[0].completedAt).toBe(null);
  });

  it('should keep task that was completed then unchecked', () => {
    // Simulate: task was completed today, then user unchecked it
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Toggled Task',
        completed: false,  // Unchecked
        completedAt: null,  // Set to null by toggleTask
        dueDate: null,
        notes: [
          { text: 'Did this earlier', createdAt: '2026-02-12T10:00:00Z' },
        ],
        children: [],
      },
    ];

    const filtered = filterCurrentTasks(tasks);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe('Toggled Task');
    expect(filtered[0].completed).toBe(false);
    // Notes should be preserved
    expect(filtered[0].notes).toHaveLength(1);
    expect(filtered[0].notes[0].text).toBe('Did this earlier');
  });

  it('should keep incomplete task with completed children from previous month', () => {
    const tasks: Task[] = [
      {
        id: 'parent',
        text: 'Parent Task',
        completed: false,
        completedAt: null,
        dueDate: null,
        notes: [],
        children: [
          {
            id: 'child1',
            text: 'Old Completed Child',
            completed: true,
            completedAt: '2025-12-15',  // Previous month
            dueDate: null,
            notes: [],
            children: [],
          },
        ],
      },
    ];

    const filtered = filterCurrentTasks(tasks);

    // Parent should be kept because it's incomplete
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe('Parent Task');
    // Old completed child should be filtered out
    expect(filtered[0].children).toHaveLength(0);
  });

  it('should filter completed tasks from previous month', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Old Completed Task',
        completed: true,
        completedAt: '2025-12-15',  // Previous month
        dueDate: null,
        notes: [],
        children: [],
      },
    ];

    const filtered = filterCurrentTasks(tasks);

    // Should be filtered out
    expect(filtered).toHaveLength(0);
  });

  it('should keep completed tasks from current month', () => {
    const currentMonth = getCurrentMonth();
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Recently Completed Task',
        completed: true,
        completedAt: `${currentMonth}-08`,  // This month
        dueDate: null,
        notes: [],
        children: [],
      },
    ];

    const filtered = filterCurrentTasks(tasks);

    // Should be kept
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe('Recently Completed Task');
  });

  it('should handle mixed scenarios in same save', () => {
    const currentMonth = getCurrentMonth();
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Incomplete Task',
        completed: false,
        completedAt: null,
        dueDate: null,
        notes: [],
        children: [],
      },
      {
        id: 't2',
        text: 'Completed This Month',
        completed: true,
        completedAt: `${currentMonth}-05`,
        dueDate: null,
        notes: [],
        children: [],
      },
      {
        id: 't3',
        text: 'Old Completed Task',
        completed: true,
        completedAt: '2025-12-15',
        dueDate: null,
        notes: [],
        children: [],
      },
      {
        id: 't4',
        text: 'Unchecked Task',
        completed: false,
        completedAt: null,
        dueDate: null,
        notes: [],
        children: [],
      },
    ];

    const filtered = filterCurrentTasks(tasks);

    // Should keep: t1 (incomplete), t2 (completed this month), t4 (unchecked)
    // Should filter: t3 (completed previous month)
    expect(filtered).toHaveLength(3);
    expect(filtered.map(t => t.id)).toEqual(['t1', 't2', 't4']);
  });
});
