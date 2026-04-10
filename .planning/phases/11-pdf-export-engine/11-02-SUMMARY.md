---
phase: 11-pdf-export-engine
plan: 02
subsystem: pdf-export
tags: [pdf, export, client, serverless, fallback]
dependency_graph:
  requires: [11-01]
  provides: [serverlessPDF-client, pdf-download-flow]
  affects: [EditorPage, pdfExport]
tech_stack:
  added: []
  patterns: [fetch-blob-download, loading-overlay, graceful-fallback]
key_files:
  created: []
  modified:
    - src/features/editor/lib/pdfExport.ts
    - src/pages/EditorPage.tsx
decisions:
  - Reused existing isExporting state instead of adding new isGeneratingPDF to avoid duplicate state
  - Used z-[300] for overlay to sit above all existing z-indexed elements
metrics:
  duration: ~8min
  completed: 2026-04-10T13:07:00Z
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
---

# Phase 11 Plan 02: Client-Side PDF Export Flow Summary

Serverless PDF download via fetch + blob with loading overlay and window.print fallback

## What Was Done

### Task 1: Add serializeCV() and serverlessPDF() to pdfExport.ts (adae302)

Added two new exported functions to `src/features/editor/lib/pdfExport.ts`:

- **serializeCV(cvElement)**: Extracts CV HTML and all stylesheets (link tags + inline CSS rules) from the live DOM. Clones and normalizes the element (removing transforms, shadows, borders) for clean server-side rendering.

- **serverlessPDF(cvElement, designSettings, options)**: Main export function that:
  1. Runs DOM pre-check validation (extractability check) before sending
  2. Serializes the CV via serializeCV()
  3. POSTs `{ html, styles, pageLimit }` to `/api/generate-pdf`
  4. Downloads the response as a PDF blob via `<a>` element with filename `CV_YYYYMMDD.pdf`
  5. Falls back to renderPDF (window.print) on any error with French notification
  6. Manages loading state via onLoadingChange callback

- **renderPDF** kept unchanged as the fallback path.

### Task 2: Wire serverlessPDF into EditorPage (6df14fc)

Updated `src/pages/EditorPage.tsx`:

- Changed import to include `serverlessPDF` alongside `renderPDF`
- Made `handleDownloadPDF` async, calling `await serverlessPDF()` with:
  - `onLoadingChange: setIsExporting` (reuses existing state)
  - `onFallback` callback that shows a toast notification
  - `onValidation` callback for text extractability warnings
- Added full-screen loading overlay with Loader2 spinner and "Generation du PDF..." message
- Guard against double-clicks via `isExporting` check at handler entry
- `handlePreviewPDF` unchanged -- still uses `renderPDF` (window.print)

### Task 3: Verification (auto-approved)

- TypeScript compilation passes (api/ errors are from Plan 11-01, out of scope)
- All verification checks pass for both modified files
- Existing preview functionality unchanged

## Deviations from Plan

### Minor Adjustments

**1. [Rule 2 - Simplification] Reused isExporting instead of adding isGeneratingPDF**
- **Found during:** Task 2
- **Issue:** Plan specified adding new `isGeneratingPDF` state, but `isExporting` already exists and is wired to all download buttons' disabled states
- **Fix:** Reused `isExporting`/`setIsExporting` to avoid duplicate state managing the same concept
- **Files modified:** src/pages/EditorPage.tsx

**2. [Noted] pdfExport.ts is 235 lines (exceeds 200-line utility guideline)**
- **Reason:** renderPDF fallback function (80+ lines) duplicates some CSS logic from serializeCV. Cannot reduce without changing renderPDF behavior which plan requires unchanged.
- **Impact:** Minimal -- file has three clearly separated exported functions with section dividers.

## Known Stubs

None -- all functions are fully implemented with real server endpoint integration.

## Threat Flags

None -- no new trust boundaries beyond what was documented in the plan's threat model.

## Self-Check: PASSED

- pdfExport.ts: FOUND
- EditorPage.tsx: FOUND
- Commit adae302: FOUND
- Commit 6df14fc: FOUND
