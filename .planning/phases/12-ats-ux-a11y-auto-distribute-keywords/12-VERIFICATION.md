# Phase 12 — ATS Workflow UX + A11y + Auto-Distribute — Verification

**Status:** Complete
**Closed:** 2026-04-11
**Phase context:** [12-CONTEXT.md](./12-CONTEXT.md)

## Test results

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | **PASS** |
| Unit + integration | `npx vitest run` | **PASS — 321 tests** (Phase 11 end: 290 → +31) |
| Production build | `npx vite build` | **PASS** |

## File inventory

### Created
- `convex/_ai/prompts/distribute.ts` — `buildKeywordDistributionPrompt` + context type
- `convex/_ai/__tests__/prompts/distribute.test.ts` — 8 specs
- `src/features/editor/lib/__tests__/keywordAnalysis.test.ts` — 23 specs
- `.planning/phases/12-ats-ux-a11y-auto-distribute-keywords/12-CONTEXT.md`
- `.planning/phases/12-ats-ux-a11y-auto-distribute-keywords/12-01-PLAN.md` + SUMMARY
- `.planning/phases/12-ats-ux-a11y-auto-distribute-keywords/12-02-PLAN.md` + SUMMARY
- `.planning/phases/12-ats-ux-a11y-auto-distribute-keywords/12-03-PLAN.md` + SUMMARY
- `.planning/phases/12-ats-ux-a11y-auto-distribute-keywords/12-04-PLAN.md`
- This file

### Modified
- `src/shared/ui/Button.tsx` — focus-visible ring, aria-busy, aria-disabled, sr-only spinner label
- `src/features/editor/lib/keywordAnalysis.ts` — `matchKeywordFuzzy` + stemmer + normalizer; `computeKeywordAnalysis` rewired
- `convex/_ai/schemas.ts` — `KeywordAssignmentSchema`, `KeywordDistributionSchema`, `KeywordDistributionParsed`
- `convex/ai.ts` — new `autoDistributeMissingKeywords` action (11 action exports total)
- `src/features/editor/components/ATSPanel.tsx` — new props + CTA + proposals preview panel
- `src/features/editor/components/index.ts` — export `DistributionProposal` type
- `src/pages/EditorPage.tsx` — `distributeAction` hook, 2 new state fields, 5 new handlers, wired ATSPanel
- `.planning/codebase/ARCHITECTURE.md` — added `distribute.ts` to the AI Layer section
- `.planning/ROADMAP.md` — Phase 11 marked complete, Phase 12 added

## API surface check

- `api.ai.*` action count: **10 → 11** (added `autoDistributeMissingKeywords`, no existing action signature changed)
- Frontend callers:
  - `DashboardPage.tsx` — untouched
  - `EditorPage.tsx` — only ADDED imports/state/handlers/props, no existing behavior removed
  - `CoverLetterPage.tsx` — untouched

## Critical fixes delivered

1. **Button atom a11y** — every CTA in the app now exposes focus-visible ring, `aria-busy`, `aria-disabled`, and a screen-reader label on the spinner. WCAG 2.4.7 / 4.1.2 / 1.1.1.

2. **Fuzzy keyword matching** — the false-negative class of bugs is closed: plurals (`designer` ↔ `designers`), accents (`développeur` ↔ `developpeur`), and simple FR/EN stems (`gestion` ↔ `gère`) are now recognized. Users will see dramatically fewer "missing" keywords that are actually already in the CV.

3. **Auto-distribute CTA** — a new "Répartir automatiquement ({N} mots-clés)" button on the ATS panel (visible when ≥ 2 missing keywords) sends the CV + missing keyword list + JD to the AI in a single call, returns per-keyword placements with rewritten bullets, and surfaces them in an ARIA-live proposal panel with individual + bulk Accept/Reject.

## Plans executed

| # | Plan | Summary | Δ tests |
|---|---|---|---|
| 01 | Button a11y | [12-01-SUMMARY](./12-01-SUMMARY.md) | 0 (atom-only) |
| 02 | Fuzzy keyword matcher | [12-02-SUMMARY](./12-02-SUMMARY.md) | +23 |
| 03 | `autoDistributeMissingKeywords` action | [12-03-SUMMARY](./12-03-SUMMARY.md) | +8 |
| 04 | UI integration | this file | 0 (integration tests deferred) |

**Total:** 290 → **321 tests** (+31).

## Deviations

1. **Plan 12-01 — `mono` default kept at `true`.** Planned to flip to `false` but audited 5/5 consumers rely on the current uppercase/mono styling. Flipping would be a silent visual regression across the app. Filed as follow-up for a dedicated styling phase.

2. **Plan 12-04 — no new unit tests for ATSPanel / EditorPage integration.** React integration testing was deferred per D-05. The TypeScript compiler + the existing 321 tests on pure helpers + the vite build constitute adequate safety for an integration patch that doesn't change any existing logic.

## Mystery button follow-up

The user reported seeing a yellow "APPLIQUER_5_REFORMULATIONS" CTA on the ATS tab
during their Phase 11 live test. Exhaustive greps on master find no such label or
component. Conclusion: stale HMR build or a branch not visible from this session.
Resolution hand-back: user can hard-refresh the dev server and confirm either (a)
the label matches `Optimiser pour cette offre` / now `Répartir automatiquement`
after rebuild, or (b) identify the component via React DevTools inspector and
report back — in which case a targeted follow-up issue can be filed.

## Follow-ups (deferred)

- **Levenshtein fuzzy matching** — for typos. Current stemmer-only approach is sufficient for the 90% case; revisit if fixtures reveal holes.
- **Button `mono` default flip** — needs a design-system migration across all 5 consumers.
- **E2E test of the auto-distribute flow** — Playwright coverage of the click → proposal → accept flow.
- **AI output quality review** — once the user tests the auto-distribute live, calibrate the prompt based on real results. The `reason` field in each assignment will guide prompt-tuning.

## Commit

(filled at commit time)
