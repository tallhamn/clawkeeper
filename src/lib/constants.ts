/**
 * Application constants
 */

// App version - increment this to show splash screen on new builds
export const APP_VERSION = '1.0.0';

// Feature flags
export const ENABLE_AUTO_REFLECTION = false; // Set to false to disable automatic reflection prompts

// Storage paths
// Local directory: ~/.welltime (iCloud can be configured later with proper entitlements)
export const APP_DIR_NAME = '/.welltime';
export const CURRENT_MD_FILE = 'current.md';
export const HISTORY_DIR = 'history';

// History management
export const MAX_SNAPSHOTS = 20;  // Keep last 20 snapshots

// UI constants
export const UNDO_BAR_TIMEOUT = 10000;  // 10 seconds
export const REINFORCEMENT_MESSAGE_DURATION = 4000;  // 4 seconds

// Styling constants for task tree depth
export const TASK_DEPTH_COLORS = [
  'border-l-rose-200',
  'border-l-amber-200',
  'border-l-emerald-200',
  'border-l-sky-200',
];

export const RELATIVE_TIME_BADGE_STYLES = {
  future: 'bg-stone-100 text-stone-400',
  upcoming: 'bg-amber-50 text-amber-600',
  current: 'bg-emerald-50 text-emerald-600',
  past: 'bg-stone-100 text-stone-400',
};

export const HABIT_STATE_OPACITY = {
  future: 'opacity-40',
  upcoming: 'opacity-70',
  current: '',
  past: 'opacity-50',
};
