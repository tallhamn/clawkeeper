import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { loadState, saveState } from 'clawkeeper/src/storage';
import {
  addTask,
  completeTask,
  uncompleteTask,
  deleteTask,
  editTask,
  addSubtask,
  addTaskNote,
  editTaskNote,
  deleteTaskNote,
  addHabit,
  completeHabit,
  deleteHabit,
  editHabit,
  addHabitNote,
  editHabitNote,
  deleteHabitNote,
  skipHabit,
  wakeupHabit,
  setTaskDueDate,
} from 'clawkeeper/src/operations';
import { assignAgent, unassignAgent } from 'clawkeeper/src/agent-operations';
import type { AppState } from '@clawkeeper/shared/src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://127.0.0.1:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';

app.use(express.json());

// Serve built client in production
app.use(express.static(path.join(__dirname, 'dist')));

// ── Undo state ──
let previousState: AppState | null = null;

/** Save current state for undo, then apply mutation */
function withUndo(mutate: (state: AppState) => AppState): AppState {
  const state = loadState();
  previousState = state;
  const newState = mutate(state);
  saveState(newState);
  return newState;
}

// ── API Routes ──

app.get('/api/state', (_req, res) => {
  try {
    const state = loadState();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Habit endpoints ──

app.post('/api/habit/complete', (req, res) => {
  try {
    const newState = withUndo(state => completeHabit(state, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/add', (req, res) => {
  try {
    const newState = withUndo(state => addHabit(state, req.body.text, req.body.intervalHours || 24).state);
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/delete', (req, res) => {
  try {
    const newState = withUndo(state => deleteHabit(state, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/edit', (req, res) => {
  try {
    const newState = withUndo(state =>
      editHabit(state, req.body.id, undefined, req.body.text, req.body.intervalHours)
    );
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/add-note', (req, res) => {
  try {
    const newState = withUndo(state => addHabitNote(state, req.body.text, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/edit-note', (req, res) => {
  try {
    const newState = withUndo(state =>
      editHabitNote(state, req.body.oldNote || '', req.body.newNote, req.body.id, undefined, req.body.noteId)
    );
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/delete-note', (req, res) => {
  try {
    const newState = withUndo(state =>
      deleteHabitNote(state, req.body.noteText || '', req.body.id, undefined, req.body.noteId)
    );
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/skip', (req, res) => {
  try {
    const newState = withUndo(state => skipHabit(state, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/wakeup', (req, res) => {
  try {
    const newState = withUndo(state => wakeupHabit(state, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/assign-agent', (req, res) => {
  try {
    const newState = withUndo(state => assignAgent(state, req.body.agentId, 'habit', req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/unassign-agent', (req, res) => {
  try {
    const newState = withUndo(state => unassignAgent(state, 'habit', req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/adjust-preferred-hour', (req, res) => {
  try {
    const newState = withUndo(state => ({
      ...state,
      habits: state.habits.map(h =>
        h.id === req.body.id ? { ...h, preferredHour: req.body.hour } : h
      ),
    }));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/habit/adjust-completion-time', (req, res) => {
  try {
    const { id, timestamp, hour } = req.body;
    const origDate = new Date(timestamp);
    const newDate = new Date(origDate);
    newDate.setHours(Math.floor(hour));
    newDate.setMinutes(Math.round((hour - Math.floor(hour)) * 60));
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    const newTimestamp = newDate.toISOString();

    const newState = withUndo(state => ({
      ...state,
      habits: state.habits.map(h => {
        if (h.id !== id) return h;
        const newHistory = (h.completionHistory || []).map(ts =>
          ts === timestamp ? newTimestamp : ts
        );
        return {
          ...h,
          completionHistory: newHistory,
          lastCompleted: h.lastCompleted === timestamp ? newTimestamp : h.lastCompleted,
        };
      }),
    }));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── Task endpoints ──

app.post('/api/task/add', (req, res) => {
  try {
    const newState = withUndo(state => addTask(state, req.body.text, req.body.dueDate).state);
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/complete', (req, res) => {
  try {
    const newState = withUndo(state => completeTask(state, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/uncomplete', (req, res) => {
  try {
    const newState = withUndo(state => uncompleteTask(state, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/delete', (req, res) => {
  try {
    const newState = withUndo(state => deleteTask(state, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/edit', (req, res) => {
  try {
    const newState = withUndo(state =>
      editTask(state, req.body.text, req.body.id, undefined, req.body.dueDate)
    );
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/set-due-date', (req, res) => {
  try {
    const newState = withUndo(state => setTaskDueDate(state, req.body.dueDate ?? null, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/add-subtask', (req, res) => {
  try {
    const newState = withUndo(state =>
      addSubtask(state, req.body.parentId, undefined, req.body.text, req.body.dueDate).state
    );
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/add-note', (req, res) => {
  try {
    const newState = withUndo(state => addTaskNote(state, req.body.text, req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/edit-note', (req, res) => {
  try {
    const newState = withUndo(state =>
      editTaskNote(state, req.body.oldNote || '', req.body.newNote, req.body.id, undefined, req.body.noteId)
    );
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/delete-note', (req, res) => {
  try {
    const newState = withUndo(state =>
      deleteTaskNote(state, req.body.noteText || '', req.body.id, undefined, req.body.noteId)
    );
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/assign-agent', (req, res) => {
  try {
    const newState = withUndo(state => assignAgent(state, req.body.agentId, 'task', req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/task/unassign-agent', (req, res) => {
  try {
    const newState = withUndo(state => unassignAgent(state, 'task', req.body.id));
    res.json(newState);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── General endpoints ──

app.get('/api/agents', (_req, res) => {
  try {
    const output = execSync('openclaw agents list --json', { encoding: 'utf-8', timeout: 5000 });
    const raw = JSON.parse(output) as Array<{ id: string; name?: string; identityName?: string }>;
    res.json(raw.map(a => ({ id: a.id, name: a.identityName || a.name || a.id })));
  } catch {
    res.json([]);
  }
});

app.post('/api/undo', (_req, res) => {
  try {
    if (!previousState) {
      res.status(400).json({ error: 'Nothing to undo' });
      return;
    }
    saveState(previousState);
    const restored = previousState;
    previousState = null;
    res.json(restored);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI proxy endpoints ──

app.post('/api/chat', async (req, res) => {
  if (!OPENCLAW_TOKEN) {
    res.status(503).json({ error: 'OpenClaw not configured' });
    return;
  }

  try {
    const { systemPrompt, messages, agentId } = req.body;
    const agent = agentId || 'main';

    // Read agent personality from workspace SOUL.md / IDENTITY.md
    let agentPersonality = '';
    try {
      const agentsOutput = execSync('openclaw agents list --json', { encoding: 'utf-8', timeout: 5000 });
      const agentsList = JSON.parse(agentsOutput) as Array<{ id: string; workspace?: string }>;
      const agentInfo = agentsList.find(a => a.id === agent);
      if (agentInfo?.workspace) {
        const soulPath = path.join(agentInfo.workspace, 'SOUL.md');
        const identityPath = path.join(agentInfo.workspace, 'IDENTITY.md');
        if (fs.existsSync(soulPath)) agentPersonality += fs.readFileSync(soulPath, 'utf-8') + '\n\n';
        if (fs.existsSync(identityPath)) agentPersonality += fs.readFileSync(identityPath, 'utf-8') + '\n\n';
      }
    } catch {
      // Agent personality lookup failed, proceed without it
    }

    const fullSystemPrompt = agentPersonality
      ? `${agentPersonality}---\n\n${systemPrompt}`
      : systemPrompt;

    const ocRes = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
        'x-openclaw-agent-id': agent,
        'x-openclaw-session-key': `clawkeeper-chat-${agent}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        stream: true,
        messages: [{ role: 'system', content: fullSystemPrompt }, ...messages],
      }),
    });

    if (!ocRes.ok) {
      res.status(ocRes.status).json({ error: `OpenClaw API error: ${ocRes.status}` });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = ocRes.body!.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
    }
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

app.post('/api/coach-message', async (req, res) => {
  if (!OPENCLAW_TOKEN) {
    res.status(503).json({ error: 'OpenClaw not configured' });
    return;
  }

  try {
    const { systemPrompt, messages } = req.body;
    const ocRes = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
        'x-openclaw-agent-id': 'main',
        'x-openclaw-session-key': 'clawkeeper-coach',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        stream: false,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });

    if (!ocRes.ok) {
      res.status(ocRes.status).json({ error: `OpenClaw API error: ${ocRes.status}` });
      return;
    }

    const data = await ocRes.json();
    res.json({ text: data.choices?.[0]?.message?.content ?? '' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/infer-hours', async (req, res) => {
  if (!OPENCLAW_TOKEN) { res.json({}); return; }

  try {
    const { habitTexts } = req.body;
    const prompt = `Given these habit names, return a JSON object mapping each habit name to the ideal hour of day (0-23) when someone would typically do it. Consider the habit name for time-of-day clues (e.g. "morning run" → 7, "evening meditation" → 20). If there's no time hint, use a reasonable default for that type of activity. Return ONLY valid JSON, no explanation.\n\nHabits: ${JSON.stringify(habitTexts)}`;

    const ocRes = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
        'x-openclaw-agent-id': 'main',
        'x-openclaw-session-key': 'clawkeeper-infer',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        stream: false,
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!ocRes.ok) { res.json({}); return; }
    const data = await ocRes.json();
    const responseText = data.choices?.[0]?.message?.content ?? '{}';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.json({}); return; }

    const parsed = JSON.parse(jsonMatch[0]);
    const result: Record<string, number> = {};
    for (const name of habitTexts) {
      const val = parsed[name] ?? parsed[name.toLowerCase()];
      if (typeof val === 'number' && val >= 0 && val <= 23) result[name] = Math.round(val);
    }
    res.json(result);
  } catch { res.json({}); }
});

app.post('/api/infer-icons', async (req, res) => {
  if (!OPENCLAW_TOKEN) { res.json({}); return; }

  try {
    const { habitTexts } = req.body;
    const prompt = `Given these habit names, return a JSON object where each key is the EXACT habit name and the value is a single emoji. Use the EXACT strings as keys — do not rephrase or shorten them. Pick specific, recognizable emoji.\n\nHabits: ${JSON.stringify(habitTexts)}\n\nReturn ONLY valid JSON, no explanation.`;

    const ocRes = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
        'x-openclaw-agent-id': 'main',
        'x-openclaw-session-key': 'clawkeeper-infer',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        stream: false,
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!ocRes.ok) { res.json({}); return; }
    const data = await ocRes.json();
    const responseText = data.choices?.[0]?.message?.content ?? '{}';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.json({}); return; }

    const parsed = JSON.parse(jsonMatch[0]);
    const result: Record<string, string> = {};
    for (const name of habitTexts) {
      const val = parsed[name] ?? parsed[name.toLowerCase()];
      if (typeof val === 'string' && val.length > 0) result[name] = val;
    }
    res.json(result);
  } catch { res.json({}); }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`ClawKeeper web server running on http://0.0.0.0:${PORT}`);
});
