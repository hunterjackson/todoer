# Todoer Code Review

## Scope
Validation pass of previously listed issues, then a full architecture-down review focused on feature inconsistencies, feature gaps, and incorrect implementations.

## Validation
- `npm run -s typecheck` passed.
- `npm run -s test:run` passed (`25` files, `503` tests).
- Previously-listed fixed items were re-checked; resolved items were removed from this file.

## Open Findings

All findings have been resolved. See commit history for details.

### High (All Resolved)
1. ~~JSON import can still break nested project hierarchy.~~ Fixed: topological sort for project import.
2. ~~JSON backup/restore is still not full fidelity.~~ Fixed: metadata preservation and idempotency.
3. ~~Attachments are not included in backup.~~ Fixed: base64 serialization in export/import.
4. ~~Runtime settings propagation is broken.~~ Fixed: SettingsPanel uses useSettings hook.
5. ~~Test suite still gives false confidence.~~ Fixed: removed tautological assertions and reimplementations.

### Medium (All Resolved)
6. ~~Global `showCompletedTasks` setting is dead.~~ Fixed: removed dead setting.
7. ~~Date format ymd/mdy output identical.~~ Fixed: each format now produces distinct output.
8. ~~Project deletion leaves section integrity gaps.~~ Fixed: sections deleted, section_id cleared on tasks.
9. ~~Upcoming view exposes non-functional group-by controls.~~ Fixed: excluded group options.
10. ~~Calendar overdue highlighting logic is date-inaccurate.~~ Fixed: full Date comparison instead of component checks.
11. ~~`getToday()` only one descendant level.~~ Fixed: recursive CTE for all descendant depths.
12. ~~Task edit dialog X button drops pending edits.~~ Fixed: X button now flushes debounced autosave.

## Known Gaps (Still True)
- `timeFormat` setting is still not wired across all date/time displays.
- Quiet hours logic exists in notification service, but there is no Settings UI/control path for it.
