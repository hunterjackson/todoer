# Todoer Code Review

## Scope
Architecture-down pass focused on feature inconsistencies, described feature gaps, and incorrect implementations.

## Validation
- `npm run -s test:run -- tests/unit/code-review-fixes.test.ts` passed.
- `npm run -s test:run -- tests/unit/services/karmaEngine.test.ts` failed (`updateStreak > should update current streak`).

## Findings

### High
1. Undo/redo bypasses completion business logic (karma and recurrence semantics).
- Evidence:
  - Normal completion awards karma and runs recurrence logic in `src/main/ipc/handlers.ts:144`.
  - Undo/redo calls `taskRepo.complete/uncomplete` directly in `src/main/ipc/handlers.ts:898` and `src/main/ipc/handlers.ts:954`.
  - `recurring-complete` undo only restores due date in `src/main/services/undoRedo.ts:154`.
  - Redo for `recurring-complete` returns `complete` in `src/main/services/undoRedo.ts:212`, but redo handling still uses direct repo completion.
- Impact: points drift from actual state; recurring redo can complete instead of rescheduling.

2. Karma date keys are inconsistent (UTC day strings vs local-day streak logic).
- Evidence:
  - UTC day keys are used in `src/main/services/karmaEngine.ts:55` and `src/main/services/karmaEngine.ts:98`.
  - Streak logic uses local midnight then ISO conversion in `src/main/db/repositories/karmaRepository.ts:193`.
  - Failing test at `tests/unit/services/karmaEngine.test.ts:215`.
- Impact: streak and “today” metrics are wrong around timezone/day boundaries.

3. JSON import is not round-trip safe and can drop/corrupt relationships.
- Evidence:
  - Export writes full entities in `src/main/ipc/handlers.ts:598` and `src/main/ipc/handlers.ts:611`.
  - Project import restores only a subset of fields in `src/main/ipc/handlers.ts:683`.
  - Task import restores only a subset of fields in `src/main/ipc/handlers.ts:779`.
  - Parent/project remaps can fall back to stale IDs or `null` in `src/main/ipc/handlers.ts:732`, `src/main/ipc/handlers.ts:766`, and `src/main/ipc/handlers.ts:770`.
  - Ordering is only parent/non-parent, not fully topological, in `src/main/ipc/handlers.ts:674` and `src/main/ipc/handlers.ts:750`.
- Impact: backup/import can silently lose completion/deadline/duration/view data and flatten hierarchies.

### Medium
4. Board drag-and-drop still writes duplicate `sort_order` values.
- Evidence:
  - Drop-on-task sets identical order in `src/renderer/components/views/BoardView.tsx:310`.
  - Reads sort only by `sort_order` in `src/main/db/repositories/taskRepository.ts:124`.
- Impact: unstable ordering after reload/further moves.

5. Section behavior is marked implemented but not actually wired in board view.
- Evidence:
  - Audit marks section reorder/collapse as implemented in `FEATURE_AUDIT.md:114` and `FEATURE_AUDIT.md:115`.
  - Board drag handler only processes tasks in `src/renderer/components/views/BoardView.tsx:299`.
  - `reorderSection` exists but is unused in board view (`src/renderer/hooks/useSections.ts:64`, `src/renderer/components/views/BoardView.tsx:248`).
- Impact: documented section capabilities are missing.

6. Label completed-tasks section still ignores selected label.
- Evidence:
  - TODO path fetches all completed tasks in `src/renderer/components/task/CompletedTasksSection.tsx:41`.
- Impact: label view can show unrelated completed tasks.

7. Search results are stale after task mutations.
- Evidence:
  - Displayed results come from `useTaskSearch` in `src/renderer/components/views/SearchView.tsx:18`.
  - Mutations use `useTasks` actions in `src/renderer/components/views/SearchView.tsx:19` without refreshing search query results.
- Impact: complete/update/delete can leave stale rows until query changes.

8. Sidebar active state is keyed only by view type, not selected entity id.
- Evidence:
  - Filters use `currentView === 'filter'` in `src/renderer/components/sidebar/Sidebar.tsx:236`.
  - Projects use `currentView === 'project'` in `src/renderer/components/sidebar/Sidebar.tsx:279`.
  - Labels use `currentView === 'label'` in `src/renderer/components/sidebar/Sidebar.tsx:350`.
- Impact: multiple entries can render as active simultaneously.

9. Project view mode buttons both toggle mode instead of selecting an explicit mode.
- Evidence:
  - Single toggle function in `src/renderer/components/views/ProjectView.tsx:73`.
  - Both buttons call that function in `src/renderer/components/views/ProjectView.tsx:179` and `src/renderer/components/views/ProjectView.tsx:186`.
- Impact: clicking either icon flips mode, which is incorrect UX behavior.

10. DatePicker quick options and calendar selected-day panel can resolve wrong dates.
- Evidence:
  - Quick options call `handleDayClick(date.getDate())` in `src/renderer/components/ui/DatePicker.tsx:156`, using current month/year view context.
  - Calendar selected-day tasks are derived via current month/year in `src/renderer/components/views/CalendarView.tsx:45` and `src/renderer/components/views/CalendarView.tsx:90`.
- Impact: users can apply/view tasks for the wrong day.

11. Settings are partially disconnected from runtime behavior, and docs overstate support.
- Evidence:
  - Settings keys are persisted in `src/renderer/components/settings/SettingsPanel.tsx:32` and `src/renderer/components/settings/SettingsPanel.tsx:41`.
  - Date/week presentation remains hardcoded in `src/renderer/components/views/CalendarView.tsx:8` and `src/renderer/components/task/TaskItem.tsx:218`.
  - Delete confirmation is hardcoded via `confirm(...)` in `src/renderer/components/task/TaskEditDialog.tsx:279`.
  - Audit claims quiet-hours notification settings in `FEATURE_AUDIT.md:249`, but settings UI only exposes enable/disable in `src/renderer/components/settings/SettingsPanel.tsx:271`.
- Impact: configured settings do not reliably change real behavior.

12. Keyboard shortcut help text is inconsistent with actual implementation.
- Evidence:
  - Help lists `Cmd+K` search and marks task shortcuts “coming soon” in `src/renderer/components/ui/KeyboardShortcutsHelp.tsx:14` and `src/renderer/components/ui/KeyboardShortcutsHelp.tsx:35`.
  - App shortcut handler implements `/` search only in `src/renderer/App.tsx:220`.
  - Task shortcuts are implemented in `src/renderer/components/task/TaskList.tsx:377` and `src/renderer/components/task/TaskList.tsx:413`.
- Impact: user-facing help is misleading.

13. “Project comments implemented” is documented, but no renderer consumer exists.
- Evidence:
  - Audit marks it implemented in `FEATURE_AUDIT.md:208`.
  - API/IPC exist in `src/preload/index.ts:66` and `src/main/ipc/handlers.ts:438`.
  - No renderer usage of `listByProject` found under `src/renderer`.
- Impact: described feature is not exposed in product UX.

14. MCP completion behavior diverges from app behavior.
- Evidence:
  - MCP completes/uncompletes directly via repository in `src/main/mcp/tools.ts:327` and `src/main/mcp/tools.ts:339`.
  - App completion logic includes karma/recurrence path in `src/main/ipc/handlers.ts:144`.
  - MCP `completedToday` counts all completed tasks (`taskRepo.list({ completed: true })`) in `src/main/mcp/tools.ts:455`.
- Impact: MCP operations and stats are inconsistent with the main app.

## Priority Order
1. Unify completion domain logic across normal actions, undo/redo, recurrence, and MCP.
2. Standardize karma date key generation and fix failing streak tests.
3. Make JSON import/export round-trip safe (full fidelity + topological parent resolution).
4. Fix board ordering and section behavior gaps.
5. Fix stale/misleading UX states (search refresh, sidebar active state, shortcut/help text, date picker/calendar selection).
6. Align settings and feature audit with actual runtime behavior.
