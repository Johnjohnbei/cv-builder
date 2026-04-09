# Phase 10: PDF Validation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Infrastructure-like phase — minimal discuss

<domain>
## Phase Boundary

After PDF export via window.print(), validate that the exported text is extractable using pdfjs-dist (already installed). If text extraction fails or is significantly degraded, show a clear warning to the user.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — this is a focused technical phase with clear success criteria:
1. Validate PDF text extractability post-export using pdfjs-dist
2. Show warning notification if text extraction fails or is degraded
- pdfjs-dist is already installed and used for PDF import (src/lib/pdfTextExtract.ts)
- Reuse the existing extraction function or create a validation wrapper
- Trigger validation after the print dialog closes (or after PDF generation)
- Degradation threshold: compare extracted text length to expected CV text length
- Warning via existing notify() pattern

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/pdfTextExtract.ts` — existing PDF text extraction using pdfjs-dist
- `src/features/editor/lib/pdfExport.ts` — current PDF export via hidden iframe + print dialog
- notify() for user-facing notifications

### Integration Points
- `src/features/editor/lib/pdfExport.ts` — add validation after export
- `src/pages/EditorPage.tsx` — wire validation results to notification

</code_context>

<specifics>
## Specific Ideas

No specific requirements — clear success criteria from ROADMAP.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 10-pdf-validation*
*Context gathered: 2026-04-09 via smart discuss (autonomous)*
