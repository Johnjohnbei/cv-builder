# Plan 11-01 — SUMMARY

**Status:** Complete
**Plan:** [11-01-PLAN.md](./11-01-PLAN.md)

## What shipped

Installed Zod 3.x and created `convex/_ai/schemas.ts` as the single source of truth
for AI output validation, plus 14 unit tests and 3 fixture files.

## Dependency

- `zod` ^3.25.76 (latest 3.x at install time; `^3.23.8` resolved forward)

## Files created

- `convex/_ai/schemas.ts` — 11 exported schemas + `CVDataParsed` type
- `convex/_ai/__tests__/schemas.test.ts` — 14 specs covering CVData, Experience, ATSAnalysis, and ancillary schemas
- `convex/_ai/__tests__/fixtures/cv-clean.json` — well-formed CV with kpi/showKpi/displayMode
- `convex/_ai/__tests__/fixtures/cv-dirty.json` — extra fields, string description, mixed skill items, LinkedIn EN proficiency
- `convex/_ai/__tests__/fixtures/cv-legacy-no-kpi.json` — pre-Phase-9 CV without kpi/showKpi/displayMode

## Schemas exported

`PersonalInfoSchema`, `ExperienceSchema`, `ExperienceDisplayModeSchema`,
`EducationSchema`, `SkillCategorySchema`, `SkillDisplayModeSchema`, `LanguageSchema`,
`CVDataSchema`, `ATSAnalysisSchema`, `KeywordListSchema`, `CoverLetterSchema`,
`BulletSuggestionsSchema`, `BulletRewriteSchema`.

## Design notes

- Every object schema ends with `.passthrough()` so AI-added fields survive
- Experience fields are mostly `.optional()` with lenient defaults (lenient-by-design per D-03)
- `description` is `z.any().default([])` so the schema accepts both array and string forms — the normalizer (Plan 02) handles coercion
- `current` is `z.any().optional()` to tolerate boolean, string, or missing values — normalizer coerces to strict boolean
- `category` in `SkillCategorySchema` is `z.any().optional()` to tolerate non-string fallbacks
- Vitest config updated to include `convex/**/*.test.ts` so backend tests run alongside frontend tests

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 193 | **207** (+14) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## API surface

`convex/ai.ts` untouched — no action signatures changed. Public API `api.ai.*` stable.

## Deviations

- Schema uses `description: z.any().default([])` (plan specified `z.array(z.any()).default([])`). Change made after dirty-fixture test exposed that the dirty case intentionally has `description` as a raw string — this is exactly what the D-03 lenient philosophy calls for, and the Plan 02 normalizer already handles the string→array coercion.
- `vite.config.ts` test include pattern extended from `src/**/*.test.ts` to `['src/**/*.test.ts', 'convex/**/*.test.ts']` so the new `convex/_ai/__tests__/` specs run in the existing vitest suite. No new test runner added.

## Commit

(filled at commit time)
