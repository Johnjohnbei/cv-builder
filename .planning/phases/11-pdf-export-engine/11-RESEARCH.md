# Phase 11: PDF Export Engine - Research

**Researched:** 2026-04-10
**Domain:** Serverless PDF generation with headless Chrome on Vercel
**Confidence:** HIGH

## Summary

This phase replaces the current `window.print()` PDF export with a Vercel Serverless Function running Puppeteer headless Chrome. The approach uses `puppeteer-core` + `@sparticuz/chromium` to generate PDFs server-side, returning a direct blob download to the user -- no print dialog.

The architecture is well-proven: the `api/generate-pdf.ts` endpoint receives serialized HTML+CSS from the client, launches headless Chrome in the serverless environment, renders the document, and returns the PDF binary. Vercel's 250MB uncompressed bundle limit accommodates `@sparticuz/chromium` (~55MB compressed). The Hobby plan provides 2GB memory and up to 300s max duration, both sufficient for PDF generation (typical generation takes 5-15 seconds).

**Primary recommendation:** Use `@sparticuz/chromium` (not `chromium-min`) as the full package fits within Vercel's 250MB limit, avoiding the complexity of self-hosting the Chromium binary. Use the modern Vercel Web Standard function signature (`export function POST(request: Request)`) in `api/generate-pdf.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Vercel Serverless Function with `@sparticuz/chromium` + `puppeteer-core`
- **D-02:** Endpoint path: `/api/generate-pdf` (POST)
- **D-03:** Serverless function config: `maxDuration: 30` (30s timeout), `memory: 1024` (1GB for Chromium) -- NOTE: Hobby plan memory is fixed at 2GB/1vCPU and cannot be configured, so memory config is ignored but harmless
- **D-04:** Client serializes CV HTML (`cvElement.outerHTML`) + collected stylesheets
- **D-05:** JSON payload: `{ html, styles, pageLimit, designSettings }`
- **D-06:** Server wraps HTML with `@page` rules, `break-inside: avoid` on `[data-cv-block]`, `print-color-adjust: exact`
- **D-07:** Include font-face declarations and external font link tags in serialized styles
- **D-08:** Use `waitUntil: 'networkidle0'` to ensure fonts are loaded
- **D-09:** `page.pdf()` with: `format: 'A4'`, `printBackground: true`, `preferCSSPageSize: true`, zero margins
- **D-10:** Viewport 794x1123 (A4 at 96 DPI)
- **D-11:** Loading spinner with "Generating PDF..." message
- **D-12:** Download via blob URL + `<a>` click with filename `CV_[name]_[date].pdf`
- **D-13:** On server error: fall back to `window.print()` with toast
- **D-14:** Keep existing `pdfValidation.ts` -- run on client before sending

### Claude's Discretion
- Exact error message wording and toast styling
- Whether to add a "generating" progress animation or simple spinner
- Internal code structure (new file vs refactor existing pdfExport.ts)
- Whether to preserve the old window.print() as a user-accessible option or only as fallback

### Deferred Ideas (OUT OF SCOPE)
- Cloud Run migration
- PDF/A compliance
- Custom filename from CV data (pulling name from cvData.personalInfo)
- Batch PDF export
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDFX-01 | User clicks "Download PDF" and receives a direct file download -- no print dialog | Blob download pattern via fetch + URL.createObjectURL, serverless PDF generation endpoint |
| PDFX-02 | Generated PDF has selectable, extractable text (ATS-compatible) | Chrome's native PDF engine produces real text layers; existing pdfValidation.ts validates this |
| PDFX-03 | Page breaks never cut mid-block | CSS `break-inside: avoid` on `[data-cv-block]` + `break-after: avoid` on section headers, replicated in server-side HTML wrapper |
| PDFX-04 | PDF rendering matches the editor preview exactly | Same HTML/CSS rendered in headless Chrome at same viewport (794px); `printBackground: true` preserves colors |
| PDFX-05 | Multi-page CVs (1-3 pages) render correctly with proper margins | `page.pdf()` with `format: 'A4'`, zero margins (margins in template), `preferCSSPageSize: true` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack**: React 18 + Vite + Convex + Clerk -- no migration
- **Performance**: Score calculations real-time, PDF generation can be async (loading state acceptable)
- **Simplicity**: Merge and simplify, don't add complexity
- **File size limits**: Max 300 lines for services, 200 for utilities, 150 for hooks
- **Immutability**: Always return new objects, never mutate
- **Error handling**: Try-catch with `notify()` for user-facing errors, French fallback messages
- **No console.log**: Only `console.error` in catch blocks
- **Naming**: camelCase for functions/hooks, PascalCase for types/components
- **Testing**: Vitest is available but no coverage threshold enforced for this phase

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| puppeteer-core | 24.40.0 | Headless Chrome control (no bundled browser) | Lightweight Puppeteer without Chromium binary; pairs with @sparticuz/chromium for serverless [VERIFIED: npm registry] |
| @sparticuz/chromium | 143.0.4 | Serverless-optimized Chromium binary | De facto standard for headless Chrome on serverless platforms (AWS Lambda, Vercel) [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| puppeteer | 24.40.0 | Local development (full Chrome) | Dev dependency only -- for local testing without @sparticuz/chromium [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @sparticuz/chromium | @sparticuz/chromium-min | Smaller bundle but requires self-hosting Chromium binary externally; not needed since full package fits in 250MB limit |
| puppeteer-core | playwright | Equivalent capability but heavier; puppeteer has better serverless ecosystem support |

**Installation:**
```bash
npm install puppeteer-core@^24.40.0 @sparticuz/chromium@^143.0.4
npm install --save-dev puppeteer@^24.40.0
```

**Version verification:** [VERIFIED: npm registry 2026-04-10]
- puppeteer-core: 24.40.0 (latest)
- @sparticuz/chromium: 143.0.4 (latest)
- puppeteer: 24.40.0 (latest, dev only)

**Version compatibility note:** `@sparticuz/chromium` follows the Chromium major version numbering. Version 143.x includes Chromium 143, which is compatible with puppeteer-core 24.x. The compatibility matrix maps Chromium versions to Puppeteer versions via the Puppeteer supported-browsers page. [ASSUMED]

## Architecture Patterns

### Recommended Project Structure
```
api/
  generate-pdf.ts       # Vercel Serverless Function (POST endpoint)
src/
  features/
    editor/
      lib/
        pdfExport.ts    # Refactored: new serverlessPDF() + legacy renderPDF() as fallback
        pdfValidation.ts # Unchanged: DOM pre-check before export
```

### Pattern 1: Vercel Serverless Function (Web Standard Signature)
**What:** Non-Next.js Vercel functions use the Web Standard `Request`/`Response` API
**When to use:** Any `api/*.ts` file in a Vite project deployed to Vercel
**Example:**
```typescript
// Source: https://vercel.com/docs/functions/functions-api-reference
// File: api/generate-pdf.ts

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function POST(request: Request): Promise<Response> {
  const { html, styles, pageLimit } = await request.json();

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 794, height: 1123 },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  const fullHtml = wrapHtml(html, styles, pageLimit);
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="cv.pdf"',
    },
  });
}
```
[CITED: https://vercel.com/docs/functions/functions-api-reference]

### Pattern 2: Client-Side Blob Download
**What:** Fetch PDF binary from API, create blob URL, trigger download
**When to use:** After receiving PDF response from serverless function
**Example:**
```typescript
// Client-side download trigger
async function downloadPDF(html: string, styles: string, pageLimit: number): Promise<void> {
  const response = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, styles, pageLimit }),
  });

  if (!response.ok) throw new Error(`PDF generation failed: ${response.status}`);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CV_${formatDate()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```
[ASSUMED]

### Pattern 3: HTML Serialization from Client
**What:** Extract CV HTML + all stylesheets from the live DOM
**When to use:** Before sending to the serverless function
**Example:**
```typescript
// Reuses existing pattern from pdfExport.ts lines 37-46
function serializeCV(cvElement: HTMLElement): { html: string; styles: string } {
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(link => link.outerHTML)
    .join('\n');

  const inlineStyles = Array.from(document.styleSheets)
    .map(sheet => {
      try { return Array.from(sheet.cssRules).map(r => r.cssText).join('\n'); }
      catch { return ''; }
    })
    .join('\n');

  const clone = cvElement.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.width = '210mm';

  return {
    html: clone.outerHTML,
    styles: `${styleLinks}\n<style>${inlineStyles}</style>`,
  };
}
```
[VERIFIED: existing pdfExport.ts code]

### Pattern 4: Environment-Based Browser Launch
**What:** Use @sparticuz/chromium in production, full puppeteer locally
**When to use:** In the serverless function to support both local dev and production
**Example:**
```typescript
// Source: https://gist.github.com/kettanaito/56861aff96e6debc575d522dd03e5725
async function getBrowser() {
  if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    const puppeteer = (await import('puppeteer')).default;
    return puppeteer.launch({ headless: true });
  }
}
```
[CITED: https://gist.github.com/kettanaito/56861aff96e6debc575d522dd03e5725]

### Anti-Patterns to Avoid
- **Bundling full `puppeteer` in production:** Includes Chromium (~400MB), blows past Vercel limits. Use `puppeteer-core` + `@sparticuz/chromium`.
- **Not closing the browser:** Always `await browser.close()` in a `finally` block. Leaked Chrome processes consume memory across invocations.
- **Using `waitUntil: 'load'` instead of `'networkidle0'`:** External fonts may not be loaded yet, causing missing text in PDF.
- **Sending CSS as raw text without link tags:** External stylesheets (Google Fonts, Tailwind CDN) need `<link>` tags so Chrome can fetch them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom canvas/SVG to PDF | puppeteer-core page.pdf() | Chrome's PDF engine handles CSS perfectly -- page breaks, colors, fonts, columns |
| Serverless Chromium | Download/compile Chrome at runtime | @sparticuz/chromium | Pre-compiled, pre-configured for serverless constraints (no /tmp, limited memory) |
| Browser download trigger | Custom download logic | Blob URL + `<a>` element click | Browser-native pattern, works cross-browser, no library needed |
| Page break CSS | JavaScript-based page splitting | CSS break-inside/break-after rules | Chrome's PDF engine natively respects CSS page break rules |

**Key insight:** The entire value proposition of this phase is that headless Chrome renders the exact same HTML/CSS as the editor preview. Zero template rewriting needed -- the server receives the same DOM the user sees.

## Common Pitfalls

### Pitfall 1: Vercel Request Body Size Limit (4.5MB)
**What goes wrong:** Large CVs with many inline styles (especially Tailwind v4 generated CSS) can exceed the 4.5MB payload limit.
**Why it happens:** `Array.from(document.styleSheets)` copies ALL CSS rules from ALL stylesheets, including unused Tailwind utilities.
**How to avoid:** Filter serialized CSS to only include rules that match elements in the CV DOM. If still too large, consider compressing the payload with gzip or sending only the stylesheet URLs (not inline rules) for Chrome to fetch directly.
**Warning signs:** 413 `FUNCTION_PAYLOAD_TOO_LARGE` error from Vercel.
[CITED: https://vercel.com/docs/functions/limitations]

### Pitfall 2: Cold Start Latency
**What goes wrong:** First PDF generation after deployment takes 8-15 seconds due to Chromium binary decompression.
**Why it happens:** @sparticuz/chromium decompresses the Brotli-compressed Chromium binary on first invocation.
**How to avoid:** Accept cold starts as unavoidable on Hobby plan (no provisioned concurrency). Show clear loading state. Consider warm-up requests if UX is critical.
**Warning signs:** First request takes 10-15s, subsequent requests take 3-8s.
[ASSUMED]

### Pitfall 3: Font Loading in Headless Chrome
**What goes wrong:** PDF renders with fallback fonts instead of the CV's chosen fonts.
**Why it happens:** `networkidle0` may timeout before all font files download, especially for Google Fonts.
**How to avoid:** Include font `<link>` tags in the serialized HTML so Chrome fetches them. Use `waitUntil: 'networkidle0'` (waits until no network activity for 500ms). As backup, add explicit `page.waitForFunction` checking `document.fonts.ready`.
**Warning signs:** PDF text appears in Arial/serif instead of the expected font.
[ASSUMED]

### Pitfall 4: vercel.json Rewrite Catching API Routes
**What goes wrong:** The catch-all rewrite `{ "source": "/(.*)", "destination": "/index.html" }` intercepts `/api/generate-pdf`.
**Why it happens:** Rewrites apply to all routes unless API routes are excluded.
**How to avoid:** Vercel automatically prioritizes `api/` directory functions over rewrites. No change to vercel.json needed -- API routes in the `api/` directory take precedence over filesystem rewrites.
**Warning signs:** API endpoint returns HTML instead of PDF.
[CITED: https://vercel.com/docs/functions]

### Pitfall 5: TypeScript Configuration for API Directory
**What goes wrong:** `api/generate-pdf.ts` fails to compile because it uses Node.js APIs not available in the browser tsconfig.
**Why it happens:** The project's tsconfig targets browser (`DOM` lib, `bundler` moduleResolution) but serverless functions need Node.js types.
**How to avoid:** Either: (a) add a separate `api/tsconfig.json` for the serverless function, or (b) use `// @ts-nocheck` since Vercel compiles API functions independently. Recommended: separate tsconfig.
**Warning signs:** `tsc --noEmit` errors on `api/generate-pdf.ts`.
[VERIFIED: project tsconfig.json uses DOM lib and bundler moduleResolution]

### Pitfall 6: PDF Margins Doubling
**What goes wrong:** PDF has unwanted margins because both `@page` margin and template internal padding are applied.
**Why it happens:** The server-side HTML wrapper adds `@page { margin: 0 }` but if the existing print CSS from `index.css` (`@page { margin: 5mm }`) is included in serialized styles, it conflicts.
**How to avoid:** In the server-side HTML wrapper, explicitly set `@page { margin: 0 !important }` AFTER the serialized styles. Or strip the `@media print` block from serialized CSS since the server controls print styling.
**Warning signs:** PDF has extra whitespace around edges, content area is smaller than expected.
[VERIFIED: src/index.css line 229 has @page { margin: 5mm }]

## Code Examples

### Complete Server-Side HTML Wrapper
```typescript
// Source: derived from existing pdfExport.ts + CONTEXT.md decisions
function wrapHtml(html: string, styles: string, pageLimit: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CV Export</title>
  ${styles}
  <style>
    @page {
      size: A4 portrait;
      margin: 0 !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm;
      min-height: ${297 * pageLimit}mm;
      height: auto;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    [data-cv-block] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    [data-cv-section] > h2 {
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
    [data-cv-block] li {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}
```
[VERIFIED: CSS rules match existing pdfExport.ts and index.css print rules]

### vercel.json Configuration
```json
{
  "functions": {
    "api/generate-pdf.ts": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "buildCommand": "npx convex deploy --cmd \"npx vite build\" --cmd-url-env-var-name VITE_CONVEX_URL"
}
```
[CITED: https://vercel.com/docs/functions/configuring-functions/duration]

Note: `memory` configuration is ignored on Hobby plan (fixed at 2GB). The `maxDuration: 30` is within Hobby plan limits (max 300s).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| window.print() | Headless Chrome serverless PDF | This phase | Direct download, no print dialog, reliable rendering |
| @sparticuz/chromium <= 130 | @sparticuz/chromium 143.x | 2025 | Matches Chrome 143, latest Puppeteer 24.x compatibility |
| Legacy Vercel handler (`export default function(req, res)`) | Web Standard signature (`export function POST(request: Request)`) | 2024-2025 | Modern API, standard Request/Response objects |
| 50MB Vercel bundle limit | 250MB uncompressed limit | ~2023 | Full @sparticuz/chromium fits without needing chromium-min |

**Deprecated/outdated:**
- `@sparticuz/chromium` versions < 130: Use 143.x for compatibility with puppeteer-core 24.x
- Legacy Vercel `(req, res)` handler signature: Use Web Standard `(request: Request) => Response` signature
- `puppeteer` full package in production: Always use `puppeteer-core` for serverless

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | @sparticuz/chromium 143.x is compatible with puppeteer-core 24.x | Standard Stack | Version mismatch could cause launch failure; verify with actual deployment |
| A2 | Cold start takes 8-15 seconds for Chromium decompression | Pitfalls | UX may be worse than expected; mitigate with loading state |
| A3 | networkidle0 is sufficient for Google Fonts loading | Pitfalls | Fonts may not load in time; may need explicit font.ready wait |
| A4 | Full @sparticuz/chromium package (not chromium-min) fits in 250MB | Architecture | If bundle exceeds 250MB, must switch to chromium-min + external hosting |

## Open Questions

1. **Payload size with Tailwind v4 CSS**
   - What we know: Vercel has 4.5MB request body limit; Tailwind v4 generates CSS at build time
   - What's unclear: How large is the serialized CSS from this specific project?
   - Recommendation: Measure actual payload size during implementation; if > 3MB, filter CSS to only matching rules

2. **Local development workflow**
   - What we know: `vercel dev` has known issues with Vite projects; the `vite-plugin-vercel-api` plugin exists
   - What's unclear: Whether the team should use `vercel dev` or a separate test strategy
   - Recommendation: For local testing, use `puppeteer` (dev dependency) with a simple test script; don't depend on `vercel dev` for the API function

3. **tsconfig for api/ directory**
   - What we know: Project tsconfig targets browser (DOM lib, bundler resolution); API function needs Node.js
   - What's unclear: Whether Vercel's build ignores the project tsconfig for api/ files
   - Recommendation: Add `api/tsconfig.json` targeting Node.js to be safe and ensure `tsc --noEmit` doesn't break

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest implicit config via package.json |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDFX-01 | Direct PDF download (no print dialog) | integration/manual | Manual -- requires browser + deployed serverless function | N/A |
| PDFX-02 | PDF has extractable text | unit | `npx vitest run src/features/editor/lib/pdfValidation.test.ts -x` | Exists (pdfValidation.ts) |
| PDFX-03 | Page breaks don't cut blocks | manual-only | Manual -- visual inspection of multi-page PDF | N/A |
| PDFX-04 | Rendering matches editor | manual-only | Manual -- visual comparison of editor vs PDF | N/A |
| PDFX-05 | Multi-page CVs render correctly | manual-only | Manual -- test with 2-3 page CV | N/A |

**Justification for manual-only tests:** PDF generation requires a running Vercel serverless function with headless Chrome. Unit tests can cover the HTML serialization and wrapper logic, but end-to-end PDF quality requires visual inspection.

### Testable Units (automated)
| Unit | Test | File |
|------|------|------|
| HTML serialization | Verify serializeCV produces valid HTML with styles | Wave 0 |
| HTML wrapper | Verify wrapHtml includes all required CSS rules | Wave 0 |
| Blob download | Verify download function creates correct blob URL | Wave 0 |
| Error fallback | Verify fallback to window.print() on API error | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual PDF generation test on deployed preview

### Wave 0 Gaps
- [ ] `src/features/editor/lib/__tests__/pdfExport.test.ts` -- covers serialization and wrapper
- [ ] `api/__tests__/generate-pdf.test.ts` -- covers HTML wrapper function (unit, no Chrome needed)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A -- endpoint is public (no auth needed for PDF generation) |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A -- stateless endpoint, no user data stored server-side |
| V5 Input Validation | yes | Validate JSON payload structure; limit html/styles string length to prevent abuse |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Payload injection (XSS in HTML) | Tampering | HTML is rendered in isolated headless Chrome, not served to users; PDF output is binary |
| Denial of service (large payloads) | Denial of Service | Enforce payload size limit (< 4.5MB by Vercel); add custom limit check (~2MB) |
| Resource exhaustion (Chrome not closing) | Denial of Service | Always close browser in `finally` block; Vercel kills functions at maxDuration |
| Server-Side Request Forgery (SSRF via font URLs) | Information Disclosure | Chrome fetches external font URLs from serialized styles; limit to known font providers if needed |

**Note:** The endpoint receives HTML from the client (not user-generated content from a database), so XSS risk is minimal -- the HTML is the user's own CV. However, adding a basic payload structure validation (check required fields, enforce max size) is good practice.

## Sources

### Primary (HIGH confidence)
- [npm registry] - puppeteer-core 24.40.0, @sparticuz/chromium 143.0.4 version verification
- [Vercel Functions docs](https://vercel.com/docs/functions) - Function signature, API route auto-detection
- [Vercel Functions limitations](https://vercel.com/docs/functions/limitations) - 250MB bundle, 4.5MB payload, 2GB Hobby memory, 300s max duration
- [Vercel Functions API Reference](https://vercel.com/docs/functions/functions-api-reference) - Web Standard signature for non-Next.js
- [Vercel Functions duration config](https://vercel.com/docs/functions/configuring-functions/duration) - vercel.json functions config syntax

### Secondary (MEDIUM confidence)
- [GitHub: Sparticuz/chromium](https://github.com/Sparticuz/chromium) - Package capabilities, launch args, serverless optimization
- [Gist: kettanaito/chromium-vercel](https://gist.github.com/kettanaito/56861aff96e6debc575d522dd03e5725) - Working code example for Chromium on Vercel
- [DEV Community: Headless Chrome on Vercel](https://dev.to/andreas_a/headless-chrome-on-vercel-build-a-screenshot-api-that-survives-cold-starts-ce8) - Cold start behavior, performance notes
- [danielolawoyin.com: Puppeteer on Vercel 2026 Guide](https://www.danielolawoyin.com/blog/puppeteer-on-vercel-the-ultimate-guide-to-serverless-browser-automation-2026) - Version compatibility, launch configuration

### Tertiary (LOW confidence)
- [Vercel Community: Serverless functions in react + vite](https://community.vercel.com/t/serverless-functions-in-react-vite/18776) - Vite + api/ directory compatibility (community report, not official)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified against npm registry, Vercel docs confirmed limits
- Architecture: HIGH - well-documented pattern with multiple authoritative sources
- Pitfalls: MEDIUM - cold start timing and font loading are experience-based estimates
- Security: HIGH - standard patterns, minimal attack surface

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable domain, packages update monthly)
