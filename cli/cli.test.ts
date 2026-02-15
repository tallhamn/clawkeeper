import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI_PATH = join(__dirname, 'main.ts');
const PROJECT_ROOT = join(__dirname, '..');

function cli(args: string[], home: string): { ok: boolean; data?: any; error?: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', CLI_PATH, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: home },
      encoding: 'utf-8',
      timeout: 15000,
    });
    return JSON.parse(stdout.trim());
  } catch (err: any) {
    // stderr contains the error JSON
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    // Try parsing stderr first (where fail() writes), then stdout
    for (const output of [stderr, stdout]) {
      const lines = output.trim().split('\n');
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed && typeof parsed.ok !== 'undefined') return parsed;
        } catch { /* skip non-JSON lines */ }
      }
    }
    throw new Error(`CLI failed with no parseable output. stderr: ${stderr}, stdout: ${stdout}`);
  }
}

// IDs are now stable across invocations (embedded in markdown as HTML comments),
// so --id lookups work across CLI invocations.

describe('CLI integration', () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'clawkeeper-cli-'));
  });

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  describe('state', () => {
    it('shows empty state when no file exists', () => {
      const result = cli(['state', 'show'], tempHome);
      expect(result.ok).toBe(true);
      expect(result.data.habits).toEqual([]);
      expect(result.data.tasks).toEqual([]);
    });
  });

  describe('task CRUD', () => {
    it('adds a task and lists it', () => {
      const add = cli(['task', 'add', '--text', 'Buy milk'], tempHome);
      expect(add.ok).toBe(true);
      expect(add.data.text).toBe('Buy milk');

      const list = cli(['task', 'list'], tempHome);
      expect(list.ok).toBe(true);
      expect(list.data).toHaveLength(1);
      expect(list.data[0].text).toBe('Buy milk');
    });

    it('adds subtask by parent text', () => {
      cli(['task', 'add', '--text', 'Shopping'], tempHome);

      const sub = cli(['task', 'add-subtask', '--parent-text', 'Shopping', '--text', 'Get eggs'], tempHome);
      expect(sub.ok).toBe(true);

      const list = cli(['task', 'list'], tempHome);
      expect(list.data[0].children).toHaveLength(1);
      expect(list.data[0].children[0].text).toBe('Get eggs');
    });

    it('completes and uncompletes a task by text', () => {
      cli(['task', 'add', '--text', 'Test task'], tempHome);

      const complete = cli(['task', 'complete', '--text', 'Test task'], tempHome);
      expect(complete.ok).toBe(true);

      const list2 = cli(['task', 'list', '--all'], tempHome);
      expect(list2.data[0].completed).toBe(true);

      const uncomplete = cli(['task', 'uncomplete', '--text', 'Test task'], tempHome);
      expect(uncomplete.ok).toBe(true);

      const list3 = cli(['task', 'list'], tempHome);
      expect(list3.data[0].completed).toBe(false);
    });

    it('completes a task by substring text match', () => {
      cli(['task', 'add', '--text', 'Unique task name'], tempHome);

      const complete = cli(['task', 'complete', '--text', 'unique task'], tempHome);
      expect(complete.ok).toBe(true);

      const list = cli(['task', 'list', '--all'], tempHome);
      expect(list.data[0].completed).toBe(true);
    });

    it('edits a task by text', () => {
      cli(['task', 'add', '--text', 'Old text'], tempHome);

      cli(['task', 'edit', '--text', 'Old text', '--new-text', 'New text'], tempHome);
      const list = cli(['task', 'list'], tempHome);
      expect(list.data[0].text).toBe('New text');
    });

    it('deletes a task by text', () => {
      cli(['task', 'add', '--text', 'To delete'], tempHome);

      cli(['task', 'delete', '--text', 'To delete'], tempHome);
      const list = cli(['task', 'list'], tempHome);
      expect(list.data).toHaveLength(0);
    });

    it('adds and deletes task notes by text', () => {
      cli(['task', 'add', '--text', 'Note task'], tempHome);

      cli(['task', 'add-note', '--text', 'Note task', '--note', 'My note'], tempHome);
      const list2 = cli(['task', 'list'], tempHome);
      expect(list2.data[0].notes).toHaveLength(1);
      expect(list2.data[0].notes[0].text).toBe('My note');

      cli(['task', 'delete-note', '--text', 'Note task', '--note', 'My note'], tempHome);
      const list3 = cli(['task', 'list'], tempHome);
      expect(list3.data[0].notes).toHaveLength(0);
    });
  });

  describe('habit CRUD', () => {
    it('adds and lists a habit', () => {
      const add = cli(['habit', 'add', '--text', 'Meditate'], tempHome);
      expect(add.ok).toBe(true);
      expect(add.data.text).toBe('Meditate');
      expect(add.data.repeatIntervalHours).toBe(24);

      const list = cli(['habit', 'list'], tempHome);
      expect(list.ok).toBe(true);
      expect(list.data).toHaveLength(1);
    });

    it('adds a habit with custom interval', () => {
      const add = cli(['habit', 'add', '--text', 'Drink water', '--interval', '4'], tempHome);
      expect(add.data.repeatIntervalHours).toBe(4);
    });

    it('edits a habit by text', () => {
      cli(['habit', 'add', '--text', 'Old habit'], tempHome);

      cli(['habit', 'edit', '--text', 'Old habit', '--new-text', 'New habit', '--interval', '12'], tempHome);
      const list = cli(['habit', 'list'], tempHome);
      expect(list.data[0].text).toBe('New habit');
      expect(list.data[0].repeatIntervalHours).toBe(12);
    });

    it('deletes a habit by text', () => {
      cli(['habit', 'add', '--text', 'To delete habit'], tempHome);

      cli(['habit', 'delete', '--text', 'To delete habit'], tempHome);
      const list = cli(['habit', 'list'], tempHome);
      expect(list.data).toHaveLength(0);
    });

    it('completes a habit by text', () => {
      cli(['habit', 'add', '--text', 'Exercise'], tempHome);

      cli(['habit', 'complete', '--text', 'Exercise'], tempHome);
      const list = cli(['habit', 'list'], tempHome);
      expect(list.data[0].totalCompletions).toBe(1);
      expect(list.data[0].lastCompleted).toBeTruthy();
    });

    it('adds a note to a habit by text', () => {
      cli(['habit', 'add', '--text', 'Journal'], tempHome);

      cli(['habit', 'add-note', '--text', 'Journal', '--note', 'Great session'], tempHome);
      const list = cli(['habit', 'list'], tempHome);
      expect(list.data[0].notes).toHaveLength(1);
      expect(list.data[0].notes[0].text).toBe('Great session');
    });
  });

  describe('error handling', () => {
    it('errors on unknown entity', () => {
      const result = cli(['foo', 'bar'], tempHome);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown entity');
    });

    it('errors on unknown command', () => {
      const result = cli(['task', 'foo'], tempHome);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown command');
    });

    it('errors on missing required flags', () => {
      const result = cli(['task', 'add'], tempHome);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('--text');
    });

    it('errors when completing non-existent task', () => {
      const result = cli(['task', 'complete', '--id', 'nonexistent'], tempHome);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('persistence', () => {
    it('data persists across invocations', () => {
      cli(['task', 'add', '--text', 'Persistent task'], tempHome);
      cli(['habit', 'add', '--text', 'Persistent habit'], tempHome);

      const state = cli(['state', 'show'], tempHome);
      expect(state.data.tasks).toHaveLength(1);
      expect(state.data.habits).toHaveLength(1);
      expect(state.data.tasks[0].text).toBe('Persistent task');
      expect(state.data.habits[0].text).toBe('Persistent habit');
    });

    it('writes valid markdown to disk', () => {
      cli(['task', 'add', '--text', 'Check markdown'], tempHome);
      const md = readFileSync(join(tempHome, '.clawkeeper', 'current.md'), 'utf-8');
      expect(md).toContain('# Tasks');
      expect(md).toContain('Check markdown');
    });
  });

  describe('stable IDs across invocations', () => {
    it('task IDs persist across CLI invocations', () => {
      const add = cli(['task', 'add', '--text', 'Stable task'], tempHome);
      expect(add.ok).toBe(true);
      const taskId = add.data.id;

      // Second invocation should see the same ID
      const list = cli(['task', 'list'], tempHome);
      expect(list.data[0].id).toBe(taskId);
    });

    it('completes a task by --id across invocations', () => {
      const add = cli(['task', 'add', '--text', 'ID complete test'], tempHome);
      const taskId = add.data.id;

      const complete = cli(['task', 'complete', '--id', taskId], tempHome);
      expect(complete.ok).toBe(true);

      const list = cli(['task', 'list', '--all'], tempHome);
      expect(list.data[0].completed).toBe(true);
    });

    it('habit IDs persist across CLI invocations', () => {
      const add = cli(['habit', 'add', '--text', 'Stable habit'], tempHome);
      expect(add.ok).toBe(true);
      const habitId = add.data.id;

      const list = cli(['habit', 'list'], tempHome);
      expect(list.data[0].id).toBe(habitId);
    });

    it('subtask IDs persist across CLI invocations', () => {
      cli(['task', 'add', '--text', 'Parent'], tempHome);
      const sub = cli(['task', 'add-subtask', '--parent-text', 'Parent', '--text', 'Child'], tempHome);
      const childId = sub.data.id;

      const list = cli(['task', 'list'], tempHome);
      expect(list.data[0].children[0].id).toBe(childId);
    });
  });
});
