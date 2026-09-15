import { test, expect } from '@playwright/test';

test.describe('Smoke — pages publiques', () => {
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

  test('une route inconnue affiche la page 404 et ramène à l\'accueil', async ({ page }) => {
    await page.goto('/cette-page-nexiste-pas');
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
    await page.getByRole('button', { name: /Retour à l'accueil/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('les métadonnées de partage n\'ont ni tiret cadratin ni nombre de templates faux', async ({ page }) => {
    await page.goto('/');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain('4 templates');
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
