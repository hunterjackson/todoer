# Todoer Code Review

## Scope
Re-validation pass after the latest fixes, plus a fresh architecture-first full review (architecture -> data/integrity -> services -> renderer -> tests), focused on feature inconsistencies, described feature gaps, and incorrect implementations.

`../CLAUDE.md` was reviewed and is empty (`0` bytes).

## Validation
- `npm run -s typecheck` passed.
- `npm run -s test:run` passed (`27` files, `602` tests).

## Open Findings

None. All findings from this review have been resolved.

## Fixed Since Prior Review

Previously listed findings that now validate as fixed and were removed from the open list:
- Productivity local-date bucket handling (`karma` history/streak paths).
- `TaskAddInput` metadata handoff on submit.
- Attachment import size-limit bypass in `addWithMetadata`.
- Label hook cross-instance notification updates.
- Weekly goal and quiet-hours settings UI/IPC wiring.
- E2E placeholder assertion comments replaced.

### v6 Findings Resolved (This Pass)

1. **[High] Referential integrity** - Added FK constraints to DDL, application-level validation in task/project repositories (validateProjectExists, validateParentTaskExists), cycle detection via visited Set in getDescendantIds.
2. **[High] defaultProject stale** - QuickAddModal now verifies project exists before using stored default; task/project creation validates IDs.
3. **[High] Comment sanitization/XSS** - Extended sanitizeHtml to handle vbscript:, whitespace-prefixed URLs, SVG/style/math/base/meta tags; import path sanitizes comment HTML.
4. **[High] Recurrence completion** - Handlers and MCP tools now handle `recurrenceRule` without `dueDate` by using `Date.now()` as base date.
5. **[High] Attachment path traversal** - Added `sanitizeFilename()` utility; applied to attachment open and import paths.
6. **[Medium] Date/time settings** - Wired `formatDateByPreference` into TaskComments and MCP; ProductivityPanel uses locale-default weekday labels.
7. **[Medium] Due-date grouping timezone** - Fixed label parsing to use `new Date(y, m-1, d)` instead of `new Date(key)` for local date semantics.
8. **[Medium] Time support inconsistent** - Updated FEATURE_AUDIT.md to mark time support as partial (NLP only, no time picker/display UI).
9. **[Medium] Unit tests reimplementations** - Clarified comments explaining why helper SQL functions and repository-level tests are used (settings inline in handlers, IPC requires electron mock).
10. **[Low] Shared constants stale** - Removed dead code (SHORTCUTS, VIEW_MODES, DATE_PRESETS, IPC_CHANNELS), synced DEFAULT_SETTINGS with AppSettings interface.
