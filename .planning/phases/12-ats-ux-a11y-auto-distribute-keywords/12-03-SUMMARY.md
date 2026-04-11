# Plan 12-03 — SUMMARY

**Status:** Complete
**Plan:** [12-03-PLAN.md](./12-03-PLAN.md)

## What shipped

New `autoDistributeMissingKeywords` Convex action — takes a CV + missing keyword
list + JD, returns per-keyword placement assignments with rewritten bullets,
in a single AI round-trip.

## Files created

- `convex/_ai/prompts/distribute.ts` — `buildKeywordDistributionPrompt` + `DistributeContext`, compact experience summary helper, full prompt with fragments
- `convex/_ai/__tests__/prompts/distribute.test.ts` — 8 specs (4 builder + 4 schema)

## Files modified

- `convex/_ai/schemas.ts` — added `KeywordAssignmentSchema`, `KeywordDistributionSchema`, `KeywordDistributionParsed` type
- `convex/ai.ts` — new import block + new action at the end

## Metrics

- Action exports: **10 → 11**
- Vitest tests: **313 → 321** (+8)
- ai.ts line count: 314 → 342 (+28 for new action)
- Zero changes to existing actions or callers

## Design highlights

- Single AI call distributes N keywords across M experiences with full context
- `expIndex: null` for keywords with no credible fit — the UI can surface these differently
- Schema accepts all optional fields except `keyword` + `expIndex` — permissive-by-design per Phase 11 D-03
- Reuses `FABRICATION_GUARD` + `ACTION_VERBS_FR` + `INTRO_PRESERVATION_FR` — no rule drift

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 313 | **321** (+8) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## API surface

All 3 callers (`DashboardPage`, `EditorPage`, `CoverLetterPage`) untouched. The new action is opt-in — consumers have to call `api.ai.autoDistributeMissingKeywords` explicitly.

## Commit

(filled at commit time)
