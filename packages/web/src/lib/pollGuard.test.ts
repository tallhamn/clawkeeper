import { describe, it, expect, vi } from 'vitest';
import { createPollGuard } from './pollGuard';

describe('createPollGuard', () => {
  it('allows polling when no mutation has occurred', () => {
    const guard = createPollGuard(3000);
    expect(guard.shouldPoll()).toBe(true);
  });

  it('suppresses polling immediately after a mutation', () => {
    const guard = createPollGuard(3000);
    guard.markMutation();
    expect(guard.shouldPoll()).toBe(false);
  });

  it('allows polling after the cooldown period', () => {
    const guard = createPollGuard(3000);
    guard.markMutation();

    // Advance time past cooldown
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 3001);
    expect(guard.shouldPoll()).toBe(true);
    vi.useRealTimers();
  });

  it('resets suppression on each new mutation', () => {
    vi.useFakeTimers();
    const guard = createPollGuard(3000);

    guard.markMutation();
    expect(guard.shouldPoll()).toBe(false);

    // Advance 2 seconds, mutation still cooling down
    vi.advanceTimersByTime(2000);
    expect(guard.shouldPoll()).toBe(false);

    // New mutation resets the clock
    guard.markMutation();
    vi.advanceTimersByTime(2000);
    expect(guard.shouldPoll()).toBe(false);

    // Full cooldown from second mutation
    vi.advanceTimersByTime(1001);
    expect(guard.shouldPoll()).toBe(true);

    vi.useRealTimers();
  });

  it('prevents stale poll from reverting a task uncomplete (regression)', () => {
    // Scenario: user uncompletes a task, poll fires with stale data
    vi.useFakeTimers();
    const guard = createPollGuard(3000);

    // User uncompletes task — mutation marked
    guard.markMutation();

    // 500ms later: stale poll result arrives
    vi.advanceTimersByTime(500);
    expect(guard.shouldPoll()).toBe(false); // poll should be skipped

    // 1500ms: mutation response arrives (state is correct)
    vi.advanceTimersByTime(1000);
    expect(guard.shouldPoll()).toBe(false); // still suppressed

    // 3500ms: safe to poll again
    vi.advanceTimersByTime(1500);
    expect(guard.shouldPoll()).toBe(true);

    vi.useRealTimers();
  });
});
