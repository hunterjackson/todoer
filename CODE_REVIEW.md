# Todoer Code Review

## Scope
Validation pass after the latest fixes, plus a fresh full top-down review (architecture -> data/integrity -> services -> renderer -> tests) focused on feature inconsistencies, described feature gaps, and incorrect implementations.

`../CLAUDE.md` was reviewed and is currently empty (`0` bytes).

## Validation
- `npm run -s typecheck` passed.
- `npm run -s test:run` passed (`25` files, `572` tests).

## Open Findings

_All findings resolved._

## Resolved Findings

1. **[High] `defaultProject` still becomes stale and can route tasks into non-existent projects.** — RESOLVED. `projects:delete` handler now resets `defaultProject` when deleting any ancestor in the project tree, and `TaskRepository.create` validates `projectId` existence.

2. **[High] Stored comment HTML is rendered without sanitization (XSS in renderer context).** — RESOLVED. Created `sanitizeHtml()` utility; `TaskComments` and `ProjectComments` now sanitize HTML before rendering via `dangerouslySetInnerHTML`. JSON import also sanitizes comment content.

3. **[Medium] Date/time settings are still only partially applied.** — RESOLVED. Created shared `formatDate.ts` utilities; all views (`TodayView`, `UpcomingView`, `BoardView`, `ProjectView`, `FilterView`, `SearchView`, `LabelView`, `InboxView`) and `groupTasks()` now use `settings.dateFormat`/`settings.timeFormat`.

4. **[Medium] Productivity date-bucket logic is still UTC-based.** — RESOLVED. Replaced `toISOString().split('T')[0]` with `getLocalDateKey()` in `karmaEngine.ts` and `ProductivityPanel.tsx`.

5. **[Medium] `TaskAddInput` drops selected metadata on the `onSubmit` path.** — RESOLVED. Changed `onSubmit` callback to accept full `TaskCreate` data including priority, labels, and project.

6. **[Medium] Attachment import bypasses attachment size constraints.** — RESOLVED. Added size validation (per-file and per-task totals) to `addWithMetadata()` in `attachmentRepository.ts`.

7. **[Medium] Label hook reactivity is still inconsistent across hook instances.** — RESOLVED. Added `notifyLabelsChanged()` calls to `createLabel`, `updateLabel`, and `deleteLabel` in `useLabels.ts`.

8. **[Medium] Described settings features are still incomplete.** — RESOLVED. Added weekly goal slider and quiet hours start/end configuration in `SettingsPanel`. Added `notifications:setQuietHours` IPC handler and preload bridge. Quiet hours loaded from settings at app startup.

9. **[Medium] E2E assertion quality remains weak across a large part of the suite.** — RESOLVED. All ~38 placeholder `"Reaching here without error is the assertion"` comments replaced with real `expect()` assertions across 6 E2E test files.

10. **[Medium] Multiple unit tests validate local reimplementations instead of production code paths.** — RESOLVED. Rewrote `notificationService.test.ts` to mock Electron and import real `NotificationService`. Rewrote `settings.test.ts` to use SQL helpers matching handler patterns and import `DEFAULT_SETTINGS` from shared constants.
