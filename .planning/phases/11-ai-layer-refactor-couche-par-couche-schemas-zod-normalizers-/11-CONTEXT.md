# Phase 11: AI Layer Refactor — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** `--auto` (recommended defaults selected for all gray areas)

<domain>
## Phase Boundary

Restructure the AI layer of Calibre into a clean, layered architecture so that every AI-facing action has:

1. A single source of truth for schemas (Zod) that validates every AI output
2. Prompt fragments reused across actions instead of duplicated strings
3. Normalizers that enforce ATS-quality output regardless of what the model returns
4. Unit tests on every pure helper (schemas, normalizers, prompt builders)
5. Atomic, reversible commits per logical step

Out of scope: introducing new AI actions, changing provider priority, changing the React frontend consumers' API surface. The public `api.ai.*` signatures stay stable so all existing callers (`DashboardPage`, `EditorPage`, `CoverLetterPage`) keep working without modification.
</domain>

<decisions>
## Implementation Decisions

### D-01 — File organization strategy
**Layered architecture via `_ai/` private directory.**

```
convex/
  ai.ts                         ← thin action definitions (unchanged API surface)
  _ai/                          ← private helpers (Convex ignores underscore-prefixed dirs)
    providers.ts                ← getProviders, getClient, getModel
    chat.ts                     ← chatJSON, chatText, withRetry, safeParseJSON
    auth.ts                     ← verifyAccessCode
    schemas.ts                  ← Zod schemas (single source of truth)
    normalizers.ts              ← normalizeCVData, normalizeDates, normalizeProficiency, normalizeTitle
    prompts/
      fragments.ts              ← FABRICATION_GUARD, ACTION_VERBS_FR/EN, KPI_RULES, INTRO_PRESERVATION
      extract.ts                ← buildExtractPrompt(ctx)
      adapt.ts                  ← buildAdaptPrompt(ctx)  — used by tailorCV and optimizeCVForPage
      rewrite.ts                ← buildBulletRewritePrompt(ctx)
      analysis.ts               ← buildATSAnalysisPrompt(ctx)
      coverLetter.ts            ← buildCoverLetterPrompt(ctx)
```

**Why**: Convex only treats top-level files under `convex/` as API files. Underscore-prefixed dirs are ignored by the code generator, so `_ai/*` is private to the module without breaking the API surface. Breaking `ai.ts` into multiple top-level files would change API paths and break every frontend caller.

### D-02 — Schema validation library
**Zod 3.x** for runtime validation of AI outputs.

Convex's `v.*` validators exist for ACTION INPUT args only (not for arbitrary runtime data). AI responses need a separate validator. Zod is the industry standard and pairs naturally with TypeScript.

Dependency to add: `zod` (runtime), already-absent from `package.json`.

### D-03 — Schema strategy (lenient, backward compatible)
**Lenient schemas** — all fields `.optional()` where the type allows it, with `.passthrough()` on objects to tolerate extra AI-generated fields. Normalizers are responsible for coercing into the canonical shape.

**Why**:
- Existing CVs in Convex DB may not have `kpi`, `showKpi`, `displayMode` — must still load
- AI models occasionally add extra fields we haven't seen — throwing breaks UX for no reason
- Strict validation at the boundary, graceful coercion inward

### D-04 — Action consolidation
**Keep all 9 existing actions separate.** Share helpers (prompt fragments, normalizers) but never merge distinct actions.

**Why**:
- `tailorCV` and `optimizeCVForPage` have different call sites at different lifecycle moments (import vs edit). Merging them would change the API and break the frontend.
- `improveBulletPoint` (1 → 3 suggestions for UI picker) and `rewriteBulletsForJob` (N → N batch) have different UIs and return shapes. Same reasoning.
- The goal is NOT fewer actions — it's ELIMINATING DUPLICATED RULES across the actions. Share via helpers, keep API stable.

### D-05 — Normalization contract
**normalizeCVData(raw: unknown) → CVData** — single function handles all cleanup.

Responsibilities:
1. Parse raw AI output against the lenient Zod schema
2. If schema parse fails → throw descriptive error, log full raw payload server-side
3. If schema parse succeeds → apply coercions:
   - `current`/`end_date` coherence (date empty or "présent" → current = true, end_date = "")
   - Date format: accept "Mois YYYY", "YYYY", "MM/YYYY"; normalize to "Mois YYYY"
   - Proficiency: map LinkedIn English levels (`"full professional proficiency"`) to canonical FR labels (`"Courant (C1)"`)
   - Title: truncate if > 50 chars, keep first part before `|` or `,`
   - Skills: coerce `items` array elements to strings, dedupe, truncate to 8 per category
   - Description: split long bullets (>200 chars), trim, max 5 per experience
   - `displayMode`: default to `"normal"` if missing or invalid
   - `kpi`: trim string, default to `""` if missing (UI displays nothing when empty)
   - `showKpi`: pass through as-is (optional boolean)
4. Return typed `CVData`

All 3 actions that return a CVData (`extractCVDataFromPDF`, `tailorCV`, `optimizeCVForPage`) MUST pipe through `normalizeCVData`. This closes the dead zone in `tailorCV` which currently has zero post-processing.

### D-06 — Error handling
**Throw descriptive errors on unrecoverable failures. Best-effort recovery on soft failures.**

- Unrecoverable (throw): AI returns non-JSON, schema parse fails after recovery attempts, required top-level fields missing (`experience` array absent entirely)
- Soft (log + coerce): individual field type mismatches, missing optional fields, extra unexpected fields
- Frontend sees either `CVData` (valid) or a thrown error with a user-friendly French message

### D-07 — Test strategy
**Unit tests on pure helpers. NO LLM calls in tests.** Use Vitest (already installed, 193 tests running).

Test files (new):
- `convex/_ai/__tests__/schemas.test.ts` — Zod schemas accept/reject edge cases
- `convex/_ai/__tests__/normalizers.test.ts` — all normalization rules with fixture inputs
- `convex/_ai/__tests__/prompts/fragments.test.ts` — constant strings are non-empty and language-aware
- `convex/_ai/__tests__/prompts/extract.test.ts` — buildExtractPrompt returns valid prompt string with expected substrings
- `convex/_ai/__tests__/prompts/adapt.test.ts` — buildAdaptPrompt with/without JD
- `convex/_ai/__tests__/prompts/rewrite.test.ts` — buildBulletRewritePrompt
- `convex/_ai/__tests__/fixtures/` — sample AI outputs (clean, dirty, malformed) for normalizer tests

Target: **~30 new unit tests** covering all pure functions. Existing 193 tests remain green.

### D-08 — Prompt fragment composition model
**Template strings composed via helper functions.** No builder pattern, no class hierarchies.

Example:
```ts
// fragments.ts
export const FABRICATION_GUARD = `RÈGLE ABSOLUE : Ne JAMAIS inventer de chiffres...`;
export const ACTION_VERBS_FR = `Pilote, Conçoit, Orchestre, Déploie, Optimise, Structure`;
export const KPI_RULES = `═══ KPI — OBLIGATOIRE ═══\n...`;

// prompts/adapt.ts
export function buildAdaptPrompt(ctx: AdaptContext): string {
  return `${ROLE_PREAMBLE}
LANGUAGE: ${ctx.outputLang}
${KPI_RULES}
${FABRICATION_GUARD}
CV:
${JSON.stringify(ctx.cvData)}
${ctx.jobContext}
${JSON_SCHEMA_EXAMPLE}`;
}
```

Simple, testable, no magic.

### D-09 — Commit atomicity
**~10 atomic commits**, each passing `tsc --noEmit` + `vitest run` + `vite build` independently.

Ordered (tentative, planner will refine):
1. Install Zod + create `_ai/schemas.ts` + unit tests
2. Create `_ai/normalizers.ts` + unit tests
3. Extract provider/client/chat helpers to `_ai/providers.ts` + `_ai/chat.ts` + `_ai/auth.ts`
4. Create `_ai/prompts/fragments.ts` (shared constants)
5. Create `_ai/prompts/extract.ts` + tests, wire into `extractCVDataFromPDF`
6. Create `_ai/prompts/adapt.ts` + tests, wire into `tailorCV` (adds normalization — critical)
7. Wire `adapt.ts` into `optimizeCVForPage` (reuses same builder)
8. Create `_ai/prompts/rewrite.ts` + tests, wire into `improveBulletPoint` + `rewriteBulletsForJob`
9. Create `_ai/prompts/analysis.ts` + wire into `getATSAnalysis`
10. Create `_ai/prompts/coverLetter.ts` + wire into `generateCoverLetter`
11. Verification: run full test suite, build, manual live check, final commit

### D-10 — ATS quality guardrails
**Every CV-returning action must enforce, via schema + normalizer:**
1. Action verbs in bullets (`ACTION_VERBS_FR/EN` referenced in prompt; weak verbs flagged post-hoc by existing `atsHelpers`)
2. KPI non-empty (when `displayMode === "extended"` OR `showKpi === true`)
3. `intro` field preserved in all adaptation flows (explicitly mentioned in every adapt prompt)
4. `displayMode` always set (defaulted to "normal")
5. Keywords from job description integrated naturally (prompt rule, not enforceable post-hoc)
6. Standardized section names (already handled client-side by `atsRules.ts`)

### Claude's Discretion
- Exact Zod schema field types (Claude picks based on existing TS types)
- Fixture file content for normalizer tests (Claude creates representative cases)
- Internal naming of prompt builder helper functions
- Order of commits within a logical group (Claude decides when ambiguous)
- Whether to create barrel `_ai/index.ts` or import directly from sub-files (prefer direct for tree-shaking)

</decisions>

<specifics>
## Specific Ideas

- **`tailorCV` is the critical fix** — currently has ZERO post-processing, AI output flows raw to the frontend. Wiring `normalizeCVData` into it is the highest-value single change of this phase.
- **Backward compat on existing CVs in Convex DB** — the lenient schema must still parse CVs saved before `kpi`/`showKpi`/`displayMode` existed. These fields become `undefined` → normalizer defaults them on read.
- **Reuse of existing `atsHelpers.ts` / `atsRules.ts`** — client-side ATS logic (extractNLPKeywords, scoreRelevance, etc.) stays untouched. This phase refactors ONLY the Convex AI layer.
- **`FABRICATION_GUARD` constant is already a proto-fragment** — it's the pattern to generalize.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing codebase — files being refactored
- `convex/ai.ts` — 864 lines, current monolith (9 actions + helpers + prompts)
- `convex/schema.ts` — Convex DB schema for CVData (uses `v.any()` for experience/skills to tolerate AI variations)
- `src/shared/types/index.ts` — TypeScript types that Zod schemas must mirror (`Experience`, `CVData`, `SkillCategory`, `Education`, `Language`, `PersonalInfo`)

### Existing codebase — callers (for API stability verification)
- `src/pages/DashboardPage.tsx` — calls `extractCVDataFromPDF`, `tailorCV`
- `src/pages/EditorPage.tsx` — calls `optimizeCVForPage`, `improveBulletPoint`, `rewriteBulletsForJob`
- `src/features/cover-letter/components/CoverLetterPage.tsx` — calls `generateCoverLetter`

### Related client-side logic (NOT refactored, but context)
- `src/features/editor/lib/scoring.ts` — `autoAssignModes` posts displayMode after extraction (runs client-side)
- `src/features/editor/lib/displayModes.ts` — `shouldShowKPI` honors the new `showKpi` override (Phase committed 052cdee)
- `src/features/editor/lib/atsRules.ts` — standard section names FR/EN, template ATS compatibility
- `src/features/editor/lib/atsHelpers.ts` — NLP keyword extraction, relevance scoring

### Codebase documentation
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`

### Project specs
- `.planning/PROJECT.md` — core value, ATS research findings
- `.planning/REQUIREMENTS.md` — acceptance criteria for AI content optimization

No external ADRs or feature specs — the Convex AI layer has no dedicated design doc yet. This phase implicitly becomes the first architectural reference for that layer.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`FABRICATION_GUARD` constant** (ai.ts:798): shared rule, already a proto-fragment — extract and expand pattern
- **`withRetry()` helper** (ai.ts:110): robust provider fallback with exponential backoff — move to `_ai/chat.ts`, no behavior change
- **`safeParseJSON()` helper** (ai.ts:93): handles markdown-wrapped JSON — move to `_ai/chat.ts`, no behavior change
- **`proficiencyMap` table** (ai.ts:302): LinkedIn English → canonical French labels — move to `_ai/normalizers.ts`
- **Existing post-extraction normalization** (ai.ts:246-320): 70 lines of ad-hoc cleanup — move to `normalizeCVData()`
- **Vitest config**: already running 193 tests, supports TS + Convex files → new tests plug in without setup

### Established Patterns
- **Convex action signature**: `action({ args, handler })` with `v.*` input validators — unchanged
- **File structure under `convex/`**: top-level files become API modules — that's why `_ai/` subdir works (underscore = private)
- **TypeScript types in `src/shared/types/`** as single source of truth for the client — Zod schemas in `convex/_ai/schemas.ts` must match these types (re-export preferred where possible)

### Integration Points
- Every action in `ai.ts` becomes a thin wrapper: `auth → build prompt → chat → normalize → return`
- Normalization is the only code path that can turn raw AI output into `CVData`
- All tests run via existing `npx vitest run` — no new runner

### Creative Options Enabled
- Future: generate JSON schema examples automatically from Zod schema (using `zod-to-json-schema`) — punt for now, could be Phase 12
- Future: structured output via OpenAI function calling (some providers support it) — out of scope for this phase
- Future: streaming responses via Convex action streaming — out of scope

</code_context>

<deferred>
## Deferred Ideas

- **Automatic JSON example generation from Zod** (via `zod-to-json-schema`) — adds a dependency, marginal benefit right now. Revisit if prompts drift.
- **Structured output via function calling** — provider-specific, depends on each LLM's support. Revisit when Gemini/Claude/NVIDIA converge on a standard.
- **Real LLM integration tests** (calling actual APIs in CI) — too flaky, too slow, too expensive. Unit tests on pure helpers suffice.
- **Merging `tailorCV` + `optimizeCVForPage` into one `adaptCV` action** — would require frontend changes, out of scope. Recheck after this phase if the shared builder makes the merger trivial.
- **Merging `improveBulletPoint` + `rewriteBulletsForJob`** — same reasoning, different call sites, out of scope.
- **Client-side Zod validation of Convex responses** — nice-to-have, adds zod to frontend bundle. Consider in a separate client-side hardening phase.
- **Date normalization to ISO 8601** — ATS parsers actually prefer "Month YYYY" so staying there. ISO is for databases.

</deferred>

---

*Phase: 11-ai-layer-refactor-couche-par-couche-schemas-zod-normalizers-*
*Context gathered: 2026-04-11 (auto mode — recommended defaults)*
