# ClawKeeper

Tasks and habits that live in a plain markdown file on your machine. Free, private, and claw-native: your AI assistant can read, plan, and act on your to-do list without an API or cloud sync.

All data is stored as human-readable markdown in `~/.clawkeeper/current.md`.

## Install

```bash
npm install -g clawkeeper
```

Or clone and link locally:

```bash
git clone https://github.com/tallhamn/clawkeeper.git
cd clawkeeper && npm install
npm link
```

## CLI

```bash
clawkeeper <entity> <command> [--flags]
```

All commands return JSON. Use `--id` for exact match, `--text` for fuzzy substring match.

| Command | Description |
|---------|-------------|
| `task list` | List all tasks |
| `task add --text "..."` | Add a task |
| `task add-subtask --parent-text "..." --text "..."` | Add subtask |
| `task complete --id <id>` | Complete a task |
| `task edit --text "..." --new-text "..."` | Rename a task |
| `task delete --text "..."` | Delete a task |
| `task add-note --text "..." --note "..."` | Add note to task |
| `habit list` | List all habits |
| `habit add --text "..." [--interval 24]` | Add a habit |
| `habit complete --text "..."` | Complete a habit |
| `habit edit --text "..." [--new-text "..."] [--interval N]` | Edit habit |
| `habit delete --text "..."` | Delete a habit |
| `habit add-note --text "..." --note "..."` | Add note to habit |
| `state show` | Show full state |

## Desktop App

```bash
npm install
cp .env.example .env   # add VITE_ANTHROPIC_API_KEY
npm run tauri:dev
```

The desktop app includes a Planning panel that routes through OpenClaw when available, falling back to the Anthropic API.

## OpenClaw Integration

ClawKeeper ships as an [OpenClaw](https://openclaw.ai) plugin. When installed, your Claw can manage tasks and habits via the CLI skill, and optionally check in on your habits via heartbeat.

To share data between the desktop app and OpenClaw, point both at the same directory:

```bash
export CLAWKEEPER_DIR=/srv/clawkeeper
```

## Development

```bash
npm install
npm run dev          # Vite dev server
npm run test         # Run tests
npm run tauri:dev    # Desktop app
```
