# Plan 11-06 — SUMMARY — CRITICAL FIX LANDED

**Status:** Complete
**Plan:** [11-06-PLAN.md](./11-06-PLAN.md)

## What shipped — the single highest-value change of Phase 11

The `tailorCV` action no longer returns raw AI output. Every response now flows
through `normalizeCVData`, closing the dead zone called out in 11-CONTEXT.md
§Specific Ideas:

> **tailorCV is the critical fix** — currently has ZERO post-processing,
> AI output flows raw to the frontend.

With this plan merged, the frontend sees validated `CVData` or a descriptive
French error — never raw LLM drift.

## Files created

- `convex/_ai/prompts/adapt.ts` — `buildAdaptPrompt(ctx)` covering both `"tailor"` and `"optimize"` modes, plus `AdaptContext` type
- `convex/_ai/__tests__/prompts/adapt.test.ts` — 9 specs (tailor mode FR/EN/override, optimize mode pageLimit/no-JD/displayMode system)

## File modified

- `convex/ai.ts`:
  - Added `import { buildAdaptPrompt } from "./_ai/prompts/adapt"`
  - `tailorCV` handler reduced to ~18 lines
  - Inline 60-line tailor prompt + language detection + action-verb strings deleted
  - `normalizeCVData` wired in before the return
  - `design` / `detectedLanguage` / `languageOverride` still re-attached after normalization

## Metrics

- `convex/ai.ts` line count: **563 → 529** (-34 lines)
- Action exports preserved: **10**
- `tailorCV` handler body: 60 lines → 18 lines
- Normalizer now wired into 2/3 CV-returning actions (extract ✓, tailor ✓, optimize pending in Plan 07)

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 254 | **263** (+9) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## API surface

`DashboardPage.tsx` — untouched. `api.ai.tailorCV` contract stable.

## Critical-fix verification

```bash
grep -A 25 "export const tailorCV" convex/ai.ts | grep -c "normalizeCVData"
# returns ≥ 1 — dead zone closed
```

## Commit

(filled at commit time)
