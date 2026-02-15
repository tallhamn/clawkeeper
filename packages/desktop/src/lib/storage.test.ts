import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task, AppState, Habit } from '@clawkeeper/shared/src/types';
import {
  getDefaultState,
  initializeStorage,
  archiveOldCompletedTasks,
  createSnapshot,
  getSnapshots,
  loadSnapshot,
  loadRecentArchives,
} from './storage';
import { exists, mkdir, readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';

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

// ---------------------------------------------------------------------------
// Archive and Snapshot operation tests
// ---------------------------------------------------------------------------

// Helper to build a minimal task
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    text: overrides.text ?? 'Test task',
    completed: overrides.completed ?? false,
    completedAt: overrides.completedAt ?? null,
    notes: overrides.notes ?? [],
    children: overrides.children ?? [],
  };
}

// Helper to build a minimal habit
function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: overrides.id ?? 'habit-1',
    text: overrides.text ?? 'Test habit',
    repeatIntervalHours: overrides.repeatIntervalHours ?? 24,
    lastCompleted: overrides.lastCompleted ?? null,
    totalCompletions: overrides.totalCompletions ?? 0,
    notes: overrides.notes ?? [],
  };
}

// Helper to build a minimal AppState
function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    habits: overrides.habits ?? [],
    tasks: overrides.tasks ?? [],
  };
}

describe('initializeStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeDir).mockResolvedValue('/Users/test');
  });

  it('should create both directories when they do not exist', async () => {
    vi.mocked(exists).mockResolvedValue(false);
    vi.mocked(mkdir).mockResolvedValue(undefined);

    await initializeStorage();

    expect(exists).toHaveBeenCalledWith('/Users/test/.clawkeeper');
    expect(exists).toHaveBeenCalledWith('/Users/test/.clawkeeper/history');
    expect(mkdir).toHaveBeenCalledWith('/Users/test/.clawkeeper', { recursive: true });
    expect(mkdir).toHaveBeenCalledWith('/Users/test/.clawkeeper/history', { recursive: true });
    expect(mkdir).toHaveBeenCalledTimes(2);
  });

  it('should skip creating directories when they already exist', async () => {
    vi.mocked(exists).mockResolvedValue(true);

    await initializeStorage();

    expect(exists).toHaveBeenCalledTimes(2);
    expect(mkdir).not.toHaveBeenCalled();
  });

  it('should create only the missing directory', async () => {
    // App dir exists, history dir does not
    vi.mocked(exists)
      .mockResolvedValueOnce(true)   // app dir exists
      .mockResolvedValueOnce(false); // history dir does not
    vi.mocked(mkdir).mockResolvedValue(undefined);

    await initializeStorage();

    expect(mkdir).toHaveBeenCalledTimes(1);
    expect(mkdir).toHaveBeenCalledWith('/Users/test/.clawkeeper/history', { recursive: true });
  });

  it('should propagate errors from exists()', async () => {
    vi.mocked(exists).mockRejectedValue(new Error('Permission denied'));

    await expect(initializeStorage()).rejects.toThrow('Permission denied');
  });

  it('should propagate errors from mkdir()', async () => {
    vi.mocked(exists).mockResolvedValue(false);
    vi.mocked(mkdir).mockRejectedValue(new Error('Disk full'));

    await expect(initializeStorage()).rejects.toThrow('Disk full');
  });
});

describe('archiveOldCompletedTasks', () => {
  const currentMonth = getCurrentMonth();
  const lastMonth = getLastMonth();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeDir).mockResolvedValue('/Users/test');
  });

  it('should archive tasks completed in a previous month', async () => {
    vi.mocked(exists).mockResolvedValue(false); // no existing archive
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const state = makeState({
      habits: [makeHabit()],
      tasks: [
        makeTask({ id: 't1', text: 'Old task', completed: true, completedAt: `${lastMonth}-15` }),
        makeTask({ id: 't2', text: 'Active task', completed: false }),
      ],
    });

    const result = await archiveOldCompletedTasks(state);

    // Should have written an archive file for last month
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    const [archivePath, archiveContent] = vi.mocked(writeTextFile).mock.calls[0];
    expect(archivePath).toBe(`/Users/test/.clawkeeper/archive-${lastMonth}.md`);
    expect(archiveContent).toContain('Old task');

    // Returned state should keep active tasks and habits, drop old completed
    expect(result.habits).toHaveLength(1);
    expect(result.tasks.some(t => t.text === 'Active task')).toBe(true);
    expect(result.tasks.some(t => t.text === 'Old task')).toBe(false);
  });

  it('should merge with an existing archive file', async () => {
    vi.mocked(exists).mockResolvedValue(true); // existing archive
    // Simulate an existing archive with one task
    const existingMarkdown = [
      '# Habits\n',
      '---\n',
      '# Tasks\n',
      '## Previously archived <!-- id:old1 -->',
      '- Status: completed (2025-11-01)',
      '',
    ].join('\n');
    vi.mocked(readTextFile).mockResolvedValue(existingMarkdown);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const state = makeState({
      tasks: [
        makeTask({ id: 't1', text: 'New old task', completed: true, completedAt: `${lastMonth}-20` }),
      ],
    });

    await archiveOldCompletedTasks(state);

    expect(readTextFile).toHaveBeenCalled();
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    const [, archiveContent] = vi.mocked(writeTextFile).mock.calls[0];
    // Should contain both the previously archived task and the new one
    expect(archiveContent).toContain('Previously archived');
    expect(archiveContent).toContain('New old task');
  });

  it('should keep current-month completed tasks in returned state', async () => {
    vi.mocked(exists).mockResolvedValue(false);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const state = makeState({
      tasks: [
        makeTask({ id: 't1', text: 'Current done', completed: true, completedAt: `${currentMonth}-10` }),
        makeTask({ id: 't2', text: 'Old done', completed: true, completedAt: `${lastMonth}-05` }),
      ],
    });

    const result = await archiveOldCompletedTasks(state);

    expect(result.tasks.some(t => t.text === 'Current done')).toBe(true);
    expect(result.tasks.some(t => t.text === 'Old done')).toBe(false);
  });

  it('should handle nested tasks with old completed children', async () => {
    vi.mocked(exists).mockResolvedValue(false);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const state = makeState({
      tasks: [
        makeTask({
          id: 'parent',
          text: 'Active parent',
          completed: false,
          children: [
            makeTask({ id: 'child-old', text: 'Old child', completed: true, completedAt: `${lastMonth}-10` }),
            makeTask({ id: 'child-current', text: 'Current child', completed: false }),
          ],
        }),
      ],
    });

    const result = await archiveOldCompletedTasks(state);

    // Old child should be archived
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    const [, archiveContent] = vi.mocked(writeTextFile).mock.calls[0];
    expect(archiveContent).toContain('Old child');

    // Returned state should keep parent with only current child
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].text).toBe('Active parent');
    expect(result.tasks[0].children).toHaveLength(1);
    expect(result.tasks[0].children[0].text).toBe('Current child');
  });

  it('should return original state on error', async () => {
    vi.mocked(exists).mockRejectedValue(new Error('read error'));

    const state = makeState({
      tasks: [makeTask({ id: 't1', text: 'A task', completed: true, completedAt: `${lastMonth}-01` })],
    });

    const result = await archiveOldCompletedTasks(state);

    // On error, the original state is returned unchanged
    expect(result).toBe(state);
  });

  it('should not write anything when there are no old tasks', async () => {
    const state = makeState({
      tasks: [
        makeTask({ id: 't1', text: 'Active', completed: false }),
        makeTask({ id: 't2', text: 'Current done', completed: true, completedAt: `${currentMonth}-05` }),
      ],
    });

    const result = await archiveOldCompletedTasks(state);

    expect(writeTextFile).not.toHaveBeenCalled();
    // All tasks should still be present
    expect(result.tasks).toHaveLength(2);
  });
});

describe('createSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeDir).mockResolvedValue('/Users/test');
    // Mock readDir for pruneSnapshots which is called internally
    vi.mocked(readDir).mockResolvedValue([]);
  });

  it('should write a markdown file with timestamp-based filename', async () => {
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const state = makeState({
      habits: [makeHabit({ text: 'Drink water' })],
      tasks: [makeTask({ text: 'Buy groceries' })],
    });

    const snapshot = await createSnapshot(state, 'auto');

    // Should have written to history dir
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = vi.mocked(writeTextFile).mock.calls[0];
    expect(writtenPath).toMatch(/^\/Users\/test\/\.clawkeeper\/history\//);
    expect(writtenPath).toContain('_auto.md');
    expect(writtenContent).toContain('Drink water');
    expect(writtenContent).toContain('Buy groceries');
  });

  it('should return a Snapshot object with correct fields', async () => {
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const state = makeState({
      habits: [],
      tasks: [makeTask({ text: 'Snapshot me' })],
    });

    const snapshot = await createSnapshot(state, 'llm-action');

    expect(snapshot.reason).toBe('llm-action');
    expect(snapshot.timestamp).toBeTruthy();
    expect(snapshot.markdown).toContain('Snapshot me');
    expect(snapshot.data).toEqual(state);
  });

  it('should propagate write errors', async () => {
    vi.mocked(writeTextFile).mockRejectedValue(new Error('Write failed'));

    const state = makeState();

    await expect(createSnapshot(state, 'auto')).rejects.toThrow('Write failed');
  });

  it('should encode colons and dots in the filename', async () => {
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const state = makeState();
    await createSnapshot(state, 'user-request');

    const [writtenPath] = vi.mocked(writeTextFile).mock.calls[0];
    const filename = writtenPath.split('/').pop()!;
    // The stem (everything before .md) should not contain colons or dots
    const stem = filename.replace(/\.md$/, '');
    expect(stem).not.toContain(':');
    expect(stem).not.toContain('.');
    expect(filename).toMatch(/_user-request\.md$/);
  });
});

describe('getSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeDir).mockResolvedValue('/Users/test');
  });

  it('should return sorted filenames (most recent first)', async () => {
    vi.mocked(readDir).mockResolvedValue([
      { name: '2025-01-10T10-00-00-000Z_auto.md', isDirectory: false, isFile: true, isSymlink: false },
      { name: '2025-01-12T10-00-00-000Z_auto.md', isDirectory: false, isFile: true, isSymlink: false },
      { name: '2025-01-11T10-00-00-000Z_llm-action.md', isDirectory: false, isFile: true, isSymlink: false },
    ] as any);

    const result = await getSnapshots();

    expect(result).toEqual([
      '2025-01-12T10-00-00-000Z_auto.md',
      '2025-01-11T10-00-00-000Z_llm-action.md',
      '2025-01-10T10-00-00-000Z_auto.md',
    ]);
  });

  it('should filter out directories and non-.md files', async () => {
    vi.mocked(readDir).mockResolvedValue([
      { name: 'some-dir', isDirectory: true, isFile: false, isSymlink: false },
      { name: '2025-01-10T10-00-00-000Z_auto.md', isDirectory: false, isFile: true, isSymlink: false },
      { name: 'notes.txt', isDirectory: false, isFile: true, isSymlink: false },
    ] as any);

    const result = await getSnapshots();

    expect(result).toEqual(['2025-01-10T10-00-00-000Z_auto.md']);
  });

  it('should return empty array when directory is empty', async () => {
    vi.mocked(readDir).mockResolvedValue([]);

    const result = await getSnapshots();

    expect(result).toEqual([]);
  });

  it('should return empty array on error', async () => {
    vi.mocked(readDir).mockRejectedValue(new Error('Dir not found'));

    const result = await getSnapshots();

    expect(result).toEqual([]);
  });
});

describe('loadSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeDir).mockResolvedValue('/Users/test');
  });

  it('should parse a markdown snapshot file and return AppState', async () => {
    const markdown = [
      '# Habits',
      '',
      '## Drink water <!-- id:h1 -->',
      '- Interval: 4h',
      '- Total Completions: 5',
      '- Last completed: 2025-01-10T08:00:00.000Z',
      '',
      '---',
      '',
      '# Tasks',
      '',
      '## Buy groceries <!-- id:t1 -->',
      '- [x] Milk (2025-01-09) <!-- id:t2 -->',
      '- [ ] Bread <!-- id:t3 -->',
      '',
    ].join('\n');
    vi.mocked(readTextFile).mockResolvedValue(markdown);

    const result = await loadSnapshot('2025-01-10T10-00-00-000Z_auto.md');

    expect(result).not.toBeNull();
    expect(result!.habits).toHaveLength(1);
    expect(result!.habits[0].text).toBe('Drink water');
    expect(result!.tasks).toHaveLength(1);
    expect(result!.tasks[0].text).toBe('Buy groceries');
    expect(result!.tasks[0].children).toHaveLength(2);
    expect(readTextFile).toHaveBeenCalledWith(
      '/Users/test/.clawkeeper/history/2025-01-10T10-00-00-000Z_auto.md'
    );
  });

  it('should return null on read error', async () => {
    vi.mocked(readTextFile).mockRejectedValue(new Error('File not found'));

    const result = await loadSnapshot('nonexistent.md');

    expect(result).toBeNull();
  });
});

describe('loadRecentArchives', () => {
  const currentMonth = getCurrentMonth();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeDir).mockResolvedValue('/Users/test');
  });

  it('should load archive files for the last N months', async () => {
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readTextFile).mockResolvedValue('# Habits\n\n---\n\n# Tasks\n\n## Archived task <!-- id:a1 -->\n');

    const result = await loadRecentArchives(3);

    // Should check existence for 3 months
    expect(exists).toHaveBeenCalledTimes(3);
    // Should read all 3 files
    expect(readTextFile).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    result.forEach(content => {
      expect(content).toContain('Archived task');
    });
  });

  it('should skip months with no archive file', async () => {
    // Only the first month exists
    vi.mocked(exists)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    vi.mocked(readTextFile).mockResolvedValue('# archive content');

    const result = await loadRecentArchives(3);

    expect(result).toHaveLength(1);
    expect(readTextFile).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when all exists checks throw', async () => {
    vi.mocked(exists).mockRejectedValue(new Error('fs error'));

    const result = await loadRecentArchives(2);

    // The outer try/catch in loadRecentArchives catches individual month errors
    // and continues, so result is empty but does not throw
    expect(result).toEqual([]);
  });

  it('should default to 3 months back', async () => {
    vi.mocked(exists).mockResolvedValue(false);

    await loadRecentArchives();

    expect(exists).toHaveBeenCalledTimes(3);
  });

  it('should construct correct archive filenames', async () => {
    vi.mocked(exists).mockResolvedValue(false);

    await loadRecentArchives(1);

    // For 1 month back, it should check the current month's archive
    expect(exists).toHaveBeenCalledWith(
      `/Users/test/.clawkeeper/archive-${currentMonth}.md`
    );
  });

  it('should skip individual months that throw errors during read', async () => {
    vi.mocked(exists)
      .mockResolvedValueOnce(true)   // month 0 exists
      .mockResolvedValueOnce(true);  // month 1 exists
    vi.mocked(readTextFile)
      .mockResolvedValueOnce('archive 0 content')
      .mockRejectedValueOnce(new Error('read error'));

    const result = await loadRecentArchives(2);

    // First month succeeds, second fails gracefully
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('archive 0 content');
  });
});
