import type { Habit, TimeWindow, RelativeTime } from './types';
import { TIME_WINDOWS } from './types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Get current time window based on hour (0-23)
 */
export function getCurrentWindow(hour: number): TimeWindow {
  for (const [key, window] of Object.entries(TIME_WINDOWS)) {
    if (hour >= window.start && hour < window.end) {
      return key as TimeWindow;
    }
  }
  return 'morning';
}

/**
 * Get relative time indicator for a habit
 */
export function getRelativeTime(
  windowKey: TimeWindow,
  currentHour: number,
  completedToday: boolean
): RelativeTime | null {
  if (completedToday) return null;

  const window = TIME_WINDOWS[windowKey];

  if (currentHour < window.start) {
    const hoursUntil = window.start - currentHour;
    if (hoursUntil <= 1) return { text: 'coming up', state: 'upcoming' };
    if (hoursUntil <= 3) return { text: `~${Math.round(hoursUntil)}h away`, state: 'upcoming' };
    return { text: 'later', state: 'future' };
  } else if (currentHour >= window.start && currentHour < window.end) {
    return { text: 'now', state: 'current' };
  } else {
    const hoursPast = currentHour - window.end;
    if (hoursPast <= 2) return { text: 'still open', state: 'past' };
    return { text: 'earlier', state: 'past' };
  }
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'yesterday';
  } else {
    return dateStr;
  }
}

/**
 * Check if we need to reset habits for a new day
 */
export function shouldResetHabits(lastResetDate: string | null): boolean {
  if (!lastResetDate) return true;
  return lastResetDate !== getTodayDate();
}

/**
 * Check if a habit is currently available (ready to be completed)
 */
export function isHabitAvailable(lastCompleted: string | null, intervalHours: number, forcedAvailable?: boolean): boolean {
  // If habit is forced available (woken up from standby), it's always available
  if (forcedAvailable) return true;

  if (!lastCompleted) return true; // Never completed, always available

  const lastCompletedTime = new Date(lastCompleted).getTime();
  const now = Date.now();
  const intervalMs = intervalHours * 60 * 60 * 1000;

  return now - lastCompletedTime >= intervalMs;
}

/**
 * Get hours until a habit is available (negative if already available)
 */
export function getHoursUntilAvailable(lastCompleted: string | null, intervalHours: number): number {
  if (!lastCompleted) return -1; // Already available

  const lastCompletedTime = new Date(lastCompleted).getTime();
  const now = Date.now();
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const nextAvailableTime = lastCompletedTime + intervalMs;

  const msUntilAvailable = nextAvailableTime - now;
  return msUntilAvailable / (60 * 60 * 1000); // Convert to hours
}

/**
 * Format interval hours for display
 */
export function formatInterval(hours: number): string {
  if (hours < 24) {
    return `${hours}h`;
  } else {
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
}

/**
 * Format time since last completion
 */
export function formatTimeSince(lastCompleted: string | null, totalCompletions?: number): string {
  // Handle corrupted state: if habit has completions but no timestamp, show that it was done before
  if (!lastCompleted) {
    return totalCompletions && totalCompletions > 0 ? 'done previously' : 'not done yet';
  }

  const now = Date.now();
  const completedTime = new Date(lastCompleted).getTime();
  const diffMs = now - completedTime;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMinutes < 1) return 'done just now';
  if (diffMinutes < 60) return `done ${diffMinutes}m ago`;
  if (diffHours < 24) return `done ${diffHours}h ago`;
  return `done ${diffDays}d ago`;
}

/**
 * Due-date status categories
 */
export type DueDateStatus = 'overdue' | 'due-today' | 'upcoming' | 'future';

/**
 * Get the urgency status of a due date relative to today.
 * Returns null if dueDate is null/undefined.
 */
export function getDueDateStatus(dueDate: string | null | undefined): DueDateStatus | null {
  if (!dueDate) return null;
  const today = getTodayDate();
  const diffDays = dateDiffDays(today, dueDate);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due-today';
  if (diffDays <= 3) return 'upcoming';
  return 'future';
}

/**
 * Human-readable label for a due date relative to today.
 * Returns null if dueDate is null/undefined.
 */
export function formatDueDate(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null;
  const today = getTodayDate();
  const diff = dateDiffDays(today, dueDate);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  return `in ${diff}d`;
}

/**
 * Difference in calendar days from dateA to dateB.
 * Positive means dateB is in the future relative to dateA.
 */
function dateDiffDays(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Format countdown until habit is available again
 */
export function formatCountdown(lastCompleted: string | null, intervalHours: number): string {
  if (!lastCompleted) return 'ready now';

  const lastCompletedTime = new Date(lastCompleted).getTime();
  const now = Date.now();
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const nextAvailableTime = lastCompletedTime + intervalMs;
  const msUntilAvailable = nextAvailableTime - now;

  if (msUntilAvailable <= 0) return 'ready now';

  const hours = Math.floor(msUntilAvailable / (60 * 60 * 1000));
  const minutes = Math.floor((msUntilAvailable % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((msUntilAvailable % (60 * 1000)) / 1000);

  if (hours > 0) {
    return `active again in ${hours}h${minutes}m${seconds}s`;
  } else if (minutes > 0) {
    return `active again in ${minutes}m${seconds}s`;
  } else {
    return `active again in ${seconds}s`;
  }
}

/**
 * Sort habits as a priority queue.
 * Available habits first (sorted by urgency score descending),
 * then resting habits (sorted by soonest to become available).
 *
 * Urgency score = overdueRatio + timeBoost
 * - overdueRatio: how overdue the habit is relative to its interval
 * - timeBoost: 0–0.5 bonus when current hour is close to preferredHour
 */
export function sortHabitQueue(habits: Habit[], currentHour: number): Habit[] {
  const now = Date.now();

  function circularHourDistance(a: number, b: number): number {
    const diff = Math.abs(a - b);
    return Math.min(diff, 24 - diff);
  }

  /** Lower = sooner = higher priority. */
  function getForwardHours(habit: Habit): number {
    if (habit.preferredHour == null) return 12; // no preference → middle of the pack
    // Hours until the next occurrence of preferredHour
    const forward = (habit.preferredHour - currentHour + 24) % 24;
    return forward === 0 ? 0 : forward; // 0 means "right now"
  }

  const available: Habit[] = [];
  const resting: Habit[] = [];

  for (const habit of habits) {
    if (isHabitAvailable(habit.lastCompleted, habit.repeatIntervalHours, habit.forcedAvailable)) {
      available.push(habit);
    } else {
      resting.push(habit);
    }
  }

  // Available: soonest preferred hour first
  available.sort((a, b) => getForwardHours(a) - getForwardHours(b));

  // Resting: soonest to become available first
  resting.sort((a, b) => {
    const aHours = getHoursUntilAvailable(a.lastCompleted, a.repeatIntervalHours);
    const bHours = getHoursUntilAvailable(b.lastCompleted, b.repeatIntervalHours);
    return aHours - bHours;
  });

  return [...available, ...resting];
}
