# Phase 11: PDF Export Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 11-pdf-export-engine
**Areas discussed:** Architecture serveur, Serialisation HTML, Gestion des polices, UX d'export
**Mode:** Auto (all decisions auto-selected from recommended defaults)

---

## Architecture serveur

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel Serverless + @sparticuz/chromium | Same project, zero infra, free tier | ✓ |
| Playwright on Cloud Run | Separate Docker service, faster warm starts | |
| @react-pdf/renderer (client-side) | Zero server but requires full template rewrite | |

**User's choice:** Vercel Serverless (auto-selected: recommended default)
**Notes:** User constraint: must be free. Vercel Hobby plan is sufficient. No template rewriting needed.

---

## Serialisation HTML

| Option | Description | Selected |
|--------|-------------|----------|
| HTML + collected stylesheets | Reuse existing pdfExport.ts collection logic | ✓ |
| Screenshot-based (html2canvas) | Captures pixels but loses text (ATS-incompatible) | |
| React-pdf DSL | Requires rewriting templates in different component API | |

**User's choice:** HTML + collected stylesheets (auto-selected: recommended default)
**Notes:** Leverages existing code from pdfExport.ts lines 37-46.

---

## Gestion des polices

| Option | Description | Selected |
|--------|-------------|----------|
| Include font declarations in payload | Chrome headless fetches fonts via URLs | ✓ |
| Pre-install fonts in Docker | Only viable for Cloud Run, not Vercel Serverless | |
| Convert to base64 inline | Increases payload size, unnecessary if URLs accessible | |

**User's choice:** Include font declarations (auto-selected: recommended default)
**Notes:** waitUntil: networkidle0 ensures fonts load before PDF generation.

---

## UX d'export

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner + fallback to window.print() | User never blocked, graceful degradation | ✓ |
| Spinner only (no fallback) | Simpler but user stuck if server fails | |
| Background generation + notification | More complex, unnecessary for 1-3s operation | |

**User's choice:** Spinner + fallback (auto-selected: recommended default)
**Notes:** Fallback ensures zero downtime even if serverless function fails.

---

## Claude's Discretion

- Error message wording and toast styling
- Progress animation design
- Code structure (new file vs refactor)
- Whether old window.print() stays as user option or only fallback

## Deferred Ideas

- Cloud Run migration if cold starts become problematic
- PDF/A compliance for enterprise
- Custom filename from candidate name
- Batch PDF export from dashboard
