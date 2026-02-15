import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateId,
  getCurrentWindow,
  getRelativeTime,
  getTodayDate,
  formatDate,
  shouldResetHabits,
  isHabitAvailable,
  getHoursUntilAvailable,
  formatInterval,
  formatTimeSince,
  formatCountdown,
} from './utils';

describe('generateId', () => {
  it('should generate a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should generate IDs of consistent length', () => {
    const id = generateId();
    expect(id.length).toBe(9);
  });
});

describe('getCurrentWindow', () => {
  it('should return morning for hours 6-10', () => {
    expect(getCurrentWindow(6)).toBe('morning');
    expect(getCurrentWindow(8)).toBe('morning');
    expect(getCurrentWindow(10)).toBe('morning');
  });

  it('should return midday for hours 11-13', () => {
    expect(getCurrentWindow(11)).toBe('midday');
    expect(getCurrentWindow(12)).toBe('midday');
    expect(getCurrentWindow(13)).toBe('midday');
  });

  it('should return afternoon for hours 14-16', () => {
    expect(getCurrentWindow(14)).toBe('afternoon');
    expect(getCurrentWindow(15)).toBe('afternoon');
    expect(getCurrentWindow(16)).toBe('afternoon');
  });

  it('should return evening for hours 17-20', () => {
    expect(getCurrentWindow(17)).toBe('evening');
    expect(getCurrentWindow(19)).toBe('evening');
    expect(getCurrentWindow(20)).toBe('evening');
  });

  it('should return night for hours 21-23', () => {
    expect(getCurrentWindow(21)).toBe('night');
    expect(getCurrentWindow(22)).toBe('night');
    expect(getCurrentWindow(23)).toBe('night');
  });

  it('should return morning for hours 0-5 (default fallback)', () => {
    expect(getCurrentWindow(0)).toBe('morning');
    expect(getCurrentWindow(3)).toBe('morning');
    expect(getCurrentWindow(5)).toBe('morning');
  });
});

describe('getRelativeTime', () => {
  it('should return null if completed today', () => {
    expect(getRelativeTime('morning', 8, true)).toBe(null);
  });

  it('should return "now" when in the current window', () => {
    const result = getRelativeTime('morning', 8, false);
    expect(result).toEqual({ text: 'now', state: 'current' });
  });

  it('should return "coming up" when 1 hour or less away', () => {
    // Morning starts at 6, currently at 5 (1 hour away)
    const result = getRelativeTime('morning', 5, false);
    expect(result).toEqual({ text: 'coming up', state: 'upcoming' });
  });

  it('should return hours away when 2-3 hours away', () => {
    // Morning starts at 6, currently at 3 (3 hours away)
    const result = getRelativeTime('morning', 3, false);
    expect(result).toEqual({ text: '~3h away', state: 'upcoming' });
  });

  it('should return "later" when more than 3 hours away', () => {
    // Morning starts at 6, currently at 0 (6 hours away)
    const result = getRelativeTime('morning', 0, false);
    expect(result).toEqual({ text: 'later', state: 'future' });
  });

  it('should return "still open" when 1-2 hours past window', () => {
    // Morning ends at 11, currently at 12 (1 hour past)
    const result = getRelativeTime('morning', 12, false);
    expect(result).toEqual({ text: 'still open', state: 'past' });
  });

  it('should return "earlier" when more than 2 hours past', () => {
    // Morning ends at 11, currently at 14 (3 hours past)
    const result = getRelativeTime('morning', 14, false);
    expect(result).toEqual({ text: 'earlier', state: 'past' });
  });
});

describe('getTodayDate', () => {
  it('should return date in YYYY-MM-DD format', () => {
    const date = getTodayDate();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDate', () => {
  it('should return a string', () => {
    const result = formatDate('2025-01-08');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return relative dates for recent dates', () => {
    const result = formatDate('2025-01-08');
    // Should be either 'today', 'yesterday', or a date string
    expect(['today', 'yesterday'].includes(result) || result.match(/^\d{4}-\d{2}-\d{2}$/)).toBeTruthy();
  });

  it('should return the date string for old dates', () => {
    const result = formatDate('2020-01-01');
    expect(result).toBe('2020-01-01');
  });
});

describe('shouldResetHabits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true if lastResetDate is null', () => {
    expect(shouldResetHabits(null)).toBe(true);
  });

  it('should return false if lastResetDate is today', () => {
    expect(shouldResetHabits('2025-01-08')).toBe(false);
  });

  it('should return true if lastResetDate is yesterday', () => {
    expect(shouldResetHabits('2025-01-07')).toBe(true);
  });
});

describe('isHabitAvailable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T12:00:00Z')); // Noon on Jan 8
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true if never completed', () => {
    expect(isHabitAvailable(null, 24)).toBe(true);
  });

  it('should return true if interval has passed', () => {
    // Completed 25 hours ago, interval is 24 hours
    const twentyFiveHoursAgo = new Date('2025-01-07T11:00:00Z').toISOString();
    expect(isHabitAvailable(twentyFiveHoursAgo, 24)).toBe(true);
  });

  it('should return false if interval has not passed', () => {
    // Completed 23 hours ago, interval is 24 hours
    const twentyThreeHoursAgo = new Date('2025-01-07T13:00:00Z').toISOString();
    expect(isHabitAvailable(twentyThreeHoursAgo, 24)).toBe(false);
  });

  it('should return true exactly at interval boundary', () => {
    // Completed exactly 24 hours ago
    const exactlyOneDayAgo = new Date('2025-01-07T12:00:00Z').toISOString();
    expect(isHabitAvailable(exactlyOneDayAgo, 24)).toBe(true);
  });

  it('should work with short intervals', () => {
    // Completed 5 hours ago, interval is 4 hours
    const fiveHoursAgo = new Date('2025-01-08T07:00:00Z').toISOString();
    expect(isHabitAvailable(fiveHoursAgo, 4)).toBe(true);

    // Completed 3 hours ago, interval is 4 hours
    const threeHoursAgo = new Date('2025-01-08T09:00:00Z').toISOString();
    expect(isHabitAvailable(threeHoursAgo, 4)).toBe(false);
  });
});

describe('getHoursUntilAvailable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return -1 if never completed', () => {
    expect(getHoursUntilAvailable(null, 24)).toBe(-1);
  });

  it('should return negative hours if already available', () => {
    // Completed 25 hours ago, interval is 24 hours
    const twentyFiveHoursAgo = new Date('2025-01-07T11:00:00Z').toISOString();
    expect(getHoursUntilAvailable(twentyFiveHoursAgo, 24)).toBeLessThan(0);
  });

  it('should return positive hours if not yet available', () => {
    // Completed 20 hours ago, interval is 24 hours
    const twentyHoursAgo = new Date('2025-01-07T16:00:00Z').toISOString();
    const hoursUntil = getHoursUntilAvailable(twentyHoursAgo, 24);
    expect(hoursUntil).toBeCloseTo(4, 0); // ~4 hours until available
  });

  it('should return 0 at exact boundary', () => {
    // Completed exactly 24 hours ago
    const exactlyOneDayAgo = new Date('2025-01-07T12:00:00Z').toISOString();
    expect(getHoursUntilAvailable(exactlyOneDayAgo, 24)).toBeCloseTo(0, 5);
  });
});

describe('formatInterval', () => {
  it('should format hours when less than 24', () => {
    expect(formatInterval(1)).toBe('1h');
    expect(formatInterval(4)).toBe('4h');
    expect(formatInterval(12)).toBe('12h');
    expect(formatInterval(23)).toBe('23h');
  });

  it('should format days when 24 or more hours', () => {
    expect(formatInterval(24)).toBe('1d');
    expect(formatInterval(48)).toBe('2d');
    expect(formatInterval(168)).toBe('7d');
  });

  it('should round down for partial days', () => {
    expect(formatInterval(36)).toBe('1d'); // 1.5 days
    expect(formatInterval(71)).toBe('2d'); // 2.96 days
  });
});

describe('formatTimeSince', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "not done yet" if never completed', () => {
    expect(formatTimeSince(null)).toBe('not done yet');
  });

  it('should return "done just now" for <1 minute', () => {
    const thirtySecondsAgo = new Date('2025-01-08T11:59:30Z').toISOString();
    expect(formatTimeSince(thirtySecondsAgo)).toBe('done just now');
  });

  it('should return minutes for <60 minutes', () => {
    const thirtyMinutesAgo = new Date('2025-01-08T11:30:00Z').toISOString();
    expect(formatTimeSince(thirtyMinutesAgo)).toBe('done 30m ago');

    const oneMinuteAgo = new Date('2025-01-08T11:59:00Z').toISOString();
    expect(formatTimeSince(oneMinuteAgo)).toBe('done 1m ago');
  });

  it('should return hours for <24 hours', () => {
    const twoHoursAgo = new Date('2025-01-08T10:00:00Z').toISOString();
    expect(formatTimeSince(twoHoursAgo)).toBe('done 2h ago');

    const twentyThreeHoursAgo = new Date('2025-01-07T13:00:00Z').toISOString();
    expect(formatTimeSince(twentyThreeHoursAgo)).toBe('done 23h ago');
  });

  it('should return days for 24+ hours', () => {
    const oneDayAgo = new Date('2025-01-07T12:00:00Z').toISOString();
    expect(formatTimeSince(oneDayAgo)).toBe('done 1d ago');

    const threeDaysAgo = new Date('2025-01-05T12:00:00Z').toISOString();
    expect(formatTimeSince(threeDaysAgo)).toBe('done 3d ago');
  });
});

describe('formatCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "ready now" if never completed', () => {
    expect(formatCountdown(null, 24)).toBe('ready now');
  });

  it('should return "ready now" if interval has passed', () => {
    const twentyFiveHoursAgo = new Date('2025-01-07T11:00:00Z').toISOString();
    expect(formatCountdown(twentyFiveHoursAgo, 24)).toBe('ready now');
  });

  it('should format hours, minutes, seconds when hours > 0', () => {
    // Completed 20 hours ago, interval is 24 hours → 4 hours remaining
    const twentyHoursAgo = new Date('2025-01-07T16:00:00Z').toISOString();
    expect(formatCountdown(twentyHoursAgo, 24)).toBe('active again in 4h0m0s');
  });

  it('should format minutes and seconds when < 1 hour remaining', () => {
    // Completed 23 hours 30 minutes ago, interval is 24 hours → 30 minutes remaining
    const twentyThreeHoursThirtyMinsAgo = new Date('2025-01-07T12:30:00Z').toISOString();
    expect(formatCountdown(twentyThreeHoursThirtyMinsAgo, 24)).toBe('active again in 30m0s');
  });

  it('should format only seconds when < 1 minute remaining', () => {
    // Completed 23 hours 59 minutes 30 seconds ago → 30 seconds remaining
    const almostOneDayAgo = new Date('2025-01-07T12:00:30Z').toISOString();
    expect(formatCountdown(almostOneDayAgo, 24)).toBe('active again in 30s');
  });

  it('should work with short intervals', () => {
    // Completed 3 hours 30 minutes ago, interval is 4 hours → 30 minutes remaining
    const threeHoursThirtyMinsAgo = new Date('2025-01-08T08:30:00Z').toISOString();
    expect(formatCountdown(threeHoursThirtyMinsAgo, 4)).toBe('active again in 30m0s');
  });
});
