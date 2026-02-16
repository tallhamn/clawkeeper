/**
 * Application constants
 */

// App version - increment this to show splash screen on new builds
export const APP_VERSION = '1.1.1';

// Feature flags
export const ENABLE_AUTO_REFLECTION = false; // Set to false to disable automatic reflection prompts

// Storage paths
// Local directory: ~/.clawkeeper (iCloud can be configured later with proper entitlements)
export const APP_DIR_NAME = '/.clawkeeper';
export const CURRENT_MD_FILE = 'current.md';
export const HISTORY_DIR = 'history';

// History management
export const MAX_SNAPSHOTS = 20;  // Keep last 20 snapshots

// UI constants
export const UNDO_BAR_TIMEOUT = 10000;  // 10 seconds
export const REINFORCEMENT_MESSAGE_DURATION = 4000;  // 4 seconds

