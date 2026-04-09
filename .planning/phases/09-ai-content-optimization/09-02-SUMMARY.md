---
phase: 09-ai-content-optimization
plan: 02
subsystem: ai-backend
tags: [ai, convex, ats, bullet-rewriting, fabrication-guard]
dependency_graph:
  requires: []
  provides: [rewriteBulletsForJob, enhanced-improveBulletPoint]
  affects: [convex/ai.ts]
tech_stack:
  added: []
  patterns: [fabrication-guard-prompt, keyword-integration-prompt]
key_files:
  created: []
  modified:
    - convex/ai.ts
decisions:
  - Extracted FABRICATION_GUARD as a shared constant to avoid duplication between actions
  - Used French prompts consistent with existing codebase conventions
  - rewriteBulletsForJob uses default model (not fast) for higher quality rewrites
  - improveBulletPoint keeps fast model for quick per-bullet suggestions
metrics:
  duration: ~3min
  completed: "2026-04-09T13:17:00Z"
  tasks: 2
  files: 1
---

# Phase 9 Plan 02: AI Bullet Rewriting Actions Summary

New `rewriteBulletsForJob` Convex action for batch bullet rewriting with JD alignment and keyword integration, plus enhanced `improveBulletPoint` with optional `missingKeywords` param and fabrication guard in both prompts.

## What Was Done

### Task 1: Add rewriteBulletsForJob action
- Created new exported Convex action `rewriteBulletsForJob` in `convex/ai.ts`
- Accepts: `bullets` array (with index, text, position, company), `jobDescription`, `missingKeywords`, optional `accessCode`
- Builds structured prompt with job description context, keyword integration instruction, and fabrication guard
- Returns `{ rewrites: [{ index, original, rewritten }] }` via `chatJSON()`
- Validates response shape; throws error if `rewrites` array is missing
- Uses default model (not fast) for quality
- **Commit:** `d9a548d`

### Task 2: Enhance improveBulletPoint with JD context
- Added `missingKeywords: v.optional(v.array(v.string()))` argument
- Added `keywordContext` block that appends missing keywords instruction when provided
- Added fabrication guard as rule 6: "Ne JAMAIS inventer de chiffres ou metriques"
- Minimal enhancement -- no restructuring of existing prompt
- **Commit:** `0039bfb`

## Decisions Made

1. **Shared FABRICATION_GUARD constant** -- Extracted the fabrication guard text as a module-level `const` string to ensure consistency between `rewriteBulletsForJob` (full guard) and `improveBulletPoint` (inline shorter version in rule 6). The full constant is used in the batch action; the per-bullet action uses a concise inline version appropriate for its simpler prompt structure.

2. **Bullet context format** -- Each bullet in the batch prompt includes position and company context: `[index] (position @ company) "text"` to give the AI role-aware rewriting context.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- both actions are fully functional and ready for client consumption.

## Verification

- `npx tsc --noEmit` -- 0 errors (pre-existing unrelated test file error excluded)
- `npx vite build` -- passes successfully

## Self-Check: PASSED

- [x] `convex/ai.ts` modified with both actions
- [x] Commit `d9a548d` exists
- [x] Commit `0039bfb` exists
- [x] `rewriteBulletsForJob` exported
- [x] `improveBulletPoint` has `missingKeywords` param
- [x] Both prompts include fabrication guard
- [x] File total: 685 lines (multi-action backend file, acceptable per plan)
