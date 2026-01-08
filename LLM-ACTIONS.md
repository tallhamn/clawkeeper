# LLM Action System

## Overview
Claude can now propose changes to habits and tasks, which the user must approve via button clicks before they're applied.

## Supported Actions

### Task Operations
- **add_task**: Create a new top-level task
- **add_subtask**: Add a subtask under an existing task
- **edit_task**: Rename/update a task's text
- **delete_task**: Remove a task (and all its children)

### Habit Operations
- **add_habit**: Create a new habit with custom interval
- **edit_habit**: Update habit name and/or interval
- **delete_habit**: Remove a habit

## How It Works

### 1. User asks Claude to make a change
```
User: "delete the wine task"
User: "add a habit for meditation every 4 hours"
User: "rename 'Hire VP' to 'Hire VP of Sales'"
```

### 2. Claude responds with json-action blocks
Claude's response includes hidden JSON in code blocks:

```json-action
{
  "type": "delete_task",
  "taskText": "wine",
  "label": "Delete 'wine task'"
}
```

### 3. UI shows approval buttons
- JSON blocks are completely hidden from the user
- If Claude's response is ONLY JSON (no conversational text), the message bubble is hidden too
- Action buttons appear as standalone UI elements
- User sees clean buttons: **"Delete 'wine task'"** **"Rename 'X' to 'Y'"** etc.

### 4. User clicks → action executes
- Change is applied immediately
- That specific button disappears (other buttons remain for batch operations)
- Undo bar appears with option to revert
- Undo expires after 10 seconds

## Implementation Details

### Files Modified
- **src/lib/types.ts**: Added action types and properties
- **src/lib/claude.ts**: Updated system prompt with examples
- **src/components/ChatPanel.tsx**: Parser extracts json-action blocks
- **src/App.tsx**: Handlers execute approved actions

### Parser Logic
1. Extracts `json-action` code blocks from Claude's response
2. Strips JSON blocks from displayed text (user never sees them)
3. **Hides incomplete blocks during streaming** - prevents JSON from flashing as it arrives
4. Collapses excessive blank lines (more than 2 consecutive newlines)
5. Validates required fields for each action type
6. Finds task/habit IDs by text (supports partial matching)
7. Returns array of validated actions to render as buttons

**Streaming JSON Detection:**
During streaming, the regex detects partial JSON blocks (``` or ```j or ```json etc.) and hides them immediately. This prevents the flash of JSON text before the closing ``` arrives.

**Why collapse whitespace?**
When JSON blocks are removed, they can leave behind 8+ blank lines in the message. Collapsing to max 2 newlines preserves paragraph breaks while removing the visual clutter.

### Batch Operations
- Claude can propose multiple actions in a single response
- Each action gets its own approval button
- User can click buttons in any order
- When a button is clicked, only that button disappears
- Remaining buttons stay visible for other operations

### Matching Algorithm
- **Exact match**: "meditation" → "meditation"
- **Partial match**: "wine task" → "Buy wine for dinner"
- **Case insensitive**: "Meditation" → "meditation"
- **Active tasks only**: Completed tasks are excluded from matching (read-only for context)

## JSON Action Format

### Task Examples
```json
// Add task
{"type": "add_task", "text": "Launch product", "label": "Add 'Launch product'"}

// Delete task
{"type": "delete_task", "taskText": "old task", "label": "Delete 'old task'"}

// Edit task
{"type": "edit_task", "taskText": "old name", "newText": "new name", "label": "Rename task"}

// Add subtask
{"type": "add_subtask", "parentText": "parent", "text": "subtask", "label": "Add subtask"}
```

### Habit Examples
```json
// Add habit (24h = daily, 4 = every 4 hours)
{"type": "add_habit", "text": "Meditate", "repeatIntervalHours": 24, "label": "Add daily meditation"}

// Delete habit
{"type": "delete_habit", "habitText": "meditation", "label": "Delete meditation habit"}

// Edit habit (can update text and/or interval)
{"type": "edit_habit", "habitText": "old", "newText": "new", "repeatIntervalHours": 4, "label": "Update habit"}
```

## Best Practices for Claude Responses

### Include Conversational Context
Claude should wrap actions with explanatory text:

**Good:**
```
I can help with those tasks. Here's what I suggest:

```json-action
{"type": "delete_task", "taskText": "task1"}
```

Let me know if you'd like me to proceed with the others!
```

**Bad:**
```
```json-action
{"type": "delete_task", "taskText": "task1"}
```
```
(No context - just action buttons appear, confusing for user)

### Action Button Labels
- Make labels clear and specific
- Include the item being acted on
- Use action verbs: "Delete", "Rename", "Add"

**Good:** `"Delete 'Buy groceries task'"`
**Bad:** `"Delete task"`

## Important Constraints

### Completed Tasks Are Read-Only
- LLM can see completed tasks for learning and context
- Parser **skips completed tasks** when matching for edits/deletes
- This preserves historical data integrity
- If user asks to edit a completed task, no action button appears

**Example:**
```
User: "delete the wine task"
- If task is active → Button appears: "Delete 'wine task'"
- If task is completed → No button (silently filtered)
```

### Habits Are Always Editable
- Habits don't have a "completed" state (they're recurring)
- All habits can be edited or deleted regardless of when last completed

## Error Handling

### If task/habit not found
- Parser silently skips the action
- No button is shown to user
- Claude should receive feedback to try again with exact name

### If JSON is malformed
- Parser logs warning to console
- Continues parsing other actions
- Claude can self-correct on next message

## Future Enhancements
- Preview mode (show diff before applying)
- Confirmation dialogs for destructive actions
- Action history/audit log
- Apply all button (execute all suggested actions at once)
