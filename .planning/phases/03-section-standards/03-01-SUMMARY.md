---
phase: 03-section-standards
plan: 01
subsystem: templates
tags: [ats, i18n, section-names, templates]
dependency_graph:
  requires: [01-01, 01-02, 02-01]
  provides: [getSectionTitle, SectionKey, language-prop-threading]
  affects: [TemplateA, TemplateB, TemplateC, TemplateD, TemplateE, TemplateF, CVRenderer, EditorPage]
tech_stack:
  added: []
  patterns: [getSectionTitle lookup function, language prop threading through component tree]
key_files:
  created: []
  modified:
    - src/features/editor/lib/atsRules.ts
    - src/features/editor/lib/atsRules.test.ts
    - src/features/editor/templates/shared.tsx
    - src/pages/EditorPage.tsx
    - src/features/editor/templates/TemplateA.tsx
    - src/features/editor/templates/TemplateB.tsx
    - src/features/editor/templates/TemplateC.tsx
    - src/features/editor/templates/TemplateD.tsx
    - src/features/editor/templates/TemplateE.tsx
    - src/features/editor/templates/TemplateF.tsx
decisions:
  - getSectionTitle as simple lookup into SECTION_NAMES constant, no caching needed
  - language prop threaded via TemplateProps interface (CVRenderer spreads it automatically)
metrics:
  duration_seconds: 331
  completed: "2026-04-09T10:56:11Z"
  tasks: 2
  files: 10
---

# Phase 03 Plan 01: Section Standards Summary

Dynamic getSectionTitle() utility replaces 32 hardcoded French section names across 6 CV templates with ATS-standard bilingual titles driven by getCVLanguage()

## What Was Done

### Task 1: Add getSectionTitle() and thread language prop (TDD)

- **RED:** Added test suite for getSectionTitle covering all 6 section keys in both FR and EN
- **GREEN:** Implemented getSectionTitle(key, language) and SectionKey type in atsRules.ts
- Added `language: SupportedLanguage` to TemplateProps interface in shared.tsx
- Updated EditorPage to pass `language={currentLanguage}` to CVRendererComponent
- CVRenderer required no changes (spread operator already forwards all TemplateProps)
- Commit: `5f5a4d5`

### Task 2: Replace 32 hardcoded section names in all 6 templates

- Added `import { getSectionTitle } from '../lib/atsRules'` to all 6 templates
- Destructured `language` from props in all 6 template functions
- Replaced all hardcoded section title strings with getSectionTitle() calls:
  - TemplateA: 5 replacements (experience, summary, skills, education, languages)
  - TemplateB: 6 replacements (summary, contact, languages, skills/Expertise, experience, education)
  - TemplateC: 5 replacements (summary, experience, skills, education, languages)
  - TemplateD: 5 replacements (summary, experience, skills, education, languages)
  - TemplateE: 5 replacements (summary, experience, skills, education, languages)
  - TemplateF: 6 replacements (contact, skills, education, languages, summary, experience)
- TemplateB "Expertise" normalized to standard "Competences"/"Skills"
- Commit: `cb476af`

## Verification Results

- `npx vitest run` -- 77 tests pass (6 test files)
- `npx tsc --noEmit` -- clean, zero type errors
- `npx vite build` -- successful build
- `grep` for hardcoded French section names in Template*.tsx -- zero matches

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all section titles are fully wired to getSectionTitle() with real data from SECTION_NAMES.

## Self-Check: PASSED

- All 10 modified files exist on disk
- Commit 5f5a4d5 found in git history
- Commit cb476af found in git history
