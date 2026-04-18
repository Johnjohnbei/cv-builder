---
phase: 260418-hce
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/_ai/schemas.ts
  - convex/_ai/prompts/distribute.ts
  - convex/_ai/prompts/analysis.ts
  - convex/ai.ts
  - convex/_ai/__tests__/schemas.test.ts
  - convex/_ai/__tests__/prompts/distribute.test.ts
  - convex/_ai/__tests__/prompts/analysis.test.ts
autonomous: true
requirements:
  - QUICK-260418-HCE-01
  - QUICK-260418-HCE-02
  - QUICK-260418-HCE-03

must_haves:
  truths:
    - "Distribute prompt teaches the AI an explicit injection hierarchy (summary top5 -> role first bullet -> skills)"
    - "Distribute response may carry a target classification ('summary' | 'experience' | 'skills') without breaking existing flow"
    - "ATS analysis prompt asks the AI for seniority_match and compensation_estimate"
    - "ATS analysis schema accepts seniority_match and compensation_estimate when present, still parses when absent"
    - "Existing consumers (ATSPanel.tsx, autoDistributeMissingKeywords action) keep working with unchanged signatures"
    - "All unit tests for schemas and prompt builders pass; type check passes"
  artifacts:
    - path: "convex/_ai/schemas.ts"
      provides: "Optional seniority_match + compensation_estimate on ATSAnalysisSchema, optional target on KeywordAssignmentSchema"
      contains: "seniority_match"
    - path: "convex/_ai/prompts/distribute.ts"
      provides: "DistributeContext with optional summary, hierarchy-aware prompt, target field in JSON example"
      contains: "target"
    - path: "convex/_ai/prompts/analysis.ts"
      provides: "Enriched prompt requesting seniority_match + compensation_estimate"
      contains: "seniority_match"
    - path: "convex/ai.ts"
      provides: "Passes cvData.personal_info?.summary into buildKeywordDistributionPrompt"
      contains: "personal_info"
    - path: "convex/_ai/__tests__/schemas.test.ts"
      provides: "Coverage for new optional fields on both schemas"
      contains: "seniority_match"
    - path: "convex/_ai/__tests__/prompts/distribute.test.ts"
      provides: "Assertions for hierarchy text, summary embedding, target in JSON example"
      contains: "target"
    - path: "convex/_ai/__tests__/prompts/analysis.test.ts"
      provides: "Assertions for seniority_match + compensation_estimate mentions"
      contains: "compensation_estimate"
  key_links:
    - from: "convex/ai.ts"
      to: "convex/_ai/prompts/distribute.ts"
      via: "buildKeywordDistributionPrompt call site"
      pattern: "buildKeywordDistributionPrompt\\(\\{[^}]*summary"
    - from: "convex/_ai/prompts/distribute.ts"
      to: "convex/_ai/schemas.ts"
      via: "target field referenced in JSON example matches KeywordAssignmentSchema.target"
      pattern: "\\\"target\\\""
    - from: "convex/_ai/prompts/analysis.ts"
      to: "convex/_ai/schemas.ts"
      via: "seniority_match + compensation_estimate requested in prompt and accepted by schema"
      pattern: "seniority_match"
---

<objective>
Integrate two focused learnings from career-ops (https://github.com/santifer/career-ops) into Calibre:

1. **Keyword injection hierarchy** — teach the distribution prompt a proven priority order (summary top-5 -> first bullet of most relevant role -> skills fallback) and surface an optional `target` classification on each assignment so downstream tooling can route assignments correctly.
2. **Enriched ATS analysis** — extend the ATS analysis prompt + schema with two optional outputs: `seniority_match` ('UNDER' | 'MATCH' | 'OVER') and `compensation_estimate` (string | null), helping users gauge fit beyond raw keyword score.

Both changes are strictly additive: new Zod fields are `.optional()`, new prompt sections are appended, existing consumers (ATSPanel.tsx, autoDistributeMissingKeywords, getATSAnalysis) keep working without modification. No UI or templates are touched.

Purpose: Raise AI output quality and user insight without introducing breaking changes or UI churn — backend + prompts only.

Output: 4 production files edited (schemas, 2 prompts, ai.ts), 3 test files edited with new coverage, npm run lint + npx vitest run both pass.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

@convex/_ai/schemas.ts
@convex/_ai/prompts/distribute.ts
@convex/_ai/prompts/analysis.ts
@convex/ai.ts
@convex/_ai/__tests__/schemas.test.ts
@convex/_ai/__tests__/prompts/distribute.test.ts
@convex/_ai/__tests__/prompts/analysis.test.ts

<interfaces>
<!-- Existing contracts executor must preserve. Do NOT break these. -->

From convex/_ai/schemas.ts (current):
```typescript
export const ATSAnalysisSchema = z.object({
  score: z.number(),
  missingKeywords: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  ats_compatibility: z.enum(["LOW", "MEDIUM", "HIGH"]),
}).passthrough();

export const KeywordAssignmentSchema = z.object({
  keyword: z.string(),
  expIndex: z.number().nullable(),
  bulletIndex: z.number().nullable().optional(),
  originalBullet: z.string().nullable().optional(),
  rewrittenBullet: z.string().nullable().optional(),
  reason: z.string().default(""),
}).passthrough();

export const KeywordDistributionSchema = z.object({
  assignments: z.array(KeywordAssignmentSchema).default([]),
}).passthrough();
```

From convex/_ai/prompts/distribute.ts (current):
```typescript
export interface DistributeContext {
  cvData: {
    experience: Array<{
      position?: string;
      company?: string;
      intro?: string;
      description?: string[];
      kpi?: string;
    }>;
  };
  missingKeywords: string[];
  jobDescription: string;
}
export function buildKeywordDistributionPrompt(ctx: DistributeContext): string;
```

From convex/_ai/prompts/analysis.ts (current):
```typescript
export interface ATSAnalysisContext {
  cvData: unknown;
  jobDescription: string;
}
export function buildATSAnalysisPrompt(ctx: ATSAnalysisContext): string;
```

From convex/ai.ts (current call sites — DO NOT rename signatures):
- Line 84: `buildATSAnalysisPrompt({ cvData: args.cvData, jobDescription: args.jobDescription })`
- Line 354: `buildKeywordDistributionPrompt({ cvData: { experience: args.cvData?.experience ?? [] }, missingKeywords: args.missingKeywords, jobDescription: args.jobDescription })`

Both call sites use `args.cvData: v.any()` already, so passing `args.cvData?.personal_info?.summary` is safe.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend Zod schemas with optional career-ops fields</name>
  <files>convex/_ai/schemas.ts, convex/_ai/__tests__/schemas.test.ts</files>
  <behavior>
    - ATSAnalysisSchema accepts `{ ...existing, seniority_match: "MATCH" }` (enum UNDER|MATCH|OVER) -> parsed.seniority_match === "MATCH"
    - ATSAnalysisSchema accepts `{ ...existing, compensation_estimate: "45k-65k€" }` -> string preserved
    - ATSAnalysisSchema accepts `{ ...existing, compensation_estimate: null }` -> null preserved
    - ATSAnalysisSchema still parses when both new fields are ABSENT (backward compat) -> parsed.seniority_match === undefined
    - ATSAnalysisSchema rejects `seniority_match: "JUNIOR"` (outside enum) via safeParse failure
    - KeywordAssignmentSchema accepts `{ keyword, expIndex, target: "summary" }` where target is enum summary|experience|skills
    - KeywordAssignmentSchema still parses assignment WITHOUT target (existing shape) -> parsed.target === undefined
    - KeywordAssignmentSchema rejects `target: "cover_letter"` (outside enum) via safeParse failure
  </behavior>
  <action>
    Edit `convex/_ai/schemas.ts`:
    1. On `ATSAnalysisSchema` (line 71), add two new fields INSIDE the existing object before `.passthrough()`:
       - `seniority_match: z.enum(["UNDER", "MATCH", "OVER"]).optional()`
       - `compensation_estimate: z.string().nullable().optional()`
       Preserve `.passthrough()` — existing consumers (ATSPanel.tsx) silently ignore unknown fields.
    2. On `KeywordAssignmentSchema` (line 112), add one new field before `.passthrough()`:
       - `target: z.enum(["summary", "experience", "skills"]).optional()`

    Edit `convex/_ai/__tests__/schemas.test.ts`:
    1. Add a new `describe("ATSAnalysisSchema — career-ops fields")` block with the 5 ATSAnalysisSchema behaviors above (happy path, null compensation, missing fields backward compat, invalid enum rejection).
    2. Add a new `describe("KeywordAssignmentSchema — target field")` block with the 3 behaviors above (valid target, missing target, invalid enum).

    Rules:
    - ALL new fields MUST be `.optional()` — zero breaking changes for existing producers/consumers.
    - Follow existing test style: `describe` + `it` + `expect(...).toBe/toEqual/toBeUndefined`, use `safeParse` for rejection cases (mirror the existing `ExperienceSchema` rejection test pattern at line 58-63).
    - Immutable — do not mutate existing schema objects; add fields inline.
  </action>
  <verify>
    <automated>cd C:/Users/joaud/Documents/GitHub/cv-builder && npx vitest run convex/_ai/__tests__/schemas.test.ts</automated>
  </verify>
  <done>
    - schemas.test.ts contains new describe blocks for ATSAnalysisSchema career-ops fields and KeywordAssignmentSchema.target
    - All new and existing tests in schemas.test.ts pass
    - `npx tsc --noEmit` passes (no type errors introduced)
    - No existing test assertion was modified (additive only)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Enrich distribute.ts with injection hierarchy + summary context, enrich analysis.ts with seniority/compensation, wire summary in ai.ts</name>
  <files>convex/_ai/prompts/distribute.ts, convex/_ai/prompts/analysis.ts, convex/ai.ts, convex/_ai/__tests__/prompts/distribute.test.ts, convex/_ai/__tests__/prompts/analysis.test.ts</files>
  <behavior>
    distribute.ts:
    - When `ctx.summary` is provided, prompt contains the summary text somewhere (verifies it's injected)
    - Prompt contains hierarchy keywords: "HIÉRARCHIE D'INJECTION" (or equivalent section header), mentions "summary" / "résumé", "premier bullet", and "skills" / "compétences" as the 3 priority targets
    - Prompt JSON example includes a `"target"` field with one of the 3 enum values
    - Prompt still contains all existing elements (FABRICATION_GUARD, ACTION_VERBS_FR, JSON-only instruction, experience summary, missing keywords list) — NO regressions
    - `DistributeContext` type accepts `{ ...existing, summary: "Senior designer with 10y exp" }` without TS error

    analysis.ts:
    - Prompt mentions `seniority_match` and lists the three enum values (UNDER / MATCH / OVER)
    - Prompt mentions `compensation_estimate` and clarifies it may be null when no salary signal exists in the JD
    - Prompt still contains all existing required-output mentions (score, missingKeywords, strengths, improvements, ats_compatibility) — NO regressions
    - Prompt still ends with "Retourne UNIQUEMENT le JSON"

    ai.ts:
    - `buildKeywordDistributionPrompt` call at line ~354 now passes `summary: args.cvData?.personal_info?.summary` (optional chaining, safe when undefined)
    - No other call-site signatures change; `getATSAnalysis` call at line ~84 is unchanged (prompt-only enrichment handles the rest)
  </behavior>
  <action>
    **Step 1 — Edit `convex/_ai/prompts/distribute.ts`:**
    1. Extend `DistributeContext` interface (line 3) to add `summary?: string;` as a top-level optional field.
    2. In `buildKeywordDistributionPrompt`:
       - Add `const summaryBlock = ctx.summary ? \`\nRÉSUMÉ ACTUEL DU CV :\n${ctx.summary}\n\` : "";` early in the function.
       - Inject `${summaryBlock}` into the prompt template between the job description and the experiences summary (so the AI sees the current summary before deciding where to route keywords).
       - Add a new numbered rule section after the existing rule 1 titled `HIÉRARCHIE D'INJECTION` explaining the priority:
         1. Core/transversal keywords (tools, methodologies, soft skills transverses): target the summary if it exists and has room — set `target: "summary"`.
         2. Role-specific keywords (technical, domain-bound): target the first bullet of the most relevant experience — set `target: "experience"`.
         3. If the summary already contains 5+ ATS keywords (saturated) OR the keyword is a pure skill label: route to skills section — set `target: "skills"` and leave `expIndex: null`.
       - Update the JSON example to include `"target": "experience"` on the sample assignment.
       - Keep ALL existing rules (FABRICATION_GUARD, ACTION_VERBS_FR, INTRO_PRESERVATION_FR, etc.) — append hierarchy rules, do not remove existing ones. Renumber rules accordingly.

    **Step 2 — Edit `convex/_ai/prompts/analysis.ts`:**
    1. Append two new bullets to the output-fields list in the prompt:
       - `- seniority_match : 'UNDER', 'MATCH' ou 'OVER' — niveau du candidat vs seniorité demandée dans l'offre`
       - `- compensation_estimate : string | null — fourchette salariale estimée (ex: "45k-65k€") basée sur les signaux de l'offre, null si aucun signal détectable`
    2. Keep existing fields and `Retourne UNIQUEMENT le JSON` closing — additive only.

    **Step 3 — Edit `convex/ai.ts` at ~line 354:**
    - Modify the `buildKeywordDistributionPrompt({ ... })` object literal to add `summary: args.cvData?.personal_info?.summary`. Use optional chaining; do NOT require `args.cvData` to be narrowed further (it's `v.any()`).

    **Step 4 — Edit `convex/_ai/__tests__/prompts/distribute.test.ts`:**
    1. Extend SAMPLE_CTX with `summary: "Senior UX designer, 10y experience, design systems and research"`.
    2. Add new `it` cases under the existing `describe("buildKeywordDistributionPrompt", ...)`:
       - "embeds the CV summary when provided" — asserts prompt contains "Senior UX designer, 10y experience"
       - "omits the summary block when ctx.summary is absent" — pass a ctx without `summary`, assert prompt does NOT contain "RÉSUMÉ ACTUEL DU CV"
       - "teaches the injection hierarchy (summary -> experience -> skills)" — asserts prompt contains "HIÉRARCHIE D'INJECTION" and the strings "summary", "premier bullet" (or equivalent), "skills"
       - "JSON example includes a target field" — asserts prompt contains `"target"`

    **Step 5 — Edit `convex/_ai/__tests__/prompts/analysis.test.ts`:**
    1. Add new `it` cases under the existing `describe("buildATSAnalysisPrompt", ...)`:
       - "mentions seniority_match with all three enum values" — asserts prompt contains "seniority_match", "UNDER", "MATCH", "OVER"
       - "mentions compensation_estimate and explains null case" — asserts prompt contains "compensation_estimate" and "null"
    2. Do NOT modify the existing "mentions every required output field" test — it already covers the non-regression baseline.

    Why these exact changes:
    - `summary?: string` on DistributeContext stays optional for backward compat (DiscoveryContext callers like existing tests that don't pass it still compile).
    - Hierarchy rules are injected as PROMPT text only — no code logic changes, no scoring, no UI. The AI uses the hierarchy; the `target` field becomes a hint that downstream code MAY consume later (out of scope for this plan).
    - analysis.ts enrichment is pure prompt text — the schema changes in Task 1 already allow the new fields to flow through `ATSAnalysisSchema.safeParse` without `.passthrough()` edge cases (they're explicit optional fields now).
  </action>
  <verify>
    <automated>cd C:/Users/joaud/Documents/GitHub/cv-builder && npx vitest run convex/_ai/__tests__/prompts/ convex/_ai/__tests__/schemas.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>
    - distribute.ts exports `DistributeContext` with optional `summary`, prompt contains hierarchy section + target in JSON example, still contains FABRICATION_GUARD + ACTION_VERBS_FR
    - analysis.ts prompt mentions seniority_match + compensation_estimate, still mentions score/missingKeywords/strengths/improvements/ats_compatibility
    - ai.ts line ~354 passes `summary: args.cvData?.personal_info?.summary` into the distribution prompt
    - distribute.test.ts and analysis.test.ts have 4 and 2 new passing `it` cases respectively
    - All existing tests still pass (no regression)
    - `npx tsc --noEmit` passes
  </done>
</task>

<task type="auto">
  <name>Task 3: Full regression sweep — typecheck, full test suite, build</name>
  <files>(no file modifications — verification only)</files>
  <action>
    Run the full quality gate to confirm no regression in any consumer of the touched files:
    1. `npx tsc --noEmit` — full project type check (catches any type regression in ATSPanel.tsx consumers or ai.ts actions even though we didn't touch them).
    2. `npx vitest run` — full test suite (catches any incidental test affected by schema/prompt changes).
    3. `npx vite build` — production build sanity check (catches convex action bundling issues).

    If any step fails, read the error output, fix the root cause, and re-run. Do NOT suppress errors with `any` casts or `// @ts-ignore`.

    Additionally verify manually (grep):
    - `ATSPanel.tsx` does NOT reference `seniority_match` yet (expected — UI integration is out of scope; `.passthrough()` silently drops unknown-to-UI fields).
    - No new `console.log` introduced in production code.
  </action>
  <verify>
    <automated>cd C:/Users/joaud/Documents/GitHub/cv-builder && npx tsc --noEmit && npx vitest run && npx vite build</automated>
  </verify>
  <done>
    - `npx tsc --noEmit` exits 0
    - `npx vitest run` shows all tests passing (including 6+ new tests added in Task 1 and Task 2)
    - `npx vite build` completes successfully
    - No breaking changes introduced for existing consumers (ATSPanel.tsx, autoDistributeMissingKeywords action, getATSAnalysis action)
  </done>
</task>

</tasks>

<verification>
Phase-level verification:

1. **Schema backward compatibility**: Existing Convex actions (`getATSAnalysis`, `autoDistributeMissingKeywords`) must still parse responses that do NOT include the new optional fields. Confirmed by Task 1 tests asserting absence-of-field behavior.

2. **Prompt regression**: All pre-existing `toContain` assertions in `distribute.test.ts` and `analysis.test.ts` still pass, guaranteeing FABRICATION_GUARD, ACTION_VERBS_FR, existing output fields remain.

3. **Wiring**: `ai.ts` autoDistributeMissingKeywords passes `summary` through. Verified by grep:
   ```bash
   grep -n "personal_info?.summary" convex/ai.ts
   ```
   Expected: one match at the `buildKeywordDistributionPrompt` call site.

4. **No UI touched**: Grep confirms ATSPanel.tsx and templates/ are untouched:
   ```bash
   git diff --name-only
   ```
   Expected files only: the 7 listed in `files_modified`.

5. **Full quality gate**: Task 3 runs type check + full test suite + build.
</verification>

<success_criteria>
- [ ] `ATSAnalysisSchema` accepts optional `seniority_match` (UNDER|MATCH|OVER enum) and `compensation_estimate` (string|null)
- [ ] `KeywordAssignmentSchema` accepts optional `target` (summary|experience|skills enum)
- [ ] `DistributeContext` declares `summary?: string`
- [ ] `buildKeywordDistributionPrompt` output contains: existing guards + summary block when provided + HIÉRARCHIE D'INJECTION rules + `"target"` in JSON example
- [ ] `buildATSAnalysisPrompt` output contains: existing required fields + `seniority_match` with enum values + `compensation_estimate` with null clarification
- [ ] `convex/ai.ts` passes `summary: args.cvData?.personal_info?.summary` into the distribution prompt
- [ ] `schemas.test.ts` has new describe blocks covering the 3 new optional fields (happy, absent, invalid enum)
- [ ] `distribute.test.ts` has 4 new it cases (summary embed, summary absent, hierarchy text, target in JSON)
- [ ] `analysis.test.ts` has 2 new it cases (seniority enum values, compensation null case)
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes fully (all pre-existing + new tests green)
- [ ] `npx vite build` passes
- [ ] Zero modifications to `src/features/editor/components/ATSPanel.tsx` or any file under `src/features/editor/templates/`
- [ ] No breaking changes to `getATSAnalysis` or `autoDistributeMissingKeywords` action signatures
</success_criteria>

<output>
After completion, create `.planning/quick/260418-hce-career-ops-integration-keyword-injection/260418-hce-SUMMARY.md` documenting:
- What changed (schemas + prompts + wiring) with file paths
- Why (career-ops learnings: hierarchy + enriched ATS signals)
- Test deltas (count of new tests added per file)
- Non-goals documented (UI consumption of new fields, schema migrations, templates) — explicitly out of scope
- Commit hashes if committed
</output>
