// ─── Vercel Serverless Function: PDF Generation ───
// Receives serialized CV HTML+CSS, renders in headless Chrome, returns PDF binary.

import { getPdfCss } from '../src/features/editor/lib/pdfStyles';

interface GeneratePDFRequest {
  html: string;
  styles: string;
}

// ─── Abuse guards ───
// The endpoint is reachable by guests (no Clerk session), so the first gate is
// origin-based: browsers always send Origin on POST fetch, and the app only
// calls this API same-origin, so other sites cannot use it from a visitor's
// browser. A script can forge the header: the rate limit, the payload cap and
// the locked-down page below are what bound that case.

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Per-IP sliding window rate limit, scoped to the serverless instance.
 * ponytail: instance-local Map, a distributed limiter (KV) if abuse persists.
 */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  // Forget expired windows once the map grows, or it keeps every IP ever seen
  if (hits.size > 1_000) {
    for (const [key, value] of hits) {
      if (now - value.windowStart > RATE_WINDOW_MS) hits.delete(key);
    }
  }
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

/** Hosts the rendered page may fetch from (fonts). Everything else is aborted: no SSRF. */
const ALLOWED_REQUEST_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

// ─── HTML wrapper ───

function wrapHtml(html: string, styles: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CV Export</title>
  ${styles}
  <style>${getPdfCss()}</style>
</head>
<body>
  ${html}
</body>
</html>`;
}

// ─── Browser launcher ───

async function getBrowser() {
  if (process.env.VERCEL) {
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
    const options = { headless: true as const, defaultViewport: { width: 794, height: 1123 } };
    try {
      // Reuse the Chrome already installed on the dev machine: no 150 MB
      // `puppeteer browsers install` step just to preview an export locally.
      return await puppeteer.launch({ ...options, channel: 'chrome' });
    } catch {
      return puppeteer.launch(options);
    }
  }
}

// ─── Payload validation ───

function validatePayload(body: unknown): { valid: true; data: GeneratePDFRequest } | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Invalid payload: html and styles (strings) required' };
  }

  const { html, styles } = body as Record<string, unknown>;

  if (typeof html !== 'string' || html.length === 0) {
    return { valid: false, error: 'Invalid payload: html and styles (strings) required' };
  }

  if (typeof styles !== 'string' || styles.length === 0) {
    return { valid: false, error: 'Invalid payload: html and styles (strings) required' };
  }

  return { valid: true, data: { html, styles } };
}

// ─── POST handler ───

export async function POST(request: Request): Promise<Response> {
  // Same-origin only: this API renders arbitrary HTML in headless Chrome
  if (!isAllowedOrigin(request)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Validate Content-Type
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return new Response(
      JSON.stringify({ error: 'Content-Type must be application/json' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Check payload size (~2MB limit) on the raw text, BEFORE parsing: checked
  // after, an oversized body had already been parsed in full.
  const rawBody = await request.text();
  if (rawBody.length > 2_000_000) {
    return new Response(
      JSON.stringify({ error: 'Payload too large' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Parse JSON body
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Validate payload structure
  const validation = validatePayload(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: (validation as { valid: false; error: string }).error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { html, styles } = (validation as { valid: true; data: GeneratePDFRequest }).data;

  // Generate PDF
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    // The serialized CV is static markup and needs no script. Disabling
    // JavaScript also closes WebSocket and WebRTC, which request interception
    // below does not see: submitted HTML could otherwise still reach the network.
    await page.setJavaScriptEnabled(false);

    // SSRF guard: the submitted HTML must not make Chrome fetch arbitrary
    // URLs (internal network scan, cost amplification). Only font hosts and
    // inline data: resources are allowed.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('about:')) {
        req.continue();
        return;
      }
      try {
        if (ALLOWED_REQUEST_HOSTS.has(new URL(url).host)) {
          req.continue();
          return;
        }
      } catch { /* fall through to abort */ }
      req.abort();
    });

    const fullHtml = wrapHtml(html, styles);

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    // Evaluated through the DevTools protocol, which page scripts being off does not block
    await page.evaluate('document.fonts.ready');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="cv.pdf"',
      },
    });
  } catch (err) {
    console.error('[generate-pdf] PDF generation failed:', err);
    return new Response(
      JSON.stringify({ error: 'PDF generation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
