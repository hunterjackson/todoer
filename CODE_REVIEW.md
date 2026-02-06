# Todoer Code Review

## Scope
Fresh architecture-to-implementation pass focused on:
- feature inconsistencies
- documented feature gaps
- incorrect implementations

Areas reviewed: main process lifecycle, IPC handlers, repositories, services, MCP layer, renderer data-entry flows, and project docs (`README.md`, `FEATURE_AUDIT.md`, `BUGS.md`).

## Validation
- `npm run -s typecheck` passed.
- `npm run -s test:run` passed (`32` files, `651` tests).
- `npm run -s lint` passed with warnings only.
- All 14 E2E test files pass (4 parallel workers).

## Open Findings
- None.

## Status of Prior Findings

### 1) High: JSON import bypasses settings validation hardening — FIXED
Import now calls `validateSettingEntry()` on each settings entry, matching the `settings:set` IPC handler. Invalid keys/values are silently skipped.

### 2) High: Undo delete is not state-complete for reminders — FIXED
`tasks:delete` handler now snapshots reminders before deletion. Undo-delete restores the snapshotted reminders. `getDescendantIds` made public for handler access.

### 3) Medium: Imported notification settings are not applied to runtime service — FIXED
After importing settings, `notificationsEnabled` and quiet-hours values are applied to the in-memory `notificationService`.

### 4) Medium: "Add task" input advertises inline parsing but does not parse inline tokens — FIXED
`TaskAddInput` now uses `parseInlineTaskContent()`, `findProjectByName()`, and `findLabelByName()` on submit, matching `QuickAddModal` behavior.

### 5) Medium: MCP resources support project URIs but do not expose them in resource listing — FIXED
`registerResources()` now dynamically includes project-scoped resources (`todoer://project/<id>`) by accepting a `ProjectRepository`.

### 6) Low: Documentation drift on quick-add symbol mapping and MCP capability list — FIXED
BUGS.md corrected: `@` = label, `#` = project. README.md updated with all 10 MCP tools and additional filter syntax (`@label`, `search:text`).
