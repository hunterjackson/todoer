# Todoer vs Todoist Feature Audit

## Legend
- ✅ Implemented
- 🔶 Partially Implemented
- ❌ Not Implemented
- 🚫 Out of Scope (requires backend/cloud)

---

## 1. Task Management

### Task Creation & Editing
| Feature | Status | Notes |
|---------|--------|-------|
| Create tasks | ✅ | |
| Quick Add modal | ✅ | Q shortcut |
| Task name/title | ✅ | |
| Task description | ✅ | Rich text via TipTap |
| Inline editing | ✅ | Via edit dialog |
| Natural language date parsing | ✅ | chrono-node |
| Copy/paste multiple tasks | ✅ | Paste multiple lines to create tasks |
| Auto-convert URLs to titles | ❌ | |
| Voice-to-task (Ramble) | 🚫 | Requires cloud AI |
| Email forwarding to tasks | 🚫 | Requires email server |

### Task Completion
| Feature | Status | Notes |
|---------|--------|-------|
| Complete tasks | ✅ | |
| Undo completion | ✅ | Undo/redo stack implemented |
| View completed tasks | ✅ | CompletedTasksSection component |

### Sub-tasks
| Feature | Status | Notes |
|---------|--------|-------|
| Create sub-tasks | ✅ | parent_id support |
| Nested display | ✅ | |
| Drag to indent | ✅ | Drag task onto another to make it a child |
| Keyboard indent/outdent | ✅ | Tab to indent, Shift+Tab to outdent |
| Show/hide sub-tasks | ✅ | Collapse/expand with chevron, H/L or arrow keys |

### Recurring Tasks
| Feature | Status | Notes |
|---------|--------|-------|
| Basic recurring | ✅ | rrule library |
| Natural language recurring | ✅ | "every monday", etc |
| Completion-based recurrence | ✅ | every! syntax (e.g., "every! 3 days") |
| Starting/ending dates | ❌ | |

### Priorities
| Feature | Status | Notes |
|---------|--------|-------|
| 4 priority levels | ✅ | P1-P4 |
| Visual color coding | ✅ | |
| Quick set in Quick Add | ✅ | |
| Keyboard shortcuts (1-4) | ✅ | 1-4 keys when task focused |

### Due Dates
| Feature | Status | Notes |
|---------|--------|-------|
| Natural language parsing | ✅ | chrono-node |
| Relative dates | ✅ | today, tomorrow, etc |
| Specific dates | ✅ | |
| Time support | ⚠️ | NLP parsing only; no time picker UI or time display |
| Remove date | ✅ | |

### Deadlines (Separate)
| Feature | Status | Notes |
|---------|--------|-------|
| Deadline field | ✅ | In TaskEditDialog, displays in TaskItem |
| Deadline filtering | ✅ | deadline:today, deadline:tomorrow, deadline:overdue, has:deadline, no deadline |

### Reminders
| Feature | Status | Notes |
|---------|--------|-------|
| Time-based reminders | ✅ | ReminderRepository + NotificationService |
| Desktop notifications | ✅ | Electron Notification API |
| Multiple reminders | ✅ | |
| Location-based | 🚫 | Requires GPS |

### Task Duration
| Feature | Status | Notes |
|---------|--------|-------|
| Duration field | ✅ | In TaskEditDialog, displays in TaskItem |
| Duration in calendar | ❌ | |
| Natural language duration | ✅ | "for X min/hour" in Quick Add |

---

## 2. Project Features

### Project Management
| Feature | Status | Notes |
|---------|--------|-------|
| Create projects | ✅ | |
| Project colors | ✅ | |
| Project favorites | ✅ | |
| Archive projects | ✅ | Double-click to edit, archive/unarchive |
| Delete projects | ✅ | |
| Duplicate projects | ✅ | Duplicates project with sections and tasks |
| Project description | ✅ | In ProjectDialog and ProjectView |

### Sub-projects
| Feature | Status | Notes |
|---------|--------|-------|
| Nested projects | ✅ | Hierarchical display in sidebar |
| Drag to indent | ❌ | |

### Sections
| Feature | Status | Notes |
|---------|--------|-------|
| Create sections | ✅ | |
| Reorder sections | ✅ | |
| Collapse sections | ✅ | In board view |

### Project Templates
| Feature | Status | Notes |
|---------|--------|-------|
| Save as template | ❌ | |
| Template gallery | ❌ | |

### Project Views
| Feature | Status | Notes |
|---------|--------|-------|
| List view | ✅ | |
| Board/Kanban view | ✅ | BoardView component |
| Calendar view | ✅ | Month grid |
| Grouping options | ✅ | By priority, project, due date |
| Sorting options | ✅ | By priority, date, alphabetical, date added |

---

## 3. Label Features

| Feature | Status | Notes |
|---------|--------|-------|
| Create labels | ✅ | |
| Label colors | ✅ | |
| Add via @ symbol | ✅ | TaskContentAutocomplete component |
| Multiple labels per task | ✅ | |
| Filter by label | ✅ | |
| Inline label autocomplete | ✅ | Type @ in task title for dropdown |
| Create labels inline | ✅ | "Create" option in autocomplete dropdown |

---

## 4. Filter/View Features

### Built-in Views
| Feature | Status | Notes |
|---------|--------|-------|
| Inbox | ✅ | |
| Today | ✅ | |
| Upcoming | ✅ | 7-day view |
| Calendar | ✅ | Month view |
| Search | ✅ | |

### Custom Filters
| Feature | Status | Notes |
|---------|--------|-------|
| Create filters | ✅ | |
| Filter colors | ✅ | |
| Add to favorites | ✅ | |

### Filter Query Syntax
| Feature | Status | Notes |
|---------|--------|-------|
| OR operator (\|) | ✅ | |
| AND operator (&) | ✅ | |
| NOT operator (!) | ✅ | Enhanced filter engine |
| Grouping () | ✅ | Enhanced filter engine |
| @label filter | ✅ | |
| #project filter | ✅ | |
| /section filter | ✅ | Filter engine updated |
| Priority filters | ✅ | p1-p4 |
| Date filters | ✅ | today, tomorrow, overdue |
| no date filter | ✅ | |
| search: keyword | ✅ | search:text in filter engine |
| Wildcard (*) | ✅ | Supports * in #project, @label, /section filters |

---

## 5. Quick Add Features

| Feature | Status | Notes |
|---------|--------|-------|
| Natural language dates | ✅ | |
| Priorities (p1-p4) | ✅ | Inline p1-p4 parsing |
| Projects (#name) | ✅ | #project triggers autocomplete dropdown |
| Project inline autocomplete | ✅ | Type # for dropdown, create new option |
| Sections (/name) | ✅ | /sectionname inline parsing |
| Labels (@name) | ✅ | @label triggers autocomplete dropdown |
| Label inline autocomplete | ✅ | Type @ for dropdown, create new option |
| Reminders (!) | ✅ | !tomorrow, !10min, !"Dec 25 3pm" in Quick Add |
| Deadlines ({date}) | ✅ | {tomorrow}, {Dec 31} in Quick Add |
| Duration (for X min) | ✅ | "for X min/hour" inline parsing |

---

## 6. Comments and Attachments

| Feature | Status | Notes |
|---------|--------|-------|
| Task comments | ✅ | TaskComments component |
| File attachments | ✅ | Stored as BLOBs in SQLite (10MB per file, 50MB per task limit) |
| Audio comments | 🚫 | |
| Project comments | ✅ | CommentRepository updated to support project_id |

---

## 7. Collaboration

| Feature | Status | Notes |
|---------|--------|-------|
| All collaboration features | 🚫 | Local-first app |

---

## 8. Notifications

| Feature | Status | Notes |
|---------|--------|-------|
| Desktop notifications | ✅ | NotificationService |
| Reminder notifications | ✅ | |

---

## 9. Karma/Productivity

| Feature | Status | Notes |
|---------|--------|-------|
| Karma points | ✅ | KarmaEngine tracks points for task completion |
| Daily/weekly goals | ✅ | In Settings panel |
| Streaks | ✅ | KarmaRepository.calculateStreak() |
| Productivity view | ✅ | ProductivityPanel component |

---

## 10. Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Theme/dark mode | ✅ | |
| Start of week | ✅ | In Settings panel, wired to CalendarView |
| Date format | ✅ | mdy/dmy/ymd in Settings, wired to TaskItem |
| Time format | 🔶 | Setting exists but not wired to all date displays |
| Default project | ✅ | In Settings panel, used by QuickAddModal |
| Notification toggle | ✅ | Enable/disable in Settings |
| Quiet hours | ❌ | Service supports it, no Settings UI controls |
| Confirm before delete | ✅ | Setting wired to all delete actions |
| Daily/weekly goals | ✅ | |

---

## 11. Import/Export

| Feature | Status | Notes |
|---------|--------|-------|
| Export to CSV/JSON | ✅ | DataExport service |
| Import from CSV | ✅ | |
| Import from JSON | ✅ | |
| Backup/restore | ✅ | Via JSON export/import |

---

## 12. Keyboard Shortcuts

| Feature | Status | Notes |
|---------|--------|-------|
| Q - Quick Add | ✅ | |
| / - Search | ✅ | |
| G then T - Today | ✅ | |
| G then I - Inbox | ✅ | |
| G then U - Upcoming | ✅ | |
| G then C - Calendar | ✅ | |
| M - Toggle sidebar | ✅ | |
| ? - Shortcuts help | ✅ | |
| Cmd/Ctrl+, - Settings | ✅ | |
| Cmd/Ctrl+Z - Undo | ✅ | |
| Cmd/Ctrl+Shift+Z - Redo | ✅ | |
| E - Complete task | ✅ | TaskList keyboard support |
| 1-4 - Set priority | ✅ | TaskList keyboard support |
| J/K - Navigate | ✅ | TaskList keyboard support |
| Esc - Dismiss | ✅ | |

---

## Remaining Features to Implement

### High Priority (Core UX)
(All completed)

### Medium Priority (Power Users)
- 🔶 Time format setting not wired to all date displays
- ❌ Quiet hours Settings UI

### Lower Priority (Nice to Have)
- ❌ Project templates
- ❌ Drag-to-indent sub-projects in sidebar
- ❌ Duration in calendar view

---

## Recently Completed (This Session)
- ✅ Project comments (comments table updated to support project_id)
- ✅ Completion-based recurrence (every! syntax - recurs from completion date)
- ✅ Karma/productivity tracking (KarmaEngine + ProductivityPanel)
- ✅ Streaks tracking (calculateStreak with consecutive days)
- ✅ Default project setting (Settings panel + QuickAddModal integration)
- ✅ Quick Add reminders (!) syntax - !tomorrow, !10min, !"Dec 25 3pm"
- ✅ Quick Add deadlines ({date}) syntax - {tomorrow}, {Dec 31}
- ✅ Deadline filtering (deadline:today/tomorrow/overdue, has:deadline, no deadline)
- ✅ Wildcard (*) filter support for projects, labels, sections
- ✅ Inline Quick Add parsing (#project /section p1-p4 "for X min")
- ✅ Natural language duration parsing
- ✅ Drag subtasks to indent/outdent (Tab/Shift+Tab keyboard shortcuts)
- ✅ Copy/paste multiple tasks
- ✅ Sorting/grouping options in views
- ✅ Date format setting (MM/DD, DD/MM, YYYY-MM-DD)
- ✅ Project description field
- ✅ Start of week setting (already in Settings)
- ✅ Time format setting (already in Settings)
- ✅ Show/hide subtasks toggle (with H/L keyboard shortcuts)
- ✅ Create new labels from task edit dialog
- ✅ Fixed project view mode toggle not updating immediately
- ✅ Fixed task project change (now clears section when moving)
- ✅ Comprehensive E2E tests for bug fixes
- ✅ Duplicate project
- ✅ Deadline field UI
- ✅ Task duration UI
- ✅ /section filter syntax
- ✅ search: keyword filter (already existed)
- ✅ Archive/unarchive projects
- ✅ Sub-project hierarchy UI
- ✅ Keyboard shortcuts (J/K navigation, E complete, 1-4 priority)
- ✅ Undo/redo stack
- ✅ View completed tasks
- ✅ Board/Kanban view
- ✅ Desktop notifications and reminders
- ✅ Task comments
- ✅ Export/import (JSON/CSV)
- ✅ Enhanced filter syntax (!, (), @label)
- ✅ Settings panel
- ✅ ESLint setup
- ✅ Code coverage thresholds
- ✅ Click/drag behavior fix
