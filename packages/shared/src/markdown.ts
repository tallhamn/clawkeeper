import type { Habit, Task, AppState } from './types';
import { generateId } from './utils';

const ID_COMMENT_RE = /\s*<!-- id:\w+ -->/g;

/**
 * Extract the last embedded ID from a line and return the clean text.
 * Returns [cleanText, id | null].
 */
function extractId(raw: string): [string, string | null] {
  let lastId: string | null = null;
  for (const m of raw.matchAll(/<!-- id:(\w+) -->/g)) {
    lastId = m[1];
  }
  const clean = raw.replace(ID_COMMENT_RE, '').trim();
  return [clean, lastId];
}

/**
 * Serialize habits and tasks to Markdown format
 */
export function serializeToMarkdown(habits: Habit[], tasks: Task[]): string {
  let md = '# Habits\n\n';

  habits.forEach((habit) => {
    md += `## ${habit.text} <!-- id:${habit.id} -->\n`;
    md += `- Interval: ${habit.repeatIntervalHours}h\n`;
    md += `- Total Completions: ${habit.totalCompletions}\n`;
    md += `- Last completed: ${habit.lastCompleted || 'never'}\n`;
    if (habit.notes && habit.notes.length > 0) {
      habit.notes.forEach((n) => {
        md += `| [${n.createdAt}] ${n.text}\n`;
      });
    }
    md += '\n';
  });

  md += '---\n\n# Tasks\n\n';

  const serializeTask = (task: Task, depth = 0) => {
    const indent = '  '.repeat(depth);
    const checkbox = task.completed ? '[x]' : '[ ]';
    const completedDate = task.completedAt ? ` (${task.completedAt})` : '';
    md += `${indent}- ${checkbox} ${task.text}${completedDate} <!-- id:${task.id} -->\n`;
    if (task.notes && task.notes.length > 0) {
      task.notes.forEach((n) => {
        md += `${indent}  | [${n.createdAt}] ${n.text}\n`;
      });
    }
    if (task.children) {
      task.children.forEach((child) => serializeTask(child, depth + 1));
    }
  };

  tasks.forEach((task) => {
    md += `## ${task.text} <!-- id:${task.id} -->\n`;
    if (task.completed) {
      md += `- Status: completed${task.completedAt ? ` (${task.completedAt})` : ''}\n`;
    }
    if (task.notes && task.notes.length > 0) {
      task.notes.forEach((n) => {
        md += `| [${n.createdAt}] ${n.text}\n`;
      });
    }
    if (task.children && task.children.length > 0) {
      task.children.forEach((child) => serializeTask(child, 0));
    }
    md += '\n';
  });

  return md;
}

/**
 * Parse Markdown into habits and tasks
 */
export function parseMarkdown(md: string): AppState {
  const habits: Habit[] = [];
  const tasks: Task[] = [];

  const lines = md.split('\n');
  let currentSection: 'habits' | 'tasks' | null = null;
  let currentHabit: Habit | null = null;
  let currentTask: Task | null = null;
  let taskStack: Task[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === '# Habits') {
      currentSection = 'habits';
      continue;
    }
    if (line === '# Tasks') {
      // Push any pending habit before switching sections
      if (currentHabit) {
        habits.push(currentHabit);
        currentHabit = null;
      }
      currentSection = 'tasks';
      continue;
    }
    if (line === '---') continue;

    if (currentSection === 'habits') {
      if (line.startsWith('## ')) {
        if (currentHabit) habits.push(currentHabit);
        const [text, id] = extractId(line.slice(3));
        currentHabit = {
          id: id || generateId(),
          text,
          repeatIntervalHours: 24,
          totalCompletions: 0,
          lastCompleted: null,
          notes: [],
        };
      } else if (currentHabit) {
        if (line.startsWith('- Interval: ')) {
          currentHabit.repeatIntervalHours = parseInt(line.slice(12)) || 24;
        } else if (line.startsWith('- Total Completions: ')) {
          currentHabit.totalCompletions = parseInt(line.slice(21)) || 0;
        } else if (line.startsWith('- Streak: ')) {
          // Legacy support for old format
          currentHabit.totalCompletions = parseInt(line.slice(10)) || 0;
        } else if (line.startsWith('- Last completed: ')) {
          const value = line.slice(18);
          currentHabit.lastCompleted = value === 'never' ? null : value;
        } else if (line === '- Reflections:') {
          continue;
        } else if (line.startsWith('  - ')) {
          currentHabit.notes.push({ createdAt: '', text: line.slice(4) });
        } else if (line.startsWith('| ')) {
          const noteMatch = line.slice(2).match(/^\[(.+?)\] (.+)$/);
          if (noteMatch) {
            currentHabit.notes.push({ createdAt: noteMatch[1], text: noteMatch[2] });
          }
        }
      }
    }

    if (currentSection === 'tasks') {
      if (line.startsWith('## ')) {
        if (currentTask) tasks.push(currentTask);
        const [text, id] = extractId(line.slice(3));
        currentTask = {
          id: id || generateId(),
          text,
          completed: false,
          completedAt: null,
          notes: [],
          children: [],
        };
        taskStack = [currentTask];
      } else if (currentTask) {
        if (line.startsWith('- Status: completed')) {
          currentTask.completed = true;
          const dateMatch = line.match(/\((\d{4}-\d{2}-\d{2})\)/);
          if (dateMatch) currentTask.completedAt = dateMatch[1];
        } else if (line.startsWith('> ') && taskStack.length === 1) {
          currentTask.notes.push({ createdAt: '', text: line.slice(2) });
        } else if (line.startsWith('| ') && taskStack.length === 1) {
          const noteMatch = line.slice(2).match(/^\[(.+?)\] (.+)$/);
          if (noteMatch) {
            currentTask.notes.push({ createdAt: noteMatch[1], text: noteMatch[2] });
          }
        } else if (line.match(/^(\s*)- \[(x| )\] /)) {
          // Extract and strip all ID comments before matching
          const [, lineId] = extractId(line);
          const cleanLine = line.replace(ID_COMMENT_RE, '');
          const match = cleanLine.match(/^(\s*)- \[(x| )\] (.+?)(?:\s+\((\d{4}-\d{2}-\d{2})\))?$/);
          if (match) {
            const depth = match[1].length / 2;
            const completed = match[2] === 'x';
            const text = match[3];
            const completedAt = match[4] || null;

            const newTask: Task = {
              id: lineId || generateId(),
              text,
              completed,
              completedAt,
              notes: [],
              children: [],
            };

            // Adjust stack to correct depth
            while (taskStack.length > depth + 1) {
              taskStack.pop();
            }

            const parent = taskStack[taskStack.length - 1];
            parent.children.push(newTask);
            taskStack.push(newTask);
          }
        } else if (line.match(/^\s*> /)) {
          // Reflection for a subtask
          const reflection = line.trim().slice(2);
          if (taskStack.length > 0) {
            taskStack[taskStack.length - 1].notes.push({ createdAt: '', text: reflection });
          }
        } else if (line.match(/^\s*\| /)) {
          // Note for a subtask
          const noteContent = line.trim().slice(2);
          const noteMatch = noteContent.match(/^\[(.+?)\] (.+)$/);
          if (noteMatch && taskStack.length > 0) {
            taskStack[taskStack.length - 1].notes.push({ createdAt: noteMatch[1], text: noteMatch[2] });
          }
        }
      }
    }
  }

  // Push final items
  if (currentSection === 'habits' && currentHabit) {
    habits.push(currentHabit);
  }
  if (currentSection === 'tasks' && currentTask) {
    tasks.push(currentTask);
  }

  return healIds({ habits, tasks });
}

/**
 * Heal duplicate or missing IDs across all habits and tasks.
 * Returns a new state with unique IDs assigned where needed.
 */
export function healIds(state: AppState): AppState {
  const seen = new Set<string>();

  function needsNewId(id: string): boolean {
    if (!id || seen.has(id)) return true;
    seen.add(id);
    return false;
  }

  function healTask(task: Task): Task {
    const id = needsNewId(task.id) ? generateId() : task.id;
    if (id !== task.id || task.children.length > 0) {
      // Need to ensure the new ID is tracked
      if (id !== task.id) seen.add(id);
      return {
        ...task,
        id,
        children: task.children.map(healTask),
      };
    }
    return { ...task, children: task.children.map(healTask) };
  }

  const habits = state.habits.map((habit) => {
    if (needsNewId(habit.id)) {
      const newId = generateId();
      seen.add(newId);
      return { ...habit, id: newId };
    }
    return habit;
  });

  const tasks = state.tasks.map(healTask);

  return { habits, tasks };
}
