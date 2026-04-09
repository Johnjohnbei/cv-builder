---
phase: 01-refactoring-foundation
plan: 01
subsystem: editor/lib
tags: [refactoring, module-extraction, code-organization]
dependency_graph:
  requires: []
  provides: [formatting-module, clean-scoring-module]
  affects: [templates, scoring]
tech_stack:
  added: []
  patterns: [leaf-module-extraction, single-responsibility]
key_files:
  created:
    - src/features/editor/lib/formatting.ts
    - src/features/editor/lib/formatting.test.ts
  modified:
    - src/features/editor/lib/scoring.ts
    - src/features/editor/lib/scoring.test.ts
    - src/features/editor/templates/TemplateA.tsx
    - src/features/editor/templates/TemplateB.tsx
    - src/features/editor/templates/TemplateC.tsx
    - src/features/editor/templates/TemplateD.tsx
    - src/features/editor/templates/TemplateE.tsx
    - src/features/editor/templates/TemplateF.tsx
  deleted:
    - src/lib/utils.ts
decisions:
  - Formatting functions extracted as leaf module with zero dependencies on scoring
  - src/lib/utils.ts deleted since all 11 cn() consumers already use @/src/shared/lib/cn
metrics:
  duration: 164s
  completed: "2026-04-09T10:05:35Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 11
---

# Phase 01 Plan 01: Extract Formatting Utilities Summary

Extract formatting utilities (formatDateShort, normalizeProficiency) from scoring.ts into a dedicated formatting.ts leaf module, update all template imports, and delete the duplicate cn() utility file.

## One-liner

Extracted date/proficiency formatting into leaf module, reduced scoring.ts from 202 to 128 lines, deleted duplicate cn() utility.

## What Was Done

### Task 1: Extract formatting functions to new module + move tests
- Created `src/features/editor/lib/formatting.ts` with `formatDateShort`, `normalizeProficiency`, `MONTH_MAP_FR`, and `PROFICIENCY_MAP`
- Created `src/features/editor/lib/formatting.test.ts` with moved test blocks (2 describe blocks, 9 test cases)
- Removed all formatting code from `scoring.ts` (reduced from 202 to 128 lines)
- Removed formatting test blocks from `scoring.test.ts`
- All 50 tests pass across 4 test files
- **Commit:** 3453ef8

### Task 2: Update template imports + delete duplicate cn() + clean barrel
- Updated all 6 template files (TemplateA-F) to import from `../lib/formatting` instead of `../lib/scoring`
- Deleted `src/lib/utils.ts` (duplicate cn() with zero consumers)
- Verified no barrel re-exports needed for formatting functions
- TypeScript compiles cleanly, all 50 tests pass
- **Commit:** 2615353

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx vitest run` -- 50 tests pass (4 test files)
- `npx tsc --noEmit` -- no type errors
- `grep formatDateShort scoring.ts` -- zero results (confirmed removed)
- `grep "from.*scoring" templates/` -- no formatting imports remain
- `ls src/lib/utils.ts` -- file does not exist (confirmed deleted)
- scoring.ts: 128 lines (down from 202, target was ~120)
- formatting.ts: 72 lines (clean leaf module, zero imports from scoring)

## Known Stubs

None.
