import { describe, it, expect } from 'vitest';
import { serializeToMarkdown, parseMarkdown } from './markdown';
import type { Habit, Task } from './types';

describe('Markdown Serialization', () => {
  it('should serialize and parse habits correctly', () => {
    const habits: Habit[] = [
      {
        id: 'h1',
        text: 'write code',
        totalCompletions: 5,
        lastCompleted: '2025-01-07T10:00:00Z',
        repeatIntervalHours: 4,
        notes: [
          { text: 'worked well today', createdAt: '2025-01-07T10:00:00Z' },
          { text: 'stayed focused', createdAt: '2025-01-07T11:00:00Z' },
        ],
      },
    ];

    const markdown = serializeToMarkdown(habits, []);
    const parsed = parseMarkdown(markdown);

    expect(parsed.habits).toHaveLength(1);
    expect(parsed.habits[0].text).toBe('write code');
    expect(parsed.habits[0].totalCompletions).toBe(5);
    expect(parsed.habits[0].repeatIntervalHours).toBe(4);
    expect(parsed.habits[0].notes).toHaveLength(2);
  });

  it('should serialize and parse tasks correctly', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Hire VP of Sales',
        completed: false,
        completedAt: null,
        notes: [],
        children: [
          {
            id: 't2',
            text: 'Define role',
            completed: true,
            completedAt: '2025-01-05',
            notes: [
              { text: 'took longer than expected', createdAt: '2025-01-05T12:00:00Z' },
            ],
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
    expect(parsed.tasks[0].children[0].notes).toHaveLength(1);
  });

  it('should handle round-trip correctly', () => {
    const habits: Habit[] = [
      {
        id: 'h1',
        text: 'workout',
        totalCompletions: 3,
        lastCompleted: '2025-01-07T10:00:00Z',
        repeatIntervalHours: 24,
        notes: [],
      },
    ];

    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Main task',
        completed: false,
        completedAt: null,
        notes: [
          { text: 'reflection 1', createdAt: '2025-01-07T12:00:00Z' },
        ],
        children: [],
      },
    ];

    const markdown = serializeToMarkdown(habits, tasks);
    const parsed = parseMarkdown(markdown);
    const markdown2 = serializeToMarkdown(parsed.habits, parsed.tasks);

    // Second serialization should match first
    expect(markdown2).toBe(markdown);
  });

  it('should handle empty notes', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Task without notes',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
    ];

    const markdown = serializeToMarkdown([], tasks);
    const parsed = parseMarkdown(markdown);

    expect(parsed.tasks[0].notes).toEqual([]);
  });

  it('should handle multiple notes per task', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Task with multiple notes',
        completed: true,
        completedAt: '2025-01-05',
        notes: [
          { text: 'first note', createdAt: '2025-01-05T10:00:00Z' },
          { text: 'second note', createdAt: '2025-01-05T11:00:00Z' },
          { text: 'third note', createdAt: '2025-01-05T12:00:00Z' },
        ],
        children: [],
      },
    ];

    const markdown = serializeToMarkdown([], tasks);
    const parsed = parseMarkdown(markdown);

    expect(parsed.tasks[0].notes).toHaveLength(3);
    expect(parsed.tasks[0].notes.map(n => n.text)).toEqual([
      'first note',
      'second note',
      'third note',
    ]);
  });

  it('should serialize and parse notes on top-level tasks', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Research project',
        completed: false,
        completedAt: null,
        notes: [
          { text: 'Found the API docs at example.com', createdAt: '2026-02-12T10:30:00Z' },
          { text: 'Rate limit is 100 req/min', createdAt: '2026-02-12T11:00:00Z' },
        ],
        children: [],
      },
    ];

    const markdown = serializeToMarkdown([], tasks);
    expect(markdown).toContain('| [2026-02-12T10:30:00Z] Found the API docs at example.com');
    expect(markdown).toContain('| [2026-02-12T11:00:00Z] Rate limit is 100 req/min');

    const parsed = parseMarkdown(markdown);
    expect(parsed.tasks[0].notes).toHaveLength(2);
    expect(parsed.tasks[0].notes[0].text).toBe('Found the API docs at example.com');
    expect(parsed.tasks[0].notes[0].createdAt).toBe('2026-02-12T10:30:00Z');
    expect(parsed.tasks[0].notes[1].text).toBe('Rate limit is 100 req/min');
    expect(parsed.tasks[0].notes[1].createdAt).toBe('2026-02-12T11:00:00Z');
  });

  it('should serialize and parse notes on subtasks', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Parent task',
        completed: false,
        completedAt: null,
        notes: [],
        children: [
          {
            id: 't2',
            text: 'Subtask with notes',
            completed: false,
            completedAt: null,
            notes: [
              { text: 'Subtask note here', createdAt: '2026-02-12T12:00:00Z' },
            ],
            children: [],
          },
        ],
      },
    ];

    const markdown = serializeToMarkdown([], tasks);
    const parsed = parseMarkdown(markdown);

    expect(parsed.tasks[0].children[0].notes).toHaveLength(1);
    expect(parsed.tasks[0].children[0].notes[0].text).toBe('Subtask note here');
    expect(parsed.tasks[0].children[0].notes[0].createdAt).toBe('2026-02-12T12:00:00Z');
  });

  it('should round-trip notes correctly', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Task with notes',
        completed: false,
        completedAt: null,
        notes: [
          { text: 'a reflection', createdAt: '2026-02-12T09:00:00Z' },
          { text: 'A note', createdAt: '2026-02-12T10:00:00Z' },
        ],
        children: [],
      },
    ];

    const markdown = serializeToMarkdown([], tasks);
    const parsed = parseMarkdown(markdown);
    const markdown2 = serializeToMarkdown([], parsed.tasks);

    expect(markdown2).toBe(markdown);
  });

  it('should handle tasks with empty notes', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        text: 'Task without notes',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
    ];

    const markdown = serializeToMarkdown([], tasks);
    const parsed = parseMarkdown(markdown);

    expect(parsed.tasks[0].notes).toEqual([]);
  });
});
