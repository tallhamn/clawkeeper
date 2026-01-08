import type { Habit, Task, AppState } from './types';
import { generateId } from './utils';

/**
 * Serialize habits and tasks to Markdown format
 */
export function serializeToMarkdown(habits: Habit[], tasks: Task[]): string {
  let md = '# Habits\n\n';

  habits.forEach((habit) => {
    md += `## ${habit.text}\n`;
    md += `- Interval: ${habit.repeatIntervalHours}h\n`;
    md += `- Total Completions: ${habit.totalCompletions}\n`;
    md += `- Last completed: ${habit.lastCompleted || 'never'}\n`;
    if (habit.reflections && habit.reflections.length > 0) {
      md += `- Reflections:\n`;
      habit.reflections.forEach((r) => {
        md += `  - ${r}\n`;
      });
    }
    md += '\n';
  });

  md += '---\n\n# Tasks\n\n';

  const serializeTask = (task: Task, depth = 0) => {
    const indent = '  '.repeat(depth);
    const checkbox = task.completed ? '[x]' : '[ ]';
    const completedDate = task.completedAt ? ` (${task.completedAt})` : '';
    md += `${indent}- ${checkbox} ${task.text}${completedDate}\n`;
    if (task.reflections && task.reflections.length > 0) {
      task.reflections.forEach((r) => {
        md += `${indent}  > ${r}\n`;
      });
    }
    if (task.children) {
      task.children.forEach((child) => serializeTask(child, depth + 1));
    }
  };

  tasks.forEach((task) => {
    md += `## ${task.text}\n`;
    if (task.completed) {
      md += `- Status: completed${task.completedAt ? ` (${task.completedAt})` : ''}\n`;
    }
    if (task.reflections && task.reflections.length > 0) {
      task.reflections.forEach((r) => {
        md += `> ${r}\n`;
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
        currentHabit = {
          id: generateId(),
          text: line.slice(3),
          repeatIntervalHours: 24,
          totalCompletions: 0,
          lastCompleted: null,
          reflections: [],
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
        } else if (line.startsWith('  - ')) {
          currentHabit.reflections.push(line.slice(4));
        }
      }
    }

    if (currentSection === 'tasks') {
      if (line.startsWith('## ')) {
        if (currentTask) tasks.push(currentTask);
        currentTask = {
          id: generateId(),
          text: line.slice(3),
          completed: false,
          completedAt: null,
          reflections: [],
          children: [],
        };
        taskStack = [currentTask];
      } else if (currentTask) {
        if (line.startsWith('- Status: completed')) {
          currentTask.completed = true;
          const dateMatch = line.match(/\((\d{4}-\d{2}-\d{2})\)/);
          if (dateMatch) currentTask.completedAt = dateMatch[1];
        } else if (line.startsWith('> ') && taskStack.length === 1) {
          currentTask.reflections.push(line.slice(2));
        } else if (line.match(/^(\s*)- \[(x| )\] /)) {
          const match = line.match(/^(\s*)- \[(x| )\] (.+?)(?:\s+\((\d{4}-\d{2}-\d{2})\))?$/);
          if (match) {
            const depth = match[1].length / 2;
            const completed = match[2] === 'x';
            const text = match[3];
            const completedAt = match[4] || null;

            const newTask: Task = {
              id: generateId(),
              text,
              completed,
              completedAt,
              reflections: [],
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
            taskStack[taskStack.length - 1].reflections.push(reflection);
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

  return { habits, tasks };
}
