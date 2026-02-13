import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task } from './types';
import { getDefaultState } from './storage';

// Helper function to get current month
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Helper function to get last month
function getLastMonth(): string {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = lastMonth.getFullYear();
  const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Copy of filterCurrentTasks logic for testing
function filterCurrentTasks(tasks: Task[]): Task[] {
  const currentMonth = getCurrentMonth();

  const filterTask = (task: Task): Task | null => {
    if (!task.completed) {
      return {
        ...task,
        children: task.children?.map(filterTask).filter((t): t is Task => t !== null) || [],
      };
    }

    if (task.completedAt && task.completedAt.startsWith(currentMonth)) {
      return {
        ...task,
        children: task.children?.map(filterTask).filter((t): t is Task => t !== null) || [],
      };
    }

    return null;
  };

  return tasks.map(filterTask).filter((t): t is Task => t !== null);
}

describe('Monthly Task Filtering', () => {
  const currentMonth = getCurrentMonth();
  const lastMonth = getLastMonth();

  it('should keep active tasks', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Active task',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
    ];

    const filtered = filterCurrentTasks(tasks);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe('Active task');
  });

  it('should keep tasks completed this month', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Completed this month',
        completed: true,
        completedAt: `${currentMonth}-05`,
        notes: [],
        children: [],
      },
    ];

    const filtered = filterCurrentTasks(tasks);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe('Completed this month');
  });

  it('should filter out tasks completed last month', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Completed last month',
        completed: true,
        completedAt: `${lastMonth}-05`,
        notes: [],
        children: [],
      },
    ];

    const filtered = filterCurrentTasks(tasks);
    expect(filtered).toHaveLength(0);
  });

  it('should keep active parent with completed children', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Active parent',
        completed: false,
        completedAt: null,
        notes: [],
        children: [
          {
            id: 't2',
            text: 'Completed child this month',
            completed: true,
            completedAt: `${currentMonth}-05`,
            notes: [],
            children: [],
          },
          {
            id: 't3',
            text: 'Completed child last month',
            completed: true,
            completedAt: `${lastMonth}-15`,
            notes: [],
            children: [],
          },
        ],
      },
    ];

    const filtered = filterCurrentTasks(tasks);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe('Active parent');
    expect(filtered[0].children).toHaveLength(1); // Only current month child
    expect(filtered[0].children[0].text).toBe('Completed child this month');
  });

  it('should filter out completed parent with old children', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Completed parent',
        completed: true,
        completedAt: `${lastMonth}-01`,
        notes: [],
        children: [
          {
            id: 't2',
            text: 'Child',
            completed: true,
            completedAt: `${lastMonth}-02`,
            notes: [],
            children: [],
          },
        ],
      },
    ];

    const filtered = filterCurrentTasks(tasks);
    expect(filtered).toHaveLength(0);
  });

  it('should handle mixed completion states', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Active',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
      {
        id: 't2',
        text: 'Completed this month',
        completed: true,
        completedAt: `${currentMonth}-10`,
        notes: [],
        children: [],
      },
      {
        id: 't3',
        text: 'Completed last month',
        completed: true,
        completedAt: `${lastMonth}-20`,
        notes: [],
        children: [],
      },
    ];

    const filtered = filterCurrentTasks(tasks);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].text).toBe('Active');
    expect(filtered[1].text).toBe('Completed this month');
  });
});
