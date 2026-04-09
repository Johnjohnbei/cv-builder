---
phase: 02-language-detection
plan: 01
subsystem: language-detection
tags: [franc-min, language-detection, i18n, react]

requires:
  - phase: 01-ats-scoring-foundation
    provides: scoring utilities and CVData type foundation

provides:
  - detectCVLanguage() utility for FR/EN detection via franc-min
  - getCVLanguage() resolution function (override > detected > default)
  - extractCVText() text extraction for detection input
  - CVData extended with detectedLanguage and languageOverride fields
  - Convex schema updated with optional language fields
  - LanguageSelector UI component in EditorHeader
  - Detection wired into DashboardPage import pipeline

affects: [section-standards, ats-scoring, ai-optimization]

tech-stack:
  added: [franc-min]
  patterns: [client-side language detection, language override pattern]

key-files:
  created:
    - src/lib/languageDetection.ts
    - src/lib/languageDetection.test.ts
    - src/features/editor/components/LanguageSelector.tsx
  modified:
    - src/shared/types/index.ts
    - convex/schema.ts
    - src/pages/DashboardPage.tsx
    - src/pages/EditorPage.tsx
    - src/features/editor/components/EditorHeader.tsx
    - src/features/editor/components/index.ts

key-decisions:
  - "franc-min for client-side detection with only fra/eng to minimize bundle"
  - "Default to French when text < 20 chars or detection undetermined"
  - "Language override stored on CVData, not in separate state"

patterns-established:
  - "Language resolution: override > detected > 'fr' default"
  - "Detection at import time, not on every keystroke"

requirements-completed: [LANG-01, LANG-02, LANG-03]

duration: 4min
completed: 2026-04-09
---

# Phase 02 Plan 01: Language Detection Summary

**Client-side FR/EN language detection using franc-min with manual override toggle and import pipeline integration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T10:35:23Z
- **Completed:** 2026-04-09T10:39:03Z
- **Tasks:** 2/2
- **Files modified:** 10

## Accomplishments

### Task 1: Language detection utility with TDD (2040e74)
- Installed franc-min for client-side FR/EN detection
- Extended CVData interface with `detectedLanguage` and `languageOverride` optional fields
- Updated Convex cvs table schema with optional language string fields
- Created `detectCVLanguage()` using franc with ISO 639-3 mapping (fra/eng)
- Created `getCVLanguage()` with override > detected > 'fr' resolution
- Created `extractCVText()` to concatenate CV fields for detection input
- Wrote 10 unit tests covering all detection and resolution behaviors

### Task 2: Import wiring and LanguageSelector UI (34ffb46)
- Created LanguageSelector component matching EditorHeader toolbar style (FR/EN toggle)
- Wired `detectCVLanguage()` into DashboardPage PDF/AI import flow
- Set `detectedLanguage: 'fr'` default for empty CV creation
- Added LanguageSelector to EditorHeader center toolbar with border separator
- Wired EditorPage with `getCVLanguage()` computation and `languageOverride` handler
- Exported LanguageSelector from components barrel

## Verification

- All 60 tests pass (10 new language detection + 50 existing)
- TypeScript compiles with zero errors
- Production build succeeds (franc-min bundled as languageDetection chunk ~110KB)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is fully wired.

## Self-Check: PASSED

- All 3 created files exist on disk
- Both task commits (2040e74, 34ffb46) verified in git log
