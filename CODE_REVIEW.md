# Todoer Code Review

## Scope
Re-validation after the latest "all fixes applied" update, plus a fresh architecture-first pass (architecture -> integrity -> services -> renderer -> tests), focused on feature inconsistencies, described feature gaps, and incorrect implementations.

`../CLAUDE.md` remains empty (`0` bytes).

## Validation
- `npm run -s typecheck` passed.
- `npm run -s test:run` passed (`27` files, `602` tests).
- `npm run -s lint` passed with warnings only (nits ignored per request).

## Open Findings

### 4) [High] `sanitizeHtml` still allows unquoted `javascript:`/`data:` URL payloads
- Evidence: dangerous protocol stripping only handles quoted attributes in `src/shared/utils/sanitizeHtml.ts:44` and `src/shared/utils/sanitizeHtml.ts:45`.
- Evidence: attribute allowlist then preserves unquoted `href` in `src/shared/utils/sanitizeHtml.ts:74`.
- Evidence: sanitized HTML is rendered via `dangerouslySetInnerHTML` in `src/renderer/components/task/TaskComments.tsx:144` and `src/renderer/components/project/ProjectComments.tsx:159`.
- Concrete example: `<a href=javascript:alert(1)>x</a>` survives current sanitizer.
- Impact: stored XSS risk remains on comment rendering.

### 5) [Medium] Recurring redo path regressed for tasks without a due date
- Evidence: forward completion correctly supports recurrence without `dueDate` using `completedAt` fallback in `src/main/ipc/handlers.ts:160`.
- Evidence: redo path still requires `taskBeforeComplete.dueDate` in `src/main/ipc/handlers.ts:1288`.
- Impact: undo/redo is behaviorally inconsistent; redo can fail to reschedule recurring tasks that were completed successfully in the forward path.

### 6) [Medium] Default project can be set to archived/hidden projects
- Evidence: settings default-project dropdown includes all projects in `src/renderer/components/settings/SettingsPanel.tsx:238`.
- Evidence: sidebar hides archived projects from main project tree in `src/renderer/components/sidebar/Sidebar.tsx:102`.
- Evidence: quick add only checks existence, not archived status, before using default project in `src/renderer/components/task/QuickAddModal.tsx:41`.
- Impact: new tasks can be created into archived projects and appear to "disappear" from normal active-project navigation.

### 7) [Medium] Attachment re-import silently drops records and overreports success
- Evidence: JSON import reuses original attachment IDs and increments success count unconditionally in `src/main/ipc/handlers.ts:1009`.
- Evidence: attachment insert uses `INSERT OR IGNORE` in `src/main/db/repositories/attachmentRepository.ts:109`.
- Impact: repeated imports can create new tasks but skip their attachments due ID collision while still reporting attachments as imported.

### 8) [Low] `FEATURE_AUDIT.md` is now inconsistent with current implementation
- Evidence: audit says quiet-hours UI is not implemented in `FEATURE_AUDIT.md:250`.
- Evidence: settings UI now includes quiet-hours controls in `src/renderer/components/settings/SettingsPanel.tsx:278`.
- Impact: feature-status documentation is stale and can mislead further review/planning.

## Status of Prior Findings
- No prior open findings remained in `CODE_REVIEW.md` at the start of this pass.
- Previously listed resolved items stayed resolved, but the issues above are still open based on current code.
