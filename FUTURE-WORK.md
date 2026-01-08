# Future Work

## iCloud Sync - Polished Implementation

### Current Status (MVP)
- ✅ Path changed to iCloud Drive location
- ✅ Will sync automatically if user is signed into iCloud
- ⚠️ Will fail silently if iCloud not available

### Needed for Production

#### 1. iCloud Availability Detection
**Problem:** If user isn't signed into iCloud, app fails to create directory and crashes
**Solution:**
```typescript
async function isICloudAvailable(): Promise<boolean> {
  try {
    const iCloudPath = await resolveDirectory('iCloud~com~welltime~app');
    return await exists(iCloudPath);
  } catch {
    return false;
  }
}
```

#### 2. Graceful Fallback to Local Storage
**Implementation:**
- Check iCloud availability on app start
- If unavailable, use `~/.welltime/` as fallback
- Show user notification: "Sign in to iCloud in System Settings to enable sync"
- Add settings toggle: "Use iCloud" (disabled if not available)

#### 3. Data Migration
**When user enables iCloud:**
- Copy existing `~/.welltime/` data to iCloud location
- Verify copy succeeded
- Delete local copy (or keep as backup?)

**When user disables iCloud:**
- Copy iCloud data back to local
- Continue using local storage

#### 4. Sync Conflict Resolution
**Problem:** User edits on both devices while offline, then both sync
**Current behavior:** Last write wins (data loss possible)
**Better solution:**
- Detect conflicts (compare timestamps)
- Show merge UI: "Changes on iPhone" vs "Changes on Mac"
- Let user choose which to keep or merge manually

#### 5. Settings UI
**Add to app:**
```
Settings > Storage
  [ ] Use iCloud Drive (requires macOS 10.15+)
  Status: Synced | Not available | Syncing...

  Last synced: 2 minutes ago
  Data location: ~/Library/Mobile Documents/iCloud~com~welltime~app/
```

#### 6. Error Handling
**Better error messages:**
- "iCloud Drive is not enabled. Go to System Settings > Apple ID > iCloud"
- "iCloud Drive is full. Free up space or disable sync"
- "Cannot access iCloud Drive. Check your connection"

#### 7. Sync Status Indicator
**Show in UI:**
- Cloud icon in header
- Green = synced
- Yellow = syncing
- Red = error
- Gray = local only (iCloud disabled)

#### 8. iOS Implementation Notes
**When building iOS app:**
```swift
// Swift code for iOS
let containerURL = FileManager.default.url(
    forUbiquityContainerIdentifier: "iCloud.com.welltime.app"
)?.appendingPathComponent("Documents")
```

**Required:**
- Add iCloud capability in Xcode
- Add CloudKit entitlement
- Request iCloud permission (automatic on first access)

---

## Plan Button / LLM Task Proposals

### Vision
User asks LLM for help planning, LLM proposes tasks, user approves and they're added to markdown.

### Example Flow
```
User: "Help me prepare for a job interview next week"

LLM: "Here's a preparation plan:

## Interview Preparation
- [ ] Research company background (1h)
  - [ ] Read company website and recent news
  - [ ] Check Glassdoor reviews
  - [ ] Review LinkedIn profiles of interviewers
- [ ] Prepare STAR stories (2h)
  - [ ] List 5 key achievements
  - [ ] Write out STAR format for each
- [ ] Practice common questions (1h)
- [ ] Prepare questions to ask (30m)

[Preview Tasks] [Modify Request]"

User clicks "Preview Tasks" → sees visual preview of tasks
User clicks "Add to Current Tasks" → tasks added to current.md
```

### Proposed Architecture

#### Option A: Simple Preview (Recommended for MVP)
1. **LLM Response Format:**
   ```json
   {
     "message": "Here's a preparation plan:",
     "proposed_tasks": [
       { "text": "Research company background", "subtasks": [...] },
       { "text": "Prepare STAR stories", "subtasks": [...] }
     ]
   }
   ```

2. **UI Flow:**
   - Show LLM's proposed tasks in a preview panel
   - Render as actual TaskItem components (but grayed out/preview mode)
   - Buttons: "Add These Tasks" | "Revise" | "Cancel"
   - On "Add" → parse and add to current.md

3. **Benefits:**
   - ✅ Simple to implement
   - ✅ Visual preview matches final result
   - ✅ User sees exactly what they're getting
   - ✅ Can iterate with "make it more detailed"

#### Option B: Markdown Diff View (More Complex)
1. **LLM returns markdown edits:**
   ```json
   {
     "edits": [
       {
         "type": "insert_after",
         "marker": "## Projects",
         "content": "## Interview Preparation\n- [ ] Research..."
       }
     ]
   }
   ```

2. **Show git-style diff:**
   ```diff
   ## Current Projects
   - [ ] Fix bug in login

   + ## Interview Preparation
   + - [ ] Research company
   + - [ ] Prepare stories
   ```

3. **Benefits:**
   - ✅ Shows exact changes to markdown
   - ✅ More transparent
   - ❌ Complex to implement
   - ❌ Less visual than preview

#### Option C: Conversational Refinement (Most Powerful)
1. **Multi-turn conversation:**
   ```
   User: "Help me prep for interview"
   LLM: [Shows preview] "Here's a plan..."
   User: "Make it more detailed"
   LLM: [Shows new preview] "I've expanded each task..."
   User: "Add time estimates"
   LLM: [Shows updated preview]
   User: "Perfect" → [Adds to tasks]
   ```

2. **Implementation:**
   - Keep conversation history
   - Each LLM response includes proposed tasks
   - User can refine multiple times
   - Only final approved version gets added

3. **Benefits:**
   - ✅ Most flexible
   - ✅ User can iterate until perfect
   - ✅ Natural conversation
   - ❌ Needs state management for proposals

### Recommended Implementation Path

**Phase 1: Simple Preview**
- LLM can suggest tasks in response
- Show preview panel with "Add" button
- User approves → tasks get added
- ~2 hours to implement

**Phase 2: Conversational Refinement**
- Add "Refine" button to preview
- Keep showing updated previews
- Track proposal history
- ~4 hours to add

**Phase 3: Smart Placement**
- LLM can specify where to add tasks
- "Add under 'Work Projects'" vs "Create new section"
- Requires markdown editing logic
- ~6 hours to add

### Technical Challenges

#### 1. Markdown Insertion
**Problem:** Where to add new tasks in current.md?
**Solutions:**
- Always append to end (simplest)
- Let user choose parent task
- LLM specifies insertion point
- Create new top-level task

#### 2. Conflict Detection
**Problem:** User edits tasks while LLM is generating
**Solution:**
- Capture state when user sends message
- Compare before applying
- Show warning if changed

#### 3. Subtask Hierarchy
**Problem:** LLM suggests nested tasks, need to preserve structure
**Solution:**
- Use markdown indentation in LLM response
- Parse into Task tree structure
- Preserve parent-child relationships

#### 4. ID Generation
**Problem:** Need stable IDs for tasks
**Solution:**
- Generate IDs when adding to markdown
- LLM doesn't need to know about IDs
- IDs created during parse step

### Open Questions

1. **Should proposals persist?**
   - If user closes chat, do proposals disappear?
   - Save proposals to markdown as comments?

2. **Multiple proposals at once?**
   - Can LLM suggest multiple separate task groups?
   - How to preview multiple changes?

3. **Undo granularity?**
   - Can user undo individual task adds?
   - Or undo entire LLM proposal?

4. **Edit vs Replace?**
   - If user asks to "revise plan", does it replace or add more?
   - Need clear UX for this

---

## Other Future Enhancements

### Habit Reflections
- Show reflection trends over time
- "You've noted X pattern 3 times this month"
- Suggest habit adjustments based on reflections

### Search
- Full-text search across all archives
- Search by date range
- Search by completion status

### Statistics
- Tasks completed this week/month
- Habit streak visualizations
- Time-to-completion analysis

### Export
- Export to PDF for sharing
- Export date range to markdown
- Email weekly summary

### Themes
- Dark mode
- Custom accent colors
- Font size preferences

### Keyboard Shortcuts
- Quick add task: Cmd+N
- Quick add habit: Cmd+Shift+N
- Toggle chat: Cmd+K
- Search: Cmd+F
