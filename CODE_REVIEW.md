# Todoer Code Review

## Scope
Full top-down architecture review after resolving all prior findings (v1-v7). Covers database layer, services, IPC handlers, MCP server, renderer components, shared utilities, and tests.

## Validation
- `npm run -s typecheck` passed.
- `npm run -s test:run` passed (`30` files, `630` tests).
- `npm run -s lint` passed with warnings only.
- All 13 E2E test files pass (213 tests, 4 parallel workers).

## Open Findings

### Finding 3 — Medium: Karma division by zero when goals are set to 0
**File**: `src/main/services/karmaEngine.ts:171,198`
**Impact**: If a user sets `dailyGoal` or `weeklyGoal` to 0 (via settings), `getTodayStats()` and `getWeekStats()` compute `tasksCompleted / 0`, producing `Infinity` for the progress percentage. `Math.min(100, Infinity)` returns 100, so the UI would show 100% progress with 0 tasks completed.
**Detail**: Line 171: `Math.round((tasksCompleted / stats.dailyGoal) * 100)`. Line 198: `Math.round((tasksCompleted / stats.weeklyGoal) * 100)`. The `updateGoals()` method at line 45 accepts any number without validation.
**Fix**: Guard the division: `stats.dailyGoal > 0 ? Math.round((tasksCompleted / stats.dailyGoal) * 100) : 0`. Also consider validating in `updateGoals()` that goals are ≥ 1.

### Finding 4 — Medium: Settings `set` handler does not validate keys or values
**File**: `src/main/ipc/handlers.ts:613-626`
**Impact**: Any arbitrary key/value can be written to the settings table from the renderer. While this is a local-only app (no remote attack surface), it means a bug in the renderer could corrupt settings by writing invalid keys or malformed values.
**Detail**: The handler accepts any `(key: string, value: string)` pair and upserts it directly into the settings table without checking against known setting keys or validating value formats (e.g., `timeFormat` should only be `'12h'` or `'24h'`).
**Fix**: Add a whitelist of valid setting keys and basic value validation. Low urgency since this is a local Electron app.

## Status of Prior Findings
- All v1-v7 findings (sessions 1-7) have been resolved and verified.
- Prior findings are no longer listed individually — see `MEMORY.md` for historical record.
