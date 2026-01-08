import { describe, it, expect } from 'vitest';
import { serializeToMarkdown, parseMarkdown } from './markdown';
import type { Habit, Task } from './types';

describe('Markdown Serialization', () => {
  it('should serialize and parse habits correctly', () => {
    const habits: Habit[] = [
      {
        id: 'h1',
        text: 'write code',
        streak: 5,
        lastCompleted: '2025-01-07T10:00:00Z',
        repeatIntervalHours: 4,
        reflections: ['worked well today', 'stayed focused'],
      },
    ];

    const markdown = serializeToMarkdown(habits, []);
    const parsed = parseMarkdown(markdown);

    expect(parsed.habits).toHaveLength(1);
    expect(parsed.habits[0].text).toBe('write code');
    expect(parsed.habits[0].streak).toBe(5);
    expect(parsed.habits[0].repeatIntervalHours).toBe(4);
    expect(parsed.habits[0].reflections).toHaveLength(2);
  });

  it('should serialize and parse tasks correctly', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Hire VP of Sales',
        completed: false,
        completedAt: null,
        reflections: [],
        children: [
          {
            id: 't2',
            text: 'Define role',
            completed: true,
            completedAt: '2025-01-05',
            reflections: ['took longer than expected'],
            children: [],
          },
        ],
      },
    ];

    const markdown = serializeToMarkdown([], tasks);
    const parsed = parseMarkdown(markdown);

    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].text).toBe('Hire VP of Sales');
    expect(parsed.tasks[0].completed).toBe(false);
    expect(parsed.tasks[0].children).toHaveLength(1);
    expect(parsed.tasks[0].children[0].text).toBe('Define role');
    expect(parsed.tasks[0].children[0].completed).toBe(true);
    expect(parsed.tasks[0].children[0].reflections).toHaveLength(1);
  });

  it('should handle round-trip correctly', () => {
    const habits: Habit[] = [
      {
        id: 'h1',
        text: 'workout',
        streak: 3,
        lastCompleted: '2025-01-07T10:00:00Z',
        repeatIntervalHours: 24,
        reflections: [],
      },
    ];

    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Main task',
        completed: false,
        completedAt: null,
        reflections: ['reflection 1'],
        children: [],
      },
    ];

    const markdown = serializeToMarkdown(habits, tasks);
    const parsed = parseMarkdown(markdown);
    const markdown2 = serializeToMarkdown(parsed.habits, parsed.tasks);

    // Second serialization should match first
    expect(markdown2).toBe(markdown);
  });

  it('should handle empty reflections', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Task without reflections',
        completed: false,
        completedAt: null,
        reflections: [],
        children: [],
      },
    ];

    const markdown = serializeToMarkdown([], tasks);
    const parsed = parseMarkdown(markdown);

    expect(parsed.tasks[0].reflections).toEqual([]);
  });

  it('should handle multiple reflections per task', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Task with multiple reflections',
        completed: true,
        completedAt: '2025-01-05',
        reflections: ['first reflection', 'second reflection', 'third reflection'],
        children: [],
      },
    ];

    const markdown = serializeToMarkdown([], tasks);
    const parsed = parseMarkdown(markdown);

    expect(parsed.tasks[0].reflections).toHaveLength(3);
    expect(parsed.tasks[0].reflections).toEqual([
      'first reflection',
      'second reflection',
      'third reflection',
    ]);
  });
});
