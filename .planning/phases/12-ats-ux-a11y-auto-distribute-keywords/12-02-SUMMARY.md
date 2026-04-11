# Plan 12-02 — SUMMARY

**Status:** Complete
**Plan:** [12-02-PLAN.md](./12-02-PLAN.md)

## What shipped

Fuzzy keyword matcher in `keywordAnalysis.ts`. Plural, accents, and simple
FR/EN suffixes are now tolerated, eliminating the false-negative class of bugs
(users seeing "missing" keywords that are actually already in the CV).

## New exports

- `normalizeForMatch(s)` — lowercase + accent strip (NFD + combining mark removal) + whitespace collapse
- `stripSimpleSuffixes(word)` — hand-rolled stemmer for ~18 common FR/EN suffixes, with 3-char minimum root guard
- `matchKeywordFuzzy(keyword, text)` — 4-step ladder: exact → normalized exact → stemmed token-by-token AND match

## Rewired

- `computeKeywordAnalysis` now calls `matchKeywordFuzzy` instead of `matchKeyword` at the section lookup site

## Design notes

- **Zero new deps**. Hand-rolled stemmer beats pulling in `natural` / `franc` at this scale (max 40 keywords per JD).
- **Original `matchKeyword` kept** as a private helper — the fuzzy matcher uses it as the fast path and fallback, so exact matches still win.
- **3-char minimum root guard** on the stemmer prevents over-stripping (e.g., "les" stays "les", "iOS" stays "iOS").
- **Multi-word keyword AND semantics** — a 2-word keyword like "design system" requires both tokens to match in the stemmed text. Prevents forcing matches on partial overlap.
- **Locked tradeoff**: the matcher currently accepts `designer` → `designers` but rejects `java` → `JavaScript` because `java` stemmed is still `java` and matches via word boundary is false. The test file documents this.

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 290 | **313** (+23) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## Commit

(filled at commit time)
