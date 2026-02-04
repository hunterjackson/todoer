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
| Task description | ✅ | |
| Inline editing | 🔶 | Via edit dialog, not inline |
| Natural language date parsing | ✅ | chrono-node |
| Copy/paste multiple tasks | ❌ | |
| Auto-convert URLs to titles | ❌ | |
| Voice-to-task (Ramble) | 🚫 | Requires cloud AI |
| Email forwarding to tasks | 🚫 | Requires email server |

### Task Completion
| Feature | Status | Notes |
|---------|--------|-------|
| Complete tasks | ✅ | |
| Undo completion | ❌ | No undo stack |
| View completed tasks | ❌ | |

### Sub-tasks
| Feature | Status | Notes |
|---------|--------|-------|
| Create sub-tasks | ✅ | parent_id support |
| Nested display | ✅ | |
| Drag to indent | ❌ | |
| Keyboard indent/outdent | ❌ | |
| Show/hide sub-tasks | ❌ | |

### Recurring Tasks
| Feature | Status | Notes |
|---------|--------|-------|
| Basic recurring | ✅ | rrule library |
| Natural language recurring | 🔶 | Limited patterns |
| Completion-based recurrence | ❌ | every! syntax |
| Starting/ending dates | ❌ | |

### Priorities
| Feature | Status | Notes |
|---------|--------|-------|
| 4 priority levels | ✅ | P1-P4 |
| Visual color coding | ✅ | |
| Quick set in Quick Add | ✅ | |
| Keyboard shortcuts (1-4) | ❌ | |

### Due Dates
| Feature | Status | Notes |
|---------|--------|-------|
| Natural language parsing | ✅ | chrono-node |
| Relative dates | ✅ | today, tomorrow, etc |
| Specific dates | ✅ | |
| Time support | ✅ | |
| Remove date | ✅ | |

### Deadlines (Separate)
| Feature | Status | Notes |
|---------|--------|-------|
| Deadline field | ❌ | DB schema has it, UI missing |
| Deadline filtering | ❌ | |

### Reminders
| Feature | Status | Notes |
|---------|--------|-------|
| Time-based reminders | ❌ | DB schema exists |
| Desktop notifications | ❌ | |
| Multiple reminders | ❌ | |
| Location-based | 🚫 | Requires GPS |

### Task Duration
| Feature | Status | Notes |
|---------|--------|-------|
| Duration field | ❌ | DB schema has it |
| Duration in calendar | ❌ | |
| Natural language duration | ❌ | |

---

## 2. Project Features

### Project Management
| Feature | Status | Notes |
|---------|--------|-------|
| Create projects | ✅ | |
| Project colors | ✅ | |
| Project favorites | ✅ | |
| Archive projects | ❌ | DB has archived_at |
| Delete projects | ✅ | |
| Duplicate projects | ❌ | |
| Project description | ❌ | |

### Sub-projects
| Feature | Status | Notes |
|---------|--------|-------|
| Nested projects | ❌ | DB has parent_id |
| Drag to indent | ❌ | |

### Sections
| Feature | Status | Notes |
|---------|--------|-------|
| Create sections | ✅ | |
| Reorder sections | ✅ | |
| Collapse sections | 🔶 | DB has it, UI partial |

### Project Templates
| Feature | Status | Notes |
|---------|--------|-------|
| Save as template | ❌ | |
| Template gallery | ❌ | |

### Project Views
| Feature | Status | Notes |
|---------|--------|-------|
| List view | ✅ | |
| Board/Kanban view | ❌ | DB has view_mode |
| Calendar view | ✅ | Month grid |
| Grouping options | ❌ | |
| Sorting options | ❌ | |

---

## 3. Label Features

| Feature | Status | Notes |
|---------|--------|-------|
| Create labels | ✅ | |
| Label colors | ✅ | |
| Add via @ symbol | ❌ | Should be # in our case |
| Multiple labels per task | ✅ | |
| Filter by label | ✅ | |
| Inline label autocomplete | ❌ | Task #30 |

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
| NOT operator (!) | ❌ | |
| Grouping () | ❌ | |
| @label filter | ❌ | |
| #project filter | ✅ | |
| /section filter | ❌ | |
| Priority filters | ✅ | p1-p4 |
| Date filters | ✅ | today, tomorrow, overdue |
| no date filter | ✅ | |
| search: keyword | ❌ | |
| Wildcard (*) | ❌ | |

---

## 5. Quick Add Features

| Feature | Status | Notes |
|---------|--------|-------|
| Natural language dates | ✅ | |
| Priorities (p1-p4) | ✅ | |
| Projects (#name) | ❌ | Need inline parsing |
| Sections (/name) | ❌ | |
| Labels (@name) | ❌ | Task #30 |
| Reminders (!) | ❌ | |
| Deadlines ({date}) | ❌ | |
| Duration (for X min) | ❌ | |

---

## 6. Comments and Attachments

| Feature | Status | Notes |
|---------|--------|-------|
| Task comments | ❌ | DB schema exists |
| File attachments | ❌ | DB schema exists |
| Audio comments | 🚫 | |
| Project comments | ❌ | |

---

## 7. Collaboration

| Feature | Status | Notes |
|---------|--------|-------|
| All collaboration features | 🚫 | Local-first app |

---

## 8. Notifications

| Feature | Status | Notes |
|---------|--------|-------|
| Desktop notifications | ❌ | Electron supports this |
| Reminder notifications | ❌ | |

---

## 9. Karma/Productivity

| Feature | Status | Notes |
|---------|--------|-------|
| Karma points | ❌ | DB schema exists |
| Daily/weekly goals | ❌ | |
| Streaks | ❌ | |
| Productivity view | ❌ | |

---

## 10. Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Theme/dark mode | ✅ | |
| Start of week | ❌ | |
| Date format | ❌ | |
| Time format | ❌ | |
| Default project | ❌ | |

---

## 11. Import/Export

| Feature | Status | Notes |
|---------|--------|-------|
| Export to CSV/JSON | ❌ | |
| Import from CSV | ❌ | |
| Backup/restore | ❌ | |

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
| M - Toggle sidebar | ❌ | |
| E - Complete task | ❌ | |
| 1-4 - Set priority | ❌ | |
| J/K - Navigate | ❌ | |
| Esc - Dismiss | ✅ | |

---

## Priority Implementation List

### High Priority (Core UX)
1. ❌ Undo/redo stack
2. ❌ View completed tasks
3. ❌ Inline label autocomplete (#) - Task #30
4. ❌ Board/Kanban view
5. ❌ Desktop notifications/reminders
6. ❌ Drag and drop between projects - Task #28
7. ❌ More keyboard shortcuts

### Medium Priority (Power Users)
8. ❌ Comments on tasks
9. ❌ Export/import
10. ❌ Task duration
11. ❌ Deadlines (separate from due)
12. ❌ Advanced filter syntax (!, (), @label)
13. ❌ Sub-project hierarchy UI
14. ❌ Archive projects
15. ❌ Sorting/grouping options

### Lower Priority (Nice to Have)
16. ❌ Karma/productivity tracking
17. ❌ Project templates
18. ❌ Settings preferences
19. ❌ Duplicate project
20. ❌ Copy/paste multiple tasks

---

## Tasks to Create

Based on this audit, the following features should be added to the task list:
1. Undo/redo stack
2. View completed tasks
3. Board/Kanban view
4. Desktop notifications and reminders
5. Task comments
6. Export/import functionality
7. More keyboard shortcuts (E, 1-4, J/K, M)
8. Advanced filter syntax (!, (), @label, /section)
9. Settings preferences (date format, start of week, etc.)
