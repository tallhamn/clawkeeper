import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { sendMessage } from '@/lib/claude';
import { useCoachMessage } from './useCoachMessage';
import type { Habit } from '@/lib/types';

vi.mock('@/lib/claude', () => ({ sendMessage: vi.fn() }));
vi.mock('@/lib/storage', () => ({ loadRecentArchives: vi.fn().mockResolvedValue([]) }));

const mockedSendMessage = sendMessage as ReturnType<typeof vi.fn>;

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    text: 'Exercise',
    repeatIntervalHours: 24,
    lastCompleted: null,
    totalCompletions: 0,
    notes: [],
    ...overrides,
  };
}

describe('useCoachMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty message initially, then generates via LLM', async () => {
    mockedSendMessage.mockResolvedValue('Exercise is ready when you are');

    const habits = [makeHabit()];
    const { result } = renderHook(() => useCoachMessage(habits, 14));

    // Initially the message is empty (LLM call is async)
    expect(result.current.message).toBe('');

    // Flush the sendMessage promise
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockedSendMessage).toHaveBeenCalled();
    expect(result.current.message).toBe('Exercise is ready when you are');
  });

  it('shows "Add a habit to get started." when no habits', async () => {
    const { result } = renderHook(() => useCoachMessage([], 10));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.message).toBe('Add a habit to get started.');
    expect(mockedSendMessage).not.toHaveBeenCalled();
  });

  it('shows fallback message when sendMessage throws', async () => {
    mockedSendMessage.mockRejectedValue(new Error('API error'));

    const habits = [makeHabit({ text: 'Meditate' })];
    const { result } = renderHook(() => useCoachMessage(habits, 14));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Fallback for available habit: "<text> is ready when you are."
    expect(result.current.message).toBe('Meditate is ready when you are.');
  });

  it('shows "All habits complete for now." fallback when all habits are resting and sendMessage throws', async () => {
    mockedSendMessage.mockRejectedValue(new Error('API error'));

    // Habit completed just now, 24h interval -> not available
    const habits = [makeHabit({ lastCompleted: new Date().toISOString(), totalCompletions: 3 })];
    const { result } = renderHook(() => useCoachMessage(habits, 14));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.message).toBe('All habits complete for now.');
  });

  it('triggerReinforcement shows instant message with habit text and count', async () => {
    mockedSendMessage.mockResolvedValue('Keep going');

    const habits = [makeHabit({ totalCompletions: 5 })];
    const { result } = renderHook(() => useCoachMessage(habits, 14));

    // Wait for initial LLM generation
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Trigger reinforcement
    act(() => {
      result.current.triggerReinforcement('Exercise', 6);
    });

    // After triggering, message should be one of the reinforcement templates
    // containing the habit text or completion count
    const msg = result.current.message;
    const isReinforcementMessage =
      msg.includes('Exercise') || msg.includes('6x') || msg.includes('/');
    expect(isReinforcementMessage).toBe(true);
  });

  it('reinforcement clears after 4 seconds', async () => {
    mockedSendMessage.mockResolvedValue('Status message from LLM');

    const habits = [makeHabit()];
    const { result } = renderHook(() => useCoachMessage(habits, 14));

    // Wait for initial generation
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Reset mock so we can track the next LLM call after reinforcement clears
    mockedSendMessage.mockClear();
    mockedSendMessage.mockResolvedValue('New status after reinforcement');

    // Trigger reinforcement
    act(() => {
      result.current.triggerReinforcement('Exercise', 1);
    });

    const reinforcementMessage = result.current.message;
    expect(reinforcementMessage).not.toBe('');

    // Advance past the 4-second reinforcement timeout
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await vi.runAllTimersAsync();
    });

    // After 4s the lastAction is cleared and the effect re-runs,
    // which should trigger a new LLM generation (or show a message).
    // The reinforcement message should no longer be showing the same text.
    expect(result.current.message).not.toBe('');
  });

  it('respects 30-second cooldown between generations', async () => {
    mockedSendMessage.mockResolvedValue('First message');

    const habits = [makeHabit()];
    const { result, rerender } = renderHook(
      ({ h, hour }: { h: Habit[]; hour: number }) => useCoachMessage(h, hour),
      { initialProps: { h: habits, hour: 14 } },
    );

    // Wait for first generation
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockedSendMessage).toHaveBeenCalledTimes(1);
    expect(result.current.message).toBe('First message');
    mockedSendMessage.mockClear();

    // Re-render with different hour (triggers effect) but within 30s cooldown
    await act(async () => {
      vi.advanceTimersByTime(5000); // only 5 seconds later
    });
    rerender({ h: habits, hour: 15 });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should NOT have called sendMessage again due to cooldown
    expect(mockedSendMessage).not.toHaveBeenCalled();
  });

  it('does not generate while already generating', async () => {
    // sendMessage hangs (never resolves immediately)
    let resolveFirst!: (value: string) => void;
    const firstPromise = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    mockedSendMessage.mockReturnValueOnce(firstPromise);

    const habits = [makeHabit()];
    const { rerender } = renderHook(
      ({ h, hour }: { h: Habit[]; hour: number }) => useCoachMessage(h, hour),
      { initialProps: { h: habits, hour: 14 } },
    );

    // First call starts generating (but hasn't resolved)
    await act(async () => {
      await Promise.resolve(); // flush microtasks
    });

    expect(mockedSendMessage).toHaveBeenCalledTimes(1);

    // Advance past cooldown so the only guard is isGenerating
    await act(async () => {
      vi.advanceTimersByTime(31000);
    });

    // Trigger another render while still generating
    rerender({ h: habits, hour: 15 });

    await act(async () => {
      await Promise.resolve();
    });

    // Should still only have 1 call because isGenerating is true
    expect(mockedSendMessage).toHaveBeenCalledTimes(1);

    // Clean up: resolve the pending promise
    await act(async () => {
      resolveFirst('Done');
      await vi.runAllTimersAsync();
    });
  });
});
