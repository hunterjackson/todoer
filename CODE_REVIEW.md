# Todoer Code Review

## Scope
Architecture-down pass validating prior findings and re-reviewing the full codebase for feature inconsistencies, described feature gaps, and incorrect implementations.

## Validation
- `npm run -s typecheck` passed.
- `npm run -s test:run` passed (`25` files, `487` tests).
- All 11 findings verified and fixed.

## Findings (All Resolved)

### High
1. **[FIXED]** Hierarchy integrity breaks for nested data on delete/restore paths.
   - Fix: Added recursive `getDescendantIds()` for tasks and `getDescendantProjectIds()` for projects. Delete/restore now handles arbitrary nesting depth.

2. **[FIXED]** Undo for recurring completion can subtract the wrong karma amount.
   - Fix: Reordered undo handler to restore the original due date *before* reading the task for karma calculation.

3. **[FIXED]** Project duplication is still lossy.
   - Fix: Duplication now includes all tasks (not just incomplete), copies label relationships, uses level-by-level processing for deep nesting, and preserves completed state.

4. **[FIXED]** JSON "Export All Data" / backup-restore is still not full-fidelity.
   - Fix: Export/import now includes comments, reminders, settings, karma stats/history. Fallback IDs use null instead of stale references. Menu label changed to "Backup Data (JSON)...".

### Medium
5. **[FIXED]** Task reorder math can still produce duplicate `sort_order` values.
   - Fix: Replaced fixed ±0.5 offsets with midpoint calculations between neighbors. Indent uses max(children)+1.

6. **[FIXED]** Settings remain partially disconnected from runtime behavior.
   - Fix: CalendarView reads `weekStart` setting. TaskItem reads `dateFormat` setting. ProjectDialog, LabelDialog, FilterDialog now use `useConfirmDelete` hook.
   - Remaining: `timeFormat` not wired to all displays. Quiet hours has no Settings UI controls.

7. **[FIXED]** Project view exposes an "Edit project" action that is a no-op.
   - Fix: "Edit project" now opens ProjectDialog in edit mode with the current project data.

8. **[FIXED]** Due-date semantics are inconsistent and can mark same-day tasks overdue.
   - Fix: DatePicker quick options use midnight timestamps. TaskItem overdue check compares against start of today. TodayView task creation uses midnight.

9. **[FIXED]** Sidebar active-state is still wrong for archived projects.
   - Fix: Archived project rows now check both view type AND project ID, matching the pattern used elsewhere.

10. **[FIXED]** Keyboard shortcuts help is still partially inaccurate.
    - Fix: Updated Tab/Shift+Tab description from "Move focus down / up" to "Indent / outdent task".

11. **[FIXED]** `FEATURE_AUDIT.md` still overstates implementation status.
    - Fix: Updated to accurately reflect quiet hours (not implemented), time format (partial), and remaining medium-priority items.

## Remaining Known Gaps
- `timeFormat` setting exists but is not wired to all date display code
- Quiet hours: NotificationService supports it but no Settings UI controls exist
- `showCompletedTasks` global setting vs per-view `showCompleted` are separate by design (per-view is better UX)
