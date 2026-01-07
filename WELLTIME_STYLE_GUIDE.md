# Welltime UI Style Guide

## Design Philosophy

Japanese Minimalism meets Analog warmth. The app should feel calm, intentional, and unhurried — like a quality tool you'd use for decades. Minimal decoration, generous whitespace, and a single accent color used sparingly.

## Color Palette

### Base Colors (Stone)
Use Tailwind's `stone` palette as the foundation:
- `stone-100` (#f5f5f4) — Page background
- `stone-200` (#e7e5e4) — Borders, dividers
- `stone-300` (#d6d3d1) — Inactive elements, subtle borders
- `stone-400` (#a8a29e) — Placeholder text, secondary text
- `stone-500` (#78716c) — Tertiary text
- `stone-600` (#57534e) — Secondary text
- `stone-700` (#44403c) — Primary text, icons
- `stone-800` (#292524) — Headers, emphasis

### Accent Color (Kyoto Red)
A single accent inspired by vermillion torii gates (朱色). Use sparingly — only for:
- Completed checkbox fills
- "Now" badges
- Progress ring stroke
- Primary action buttons
- Reflection highlights
- Active/selected states

```
KYOTO_RED = '#c53d2d'        // Primary accent
KYOTO_RED_LIGHT = '#fef2f1'  // Subtle backgrounds (current window highlight)
KYOTO_RED_MEDIUM = '#f8d7d4' // Borders, badge backgrounds
```

## Typography

- **Font**: System default (San Francisco on Mac/iOS, Segoe on Windows, Roboto on Android)
- **Base size**: 15px for body text
- **Headers**: 
  - Section labels: 12px, uppercase, `tracking-wider`, `font-semibold`, `text-stone-500`
  - Page title: 18px, `font-semibold`, `text-stone-800`
- **Secondary text**: 14px, `text-stone-400`
- **Tiny labels**: 10px, uppercase, `tracking-wide`

## Spacing

Generous but not excessive:
- Page padding: 16px horizontal, 24px vertical
- Card padding: 16px
- Between sections: 20px
- Between list items: 12px vertical
- Inner element gaps: 12px

## Components

### Cards/Sections
```
- Background: white
- Border radius: 16px (rounded-2xl)
- Shadow: shadow-sm (subtle)
- No visible border
- Section header: border-b border-stone-100, px-4 py-3
```

### Checkboxes
```
- Size: 20px × 20px (normal), 16px × 16px (small for subtasks)
- Unchecked: white fill, 2px stone-300 border, rounded (not fully round)
- Hover: border becomes stone-400
- Checked: KYOTO_RED fill, KYOTO_RED border, white checkmark (3px stroke)
- Transition: 200ms
```

### Buttons

**Primary (rare, only for key actions):**
```
- Background: KYOTO_RED
- Text: white
- Padding: 8px 16px
- Border radius: 8px (rounded-lg)
- No border
```

**Secondary/Ghost:**
```
- Background: transparent or stone-50 on hover
- Text: stone-600
- No border
```

**Accent Badge (like "Plan" button):**
```
- Background: KYOTO_RED_LIGHT
- Text: KYOTO_RED
- Font: 12px, font-semibold
- Padding: 6px 12px
- Border radius: 8px
```

### Input Fields
```
- Background: stone-50
- Border: 1px stone-200
- Border radius: 8px
- Padding: 8px 12px
- Font size: 14px
- Focus: ring-1 with KYOTO_RED (subtle)
- Placeholder: stone-400
```

### List Items (Habits/Tasks)
```
- Padding: 12px horizontal, 12px vertical
- No visible separator between items
- Hover: subtle stone-50 background (optional)
- Completed items: opacity-50, text line-through
- Current window items: KYOTO_RED_LIGHT background
```

### "Now" Badge
```
- Text: KYOTO_RED
- Background: KYOTO_RED_MEDIUM
- Font: 10px, uppercase, font-semibold, tracking-wide
- Padding: 2px 6px
- Border radius: 4px
```

### Progress Ring
```
- Size: 56px × 56px
- Track: stone-200, 2.5px stroke
- Progress: KYOTO_RED, 2.5px stroke, rounded caps
- Center text: completed count (14px semibold) over total (9px stone-400)
- Background: white fill
```

### Modals
```
- Backdrop: black/30
- Card: white, rounded-2xl, shadow-xl
- Max width: 384px (max-w-sm)
- Header: border-b border-stone-100, font-semibold
- Footer: border-t border-stone-100, flex justify-between
```

### Chat/Slide Panel
```
- Width: 100% on mobile, 384px on desktop
- Background: white
- Border-left: stone-200
- Shadow: shadow-2xl
- Header background: white (not colored)
- Message bubbles:
  - User: stone-700 background, white text, rounded-xl
  - Assistant: stone-100 background, stone-700 text, rounded-xl
  - System: KYOTO_RED_LIGHT background, KYOTO_RED text, rounded-full, small
```

## Layout Structure

```
┌─────────────────────────────────┐
│  Header Card                    │
│  ┌─────────────────┬─────────┐  │
│  │ Date            │Progress │  │
│  │ Time            │  Ring   │  │
│  ├─────────────────┴─────────┤  │
│  │ Coach message    [Plan]   │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  HABITS                    2/4  │
│  ───────────────────────────────│
│  ☐ Habit name           12d now │
│  ☑ Habit name            5d     │
│  ☐ Habit name            8d     │
│  + Add habit                    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  TASKS                   3 open │
│  ───────────────────────────────│
│  🔍 Search tasks...             │
│  ───────────────────────────────│
│  ☐ Task name              2/3   │
│    │ ☐ Subtask                  │
│    │ ☑ Subtask                  │
│  ☐ Task name                    │
│  + Add task                     │
│       View completed →          │
└─────────────────────────────────┘

         WELLTIME (footer)
```

## Key Principles

1. **Restraint**: Don't add visual elements unless they serve a clear purpose
2. **Whitespace**: Let elements breathe — generous padding over tight layouts
3. **Single accent**: Kyoto red only for interactive/active states, never decorative
4. **No icons for decoration**: Icons only when they clarify function
5. **Subtle hierarchy**: Use font weight and size, not color, for most hierarchy
6. **Calm transitions**: 200-300ms for state changes, nothing flashy
7. **Mobile-first**: Design for single-column, ~400px width

## What to Avoid

- Gradients (except very subtle ones if absolutely needed)
- Multiple accent colors
- Heavy shadows
- Rounded-full buttons (except small badges)
- Emoji in the UI
- Decorative borders or dividers
- Dense information layouts
- Animation for its own sake
