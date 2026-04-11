# Plan 11-04 — SUMMARY

**Status:** Complete
**Plan:** [11-04-PLAN.md](./11-04-PLAN.md)

## What shipped

Shared prompt fragments extracted into `convex/_ai/prompts/fragments.ts`. Plan 04
is the DRY-out step: `FABRICATION_GUARD` is now single-sourced, and the action
verb lists, KPI rules, intro preservation rules, and language instruction
helper are available to every future prompt builder.

## Files created

- `convex/_ai/prompts/fragments.ts` — exports 8 constants + 1 helper function:
  - `FABRICATION_GUARD`
  - `ACTION_VERBS_FR` / `ACTION_VERBS_EN`
  - `WEAK_VERBS_FR` / `WEAK_VERBS_EN`
  - `KPI_RULES_FR`
  - `INTRO_PRESERVATION_FR` / `INTRO_PRESERVATION_EN`
  - `LANGUAGE_OUTPUT_INSTRUCTION(isEn)`
- `convex/_ai/__tests__/prompts/fragments.test.ts` — 12 specs anchoring key strings

## File modified

- `convex/ai.ts`:
  - Added `import { FABRICATION_GUARD } from "./_ai/prompts/fragments"`
  - Removed the local `const FABRICATION_GUARD = …`
  - All `${FABRICATION_GUARD}` references in prompts continue to resolve via the import

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 237 | **249** (+12) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## Notes

- Only `FABRICATION_GUARD` is wired into `ai.ts` in this plan. The action verbs,
  KPI rules, and intro fragments get consumed by the new prompt builders in
  Plans 05-10 when each inline prompt is replaced.
- Plan uses the "anchor string" test approach: tests assert that each fragment
  contains specific expected substrings, so accidental edits break the build.

## Commit

(filled at commit time)
