---
phase_id: 260411-mij
slug: auto-extract-company-name-from-jd-and-pr
description: Auto-extract company name from JD and pre-fill cover letter drawer (Phase A of the "logo roadmap")
plan_count: 2
mode: quick
type: execute
requirements:
  - Q-MIJ-01  # Convex action extractCompanyMeta returns { companyName, domainGuess, industry } (nullable)
  - Q-MIJ-02  # Zod schema CompanyMetaSchema validates LLM output with graceful null fallback
  - Q-MIJ-03  # Bilingual prompt (FR/EN) extracts hiring-company name without hallucinating on generic text
  - Q-MIJ-04  # useCoverLetter triggers extraction on open() when JD ≥ 50 chars and companyName empty
  - Q-MIJ-05  # Drawer shows tiny "Détection automatique..." placeholder while extracting; user input never overwritten
  - Q-MIJ-06  # Graceful degradation: LLM failure leaves companyName empty, drawer still functional
files_modified:
  - convex/_ai/prompts/companyExtraction.ts           # NEW
  - convex/_ai/schemas.ts                              # ADD CompanyMetaSchema
  - convex/ai.ts                                       # ADD extractCompanyMeta action
  - convex/_ai/__tests__/prompts/companyExtraction.test.ts  # NEW
  - convex/_ai/__tests__/schemas.test.ts               # ADD CompanyMetaSchema cases
  - src/features/editor/hooks/useCoverLetter.ts        # add extraction wiring + shouldTriggerExtraction helper
  - src/features/editor/hooks/useCoverLetter.test.ts   # ADD shouldTriggerExtraction tests
  - src/features/editor/components/CoverLetterDrawer.tsx  # optional loader placeholder
autonomous: true
---

# Plan — Auto-extract company name from JD (Phase A logo roadmap)

## Pre-flight Findings

**Existing patterns confirmed (no guesswork):**

1. **Convex action shape** — All AI actions in `convex/ai.ts` follow the exact same pattern:
   ```
   verifyAccessCode → buildXPrompt → chatJSON(prompt, getModel("fast")) → XSchema.safeParse → return parsed.data
   ```
   See `getATSAnalysis` (lines 74–94), `extractJobKeywords` (176–192), `generateCoverLetter` (223–252). The new action will follow the same shape **but with graceful null fallback** instead of throwing (per task boundary).

2. **Prompt builder style** — `convex/_ai/prompts/coverLetter.ts` exports a single `buildCoverLetterPrompt(ctx: CoverLetterContext): string` with an interface above it. `jobDescription.ts` in the same dir already mentions the LLM extracting "Entreprise" as free text — we're formalizing this into a structured JSON action.

3. **Zod schema style** — `convex/_ai/schemas.ts` uses `.passthrough()` on all object schemas. `CoverLetterSchema` (lines 83–88) is the closest shape match. Nullable fields need `.nullable()` (zod pattern).

4. **Prompt test style** — `convex/_ai/__tests__/prompts/coverLetter.test.ts` imports from `../../prompts/coverLetter`, asserts on substrings/phrases. Schema tests in `convex/_ai/__tests__/schemas.test.ts` parse valid fixtures and use `expect(...).toThrow()` on invalid.

5. **Hook architecture** — `useCoverLetter.ts` (139 lines, 11 lines of headroom before the 150 limit) already exports pure helpers `buildCoverLetterText`, `buildFilename`, `canSave` that are unit-tested in `useCoverLetter.test.ts`. We add a new pure helper `shouldTriggerExtraction(companyName, jobDescription)` following the exact same pattern — tests don't need Convex providers.

6. **Drawer test-free pattern** — `CoverLetterDrawer.tsx` has no tests (component requires motion/Convex context). Adding a `isExtractingCompany` placeholder on the existing `<Input>` atom is minimal and follows the props path already flowing through the controller.

7. **Line budget for hook** — Current: 139 lines. Adding `useAction` + effect + helper (~20 lines net, with dense formatting like the existing file) will land around ~155–160. **Must extract to stay ≤150.** Strategy: inline the "trigger on open" logic inside the existing `open()` callback (no `useEffect` needed → saves ~8 lines), and keep the pure helper `shouldTriggerExtraction` exported at module level (doesn't count against hook body).

8. **Generated API** — `convex/_generated/api.d.ts` regenerates automatically via `convex dev` / `npm run build`. **Plan never edits it.** tsc may lag until regen; we verify via `npm run lint` after `convex codegen` (implicit in build).

**Risk surface:**
- LLM may return generic strings like "the company" or "our client" → prompt must forbid this explicitly and use `null` as the safe default.
- LLM may return non-JSON → `safeParse` fallback to all-nulls (no throw). This is the critical diff from other actions.
- User typing during async extraction → the extraction callback must check `companyName === ''` **at resolution time** (via functional setter), not at call time.

## Must-Haves

**Truths (observable after plan completion):**
- T1: Opening the cover letter drawer with a non-empty JD (≥50 chars) and empty `companyName` triggers a background AI call to `extractCompanyMeta`.
- T2: When extraction succeeds, the `Nom de l'entreprise` input auto-fills with the detected name — **only if the user hasn't typed anything in between**.
- T3: When extraction fails (LLM error, schema mismatch, garbage JSON), the input stays empty and no error toast appears — drawer remains fully functional.
- T4: While extraction is running, the input shows a subtle `Détection automatique...` placeholder (not a blocking loader).
- T5: User-typed value is **never** overwritten by a late-arriving extraction result.
- T6: Prompt builder unit tests prove: FR JD → company extracted; EN JD → company extracted; generic "we are looking for a developer" → `null` for companyName.
- T7: Schema unit tests prove: valid payload with all 3 strings; valid payload with all 3 nulls; invalid (wrong types) → throws.

**Artifacts (concrete files):**
- `convex/_ai/prompts/companyExtraction.ts` — exports `buildCompanyExtractionPrompt({ jobDescription }): string` and `CompanyExtractionContext` interface
- `convex/_ai/schemas.ts` — adds `CompanyMetaSchema` export with `{ companyName, domainGuess, industry }` all nullable
- `convex/ai.ts` — adds `extractCompanyMeta` action using `chatJSON` + `safeParse` with null-fallback (no throw)
- `convex/_ai/__tests__/prompts/companyExtraction.test.ts` — ≥6 test cases (FR/EN/generic × presence assertions)
- `convex/_ai/__tests__/schemas.test.ts` — adds `CompanyMetaSchema` describe block (≥3 cases)
- `src/features/editor/hooks/useCoverLetter.ts` — adds `useAction(api.ai.extractCompanyMeta)`, `isExtractingCompany` state, extraction trigger in `open()`, exports new pure helper `shouldTriggerExtraction`
- `src/features/editor/hooks/useCoverLetter.test.ts` — adds `describe('shouldTriggerExtraction', ...)` block
- `src/features/editor/components/CoverLetterDrawer.tsx` — uses `controller.isExtractingCompany` to swap the `placeholder` on the companyName `<Input>`

**Key links (critical connections):**
- Drawer `open()` → hook `open()` → (conditional) `extractAction({ jobDescription, accessCode })` → Convex `ai.extractCompanyMeta` → `chatJSON` → `CompanyMetaSchema.safeParse` → functional setter guarded by empty-check → UI update
- Break point: if the functional setter check is wrong, user typing gets clobbered → test case T5 catches this

## Tasks

### Task 1 — Backend: action + prompt + schema + tests

**Files:**
- `convex/_ai/prompts/companyExtraction.ts` (new)
- `convex/_ai/schemas.ts` (edit: add `CompanyMetaSchema`)
- `convex/ai.ts` (edit: add `extractCompanyMeta` action + import)
- `convex/_ai/__tests__/prompts/companyExtraction.test.ts` (new)
- `convex/_ai/__tests__/schemas.test.ts` (edit: add schema block)

**Action:**

1. **Create `convex/_ai/prompts/companyExtraction.ts`** exporting:
   ```ts
   export interface CompanyExtractionContext { jobDescription: string }
   export function buildCompanyExtractionPrompt(ctx: CompanyExtractionContext): string
   ```
   The prompt MUST:
   - Be bilingual: instruct the LLM to detect FR/EN from JD content and respond with the appropriate language context (though the output JSON keys stay English).
   - Ask for 3 fields: `companyName` (the hiring entity — e.g. "Google", "Airbus", "Société Générale"), `domainGuess` (best guess official domain like `"google.com"`, `null` if unsure), `industry` (short category like `"Tech"`, `"Banking"`, `"Retail"`).
   - **Explicitly forbid** generic fallbacks: "the company", "our client", "a leading firm", "notre client", "l'entreprise", "une société leader" → return `null`.
   - **Explicitly forbid hallucination**: if not clearly stated, return `null` for that field (rule: "high confidence only").
   - Return strictly `{ "companyName": string|null, "domainGuess": string|null, "industry": string|null }`, no prose, end with `Retourne UNIQUEMENT le JSON.` (matches other prompts).
   - Keep prompt under ~800 chars of instructions + the JD content (JD is appended verbatim, no truncation at this layer — callers handle size).

2. **Extend `convex/_ai/schemas.ts`** after `CoverLetterSchema`:
   ```ts
   export const CompanyMetaSchema = z.object({
     companyName: z.string().nullable(),
     domainGuess: z.string().nullable(),
     industry: z.string().nullable(),
   }).passthrough();
   export type CompanyMetaParsed = z.infer<typeof CompanyMetaSchema>;
   ```

3. **Extend `convex/ai.ts`**:
   - Add imports: `buildCompanyExtractionPrompt` from `./_ai/prompts/companyExtraction`, `CompanyMetaSchema` added to the existing schemas import block.
   - Add action `extractCompanyMeta` after `generateCoverLetter`:
     ```ts
     export const extractCompanyMeta = action({
       args: { jobDescription: v.string(), accessCode: v.optional(v.string()) },
       handler: async (ctx, args) => {
         await verifyAccessCode(ctx, args.accessCode);
         const FALLBACK = { companyName: null, domainGuess: null, industry: null };
         if (!args.jobDescription || args.jobDescription.trim().length < 50) return FALLBACK;
         try {
           const prompt = buildCompanyExtractionPrompt({ jobDescription: args.jobDescription });
           const raw = await chatJSON(prompt, getModel("fast"));
           const parsed = CompanyMetaSchema.safeParse(raw);
           if (!parsed.success) {
             console.warn("[extractCompanyMeta] schema parse failed:", parsed.error.message);
             return FALLBACK;
           }
           return parsed.data;
         } catch (e) {
           console.warn("[extractCompanyMeta] LLM call failed:", e);
           return FALLBACK;
         }
       },
     });
     ```
   - **CRITICAL DIFFERENCE** from other actions: never throws. Swallows errors into `FALLBACK` to preserve drawer UX.

4. **Create `convex/_ai/__tests__/prompts/companyExtraction.test.ts`** with ≥6 cases:
   - `it('embeds the job description verbatim')` — prompt contains JD string
   - `it('requests the three output fields')` — asserts `companyName`, `domainGuess`, `industry` appear in prompt
   - `it('instructs JSON-only output')` — asserts `Retourne UNIQUEMENT le JSON`
   - `it('forbids generic fallbacks in FR')` — asserts prompt mentions `null` + forbids `l'entreprise` / `notre client`
   - `it('forbids generic fallbacks in EN')` — asserts prompt mentions / forbids `the company` / `our client`
   - `it('forbids hallucination')` — asserts prompt contains a phrase enforcing high-confidence / null-on-doubt (e.g. `null` + `certain` or similar keyword the implementer chooses, then asserts that literal)

5. **Extend `convex/_ai/__tests__/schemas.test.ts`** — add after the "Ancillary schemas" describe block:
   ```ts
   describe('CompanyMetaSchema', () => {
     it('parses valid payload with all fields as strings', ...);
     it('parses valid payload with all fields as null', ...);
     it('parses mixed payload (name string, others null)', ...);
     it('rejects when companyName is a number', ...);
   });
   ```
   Import `CompanyMetaSchema` from `../schemas`.

**Verify:**
```bash
npx vitest run convex/_ai/__tests__/prompts/companyExtraction.test.ts convex/_ai/__tests__/schemas.test.ts
npx tsc --noEmit
```

**Done:**
- New prompt builder file exists and exports `buildCompanyExtractionPrompt`
- `CompanyMetaSchema` exported from `convex/_ai/schemas.ts`
- `extractCompanyMeta` action present in `convex/ai.ts`, imports clean, no `throw` on LLM failure paths
- All new tests green; existing tests still green
- `npx tsc --noEmit` passes (Convex codegen regenerates `api.d.ts` on next `convex dev` / build; if tsc fails purely due to stale `api.d.ts`, run `npx convex codegen` once, do **not** hand-edit `api.d.ts`)

---

### Task 2 — Frontend: hook wiring + pure helper + drawer placeholder

**Files:**
- `src/features/editor/hooks/useCoverLetter.ts` (edit)
- `src/features/editor/hooks/useCoverLetter.test.ts` (edit: add `shouldTriggerExtraction` tests)
- `src/features/editor/components/CoverLetterDrawer.tsx` (edit: dynamic placeholder)

**Action:**

1. **Add pure helper to `useCoverLetter.ts`** (module-level, doesn't count against the hook body line budget):
   ```ts
   /** True when we should kick off auto-extraction of the company name on drawer open. */
   export function shouldTriggerExtraction(companyName: string, jobDescription: string): boolean {
     return companyName.trim().length === 0 && jobDescription.trim().length >= 50;
   }
   ```

2. **Extend the `UseCoverLetterResult` interface** to add:
   ```ts
   isExtractingCompany: boolean;
   ```

3. **Modify `useCoverLetter` hook body** — keep total file ≤ 150 lines:
   - Add `const extractAction = useAction(api.ai.extractCompanyMeta);` near the existing `useAction` call.
   - Add `const [isExtractingCompany, setIsExtractingCompany] = useState(false);`
   - **Inline extraction into `open()`** (no separate useEffect — saves lines and eliminates race conditions with closure state). Use the current JD string (prefer `localJobDescription || jobDescription`) and the current `companyName` to gate. Implementation sketch:
     ```ts
     const open = useCallback(() => {
       setLocalJobDescription(prev => (prev.length > 0 ? prev : jobDescription));
       setIsOpen(true);
       const effectiveJD = localJobDescription || jobDescription;
       if (shouldTriggerExtraction(companyName, effectiveJD)) {
         setIsExtractingCompany(true);
         extractAction({ jobDescription: effectiveJD, accessCode })
           .then(result => {
             if (result?.companyName) {
               // functional setter: only apply if user hasn't typed during the async call
               setCompanyName(curr => (curr.trim().length === 0 ? result.companyName! : curr));
             }
           })
           .catch(e => { console.warn('[useCoverLetter] extract failed:', e); })
           .finally(() => setIsExtractingCompany(false));
       }
     }, [jobDescription, localJobDescription, companyName, accessCode, extractAction]);
     ```
   - Return `isExtractingCompany` in the result object.
   - **Line budget enforcement**: if adding this pushes the file > 150 lines, compress by: (a) collapsing the multi-line return block, (b) dropping the now-redundant inline comments on existing code, (c) inlining the `FALLBACK`-style const. The helper signature + tests must remain.

4. **Extend `useCoverLetter.test.ts`** — add after existing blocks:
   ```ts
   import { ..., shouldTriggerExtraction } from './useCoverLetter';

   describe('shouldTriggerExtraction', () => {
     it('returns false when companyName already filled', () => {
       expect(shouldTriggerExtraction('Google', 'A'.repeat(100))).toBe(false);
     });
     it('returns false when JD shorter than 50 chars', () => {
       expect(shouldTriggerExtraction('', 'short JD')).toBe(false);
     });
     it('returns false when both empty', () => {
       expect(shouldTriggerExtraction('', '')).toBe(false);
     });
     it('returns true when companyName empty and JD >= 50 chars', () => {
       expect(shouldTriggerExtraction('', 'A'.repeat(50))).toBe(true);
     });
     it('treats whitespace-only companyName as empty', () => {
       expect(shouldTriggerExtraction('   ', 'A'.repeat(100))).toBe(true);
     });
     it('treats whitespace-only JD as empty', () => {
       expect(shouldTriggerExtraction('', '   ' + 'A'.repeat(60) + '   ')).toBe(true); // post-trim ≥ 50
     });
   });
   ```

5. **Update `CoverLetterDrawer.tsx`** — minimal change. On the existing `<Input label="Nom de l'entreprise" ...>` (around line 80), switch the placeholder to use the controller state:
   ```tsx
   placeholder={controller.isExtractingCompany ? 'Détection automatique...' : 'Ex: Google, Airbus...'}
   ```
   No other drawer changes. Do **not** add any new atom or disable the input — user must remain free to type at any moment (this is what protects T5).

**Verify:**
```bash
npx vitest run src/features/editor/hooks/useCoverLetter.test.ts
npx tsc --noEmit
npx vite build
```
Also: manual sanity — open drawer with a pasted JD, watch the placeholder flip to "Détection automatique..." then the input fill. Confirm typing during the async call is never clobbered.

**Done:**
- `shouldTriggerExtraction` exported and tested (≥6 cases, all green)
- Hook file still ≤ 150 lines (`wc -l src/features/editor/hooks/useCoverLetter.ts` ≤ 150)
- `isExtractingCompany` flows from hook → drawer → Input placeholder
- `npx tsc --noEmit` clean, `npx vitest run` all green, `npx vite build` passes
- Manual: drawer open with JD auto-fills companyName; user typing mid-extraction is preserved

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hook file exceeds 150-line limit | Medium | Compress existing code; helper lives at module level; if still over, extract a tiny `useCompanyExtraction` sub-hook in a follow-up — out of scope here, flag it rather than silently exceed |
| LLM returns plausible but wrong company name | Medium | Prompt forbids generic terms + requires high confidence; user can always override manually (T5 protects mid-typing) |
| Race: user types during extraction, result clobbers input | High if implemented naively | Functional setter `setCompanyName(curr => curr.trim().length === 0 ? result.companyName : curr)` — tested pattern |
| `convex/_generated/api.d.ts` stale → tsc fails | Low | `convex codegen` regenerates on build; never hand-edit; if tsc fails purely on missing `api.ai.extractCompanyMeta`, run `npx convex codegen` |
| Prompt test over-specifies exact French wording | Low | Tests assert on structural keywords (field names, "null", forbidden terms) — not on exact sentences; implementer picks wording |

## Rollback

Both tasks are independently reversible via `git revert <sha>`:

- **Task 1 revert** removes the action + prompt + schema + tests. Frontend remains unchanged (Task 2 not yet merged).
- **Task 2 revert** removes hook wiring + drawer placeholder. Backend action stays but is unused (no cost, dead code — optional follow-up to delete).
- **Full rollback**: `git revert` both commits in reverse order. System returns to the current state (drawer opens with empty companyName, manual typing only).

No DB migrations, no schema changes in `convex/schema.ts`, no persisted state → zero data risk.

## Commit Plan

| # | Commit message | Files | Gate |
|---|----------------|-------|------|
| 1 | `feat(ai): extractCompanyMeta action with bilingual prompt + Zod schema` | Task 1 files | `vitest run convex/_ai` + `tsc --noEmit` |
| 2 | `feat(editor): auto-fill company name in cover letter drawer` | Task 2 files | `vitest run src/features/editor/hooks` + `tsc --noEmit` + `vite build` |

Both commits follow conventional-commits as per `.claude/rules/common/workflow.md`.

## Success Criteria

- [ ] `extractCompanyMeta` action exists, uses `chatJSON` + `CompanyMetaSchema.safeParse`, returns `{null,null,null}` fallback on any failure (no throws)
- [ ] Bilingual prompt forbids generic fallbacks and hallucination (FR + EN cases proven by unit tests)
- [ ] `CompanyMetaSchema` parses all-string, all-null, and mixed payloads; rejects wrong types
- [ ] Hook file still ≤ 150 lines
- [ ] `shouldTriggerExtraction` unit-tested (≥6 cases)
- [ ] Drawer shows `Détection automatique...` placeholder while extracting
- [ ] User typing during async extraction is preserved (functional setter guard)
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` all green (including pre-existing suites)
- [ ] `npx vite build` passes
- [ ] Manual: open drawer with pasted JD → companyName auto-fills within a few seconds; opening with JD < 50 chars does not trigger extraction; failing LLM leaves field empty with no toast
