# Plan 11-08 — SUMMARY

**Status:** Complete
**Plan:** [11-08-PLAN.md](./11-08-PLAN.md)

## What shipped

Both bullet-rewriting actions (`improveBulletPoint` and `rewriteBulletsForJob`)
now use shared prompt builders and enforce `BulletSuggestionsSchema` /
`BulletRewriteSchema` validation. The ad-hoc array check in
`rewriteBulletsForJob` is replaced by typed schema validation.

## Files created

- `convex/_ai/prompts/rewrite.ts` — `buildBulletSuggestionsPrompt`, `buildBulletRewritePrompt` + context types
- `convex/_ai/__tests__/prompts/rewrite.test.ts` — 10 specs (5 per builder)

## File modified

- `convex/ai.ts`:
  - Added imports for the two builders + schemas
  - `improveBulletPoint` handler reduced to ~18 lines, schema-validated
  - `rewriteBulletsForJob` handler reduced to ~22 lines, schema-validated
  - Inline ~85 lines of prompt text deleted (two prompts)
  - `FABRICATION_GUARD` import removed from `ai.ts` — no longer referenced there (lives in adapt.ts and rewrite.ts via fragments)

## Metrics

- `convex/ai.ts` line count: **413 → 366** (-47 lines)
- Action exports preserved: **10**
- Schema-validated actions: 4/10 (tailor, optimize, improve, rewrite) — extract already uses normalizeCVData

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 263 | **273** (+10) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## API surface

`EditorPage.tsx` — untouched. `api.ai.improveBulletPoint` / `api.ai.rewriteBulletsForJob` contracts stable.

## Commit

(filled at commit time)
