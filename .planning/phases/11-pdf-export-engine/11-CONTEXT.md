# Phase 11: PDF Export Engine - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current `window.print()` PDF export with a Puppeteer headless Chrome endpoint on Vercel Serverless. The user clicks "Download PDF" and receives a direct file download — no print dialog. The PDF must have selectable text (ATS-compatible), reliable page breaks, and pixel-perfect rendering matching the editor preview.

</domain>

<decisions>
## Implementation Decisions

### Server Architecture
- **D-01:** Use Vercel Serverless Function with `@sparticuz/chromium` + `puppeteer-core` — lives in the existing Vercel project, zero additional infrastructure, free on Hobby plan
- **D-02:** Endpoint path: `/api/generate-pdf` (POST) — receives HTML + styles, returns PDF blob
- **D-03:** Serverless function config: `maxDuration: 30` (30s timeout), `memory: 1024` (1GB for Chromium)

### HTML Serialization
- **D-04:** Client serializes the CV HTML (`cvElement.outerHTML`) + collected stylesheets (reuse existing pattern from `pdfExport.ts` that copies link tags and inline CSSRules)
- **D-05:** Send as JSON payload: `{ html, styles, pageLimit, designSettings }` — keep it simple
- **D-06:** Server wraps HTML in a full document with `@page` rules, `break-inside: avoid` on `[data-cv-block]`, and `print-color-adjust: exact`

### Font Handling
- **D-07:** Include font-face declarations and external font link tags in the serialized styles — headless Chrome will fetch them
- **D-08:** Playwright/Puppeteer `waitUntil: 'networkidle0'` ensures fonts are loaded before PDF generation

### PDF Generation
- **D-09:** Use `page.pdf()` with: `format: 'A4'`, `printBackground: true`, `preferCSSPageSize: true`, zero margins (margins are in the CV template itself)
- **D-10:** Viewport set to 794x1123 (A4 at 96 DPI) to match the editor's CV_WIDTH_PX constant

### UX & Error Handling
- **D-11:** Show a loading spinner with "Generating PDF..." message during generation
- **D-12:** On success: trigger browser download via blob URL + `<a>` click with filename `CV_[name]_[date].pdf`
- **D-13:** On server error: fall back to `window.print()` with a toast explaining the fallback — the user must never be blocked
- **D-14:** Keep the existing `pdfValidation.ts` validation — run it on the client before sending to server (DOM pre-check)

### Claude's Discretion
- Exact error message wording and toast styling
- Whether to add a "generating" progress animation or simple spinner
- Internal code structure (new file vs refactor existing pdfExport.ts)
- Whether to preserve the old window.print() as a user-accessible option or only as fallback

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current PDF System
- `src/features/editor/lib/pdfExport.ts` — Current window.print() implementation to replace
- `src/features/editor/lib/pdfValidation.ts` — Text extractability validation to preserve
- `src/index.css` (lines 183-256) — Print CSS rules and pdf-safe class

### CV Rendering
- `src/features/editor/templates/CVRenderer.tsx` — Template dispatcher with data-cv-block/data-cv-section attributes
- `src/features/editor/templates/shared.tsx` — Shared rendering helpers
- `src/features/editor/hooks/useAutoZoom.ts` — CV_WIDTH_PX = 794 constant

### Integration
- `src/pages/EditorPage.tsx` — Export trigger location, cvRef, designSettings state
- `vercel.json` — Current Vercel config (rewrites only, no API routes yet)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pdfExport.ts` stylesheet collection logic (lines 37-46) — reuse for serialization
- `pdfValidation.ts` — keep as pre-export DOM validation
- `data-cv-block` / `data-cv-section` attributes on all templates — drive page break rules
- `CV_WIDTH_PX = 794` in useAutoZoom.ts — viewport width for server
- Existing notify() pattern for user feedback

### Established Patterns
- All templates use `className="w-full h-full bg-white pdf-safe"` as root
- Templates use CSS variables `--primary` / `--secondary` for dynamic colors
- DesignSettings type carries pageLimit, colors, fonts, atsMode
- file-saver package already installed for browser downloads

### Integration Points
- `EditorPage.tsx` calls `renderPDF(cvRef.current, designSettings, options)` — replace this call
- `vercel.json` needs no change — API routes are auto-detected from `api/` folder
- `package.json` needs `puppeteer-core` and `@sparticuz/chromium` as dependencies

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants NO print dialog — direct download is the primary UX change
- User wants this to be free — Vercel Serverless free tier is sufficient
- The solution was chosen specifically because it requires ZERO template rewriting — headless Chrome renders the exact same HTML/CSS
- ATS text extractability is critical — Chrome's native PDF engine produces real text layers

</specifics>

<deferred>
## Deferred Ideas

- **Cloud Run migration** — If cold starts become unacceptable or Vercel timeout limits are hit, migrate to Playwright on Cloud Run (same architecture, different host)
- **PDF/A compliance** — Archival format compliance for government/enterprise applications
- **Custom filename from CV data** — Pull the candidate's name from cvData.personalInfo for the filename
- **Batch PDF export** — Generate multiple CVs at once from dashboard

</deferred>

---

*Phase: 11-pdf-export-engine*
*Context gathered: 2026-04-10 via auto discuss*
