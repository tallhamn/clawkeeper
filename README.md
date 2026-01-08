# Habits & Tasks

A productivity app that separates who you're becoming from what you need to get done.

## The Core Idea

Most todo apps treat everything the same — buy milk, exercise, hire a VP, call mom. But these are fundamentally different kinds of work:

**Habits** are recurring commitments that shape your identity. They're not tasks you complete and forget; they're practices you maintain. Missing one day doesn't mean failure — but missing two often breaks the chain.

**Tasks** are one-time things you need to accomplish. They have an end state. They might break down into subtasks, but eventually they're done.

This app keeps them separate because they require different mental models. Habits go at the top — they're the foundation. Tasks come below — they're what you're building on that foundation.

## Systems Over Goals

Inspired by Scott Adams' observation that "goals are for losers, systems are for winners." A goal is "lose 10 pounds." A system is "exercise every morning." This app is built around systems.

The habits section *is* your system. The streaks, the time windows, the daily reset — these reinforce identity-based behavior change. You're not trying to do things; you're becoming someone who does things.

## Time Windows, Not Exact Times

Habits aren't scheduled for 7:00 AM. They're scheduled for "morning." This is intentional:

- Less pressure than exact times
- Acknowledges that life is variable
- Focuses on rhythm, not rigidity
- Shows gentle indicators: "now", "coming up", "still open"

No red warnings. No guilt. Just orientation.

## Reflections: Learning From Yourself

When you complete a task or habit, you can optionally add a reflection — a quick note about what worked, what didn't, what you'd do differently.

These accumulate over time into a personal knowledge base. The app learns that *you* find warm intros more effective than cold outreach, that *you* work better with your phone in another room, that *you* tend to overthink things.

This isn't generic productivity advice. It's your own patterns, surfaced when relevant.

## The Plan Panel

An LLM-powered assistant that knows your full context — habits, tasks, streaks, reflections. You can ask it:

- "What should I focus on today?"
- "Help me break down the VP Sales hire"
- "What have I learned about hiring?"
- "I'm stuck on this task"
- "Find gas stations near 123 Main St, Franklin, TN"
- "What's a good place for lunch near me?"

It responds with awareness of your history and can take actions: add tasks, create subtasks, restructure plans. Every action can be undone.

**Web Search:** The assistant can search the web for real-time information like local businesses, addresses, prices, or current data. Just add your Tavily API key to `.env` (see Setup below).

## Markdown Storage

Your data lives in plain Markdown files you control:

```markdown
# Habits

## Morning workout
- Window: morning
- Streak: 12
- Reflections:
  - Felt sluggish but pushed through - always feel better after
  - Tried new HIIT routine, way more efficient

---

# Tasks

## Hire VP of Sales
- [x] Define role requirements (2025-01-05)
  > Took longer than expected - should have talked to founders first
- [ ] Reach out to network for referrals
- [ ] Contact 3 executive recruiters
```

No database. No vendor lock-in. Works with Obsidian, git, grep, whatever you want. Syncs via Dropbox or iCloud trivially.

History is preserved — every LLM action creates a snapshot, so you can always revert.

## What This App Isn't

- Not a calendar
- Not a project management tool for teams
- Not gamified with points and badges
- Not trying to optimize every minute of your day

It's a personal tool for maintaining habits, tracking tasks, learning from experience, and occasionally asking for help planning.

## Key Principles

1. **Habits above tasks** — Structure reflects philosophy
2. **Identity over outcomes** — "Who you're becoming" not "what you're trying to do"
3. **Gentle time awareness** — Orientation without pressure
4. **Reflections compound** — Your past informs your future
5. **LLM assists, you decide** — AI helps plan, you stay in control
6. **Plain text storage** — Your data, your format, forever readable
7. **Undo everything** — No fear of experimentation

---

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys:**
   Copy `.env.example` to `.env` and add your keys:
   ```bash
   cp .env.example .env
   ```

   Required:
   - `VITE_ANTHROPIC_API_KEY` - Get from https://console.anthropic.com/

   Optional (for web search):
   - `VITE_TAVILY_API_KEY` - Get free key from https://tavily.com

3. **Run the app:**
   ```bash
   npm run tauri:dev
   ```

4. **Build for production:**
   ```bash
   npm run tauri:build
   ```

---

Built for people who want to be thoughtful about their habits and tasks without being precious about it.
