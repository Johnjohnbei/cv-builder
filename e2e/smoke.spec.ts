import { test, expect } from '@playwright/test';

test.describe('Smoke : pages publiques', () => {
  test('la page d\'accueil se charge et affiche le titre principal', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CV|Calibre|Optimisez/i);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText('CV');
  });

  test('la page d\'accueil affiche les 3 étapes produit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /import intelligent/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /adaptation ia/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /score ats/i })).toBeVisible();
  });

  test('la page /auth se charge sans erreur', async ({ page }) => {
    // Listening before navigating: attached after the load, it caught nothing
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/auth');
    await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('stockage bloqué : « Essayer sans compte » mène à la connexion, qui explique pourquoi', async ({ page }) => {
    // Collected before navigating: a non-fatal exception on blocked storage must fail the test too
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    // Site data blocked: even reading window.sessionStorage throws
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        get() { throw new DOMException('The operation is insecure.', 'SecurityError'); },
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Essayer sans compte' }).click();
    await expect(page).toHaveURL(/\/auth$/);
    // Announced to screen readers, not only shown
    await expect(page.getByRole('alert')).toContainText('Mode invité indisponible');

    // Trying guest mode again re-inserts the alert, so screen readers announce it
    // again: setting the same text changed nothing in the DOM and was silent.
    await page.evaluate(() => {
      const w = window as unknown as { alertInserts: number };
      w.alertInserts = 0;
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element && (node.matches('[role="alert"]') || node.querySelector('[role="alert"]'))) w.alertInserts++;
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole('button', { name: 'Mode invité' }).click();
    const alertInserts = () => page.evaluate(() => (window as unknown as { alertInserts: number }).alertInserts);
    await expect.poll(alertInserts).toBe(1);
    // Exactly one: a later insertion would pass a poll that stops at the first match
    await page.waitForTimeout(300);
    expect(await alertInserts()).toBe(1);
    await expect(page.getByRole('alert')).toContainText('Mode invité indisponible');

    // Read once: a reload does not bring back a message the navigation carried
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('une route inconnue affiche la page 404 et ramène à l\'accueil', async ({ page }) => {
    await page.goto('/cette-page-nexiste-pas');
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
    await page.getByRole('button', { name: /Retour à l'accueil/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('les métadonnées de partage n\'ont ni tiret cadratin ni nombre de templates faux', async ({ page }) => {
    await page.goto('/');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    // TEMPLATES (lib/pagination/template-layouts.ts) offers 2 since the 2026-09-15 removal of A and B
    expect(description).toContain('2 templates');
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      expect(await page.locator(selector).getAttribute('content')).not.toMatch(/[—–]/);
    }
  });

  test('aucune erreur JS console sur la page d\'accueil', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const criticalErrors = errors.filter(
      e => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
