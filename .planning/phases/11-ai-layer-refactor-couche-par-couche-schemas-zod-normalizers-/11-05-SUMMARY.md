# Plan 11-05 — SUMMARY

**Status:** Complete
**Plan:** [11-05-PLAN.md](./11-05-PLAN.md)

## What shipped

`extractCVDataFromPDF` is now a 5-line wrapper:
`auth → buildExtractPrompt → chatJSON → normalizeCVData → return`.
The ~140 lines of inline prompt string + 70 lines of ad-hoc post-processing are deleted.

## Files created

- `convex/_ai/prompts/extract.ts` — `buildExtractPrompt(ctx)` + `ExtractContext` type
- `convex/_ai/__tests__/prompts/extract.test.ts` — 5 specs

## File modified

- `convex/ai.ts` — `extractCVDataFromPDF` handler reduced to ~5 lines, 140+ lines of inline prompt and post-process deleted

## Metrics

- `convex/ai.ts` line count: **698 → 563** (-135 lines)
- Action exports preserved: **10**
- Normalizer wired into first CV-returning action ✓

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 249 | **254** (+5) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## API surface

`DashboardPage.tsx` untouched — `api.ai.extractCVDataFromPDF` signature and return shape stable.

## Commit

(filled at commit time)
