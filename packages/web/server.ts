import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadState, saveState } from 'clawkeeper/src/storage';
import {
  addTask,
  completeTask,
  uncompleteTask,
  deleteTask,
  editTask,
  addSubtask,
  addTaskNote,
  addHabit,
  completeHabit,
  deleteHabit,
  editHabit,
  addHabitNote,
  setTaskDueDate,
} from 'clawkeeper/src/operations';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve built client in production
app.use(express.static(path.join(__dirname, 'dist')));

// ── API Routes ──

app.get('/api/state', (_req, res) => {
  try {
    const state = loadState();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Habit endpoints
app.post('/api/habit/complete', (req, res) => {
  try {
    let state = loadState();
    state = completeHabit(state, req.body.id);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/add', (req, res) => {
  try {
    let state = loadState();
    const result = addHabit(state, req.body.text, req.body.intervalHours || 24);
    saveState(result.state);
    res.json(result.state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/delete', (req, res) => {
  try {
    let state = loadState();
    state = deleteHabit(state, req.body.id);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/edit', (req, res) => {
  try {
    let state = loadState();
    state = editHabit(state, req.body.id, undefined, req.body.text, req.body.intervalHours);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/add-note', (req, res) => {
  try {
    let state = loadState();
    state = addHabitNote(state, req.body.text, req.body.id);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Task endpoints
app.post('/api/task/add', (req, res) => {
  try {
    let state = loadState();
    const result = addTask(state, req.body.text, req.body.dueDate);
    saveState(result.state);
    res.json(result.state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/complete', (req, res) => {
  try {
    let state = loadState();
    state = completeTask(state, req.body.id);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/uncomplete', (req, res) => {
  try {
    let state = loadState();
    state = uncompleteTask(state, req.body.id);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/delete', (req, res) => {
  try {
    let state = loadState();
    state = deleteTask(state, req.body.id);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/edit', (req, res) => {
  try {
    let state = loadState();
    state = editTask(state, req.body.text, req.body.id, undefined, req.body.dueDate);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/set-due-date', (req, res) => {
  try {
    let state = loadState();
    state = setTaskDueDate(state, req.body.dueDate ?? null, req.body.id);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/add-subtask', (req, res) => {
  try {
    let state = loadState();
    const result = addSubtask(state, req.body.parentId, undefined, req.body.text, req.body.dueDate);
    saveState(result.state);
    res.json(result.state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/add-note', (req, res) => {
  try {
    let state = loadState();
    state = addTaskNote(state, req.body.text, req.body.id);
    saveState(state);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`ClawKeeper web server running on http://0.0.0.0:${PORT}`);
});
