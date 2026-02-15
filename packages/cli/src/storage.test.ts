import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We need to control HOME before importing storage, so we use dynamic imports
describe('storage', () => {
  let tempHome: string;
  let originalHome: string | undefined;
  let originalClawkeeperDir: string | undefined;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'clawkeeper-test-'));
    originalHome = process.env.HOME;
    originalClawkeeperDir = process.env.CLAWKEEPER_DIR;
    process.env.HOME = tempHome;
    delete process.env.CLAWKEEPER_DIR;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    if (originalClawkeeperDir !== undefined) {
      process.env.CLAWKEEPER_DIR = originalClawkeeperDir;
    } else {
      delete process.env.CLAWKEEPER_DIR;
    }
    rmSync(tempHome, { recursive: true, force: true });
  });

  it('loadState returns empty state when file does not exist', async () => {
    const { loadState } = await import('./storage');
    const state = loadState();
    expect(state).toEqual({ habits: [], tasks: [] });
  });

  it('loadState reads and parses existing markdown', async () => {
    const appDir = join(tempHome, '.clawkeeper');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, 'current.md'), `# Habits

## Meditate
- Interval: 24h
- Total Completions: 5
- Last completed: never

---

# Tasks

## Buy groceries
- [ ] Milk
- [ ] Eggs

`, 'utf-8');

    const { loadState } = await import('./storage');
    const state = loadState();
    expect(state.habits).toHaveLength(1);
    expect(state.habits[0].text).toBe('Meditate');
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].text).toBe('Buy groceries');
    expect(state.tasks[0].children).toHaveLength(2);
  });

  it('saveState creates directory and writes markdown', async () => {
    const { saveState } = await import('./storage');
    saveState({
      habits: [{
        id: 'h1',
        text: 'Exercise',
        repeatIntervalHours: 24,
        lastCompleted: null,
        totalCompletions: 0,
        notes: [],
      }],
      tasks: [{
        id: 't1',
        text: 'Do laundry',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      }],
    });

    const content = readFileSync(join(tempHome, '.clawkeeper', 'current.md'), 'utf-8');
    expect(content).toContain('# Habits');
    expect(content).toContain('Exercise');
    expect(content).toContain('# Tasks');
    expect(content).toContain('Do laundry');
  });

  it('round-trips state through save and load', async () => {
    const { saveState, loadState } = await import('./storage');
    const original = {
      habits: [{
        id: 'h1',
        text: 'Read',
        repeatIntervalHours: 12,
        lastCompleted: '2025-01-01T10:00:00.000Z',
        totalCompletions: 3,
        notes: [{ text: 'Good session', createdAt: '2025-01-01T10:00:00.000Z' }],
      }],
      tasks: [{
        id: 't1',
        text: 'Project',
        completed: false,
        completedAt: null,
        notes: [],
        children: [{
          id: 't2',
          text: 'Subtask',
          completed: true,
          completedAt: '2025-01-01',
          notes: [],
          children: [],
        }],
      }],
    };

    saveState(original);
    const loaded = loadState();

    // IDs are now stable through save/load round-trips
    expect(loaded.habits).toHaveLength(1);
    expect(loaded.habits[0].id).toBe('h1');
    expect(loaded.habits[0].text).toBe('Read');
    expect(loaded.habits[0].repeatIntervalHours).toBe(12);
    expect(loaded.habits[0].totalCompletions).toBe(3);
    expect(loaded.habits[0].notes).toHaveLength(1);

    expect(loaded.tasks).toHaveLength(1);
    expect(loaded.tasks[0].id).toBe('t1');
    expect(loaded.tasks[0].text).toBe('Project');
    expect(loaded.tasks[0].children).toHaveLength(1);
    expect(loaded.tasks[0].children[0].id).toBe('t2');
    expect(loaded.tasks[0].children[0].text).toBe('Subtask');
    expect(loaded.tasks[0].children[0].completed).toBe(true);
  });

  it('uses CLAWKEEPER_DIR when set', async () => {
    const customDir = mkdtempSync(join(tmpdir(), 'clawkeeper-custom-'));
    process.env.CLAWKEEPER_DIR = customDir;

    try {
      const { saveState, loadState } = await import('./storage');
      saveState({
        habits: [],
        tasks: [{ id: 't1', text: 'Custom dir task', completed: false, completedAt: null, notes: [], children: [] }],
      });

      const content = readFileSync(join(customDir, 'current.md'), 'utf-8');
      expect(content).toContain('Custom dir task');

      const loaded = loadState();
      expect(loaded.tasks[0].text).toBe('Custom dir task');
    } finally {
      rmSync(customDir, { recursive: true, force: true });
    }
  });
});
