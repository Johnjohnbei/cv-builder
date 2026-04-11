# Plan 11-02 — SUMMARY

**Status:** Complete
**Plan:** [11-02-PLAN.md](./11-02-PLAN.md)

## What shipped

`convex/_ai/normalizers.ts` — single function that turns raw AI output into
canonical `CVData`. This is the helper that later plans (05, 06, 07) wire into
every CV-returning action.

## Files created

- `convex/_ai/normalizers.ts` — 6 exports: `normalizeCVData`, `normalizeExperience`, `normalizeSkills`, `normalizeProficiency`, `normalizeTitle`, `PROFICIENCY_MAP`
- `convex/_ai/__tests__/normalizers.test.ts` — 30 specs covering every rule
- `convex/_ai/__tests__/fixtures/cv-malformed.json` — non-object input used for the throw-case test

## Rules implemented (D-05)

1. `CVDataSchema.safeParse` runs first; unrecoverable failure → log raw (first 500 chars) + throw French error
2. `current` ↔ `end_date` coherence: empty or "présent"/"present" → `current=true`, `end_date=""`
3. Description: split long bullets (>200 chars) on `[•·–—]` separators or `.␣` before capital; filter <10 chars; trim; cap at 5; non-string entries coerced via `String()`
4. Description string fallback: if AI returned a plain string, wrap-and-split instead of empty array
5. Skills items: object → `name` / `skill` / `title` / `String(x)`; dedupe case-insensitive; cap 8 items; cap 5 categories; default category name `Compétences`
6. Title: `> 50` chars → split on `[|,]`, take first part trimmed
7. Languages: `proficiency` mapped via `PROFICIENCY_MAP` (LinkedIn EN → FR canonical)
8. `displayMode`: default `"normal"` when missing or not in `['hidden','compact','normal','extended']`
9. `kpi`: trim if string, `""` otherwise
10. `showKpi`: pass through as `boolean` or `undefined`
11. Education: coerced field-by-field with `typeof` guards to avoid prototype pollution

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 207 | **237** (+30) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## API surface

`convex/ai.ts` untouched — still no edits to the monolith. Purely additive layer.

## Notes

- Types imported from `../../src/shared/types` — relative path works under the root tsconfig without any additional config
- `normalizeDescription` handles two input shapes (array + string) by recursing on `[raw]` — keeps downstream logic simple
- Dedupe preserves first occurrence to respect user-intent ordering

## Commit

(filled at commit time)
