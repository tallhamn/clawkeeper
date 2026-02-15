import { loadState, saveState } from './storage';
import {
  showState,
  listTasks,
  addTask,
  addSubtask,
  completeTask,
  uncompleteTask,
  editTask,
  deleteTask,
  moveTask,
  addTaskNote,
  editTaskNote,
  deleteTaskNote,
  listHabits,
  addHabit,
  editHabit,
  deleteHabit,
  completeHabit,
  addHabitNote,
  editHabitNote,
  deleteHabitNote,
} from './operations';

// ── Arg parser ──

interface Args {
  entity: string;
  command: string;
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2); // skip node + script
  const entity = args[0] || '';
  const command = args[1] || '';
  const flags: Record<string, string | boolean> = {};

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }

  return { entity, command, flags };
}

function ok(data: unknown) {
  console.log(JSON.stringify({ ok: true, data }));
}

function fail(error: string) {
  console.error(JSON.stringify({ ok: false, error }));
  process.exit(1);
}

// ── Dispatch ──

function run() {
  const { entity, command, flags } = parseArgs(process.argv);

  if (!entity || !command) {
    fail('Usage: clawkeeper <entity> <command> [--flags]');
    return;
  }

  try {
    let state = loadState();
    let result: unknown = undefined;
    let modified = false;

    if (entity === 'state') {
      if (command === 'show') {
        result = showState(state);
      } else {
        fail(`Unknown command: state ${command}`);
      }
    } else if (entity === 'task') {
      const id = flags.id as string | undefined;
      const text = flags.text as string | undefined;

      switch (command) {
        case 'list':
          result = listTasks(state, flags.all === true);
          break;

        case 'add': {
          if (!text) { fail('--text is required'); return; }
          const out = addTask(state, text);
          state = out.state;
          result = out.task;
          modified = true;
          break;
        }

        case 'add-subtask': {
          const parentId = flags['parent-id'] as string | undefined;
          if (!text) { fail('--text is required'); return; }
          const out = addSubtask(state, parentId, flags['parent-text'] as string | undefined, text);
          state = out.state;
          result = out.task;
          modified = true;
          break;
        }

        case 'complete':
          state = completeTask(state, id, text);
          result = { completed: true };
          modified = true;
          break;

        case 'uncomplete':
          state = uncompleteTask(state, id, text);
          result = { uncompleted: true };
          modified = true;
          break;

        case 'edit': {
          const newText = flags['new-text'] as string;
          if (!newText) { fail('--new-text is required'); return; }
          state = editTask(state, newText, id, text);
          result = { edited: true };
          modified = true;
          break;
        }

        case 'delete':
          state = deleteTask(state, id, text);
          result = { deleted: true };
          modified = true;
          break;

        case 'move': {
          const parentId = flags['parent-id'] as string | undefined;
          const root = flags.root === true;
          state = moveTask(state, id, text, parentId, root);
          result = { moved: true };
          modified = true;
          break;
        }

        case 'add-note': {
          const note = flags.note as string;
          if (!note) { fail('--note is required'); return; }
          state = addTaskNote(state, note, id, text);
          result = { noteAdded: true };
          modified = true;
          break;
        }

        case 'edit-note': {
          const note = flags.note as string;
          const newNote = flags['new-note'] as string;
          if (!note || !newNote) { fail('--note and --new-note are required'); return; }
          state = editTaskNote(state, note, newNote, id, text);
          result = { noteEdited: true };
          modified = true;
          break;
        }

        case 'delete-note': {
          const note = flags.note as string;
          if (!note) { fail('--note is required'); return; }
          state = deleteTaskNote(state, note, id, text);
          result = { noteDeleted: true };
          modified = true;
          break;
        }

        default:
          fail(`Unknown command: task ${command}`);
      }
    } else if (entity === 'habit') {
      const id = flags.id as string | undefined;
      const text = flags.text as string | undefined;

      switch (command) {
        case 'list':
          result = listHabits(state);
          break;

        case 'add': {
          if (!text) { fail('--text is required'); return; }
          const interval = flags.interval ? parseInt(flags.interval as string, 10) : undefined;
          const out = addHabit(state, text, interval);
          state = out.state;
          result = out.habit;
          modified = true;
          break;
        }

        case 'edit': {
          const newText = flags['new-text'] as string | undefined;
          const interval = flags.interval ? parseInt(flags.interval as string, 10) : undefined;
          state = editHabit(state, id, text, newText, interval);
          result = { edited: true };
          modified = true;
          break;
        }

        case 'delete':
          state = deleteHabit(state, id, text);
          result = { deleted: true };
          modified = true;
          break;

        case 'complete':
          state = completeHabit(state, id, text);
          result = { completed: true };
          modified = true;
          break;

        case 'add-note': {
          const note = flags.note as string;
          if (!note) { fail('--note is required'); return; }
          state = addHabitNote(state, note, id, text);
          result = { noteAdded: true };
          modified = true;
          break;
        }

        case 'edit-note': {
          const note = flags.note as string;
          const newNote = flags['new-note'] as string;
          if (!note || !newNote) { fail('--note and --new-note are required'); return; }
          state = editHabitNote(state, note, newNote, id, text);
          result = { noteEdited: true };
          modified = true;
          break;
        }

        case 'delete-note': {
          const note = flags.note as string;
          if (!note) { fail('--note is required'); return; }
          state = deleteHabitNote(state, note, id, text);
          result = { noteDeleted: true };
          modified = true;
          break;
        }

        default:
          fail(`Unknown command: habit ${command}`);
      }
    } else {
      fail(`Unknown entity: ${entity}. Expected: state, task, habit`);
    }

    if (modified) {
      saveState(state);
    }

    ok(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    fail(message);
  }
}

run();
