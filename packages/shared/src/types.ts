// Time window types
export type TimeWindow = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export interface TimeWindowDefinition {
  label: string;
  start: number;  // Hour (0-23)
  end: number;    // Hour (0-23)
  icon: string;
}

export const TIME_WINDOWS: Record<TimeWindow, TimeWindowDefinition> = {
  morning: { label: 'Morning', start: 6, end: 11, icon: '🌅' },
  midday: { label: 'Midday', start: 11, end: 14, icon: '☀️' },
  afternoon: { label: 'Afternoon', start: 14, end: 17, icon: '🌤' },
  evening: { label: 'Evening', start: 17, end: 21, icon: '🌆' },
  night: { label: 'Night', start: 21, end: 24, icon: '🌙' },
};

// Habit model
export interface Habit {
  id: string;
  text: string;
  repeatIntervalHours: number; // How often the habit repeats (default: 24)
  lastCompleted: string | null; // ISO timestamp of when it was last completed
  totalCompletions: number; // All-time completion count
  notes: Note[];
  forcedAvailable?: boolean; // If true, habit is available even if interval hasn't passed
}

// Note model
export interface Note {
  id: string;        // Stable identifier
  text: string;
  createdAt: string; // ISO timestamp
}

// Task model (recursive for subtasks)
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  completedAt: string | null;  // ISO date string (YYYY-MM-DD)
  dueDate: string | null;      // YYYY-MM-DD deadline
  notes: Note[];
  children: Task[];
}

// Application state
export interface AppState {
  habits: Habit[];
  tasks: Task[];
}

// History snapshot
export interface Snapshot {
  timestamp: string;  // ISO timestamp
  reason: string;     // 'llm-action', 'auto', 'user-request'
  markdown: string;
  data: AppState;
}

// LLM Action types
export type LLMActionType =
  | 'add_task'
  | 'add_subtask'
  | 'complete_task'
  | 'uncomplete_task'
  | 'delete_task'
  | 'edit_task'
  | 'move_task'
  | 'add_note'
  | 'edit_note'
  | 'delete_note'
  | 'add_habit'
  | 'delete_habit'
  | 'edit_habit'
  | 'replace_state'
  | 'filter_tasks'
  | 'restructure_tasks';

export interface LLMAction {
  type: LLMActionType;
  text?: string;
  parentText?: string;
  parentId?: string;
  taskText?: string;
  taskId?: string;
  newParentText?: string;  // For move_task: new parent task name
  newParentId?: string;    // For move_task: new parent task id (or null for root)
  noteText?: string;       // For add_note/edit_note/delete_note: the note content
  noteId?: string;         // For edit_note/delete_note: target note by id
  newNoteText?: string;    // For edit_note: the replacement text
  dueDate?: string | null; // YYYY-MM-DD deadline (null to clear)
  habitText?: string;
  habitId?: string;
  repeatIntervalHours?: number;
  query?: string;
  newTasks?: Task[];
  newState?: AppState;  // For replace_state action
  label?: string; // Button label like "Add these subtasks"
}

// Task filter results
export interface TaskFilterResult {
  tasks: Task[];
  groupedTasks: Task[] | null;
  description: string;
  count: number;
  showReflections?: boolean;
}

// Relative time indicators for habits
export type RelativeTimeState = 'future' | 'upcoming' | 'current' | 'past';

export interface RelativeTime {
  text: string;
  state: RelativeTimeState;
}
