---
phase: 11-pdf-export-engine
plan: 01
subsystem: pdf-export
tags: [pdf, serverless, puppeteer, vercel]
dependency_graph:
  requires: []
  provides: ["/api/generate-pdf POST endpoint", "puppeteer-core dependency", "api/ infrastructure"]
  affects: ["vercel.json", "package.json"]
tech_stack:
  added: ["puppeteer-core@24", "@sparticuz/chromium@143", "puppeteer@24 (dev)"]
  patterns: ["Vercel Web Standard function signature", "headless Chrome PDF generation", "process.env.VERCEL branch for local/prod"]
key_files:
  created:
    - api/generate-pdf.ts
    - api/tsconfig.json
  modified:
    - vercel.json
    - package.json
    - package-lock.json
decisions:
  - "Used Vercel Web Standard API (export async function POST) instead of legacy req/res pattern"
  - "Viewport 794x1123px matches A4 at 96 DPI for pixel-perfect rendering"
  - "wrapHtml places @page margin:0 AFTER serialized styles to override index.css @page margin:5mm"
metrics:
  duration: "2m 15s"
  completed: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 11 Plan 01: Serverless PDF Generation Endpoint Summary

Vercel serverless function using puppeteer-core + @sparticuz/chromium that accepts serialized CV HTML+CSS and returns an A4 PDF with selectable text, correct page breaks, and zero margins.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Install dependencies and configure infrastructure | 2c3e4ee | Done |
| 2 | Create Vercel Serverless PDF generation endpoint | e38bbbd | Done |

## What Was Built

### api/generate-pdf.ts
- **POST handler** with Vercel Web Standard signature (`export async function POST`)
- **Payload validation**: Content-Type check, JSON parse, structure validation (html+styles as non-empty strings, pageLimit 1-4), 2MB size limit (413 response)
- **wrapHtml()**: Wraps CV HTML+styles in full document with `@page { size: A4 portrait; margin: 0 !important }` placed AFTER serialized styles to override any existing `@page` rules
- **Page break CSS**: `[data-cv-block] break-inside: avoid`, `[data-cv-section] > h2 break-after: avoid`, `[data-cv-block] li break-inside: avoid` -- matches pdfExport.ts pattern exactly
- **getBrowser()**: Uses `process.env.VERCEL` to branch between `@sparticuz/chromium` (production) and full `puppeteer` (local dev)
- **Viewport**: 794x1123px (A4 at 96 DPI)
- **Font safety**: `waitUntil: 'networkidle0'` + `document.fonts.ready`
- **PDF options**: `format: 'A4'`, `printBackground: true`, `preferCSSPageSize: true`, zero margins
- **Error handling**: Generic "PDF generation failed" response (no internal details leaked), `browser.close()` in `finally` block

### Infrastructure
- **api/tsconfig.json**: Node.js config with `lib: ["ES2022"]` (no DOM), `moduleResolution: "bundler"`
- **vercel.json**: Added `functions` config with `maxDuration: 30` for the endpoint
- **Dependencies**: `puppeteer-core` and `@sparticuz/chromium` in production deps, `puppeteer` in devDeps

## Decisions Made

1. **Vercel Web Standard API**: Used `export async function POST(request: Request)` instead of legacy `(req, res)` pattern -- cleaner, better typed, aligns with modern Vercel conventions
2. **Viewport 794x1123**: A4 dimensions at 96 DPI, matching the existing `CV_WIDTH_PX` constant for pixel-perfect rendering
3. **Style override ordering**: `@page { margin: 0 !important }` placed AFTER `${styles}` in wrapHtml to override the existing `@page { margin: 5mm }` from index.css (Pitfall 6 from research)

## Deviations from Plan

None - plan executed exactly as written.

## Security Mitigations (Threat Model)

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-11-02 DoS via large payload | 2MB custom limit + Vercel 4.5MB hard limit + maxDuration: 30s | Implemented |
| T-11-03 DoS via browser leak | `browser.close()` in `finally` block | Implemented |
| T-11-05 Info disclosure | Generic error message, no stack traces | Implemented |

## Self-Check: PASSED

- [x] api/generate-pdf.ts exists
- [x] api/tsconfig.json exists
- [x] Commit 2c3e4ee found
- [x] Commit e38bbbd found
