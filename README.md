# Welltime

Agentic task management — use AI to handle your todos. All your tasks are stored as markdown for easy cross-agent access and editing.

## Two Types of Items

**Habits** are recurring practices with streaks, time windows (morning/afternoon/evening), and gentle scheduling. They sit at the top because they represent who you're becoming.

**Tasks** are one-time items that can break down into subtasks. They have an end state — eventually they're done.

## Markdown Storage

Your data lives in plain Markdown files. No database, no lock-in. Works with Obsidian, git, grep, other AI agents, or whatever you want.

## Setup

1. `npm install`
2. `cp .env.example .env` and add your `VITE_ANTHROPIC_API_KEY` (required) and `VITE_TAVILY_API_KEY` (optional, for web search)
3. `npm run tauri:dev`
