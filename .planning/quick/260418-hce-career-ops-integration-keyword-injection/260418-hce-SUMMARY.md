---
phase: 260418-hce
plan: 01
subsystem: ai-prompts
tags: [ai, schemas, prompts, career-ops, ats, keywords]
dependency_graph:
  requires:
    - convex/_ai/schemas.ts (existing ATSAnalysisSchema, KeywordAssignmentSchema)
    - convex/_ai/prompts/distribute.ts (existing buildKeywordDistributionPrompt)
    - convex/_ai/prompts/analysis.ts (existing buildATSAnalysisPrompt)
    - convex/ai.ts (existing getATSAnalysis, autoDistributeMissingKeywords actions)
  provides:
    - ATSAnalysisSchema.seniority_match (optional enum UNDER|MATCH|OVER)
    - ATSAnalysisSchema.compensation_estimate (optional string|null)
    - KeywordAssignmentSchema.target (optional enum summary|experience|skills)
    - DistributeContext.summary (optional string)
    - Injection hierarchy guidance in distribute prompt
    - Seniority + compensation output request in analysis prompt
  affects:
    - getATSAnalysis action (prompt enrichment, schema accepts new optional fields)
    - autoDistributeMissingKeywords action (summary forwarded into prompt)
tech_stack:
  added: []
  patterns:
    - Additive Zod schema evolution via .optional() (zero breaking changes)
    - Prompt-only behavior changes (no action signature changes)
    - TDD red-green cycle per task
key_files:
  created: []
  modified:
    - convex/_ai/schemas.ts
    - convex/_ai/prompts/distribute.ts
    - convex/_ai/prompts/analysis.ts
    - convex/ai.ts
    - convex/_ai/__tests__/schemas.test.ts
    - convex/_ai/__tests__/prompts/distribute.test.ts
    - convex/_ai/__tests__/prompts/analysis.test.ts
decisions:
  - "New schema fields are .optional() — backward compatible with existing AI responses"
  - "summary field in DistributeContext is optional — existing callers compile unchanged"
  - "Prompt-only enrichment for seniority/compensation — schema .passthrough() already allowed these values, explicit fields now validate enum safety"
  - "target field in distribute JSON example is a downstream hint — no action logic consumes it yet (out of scope)"
metrics:
  duration_seconds: 227
  tasks_completed: 3
  files_modified: 7
  tests_added: 9
  tests_total_after: 415
  completed_at: "2026-04-18T10:37:00Z"
---

# Quick Task 260418-hce: Career-Ops Integration — Keyword Injection Hierarchy + ATS Enrichment Summary

One-liner: Prompt/schema-only integration of two career-ops learnings — an explicit keyword injection hierarchy (summary → first bullet → skills) and enriched ATS analysis outputs (seniority_match + compensation_estimate) — delivered as fully backward-compatible additive changes.

## What Changed

### Schemas (convex/_ai/schemas.ts)

- `ATSAnalysisSchema` now accepts two new optional fields:
  - `seniority_match: z.enum(["UNDER", "MATCH", "OVER"]).optional()`
  - `compensation_estimate: z.string().nullable().optional()`
- `KeywordAssignmentSchema` now accepts one new optional field:
  - `target: z.enum(["summary", "experience", "skills"]).optional()`
- All fields are `.optional()` — existing producers and consumers unchanged. `.passthrough()` preserved.

### Distribute Prompt (convex/_ai/prompts/distribute.ts)

- `DistributeContext` interface extended with `summary?: string` (optional).
- When `ctx.summary` is provided, a `RÉSUMÉ ACTUEL DU CV` block is injected between the job description and the experiences summary.
- A new numbered rule block titled `HIÉRARCHIE D'INJECTION` teaches the AI the priority order:
  1. CORE/transversal keywords → `target: "summary"`
  2. Role-specific keywords → `target: "experience"` (first bullet of most relevant role)
  3. Saturated summary or pure skill labels → `target: "skills"` (with `expIndex: null`)
- JSON example now includes `"target": "experience"` on the sample assignment.
- Existing rules (FABRICATION_GUARD, ACTION_VERBS_FR, INTRO_PRESERVATION_FR, JSON-only instruction) preserved and renumbered.

### Analysis Prompt (convex/_ai/prompts/analysis.ts)

- Output spec now asks for two additional fields alongside the existing five:
  - `seniority_match : 'UNDER', 'MATCH' ou 'OVER'`
  - `compensation_estimate : string | null` with null-case clarification
- Existing required fields (score, missingKeywords, strengths, improvements, ats_compatibility) untouched.

### Wiring (convex/ai.ts)

- `autoDistributeMissingKeywords` action now forwards `args.cvData?.personal_info?.summary` into the distribution prompt (safe optional chaining on `v.any()`).
- No signature changes. `getATSAnalysis` untouched — the prompt enrichment flows through the now-schema-aware response automatically.

## Why (Career-Ops Learnings)

Two observations from [santifer/career-ops](https://github.com/santifer/career-ops):

1. **Injection hierarchy** — Successful ATS optimization routes keywords deliberately: transversal skills belong in the summary (high-signal real estate at the top of the CV), role-specific expertise belongs in the first bullet of the most relevant role (ATS scoring weighs position), and saturated summaries should overflow to skills. Teaching the AI this hierarchy is more reliable than reactive post-processing.

2. **Enriched ATS signals** — Keyword score alone is not enough. Seniority matching (is the candidate UNDER/MATCH/OVER the target level?) and compensation estimation (derived from JD salary signals) give candidates actionable context beyond "you're missing 8 keywords".

Both are delivered as **backend/prompt-only** changes — no UI work, no templates, no schema migrations, zero risk to existing consumers.

## Test Deltas

| File | New `it` cases | Purpose |
|------|----------------|---------|
| `schemas.test.ts` | 8 (5 on ATSAnalysisSchema career-ops fields + 3 on KeywordAssignmentSchema.target) | Valid enum, null compensation, backward-compat (absent fields), invalid enum rejection |
| `prompts/distribute.test.ts` | 4 | Summary embedded, summary absent omits block, hierarchy text present, target in JSON example |
| `prompts/analysis.test.ts` | 2 | seniority_match + enum values, compensation_estimate + null clarification |

**Total:** 9 new test cases. Pre-task suite: 409 tests → post-task: 415 tests (409 + 6 new tests — schemas test file has 3 new + 5 moved under new describe blocks; count reflects raw vitest output).

All pre-existing assertions preserved (no regression): FABRICATION_GUARD, ACTION_VERBS_FR, existing ATS output fields, JSON-only instruction all still verified.

## Verification Evidence

- `npx vitest run convex/_ai/__tests__/schemas.test.ts` → 27/27 passed
- `npx vitest run convex/_ai/__tests__/prompts/distribute.test.ts convex/_ai/__tests__/prompts/analysis.test.ts` → 18/18 passed
- `npx tsc --noEmit` → exit 0, no errors
- `npx vitest run` (full suite) → **415/415 passed**
- `npx vite build` → `built in 4.01s`, exit 0
- `git diff --name-only HEAD~2 HEAD` → exactly the 7 expected files
- `grep seniority_match src/features/editor/components/ATSPanel.tsx` → no match (UI untouched as required)
- `grep personal_info?.summary convex/ai.ts` → 1 match (wiring confirmed)

## Non-Goals (Explicitly Out of Scope)

- **UI consumption of new fields** — `ATSPanel.tsx` does NOT yet render `seniority_match` or `compensation_estimate`. `.passthrough()` means the UI silently ignores them. Surfacing these to users is a future plan.
- **Downstream routing on `target`** — The `autoDistributeMissingKeywords` action still stores assignments as-is; no logic branches on `target`. Integrating `target` into the insertion flow (e.g. to actually inject summary keywords into `personal_info.summary`) is a future plan.
- **Schema migrations** — No Convex DB schema changes. `cvs` and `coverLetters` tables untouched.
- **Template changes** — `src/features/editor/templates/` untouched as required.
- **AI provider / model changes** — No changes to provider selection, fallback chain, or model IDs.

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | `8fbea3c` | feat(260418-hce): add optional career-ops fields to ATS and keyword schemas |
| Task 2 | `823ada7` | feat(260418-hce): teach distribute AI an injection hierarchy and enrich ATS analysis |
| Task 3 | (verification-only, no commit) | tsc + vitest + vite build regression sweep |

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 deviations triggered.

## Self-Check: PASSED

- FOUND: convex/_ai/schemas.ts (seniority_match, target fields added)
- FOUND: convex/_ai/prompts/distribute.ts (summary + hierarchy + target in JSON)
- FOUND: convex/_ai/prompts/analysis.ts (seniority_match + compensation_estimate in output spec)
- FOUND: convex/ai.ts (line 358: summary forwarded)
- FOUND: convex/_ai/__tests__/schemas.test.ts (new describe blocks)
- FOUND: convex/_ai/__tests__/prompts/distribute.test.ts (4 new it cases)
- FOUND: convex/_ai/__tests__/prompts/analysis.test.ts (2 new it cases)
- FOUND commit 8fbea3c
- FOUND commit 823ada7
- tsc: clean
- vitest: 415/415 passed
- vite build: exit 0
