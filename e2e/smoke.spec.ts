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
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('une route inconnue affiche la page 404', async ({ page }) => {
    await page.goto('/cette-page-nexiste-pas');
    await expect(page.locator('body')).toBeVisible();
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
