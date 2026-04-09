---
phase: 10-pdf-validation
plan: 01
subsystem: pdf-export
tags: [pdf, ats, validation, text-extraction]
dependency_graph:
  requires: []
  provides: [pdf-text-validation, extractability-warning]
  affects: [pdfExport, EditorPage]
tech_stack:
  added: []
  patterns: [token-ratio-comparison, validation-callback]
key_files:
  created:
    - src/features/editor/lib/pdfValidation.ts
    - src/features/editor/lib/pdfValidation.test.ts
  modified:
    - src/features/editor/lib/pdfExport.ts
    - src/pages/EditorPage.tsx
decisions:
  - Token-ratio comparison (word count) as extractability metric
  - 60% threshold for valid/invalid boundary
  - Non-blocking validation (print dialog opens regardless of result)
  - ValidationResult passed via callback pattern to decouple validation from export
metrics:
  duration: ~4min
  completed: 2026-04-09
  tasks: 2
  files: 4
requirements: [PDFV-01, PDFV-02]
---

# Phase 10 Plan 01: PDF Text Extractability Validation Summary

PDF text extractability validation via token-ratio comparison with 60% threshold, wired as non-blocking callback in renderPDF export flow.

## What Was Done

### Task 1: pdfValidation utility with tests (TDD)

Created `src/features/editor/lib/pdfValidation.ts` (121 lines) with two exported functions:

- `extractExpectedText(cvData)` - Builds plain-text representation of CV content, skipping hidden experiences and hidden skill categories
- `validateCVTextExtractability(renderedText, expectedText)` - Compares token counts with 60% threshold, returns `{ valid, ratio, warning? }`

9 unit tests covering: full CVData extraction, empty CVData, hidden experience/skill skipping, valid ratio, invalid ratio with warning, zero-text warning, empty expected text edge case, exact threshold boundary.

**Commit:** 263ffd3

### Task 2: Wire validation into pdfExport and EditorPage

Extended `renderPDF` signature with optional `RenderPDFOptions { expectedText?, onValidation? }`. Inside `iframe.onload`, extracts `doc.body.innerText` and runs validation before the print timeout fires.

Updated both `handleDownloadPDF` and `handlePreviewPDF` in EditorPage to pass `extractExpectedText(cvData)` and a callback that triggers `notify({ type: 'error' })` when validation fails.

**Commit:** 13c178b

## Verification Results

- 9/9 unit tests pass
- `tsc --noEmit` passes (zero type errors)
- `vite build` succeeds
- Backward compatible: existing callers without options behave identically

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is fully wired.

## Self-Check: PASSED
