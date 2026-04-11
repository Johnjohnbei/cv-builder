# Plan 12-01 — SUMMARY

**Status:** Complete
**Plan:** [12-01-PLAN.md](./12-01-PLAN.md)

## What shipped

A11y fixes on `src/shared/ui/Button.tsx`. Minimal, additive — zero API or visual break.

## Changes

- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[--google-blue]` to the base className — WCAG 2.4.7 focus visible.
- Added `aria-busy={loading ? true : undefined}` to expose loading state to assistive tech — WCAG 4.1.2.
- Added `aria-disabled={(disabled || loading) ? true : undefined}` — same criterion.
- Wrapped the `Spinner` in `<span className="sr-only">Chargement en cours</span>` — WCAG 1.1.1 (non-text content has alternative).
- Kept `mono = true` as default. Audited all 5 consumers (`CoverLetterPage` ×3, `ATSPanel` ×1, `NotFoundPage` ×1) — none pass `mono` explicitly, so flipping would be a silent visual regression across the app. Left the D-01 "flip default to false" deviation for a follow-up styling phase if the user asks.

## Decision deviation

Kept `mono = true` default (was: planned flip to false). Reason above.

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 290 | 290 (unchanged — no new tests needed for atom-only a11y fix) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## Consumers untouched

`grep -rn "<Button" src/` returns 5 hits, git diff on consumer files is empty.

## Commit

(filled at commit time)
