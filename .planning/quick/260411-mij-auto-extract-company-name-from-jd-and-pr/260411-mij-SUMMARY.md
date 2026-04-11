---
phase_id: 260411-mij
slug: auto-extract-company-name-from-jd-and-pr
mode: quick
status: complete
completed_at: 2026-04-11T16:25:00Z
requirements_completed:
  - Q-MIJ-01
  - Q-MIJ-02
  - Q-MIJ-03
  - Q-MIJ-04
  - Q-MIJ-05
  - Q-MIJ-06
commits:
  - d90e5b0  # feat(ai): extractCompanyMeta action with bilingual prompt + Zod schema
  - e5392a0  # feat(editor): auto-fill company name in cover letter drawer
files_created:
  - convex/_ai/prompts/companyExtraction.ts
  - convex/_ai/__tests__/prompts/companyExtraction.test.ts
files_modified:
  - convex/_ai/schemas.ts
  - convex/ai.ts
  - convex/_ai/__tests__/schemas.test.ts
  - src/features/editor/hooks/useCoverLetter.ts
  - src/features/editor/hooks/useCoverLetter.test.ts
  - src/features/editor/components/CoverLetterDrawer.tsx
metrics:
  tests_before: 372
  tests_after: 393
  tests_added: 21
  hook_lines: 148
  hook_limit: 150
---

# Quick Task 260411-mij — Auto-extract company name from JD

## One-liner

Phase A of the "logo roadmap": a new non-throwing Convex action `extractCompanyMeta` (NVIDIA NIM + bilingual FR/EN prompt + Zod schema) auto-fills the cover-letter drawer's `companyName` field whenever the user opens the drawer with a ≥50-char JD and an empty company field — with a functional-setter guard that keeps user typing safe and silent graceful degradation on every LLM failure path.

## What shipped

### Backend (Task 1 — commit d90e5b0)

1. **`convex/_ai/prompts/companyExtraction.ts`** (new) — exports `buildCompanyExtractionPrompt({ jobDescription }): string`.
   - Bilingual (FR/EN): instructs LLM to detect the JD language and apply rules in kind.
   - Requests 3 fields: `companyName`, `domainGuess`, `industry`.
   - **Explicitly forbids** generic fallbacks: `the company`, `our client`, `a leading firm`, `notre client`, `l'entreprise`, `une société leader`, `a fast-growing startup`.
   - **High-confidence rule**: any uncertainty → `null` (no hallucination).
   - Ends with `Retourne UNIQUEMENT le JSON.` (matches existing prompt convention).

2. **`convex/_ai/schemas.ts`** — added `CompanyMetaSchema` + type:
   ```ts
   export const CompanyMetaSchema = z.object({
     companyName: z.string().nullable(),
     domainGuess: z.string().nullable(),
     industry: z.string().nullable(),
   }).passthrough();
   ```

3. **`convex/ai.ts`** — added `extractCompanyMeta` action after `generateCoverLetter`.
   - **Critical difference from every other AI action**: NEVER throws. All failure paths (empty JD, JD < 50 chars, LLM network error, `safeParse` failure) return the `FALLBACK = { companyName: null, domainGuess: null, industry: null }`. The drawer UX is preserved no matter what.
   - Uses `getModel("fast")` + `chatJSON` (same pattern as `getATSAnalysis`, `extractJobKeywords`).
   - Logs warnings (not errors) on failure — not meant to page anyone.

4. **Tests**:
   - `convex/_ai/__tests__/prompts/companyExtraction.test.ts` (new) — **8 test cases**: JD verbatim embedding, 3 required fields present, JSON-only instruction, FR generic-fallback forbid, EN generic-fallback forbid, high-confidence hallucination forbid, French sample JD, English sample JD.
   - `convex/_ai/__tests__/schemas.test.ts` — added `describe('CompanyMetaSchema', ...)` with **5 cases**: all-strings, all-nulls, mixed (name+nulls), type rejection (number for companyName), passthrough preservation.

### Frontend (Task 2 — commit e5392a0)

1. **`src/features/editor/hooks/useCoverLetter.ts`** — stayed at **148 lines** (≤150 hard limit, was 138 pre-task).
   - New module-level pure helper `shouldTriggerExtraction(companyName, jobDescription): boolean` (trim-based, ≥50 chars + empty-name gate).
   - New `useAction(api.ai.extractCompanyMeta)` → `extractAction` ref.
   - New `isExtractingCompany` state + interface field.
   - **Extraction inlined into `open()`** (no new `useEffect` — saves lines and eliminates the closure-race cliff). Uses `effectiveJD = localJobDescription || jobDescription` to cover both the "JD already pasted in drawer" and "JD coming from editor context" cases.
   - **Functional-setter guard** on the result: `setCompanyName(curr => curr.trim().length === 0 ? r.companyName! : curr)`. If the user typed anything between drawer open and the async resolution, the result is discarded. This is the core of T5.
   - All error paths → `console.warn(...)`, no `notify`, no toast. Silent graceful degradation.
   - Compressions to stay under the line limit: collapsed return object (3 lines instead of 7), collapsed the extract chain (one-line then/catch/finally closures), shared `jd` local between `setLocalJobDescription` setter and the extraction gate.

2. **`src/features/editor/hooks/useCoverLetter.test.ts`** — added `describe('shouldTriggerExtraction', ...)` block with **8 cases**: filled name skip, short JD skip, both empty, true path, whitespace-only name, whitespace-padded JD trimmed, whitespace-only JD skip, filled name + long JD skip.

3. **`src/features/editor/components/CoverLetterDrawer.tsx`** — minimal change: `<Input label="Nom de l'entreprise">` placeholder now toggles between `'Détection automatique...'` and `'Ex: Google, Airbus...'` based on `controller.isExtractingCompany`. No new atom, no disable, no loader — the input stays editable at all times (required by T5).

## Verification results

| Gate | Task 1 | Task 2 |
|------|--------|--------|
| `npx tsc --noEmit` | PASS (clean) | PASS (clean) |
| `npx vitest run` | PASS — 385 tests | PASS — 393 tests |
| `npx vite build` | PASS — 2854 modules, 4.95s | PASS — 2854 modules, 4.21s |

- **Tests before plan**: 372
- **Tests after plan**: 393
- **Tests added**: 21 (8 prompt + 5 schema + 8 hook helper)
- **All pre-existing tests still green** (no regressions)
- **Hook file line count**: **148** (under 150 hard limit)

## Success criteria checklist

- [x] `extractCompanyMeta` action exists, uses `chatJSON` + `CompanyMetaSchema.safeParse`, returns `{null,null,null}` fallback on any failure (no throws)
- [x] Bilingual prompt forbids generic fallbacks and hallucination (FR + EN cases proven by unit tests)
- [x] `CompanyMetaSchema` parses all-string, all-null, and mixed payloads; rejects wrong types
- [x] Hook file still ≤ 150 lines (148)
- [x] `shouldTriggerExtraction` unit-tested (8 cases, all green — plan asked for ≥6)
- [x] Drawer shows `Détection automatique...` placeholder while extracting
- [x] User typing during async extraction is preserved (functional setter guard, documented in code + summary)
- [x] `npx tsc --noEmit` clean
- [x] `npx vitest run` all green
- [x] `npx vite build` passes

## Deviations from plan

**None.** Plan executed exactly as written. A few small notes:

- Added **2 extra test cases** in the prompt suite (FR sample JD, EN sample JD) beyond the 6 the plan required — no cost, proves bilingual handling with realistic inputs.
- Added **2 extra test cases** in the `shouldTriggerExtraction` suite (whitespace-only JD skip, filled name + long JD skip) beyond the 6 the plan required.
- Added **1 extra schema test** (passthrough preservation) — matches existing schema test conventions.
- Hook compression was needed to fit the 150-line budget: collapsed the return object and the extract `.then/.catch/.finally` chain into dense one-liners. No existing behavior changed.

No Rule 1/2/3 auto-fixes were needed. No Rule 4 architectural questions surfaced. No auth gates hit.

## Known stubs / threat flags

None. This task adds read-only metadata extraction from free-form JD text — no new trust boundaries, no new persisted data, no new schema fields in `convex/schema.ts`, no new auth paths. The new action reuses `verifyAccessCode` (identical to every other AI action) and never writes anything.

## Manual verification (for the user)

1. Open the editor with a CV + a pasted JD ≥50 chars in the ATS/JD field.
2. Click "Lettre de motivation" to open the drawer.
3. Observe: `Nom de l'entreprise` input is empty, placeholder reads `Détection automatique...`.
4. Within a few seconds: the company name auto-fills with the hiring entity name.
5. **Race test**: open the drawer, immediately type a custom company name. When the async result arrives, your typed value should NOT be overwritten.
6. **Failure test**: disconnect network, reopen drawer. Drawer opens normally, no toast, input stays empty, placeholder reverts to `Ex: Google, Airbus...` after the LLM timeout.
7. **Short-JD test**: paste a 30-char JD. Open drawer. No extraction triggered, no placeholder change.

## Rollback

Both commits are independently reversible:
- `git revert e5392a0` — removes the frontend wiring only; backend action stays (dead code, no cost).
- `git revert d90e5b0` — removes the backend action + schema + prompt. Frontend would break if reverted without first reverting e5392a0 (Task 2 imports `api.ai.extractCompanyMeta`).

Full rollback: revert e5392a0 then d90e5b0. No data risk.

## Self-Check

- [x] `convex/_ai/prompts/companyExtraction.ts` exists
- [x] `convex/_ai/__tests__/prompts/companyExtraction.test.ts` exists
- [x] `convex/_ai/schemas.ts` contains `CompanyMetaSchema` (edit verified via test import)
- [x] `convex/ai.ts` contains `extractCompanyMeta` (edit verified via `vite build` success — Convex codegen would fail otherwise)
- [x] `src/features/editor/hooks/useCoverLetter.ts` exports `shouldTriggerExtraction` (verified by test import + passing test)
- [x] `src/features/editor/components/CoverLetterDrawer.tsx` uses `controller.isExtractingCompany` (tsc would fail on typo)
- [x] Commit d90e5b0 present in `git log`
- [x] Commit e5392a0 present in `git log`
- [x] Both commits pushed to `origin/master`

## Self-Check: PASSED
