# Todoer Code Review

## Scope
Full top-down review of all code: main process, IPC handlers, repositories, services, renderer components, MCP server, shared utilities, tests, and documentation.

## Validation (Current Pass)
- `npm run -s typecheck` passed.
- `npm run -s lint` passed (`0` errors, `90` warnings).
- `npm run -s test:run` passed (`36` files, `661` tests).
- `npx playwright test tests/e2e/code-review-v8.spec.ts` passed (`7` tests).

## Findings Evaluation And Resolution

### Finding 1 (High): Comment delete fails with FK constraint when attachments exist
- **Evaluation:** True.
- **Test-first proof:** `tests/unit/repositories/commentRepository.test.ts` now verifies comment deletion succeeds and dependent `attachments` rows are removed under FK enforcement.
- **Fix:** `CommentRepository` now deletes dependent attachment rows before comment deletes in single and bulk delete flows.
- **Code:** `src/main/db/repositories/commentRepository.ts`

### Finding 2 (Medium): Unsafe private property access in MCP resources
- **Evaluation:** True.
- **Test-first proof:** `tests/unit/services/mcpResources.test.ts` reproduces stats read failure when a repo object does not expose an internal `db` field.
- **Fix:** `handleResourceRead` now takes explicit DB dependency; MCP server passes `db` directly.
- **Code:** `src/main/mcp/resources.ts`, `src/main/mcp/server.ts`

### Finding 3 (Medium): BrowserWindow.getFocusedWindow() null safety
- **Evaluation:** True.
- **Test-first proof:** `tests/unit/utils/dialogWindow.test.ts` defines and verifies focused-window fallback behavior and null handling when no windows exist.
- **Fix:** Added `resolveDialogWindow` and replaced all four import/export dialog entry points to use fallback and safe error return when no window is available.
- **Code:** `src/main/ipc/dialogWindow.ts`, `src/main/ipc/handlers.ts`

### Finding 4 (Low): console.error in renderer App.tsx
- **Evaluation:** True.
- **Test-first proof:** `tests/unit/appConsoleLogging.test.ts` fails if `App.tsx` uses `console.error` for task-move failure.
- **Fix:** Replaced console logging with toast-based UI error feedback.
- **Code:** `src/renderer/App.tsx`

### Finding 5 (Low): SQL string interpolation in seedInitialData
- **Evaluation:** True.
- **Test-first proof:** `tests/unit/seedQuerySafety.test.ts` checks for disallowed string interpolation pattern in inbox seed SQL.
- **Fix:** Replaced interpolated inbox check/insert with parameterized statements.
- **Code:** `src/main/db/index.ts`

### Finding 6 (Low): MCP priority not validated server-side
- **Evaluation:** True.
- **Test-first proof:** `tests/unit/services/mcpTools.test.ts` verifies out-of-range `todoer_create_task` priority is normalized to default `4`.
- **Fix:** Added `normalizePriority` and used it in MCP create/update task paths.
- **Code:** `src/main/mcp/tools.ts`

## Open Findings
- None.

## Guardrails Added
- Added repository-level empty-content rejection in task create/update paths (previous pass).
- Added Git pre-commit hook at `.githooks/pre-commit` to run lint before commits (previous pass).
- Added `setup:hooks` script in `package.json` and configured `core.hooksPath` to `.githooks` (previous pass).
- Added targeted e2e regression coverage for TaskAddInput inline-only submission rejection and multi-line paste parsing (previous pass).
- Added targeted regression tests for comment delete FK handling, MCP stats DB dependency, dialog-window fallback behavior, renderer console logging policy, seed SQL parameterization, and MCP priority normalization.
