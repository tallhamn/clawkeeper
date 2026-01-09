import type { TimeWindow, RelativeTime } from './types';
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
export function isHabitAvailable(lastCompleted: string | null, intervalHours: number): boolean {
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
