import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
  readDir,
} from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import type { AppState, Snapshot, Task } from './types';
import { serializeToMarkdown, parseMarkdown } from './markdown';
import { generateId } from './utils';
import {
  APP_DIR_NAME,
  CURRENT_MD_FILE,
  HISTORY_DIR,
} from './constants';

/**
 * Get default state for first-time users
 */
export function getDefaultState(): AppState {
  return {
    habits: [
      {
        id: generateId(),
        text: 'Drink a glass of water',
        repeatIntervalHours: 4, // Comes back throughout the day
        lastCompleted: null,
        totalCompletions: 0,
        reflections: [],
      },
      {
        id: generateId(),
        text: 'Hug someone I care about',
        repeatIntervalHours: 24, // Once a day
        lastCompleted: null,
        totalCompletions: 0,
        reflections: [],
      },
      {
        id: generateId(),
        text: 'Write down something good that happened',
        repeatIntervalHours: 24, // Once a day
        lastCompleted: null,
        totalCompletions: 0,
        reflections: [],
      },
    ],
    tasks: [
      {
        id: generateId(),
        text: 'Explore Welltime',
        completed: false,
        completedAt: null,
        reflections: [],
        children: [
          {
            id: generateId(),
            text: 'Complete a habit and add a reflection',
            completed: false,
            completedAt: null,
            reflections: [],
            children: [],
          },
          {
            id: generateId(),
            text: 'Check off this subtask to see how it works',
            completed: false,
            completedAt: null,
            reflections: [],
            children: [],
          },
        ],
      },
      {
        id: generateId(),
        text: 'Plan something fun for this week',
        completed: false,
        completedAt: null,
        reflections: [],
        children: [],
      },
    ],
  };
}

/**
 * Initialize storage directory structure
 */
export async function initializeStorage(): Promise<void> {
  const home = await homeDir();
  const appDir = `${home}${APP_DIR_NAME}`;
  console.log('[Storage] App directory path:', appDir);

  try {
    // Create main app directory
    const appDirExists = await exists(appDir);
    console.log('[Storage] App directory exists:', appDirExists);
    if (!appDirExists) {
      console.log('[Storage] Creating app directory...');
      await mkdir(appDir, { recursive: true });
      console.log('[Storage] App directory created');
    }

    // Create history directory
    const historyDir = `${appDir}/${HISTORY_DIR}`;
    const historyDirExists = await exists(historyDir);
    console.log('[Storage] History directory exists:', historyDirExists);
    if (!historyDirExists) {
      console.log('[Storage] Creating history directory...');
      await mkdir(historyDir, { recursive: true });
      console.log('[Storage] History directory created');
    }
  } catch (error) {
    console.error('[Storage] Error initializing storage:', error);
    throw error;
  }
}

/**
 * Check if the app has been initialized (has data files)
 */
export async function isInitialized(): Promise<boolean> {
  try {
    const home = await homeDir();
    const mdPath = `${home}${APP_DIR_NAME}/${CURRENT_MD_FILE}`;
    return await exists(mdPath);
  } catch {
    return false;
  }
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Filter tasks to only include active and current month's completed
 */
function filterCurrentTasks(tasks: Task[]): Task[] {
  const currentMonth = getCurrentMonth();

  const filterTask = (task: Task): Task | null => {
    // Keep if not completed
    if (!task.completed) {
      // Recursively filter children
      return {
        ...task,
        children: task.children?.map(filterTask).filter((t): t is Task => t !== null) || [],
      };
    }

    // Keep if completed this month
    if (task.completedAt && task.completedAt.startsWith(currentMonth)) {
      return {
        ...task,
        children: task.children?.map(filterTask).filter((t): t is Task => t !== null) || [],
      };
    }

    // Filter out if completed in previous months
    return null;
  };

  return tasks.map(filterTask).filter((t): t is Task => t !== null);
}

/**
 * Save current state to Markdown only
 */
export async function saveCurrentState(state: AppState): Promise<void> {
  const home = await homeDir();
  const appDir = `${home}${APP_DIR_NAME}`;

  try {
    // Filter to only current month's data
    const filteredState: AppState = {
      habits: state.habits,
      tasks: filterCurrentTasks(state.tasks),
    };

    // Save as Markdown
    const markdown = serializeToMarkdown(filteredState.habits, filteredState.tasks);
    await writeTextFile(`${appDir}/${CURRENT_MD_FILE}`, markdown);
  } catch (error) {
    console.error('Error saving current state:', error);
    throw error;
  }
}

/**
 * Load current state from Markdown file
 */
export async function loadCurrentState(): Promise<AppState | null> {
  const home = await homeDir();
  const appDir = `${home}${APP_DIR_NAME}`;

  try {
    const mdPath = `${appDir}/${CURRENT_MD_FILE}`;
    const mdExists = await exists(mdPath);

    if (mdExists) {
      const markdown = await readTextFile(mdPath);
      return parseMarkdown(markdown);
    }

    return null;
  } catch (error) {
    console.error('Error loading current state:', error);
    return null;
  }
}

/**
 * Extract completed tasks from previous months
 */
function extractOldCompletedTasks(tasks: Task[]): { [month: string]: Task[] } {
  const currentMonth = getCurrentMonth();
  const archiveByMonth: { [month: string]: Task[] } = {};

  const extractFromTask = (task: Task): Task | null => {
    // If completed in a previous month, archive it
    if (task.completed && task.completedAt && !task.completedAt.startsWith(currentMonth)) {
      const month = task.completedAt.substring(0, 7); // YYYY-MM
      if (!archiveByMonth[month]) {
        archiveByMonth[month] = [];
      }
      archiveByMonth[month].push(task);
      return null; // Remove from current
    }

    // For active tasks, recursively check children
    if (!task.completed && task.children && task.children.length > 0) {
      const filteredChildren = task.children
        .map(extractFromTask)
        .filter((t): t is Task => t !== null);

      // If children were archived, update the task
      if (filteredChildren.length !== task.children.length) {
        return { ...task, children: filteredChildren };
      }
    }

    return task;
  };

  // Process all tasks to extract old ones
  tasks.forEach(extractFromTask);

  return archiveByMonth;
}

/**
 * Archive old completed tasks to monthly files
 */
export async function archiveOldCompletedTasks(state: AppState): Promise<AppState> {
  const home = await homeDir();
  const appDir = `${home}${APP_DIR_NAME}`;

  try {
    // Extract old completed tasks by month
    const archiveByMonth = extractOldCompletedTasks(state.tasks);

    // Save each month's completed tasks to archive file
    for (const [month, tasks] of Object.entries(archiveByMonth)) {
      if (tasks.length === 0) continue;

      const archiveFile = `${appDir}/archive-${month}.md`;
      const archiveExists = await exists(archiveFile);

      let existingTasks: Task[] = [];
      if (archiveExists) {
        // Load existing archive and merge
        const markdown = await readTextFile(archiveFile);
        const existing = parseMarkdown(markdown);
        existingTasks = existing.tasks;
      }

      // Merge and save
      const mergedTasks = [...existingTasks, ...tasks];
      const markdown = serializeToMarkdown([], mergedTasks); // No habits in archives
      await writeTextFile(archiveFile, markdown);

      console.log(`[Archive] Archived ${tasks.length} tasks to archive-${month}.md`);
    }

    // Return state with only current month's tasks
    return {
      habits: state.habits,
      tasks: filterCurrentTasks(state.tasks),
    };
  } catch (error) {
    console.error('[Archive] Error archiving old tasks:', error);
    return state; // Return original state on error
  }
}

/**
 * Create a snapshot of the current state
 */
export async function createSnapshot(
  state: AppState,
  reason: string
): Promise<Snapshot> {
  const home = await homeDir();
  const historyDir = `${home}${APP_DIR_NAME}/${HISTORY_DIR}`;

  const timestamp = new Date().toISOString();
  const filename = `${timestamp.replace(/[:.]/g, '-')}_${reason}.md`;

  const snapshot: Snapshot = {
    timestamp,
    reason,
    markdown: serializeToMarkdown(state.habits, state.tasks),
    data: state,
  };

  try {
    // Save snapshot
    await writeTextFile(`${historyDir}/${filename}`, snapshot.markdown);

    // Prune old snapshots
    await pruneSnapshots();

    return snapshot;
  } catch (error) {
    console.error('Error creating snapshot:', error);
    throw error;
  }
}

/**
 * Prune old snapshots, keeping only the most recent MAX_SNAPSHOTS
 */
async function pruneSnapshots(): Promise<void> {
  const home = await homeDir();
  const historyDir = `${home}${APP_DIR_NAME}/${HISTORY_DIR}`;

  try {
    const entries = await readDir(historyDir);
    // Sort by name (timestamp) descending
    entries
      .filter((entry) => !entry.isDirectory && entry.name.endsWith('.md'))
      .sort((a, b) => b.name.localeCompare(a.name));

    // TODO: Delete files beyond MAX_SNAPSHOTS
    // Note: Tauri plugin-fs doesn't have a delete function in the stable API yet
    // This will need to be implemented when the API is available
  } catch (error) {
    console.error('Error pruning snapshots:', error);
  }
}

/**
 * Get list of available snapshots
 */
export async function getSnapshots(): Promise<string[]> {
  const home = await homeDir();
  const historyDir = `${home}${APP_DIR_NAME}/${HISTORY_DIR}`;

  try {
    const entries = await readDir(historyDir);
    return entries
      .filter((entry) => !entry.isDirectory && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort()
      .reverse(); // Most recent first
  } catch (error) {
    console.error('Error getting snapshots:', error);
    return [];
  }
}

/**
 * Load a specific snapshot
 */
export async function loadSnapshot(filename: string): Promise<AppState | null> {
  const home = await homeDir();
  const historyDir = `${home}${APP_DIR_NAME}/${HISTORY_DIR}`;

  try {
    const markdown = await readTextFile(`${historyDir}/${filename}`);
    return parseMarkdown(markdown);
  } catch (error) {
    console.error('Error loading snapshot:', error);
    return null;
  }
}

/**
 * Load recent archive files for coaching context
 */
export async function loadRecentArchives(monthsBack: number = 3): Promise<string[]> {
  const home = await homeDir();
  const appDir = `${home}${APP_DIR_NAME}`;

  try {
    const now = new Date();
    const archives: string[] = [];

    // Generate list of archive filenames for recent months
    for (let i = 0; i < monthsBack; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const archiveFile = `${appDir}/archive-${year}-${month}.md`;

      try {
        const fileExists = await exists(archiveFile);
        if (fileExists) {
          const content = await readTextFile(archiveFile);
          archives.push(content);
        }
      } catch {
        // Archive doesn't exist yet, skip
        continue;
      }
    }

    return archives;
  } catch (error) {
    console.error('Error loading recent archives:', error);
    return [];
  }
}
