import { describe, it, expect } from 'vitest';
import { serializeToMarkdown, parseMarkdown, healIds } from './markdown';
import type { Habit, Task, AppState } from './types';

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

describe('Stable IDs', () => {
  it('should preserve IDs through serialize → parse round-trip', () => {
    const habits: Habit[] = [
      {
        id: 'habit111',
        text: 'Meditate',
        repeatIntervalHours: 24,
        totalCompletions: 0,
        lastCompleted: null,
        notes: [],
      },
    ];

    const tasks: Task[] = [
      {
        id: 'task111',
        text: 'Buy groceries',
        completed: false,
        completedAt: null,
        notes: [],
        children: [
          {
            id: 'sub111',
            text: 'Milk',
            completed: false,
            completedAt: null,
            notes: [],
            children: [
              {
                id: 'subsub111',
                text: 'Whole milk',
                completed: false,
                completedAt: null,
                notes: [],
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const markdown = serializeToMarkdown(habits, tasks);
    const parsed = parseMarkdown(markdown);

    expect(parsed.habits[0].id).toBe('habit111');
    expect(parsed.tasks[0].id).toBe('task111');
    expect(parsed.tasks[0].children[0].id).toBe('sub111');
    expect(parsed.tasks[0].children[0].children[0].id).toBe('subsub111');
  });

  it('should embed IDs as HTML comments in serialized output', () => {
    const markdown = serializeToMarkdown(
      [{ id: 'abc123', text: 'Run', repeatIntervalHours: 24, totalCompletions: 0, lastCompleted: null, notes: [] }],
      [{ id: 'def456', text: 'Task', completed: false, completedAt: null, notes: [], children: [
        { id: 'ghi789', text: 'Sub', completed: false, completedAt: null, notes: [], children: [] },
      ] }],
    );

    expect(markdown).toContain('## Run <!-- id:abc123 -->');
    expect(markdown).toContain('## Task <!-- id:def456 -->');
    expect(markdown).toContain('- [ ] Sub <!-- id:ghi789 -->');
  });

  it('should generate IDs for markdown without ID comments (backward compatibility)', () => {
    const legacyMarkdown = `# Habits

## Meditate
- Interval: 24h
- Total Completions: 5
- Last completed: never

---

# Tasks

## Buy groceries
- [ ] Milk
  - [ ] Whole milk

`;

    const parsed = parseMarkdown(legacyMarkdown);

    expect(parsed.habits[0].text).toBe('Meditate');
    expect(parsed.habits[0].id).toBeTruthy();
    expect(parsed.tasks[0].text).toBe('Buy groceries');
    expect(parsed.tasks[0].id).toBeTruthy();
    expect(parsed.tasks[0].children[0].text).toBe('Milk');
    expect(parsed.tasks[0].children[0].id).toBeTruthy();
    expect(parsed.tasks[0].children[0].children[0].text).toBe('Whole milk');
    expect(parsed.tasks[0].children[0].children[0].id).toBeTruthy();

    // All IDs should be unique
    const ids = [
      parsed.habits[0].id,
      parsed.tasks[0].id,
      parsed.tasks[0].children[0].id,
      parsed.tasks[0].children[0].children[0].id,
    ];
    expect(new Set(ids).size).toBe(4);
  });

  it('should never include ID comments in parsed text fields', () => {
    const habits: Habit[] = [
      { id: 'h1', text: 'Meditate', repeatIntervalHours: 24, totalCompletions: 0, lastCompleted: null, notes: [] },
    ];
    const tasks: Task[] = [
      { id: 't1', text: 'Buy groceries', completed: false, completedAt: null, notes: [], children: [
        { id: 's1', text: 'Milk', completed: false, completedAt: null, notes: [], children: [] },
      ] },
    ];

    // Serialize and parse multiple times to detect accumulation
    let md = serializeToMarkdown(habits, tasks);
    for (let i = 0; i < 5; i++) {
      const parsed = parseMarkdown(md);
      // Text must never contain ID comments
      expect(parsed.habits[0].text).toBe('Meditate');
      expect(parsed.habits[0].text).not.toContain('<!-- id:');
      expect(parsed.tasks[0].text).toBe('Buy groceries');
      expect(parsed.tasks[0].text).not.toContain('<!-- id:');
      expect(parsed.tasks[0].children[0].text).toBe('Milk');
      expect(parsed.tasks[0].children[0].text).not.toContain('<!-- id:');
      md = serializeToMarkdown(parsed.habits, parsed.tasks);
    }

    // Serialized markdown should have exactly one ID comment per line
    const idMatches = md.match(/<!-- id:\w+ -->/g) || [];
    expect(idMatches).toHaveLength(3); // h1, t1, s1
  });

  it('should strip accumulated ID comments from corrupted markdown', () => {
    const corruptedMarkdown = `# Habits

## Meditate <!-- id:aaa --> <!-- id:bbb --> <!-- id:ccc -->
- Interval: 24h
- Total Completions: 0
- Last completed: never

---

# Tasks

## Buy groceries <!-- id:ddd --> <!-- id:eee -->
- [ ] Milk <!-- id:fff --> <!-- id:ggg --> <!-- id:hhh -->

`;

    const parsed = parseMarkdown(corruptedMarkdown);

    // Text should be clean
    expect(parsed.habits[0].text).toBe('Meditate');
    expect(parsed.habits[0].text).not.toContain('<!--');
    expect(parsed.tasks[0].text).toBe('Buy groceries');
    expect(parsed.tasks[0].text).not.toContain('<!--');
    expect(parsed.tasks[0].children[0].text).toBe('Milk');
    expect(parsed.tasks[0].children[0].text).not.toContain('<!--');

    // Should use the last ID from the line
    expect(parsed.habits[0].id).toBe('ccc');
    expect(parsed.tasks[0].id).toBe('eee');
    expect(parsed.tasks[0].children[0].id).toBe('hhh');

    // Re-serializing should produce clean markdown with single IDs
    const reserialized = serializeToMarkdown(parsed.habits, parsed.tasks);
    expect((reserialized.match(/<!-- id:\w+ -->/g) || []).length).toBe(3);
  });

  it('should generate IDs for mixed markdown (some with, some without IDs)', () => {
    const mixedMarkdown = `# Habits

## Meditate <!-- id:keepme -->
- Interval: 24h
- Total Completions: 0
- Last completed: never

---

# Tasks

## Task with ID <!-- id:taskid1 -->
- [ ] Sub without ID
- [ ] Sub with ID <!-- id:subid1 -->

`;

    const parsed = parseMarkdown(mixedMarkdown);

    expect(parsed.habits[0].id).toBe('keepme');
    expect(parsed.tasks[0].id).toBe('taskid1');
    expect(parsed.tasks[0].children[0].id).toBeTruthy();
    expect(parsed.tasks[0].children[0].id).not.toBe('taskid1');
    expect(parsed.tasks[0].children[1].id).toBe('subid1');
  });
});

describe('healIds', () => {
  it('should assign new IDs to duplicates', () => {
    const state: AppState = {
      habits: [
        { id: 'dup', text: 'Habit', repeatIntervalHours: 24, totalCompletions: 0, lastCompleted: null, notes: [] },
      ],
      tasks: [
        { id: 'dup', text: 'Task', completed: false, completedAt: null, notes: [], children: [] },
      ],
    };

    const healed = healIds(state);

    // First occurrence keeps ID, second gets a new one
    expect(healed.habits[0].id).toBe('dup');
    expect(healed.tasks[0].id).not.toBe('dup');
    expect(healed.tasks[0].id).toBeTruthy();
  });

  it('should assign new IDs to empty IDs', () => {
    const state: AppState = {
      habits: [],
      tasks: [
        { id: '', text: 'Task', completed: false, completedAt: null, notes: [], children: [] },
      ],
    };

    const healed = healIds(state);
    expect(healed.tasks[0].id).toBeTruthy();
    expect(healed.tasks[0].id.length).toBeGreaterThan(0);
  });

  it('should handle duplicate IDs in nested subtasks', () => {
    const state: AppState = {
      habits: [],
      tasks: [
        {
          id: 'parent',
          text: 'Parent',
          completed: false,
          completedAt: null,
          notes: [],
          children: [
            { id: 'parent', text: 'Child with dup ID', completed: false, completedAt: null, notes: [], children: [] },
          ],
        },
      ],
    };

    const healed = healIds(state);
    expect(healed.tasks[0].id).toBe('parent');
    expect(healed.tasks[0].children[0].id).not.toBe('parent');
  });

  it('should not modify unique IDs', () => {
    const state: AppState = {
      habits: [
        { id: 'h1', text: 'Habit', repeatIntervalHours: 24, totalCompletions: 0, lastCompleted: null, notes: [] },
      ],
      tasks: [
        { id: 't1', text: 'Task', completed: false, completedAt: null, notes: [], children: [
          { id: 't2', text: 'Sub', completed: false, completedAt: null, notes: [], children: [] },
        ] },
      ],
    };

    const healed = healIds(state);
    expect(healed.habits[0].id).toBe('h1');
    expect(healed.tasks[0].id).toBe('t1');
    expect(healed.tasks[0].children[0].id).toBe('t2');
  });
});
