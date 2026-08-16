import { test, expect } from '@playwright/test';
import { LONG_CV, LONG_CV_JOB_DESCRIPTION } from './fixtures/long-cv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Not a regression test: drives the real Export button and writes the PDF the
 * app produced to disk, so the export can be inspected by a human. Skipped by
 * default — run with CAPTURE_PDF=<path> when you want the artefact.
 */
const OUT = process.env.CAPTURE_PDF;

test.describe('Capture PDF', () => {
  test.skip(!OUT, 'set CAPTURE_PDF=<path> to capture the export');
  // Launching headless Chrome server-side to render the PDF blows past the
  // 30s default the regression suite runs on.
  test.setTimeout(180_000);

  test('exporte le CV via le vrai bouton Exporter', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(({ cv, jd }) => {
      sessionStorage.setItem('guest_access', 'true');
      localStorage.setItem('guest_last_optimized', JSON.stringify(cv));
      localStorage.setItem('guest_last_jd', jd);
    }, { cv: LONG_CV, jd: LONG_CV_JOB_DESCRIPTION });
    await page.goto('/editor');

    await expect.poll(() => page.locator('.cv-page').count(), { timeout: 20_000 }).toBe(2);

    // Capture the endpoint's response rather than the browser download: the
    // bytes are the same, and it does not depend on download plumbing.
    const response = page.waitForResponse(r => r.url().includes('/api/generate-pdf'), { timeout: 120_000 });
    await page.getByRole('button', { name: /^Exporter$/ }).first().click();
    const res = await response;

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');

    mkdirSync(dirname(OUT!), { recursive: true });
    writeFileSync(OUT!, await res.body());
    console.log(`[capture] ${OUT}`);
  });
});
