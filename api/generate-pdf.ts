// ─── Vercel Serverless Function: PDF Generation ───
// Receives serialized CV HTML+CSS, renders in headless Chrome, returns PDF binary.

interface GeneratePDFRequest {
  html: string;
  styles: string;
  pageLimit: number;
}

// ─── PDF CSS (mirror of src/features/editor/lib/pdfStyles.ts) ───
// Keep in sync with the canonical source. Cannot import from src/ in serverless context.

function getPdfCss(): string {
  return `
    @page {
      size: A4 portrait;
      margin: 0 !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm;
      height: auto;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .cv-page {
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .cv-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .pdf-safe {
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    [data-cv-block] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    [data-cv-section] > h2 {
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
  `;
}

// ─── HTML wrapper ───

function wrapHtml(html: string, styles: string, pageLimit: number): string {
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
    return puppeteer.launch({
      headless: true,
      defaultViewport: { width: 794, height: 1123 },
    });
  }
}

// ─── Payload validation ───

function validatePayload(body: unknown): { valid: true; data: GeneratePDFRequest } | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Invalid payload: html, styles (strings) and pageLimit (1-4) required' };
  }

  const { html, styles, pageLimit } = body as Record<string, unknown>;

  if (typeof html !== 'string' || html.length === 0) {
    return { valid: false, error: 'Invalid payload: html, styles (strings) and pageLimit (1-4) required' };
  }

  if (typeof styles !== 'string' || styles.length === 0) {
    return { valid: false, error: 'Invalid payload: html, styles (strings) and pageLimit (1-4) required' };
  }

  if (typeof pageLimit !== 'number' || pageLimit < 1 || pageLimit > 4 || !Number.isInteger(pageLimit)) {
    return { valid: false, error: 'Invalid payload: html, styles (strings) and pageLimit (1-4) required' };
  }

  return { valid: true, data: { html, styles, pageLimit } };
}

// ─── POST handler ───

export async function POST(request: Request): Promise<Response> {
  // Validate Content-Type
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return new Response(
      JSON.stringify({ error: 'Content-Type must be application/json' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Check payload size (~2MB limit)
  if (JSON.stringify(body).length > 2_000_000) {
    return new Response(
      JSON.stringify({ error: 'Payload too large' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
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

  const { html, styles, pageLimit } = (validation as { valid: true; data: GeneratePDFRequest }).data;

  // Generate PDF
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    const fullHtml = wrapHtml(html, styles, pageLimit);

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    await page.waitForFunction('document.fonts.ready');

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
