import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { saveCurrentState, loadCurrentState, watchCurrentFile } from './storage';
import { serializeToMarkdown, parseMarkdown } from '@clawkeeper/shared/src/markdown';
import type { AppState } from '@clawkeeper/shared/src/types';

// The Tauri mocks are set up in src/test/setup.ts

const MOCK_HOME = '/Users/test';
const MOCK_MD_PATH = `${MOCK_HOME}/.clawkeeper/current.md`;

const makeState = (taskTexts: string[]): AppState => ({
  habits: [],
  tasks: taskTexts.map((text, i) => ({
    id: `t${i}`,
    text,
    completed: false,
    completedAt: null,
    notes: [],
    children: [],
  })),
});

describe('File watcher — self-write detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(homeDir).mockResolvedValue(MOCK_HOME);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should NOT fire onChange when file matches what we last saved', async () => {
    const state = makeState(['Buy groceries']);
    const markdown = serializeToMarkdown(state.habits, state.tasks);

    // Save state first — this sets lastWrittenMarkdown internally
    vi.mocked(readTextFile).mockResolvedValue('');
    await saveCurrentState(state);

    // Now the watcher reads the same content back
    vi.mocked(readTextFile).mockResolvedValue(markdown);

    const onChange = vi.fn();
    await watchCurrentFile(onChange);

    // Advance past the 2-second polling interval
    await vi.advanceTimersByTimeAsync(2500);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('should fire onChange when file differs from what we last saved', async () => {
    const state = makeState(['Buy groceries']);
    const markdown = serializeToMarkdown(state.habits, state.tasks);

    // Save state first
    vi.mocked(readTextFile).mockResolvedValue('');
    await saveCurrentState(state);

    // External process adds a task — file content changes
    const externalState = makeState(['Buy groceries', 'Walk the dog']);
    const externalMarkdown = serializeToMarkdown(externalState.habits, externalState.tasks);
    vi.mocked(readTextFile).mockResolvedValue(externalMarkdown);

    const onChange = vi.fn();
    await watchCurrentFile(onChange);

    await vi.advanceTimersByTimeAsync(2500);

    expect(onChange).toHaveBeenCalledTimes(1);
    const received = onChange.mock.calls[0][0] as AppState;
    expect(received.tasks).toHaveLength(2);
    expect(received.tasks[1].text).toBe('Walk the dog');
  });

  it('should not fire again if file stays the same across polls', async () => {
    const state = makeState(['Task A']);
    const markdown = serializeToMarkdown(state.habits, state.tasks);

    // Seed lastWrittenMarkdown with something different so first poll triggers
    vi.mocked(readTextFile).mockResolvedValue('');
    await saveCurrentState(makeState([]));

    vi.mocked(readTextFile).mockResolvedValue(markdown);

    const onChange = vi.fn();
    await watchCurrentFile(onChange);

    // First poll detects change
    await vi.advanceTimersByTimeAsync(2500);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Second poll — same content, should not fire
    await vi.advanceTimersByTimeAsync(2500);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('File watcher — polling behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(homeDir).mockResolvedValue(MOCK_HOME);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should poll every 2 seconds', async () => {
    vi.mocked(readTextFile).mockResolvedValue('');

    const onChange = vi.fn();
    await watchCurrentFile(onChange);

    // At 1.5s — not yet polled
    await vi.advanceTimersByTimeAsync(1500);
    expect(readTextFile).toHaveBeenCalledTimes(0);

    // At 2.5s — first poll
    await vi.advanceTimersByTimeAsync(1000);
    expect(readTextFile).toHaveBeenCalledTimes(1);

    // At 4.5s — second poll
    await vi.advanceTimersByTimeAsync(2000);
    expect(readTextFile).toHaveBeenCalledTimes(2);
  });

  it('should stop polling when unwatch is called', async () => {
    vi.mocked(readTextFile).mockResolvedValue('');

    const onChange = vi.fn();
    const unwatch = await watchCurrentFile(onChange);

    await vi.advanceTimersByTimeAsync(2500);
    expect(readTextFile).toHaveBeenCalledTimes(1);

    // Stop watching
    unwatch();

    await vi.advanceTimersByTimeAsync(5000);
    // Should not have polled again
    expect(readTextFile).toHaveBeenCalledTimes(1);
  });

  it('should handle readTextFile errors gracefully without crashing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readTextFile).mockRejectedValue(new Error('ENOENT'));

    const onChange = vi.fn();
    await watchCurrentFile(onChange);

    await vi.advanceTimersByTimeAsync(2500);

    expect(onChange).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('[Watcher] Error reading file:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

describe('loadCurrentState — direct read without exists()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeDir).mockResolvedValue(MOCK_HOME);
  });

  it('should return parsed state when file exists', async () => {
    const state = makeState(['Buy groceries', 'Walk the dog']);
    const markdown = serializeToMarkdown(state.habits, state.tasks);
    vi.mocked(readTextFile).mockResolvedValue(markdown);

    const loaded = await loadCurrentState();

    expect(loaded).not.toBeNull();
    expect(loaded!.tasks).toHaveLength(2);
    expect(loaded!.tasks[0].text).toBe('Buy groceries');
    expect(readTextFile).toHaveBeenCalledWith(MOCK_MD_PATH);
  });

  it('should return null when file does not exist (no exists() call)', async () => {
    vi.mocked(readTextFile).mockRejectedValue(new Error('ENOENT'));

    const loaded = await loadCurrentState();

    expect(loaded).toBeNull();
    // Crucially: exists() should NOT have been called
    const { exists } = await import('@tauri-apps/plugin-fs');
    expect(exists).not.toHaveBeenCalled();
  });

  it('should seed lastWrittenMarkdown so watcher skips initial content', async () => {
    const state = makeState(['Existing task']);
    const markdown = serializeToMarkdown(state.habits, state.tasks);
    vi.mocked(readTextFile).mockResolvedValue(markdown);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    // Load seeds lastWrittenMarkdown
    await loadCurrentState();

    // Now start watcher — it should NOT fire because content matches
    vi.useFakeTimers();
    const onChange = vi.fn();
    await watchCurrentFile(onChange);
    await vi.advanceTimersByTimeAsync(2500);

    expect(onChange).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('saveCurrentState — sets lastWrittenMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeDir).mockResolvedValue(MOCK_HOME);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
  });

  it('should mark saved content so watcher ignores it', async () => {
    const state = makeState(['Task from UI']);
    const markdown = serializeToMarkdown(state.habits, state.tasks);

    await saveCurrentState(state);

    // Watcher reads back what we just wrote
    vi.mocked(readTextFile).mockResolvedValue(markdown);

    vi.useFakeTimers();
    const onChange = vi.fn();
    await watchCurrentFile(onChange);
    await vi.advanceTimersByTimeAsync(2500);

    expect(onChange).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should let watcher fire when external process modifies file after save', async () => {
    const state = makeState(['Task from UI']);
    await saveCurrentState(state);

    // External process writes different content
    const externalState = makeState(['Task from UI', 'Task from CLI']);
    const externalMarkdown = serializeToMarkdown(externalState.habits, externalState.tasks);
    vi.mocked(readTextFile).mockResolvedValue(externalMarkdown);

    vi.useFakeTimers();
    const onChange = vi.fn();
    await watchCurrentFile(onChange);
    await vi.advanceTimersByTimeAsync(2500);

    expect(onChange).toHaveBeenCalledTimes(1);
    const received = onChange.mock.calls[0][0] as AppState;
    expect(received.tasks).toHaveLength(2);
    expect(received.tasks[1].text).toBe('Task from CLI');
    vi.useRealTimers();
  });
});

describe('Markdown round-trip through watcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeDir).mockResolvedValue(MOCK_HOME);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
  });

  it('should preserve task structure through save → external read → parse cycle', async () => {
    const state: AppState = {
      habits: [
        {
          id: 'h1',
          text: 'Drink water',
          repeatIntervalHours: 4,
          lastCompleted: null,
          totalCompletions: 3,
          notes: [{ text: 'Felt great', createdAt: '2026-02-13T10:00:00Z' }],
        },
      ],
      tasks: [
        {
          id: 't1',
          text: 'Parent task',
          completed: false,
          completedAt: null,
          notes: [{ text: 'Important note', createdAt: '2026-02-13T10:00:00Z' }],
          children: [
            {
              id: 't2',
              text: 'Subtask',
              completed: true,
              completedAt: '2026-02-13',
              notes: [],
              children: [],
            },
          ],
        },
      ],
    };

    // Capture what saveCurrentState writes
    let writtenMarkdown = '';
    vi.mocked(writeTextFile).mockImplementation(async (_path: string, content: string) => {
      writtenMarkdown = content;
    });

    await saveCurrentState(state);

    // Simulate the watcher reading back the written file
    const parsed = parseMarkdown(writtenMarkdown);

    expect(parsed.habits).toHaveLength(1);
    expect(parsed.habits[0].text).toBe('Drink water');
    expect(parsed.habits[0].totalCompletions).toBe(3);
    expect(parsed.habits[0].notes).toHaveLength(1);

    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].text).toBe('Parent task');
    expect(parsed.tasks[0].notes).toHaveLength(1);
    expect(parsed.tasks[0].children).toHaveLength(1);
    expect(parsed.tasks[0].children[0].text).toBe('Subtask');
    expect(parsed.tasks[0].children[0].completed).toBe(true);
  });
});
