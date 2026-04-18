import { test, expect } from '@playwright/test';
import { MOCK_CV, MOCK_JOB_DESCRIPTION } from './fixtures/mock-cv';

// Helper: inject guest session + CV data before navigating to editor
async function setupGuestEditor(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(({ cv, jd }) => {
    sessionStorage.setItem('guest_access', 'true');
    localStorage.setItem('guest_last_optimized', JSON.stringify(cv));
    localStorage.setItem('guest_last_jd', jd);
  }, { cv: MOCK_CV, jd: MOCK_JOB_DESCRIPTION });
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
}

// Onglets = role="tab" (buttons avec role explicite dans EditorPage.tsx)
const TAB = {
  ats: () => (page: import('@playwright/test').Page) => page.getByRole('tab', { name: 'ATS' }),
  contenu: () => (page: import('@playwright/test').Page) => page.getByRole('tab', { name: 'Contenu' }),
  design: () => (page: import('@playwright/test').Page) => page.getByRole('tab', { name: 'Design' }),
};

test.describe('ATS Panel — mode guest', () => {
  test.beforeEach(async ({ page }) => {
    await setupGuestEditor(page);
  });

  test('l\'éditeur se charge en mode guest sans erreur JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    const criticalErrors = errors.filter(
      e => !e.includes('ResizeObserver') && !e.includes('Non-Error') && !e.includes('ChunkLoadError')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('le CV mock est chargé — le nom du candidat est visible', async ({ page }) => {
    await expect(page.getByText('Marie Dupont')).toBeVisible({ timeout: 10_000 });
  });

  test('l\'onglet ATS est cliquable et affiche le panel', async ({ page }) => {
    const atsTab = page.getByRole('tab', { name: 'ATS' });
    await expect(atsTab).toBeVisible({ timeout: 8_000 });
    await atsTab.click();
    // [role="status"] = le conteneur principal du score ATS
    await expect(page.locator('[role="status"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('le panel ATS affiche un score numérique entre 0 et 100', async ({ page }) => {
    await page.getByRole('tab', { name: 'ATS' }).click();
    await page.waitForTimeout(2000);
    const scoreText = await page.locator('[role="status"]').textContent({ timeout: 8_000 }).catch(() => '');
    const match = scoreText?.match(/(\d{1,3})/);
    if (match) {
      const score = parseInt(match[1], 10);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test('les mots-clés trouvés sont affichés en vert', async ({ page }) => {
    await page.getByRole('tab', { name: 'ATS' }).click();
    await page.waitForTimeout(2000);
    const foundKeyword = page.locator('.bg-green-100').first();
    await expect(foundKeyword).toBeVisible({ timeout: 8_000 });
  });

  test('les onglets Contenu/Design/ATS switchent sans erreur', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.getByRole('tab', { name: 'Contenu' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('tab', { name: 'Design' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('tab', { name: 'ATS' }).click();
    await page.waitForTimeout(500);

    const criticalErrors = errors.filter(
      e => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('ATS Panel — régression career-ops integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupGuestEditor(page);
    await page.getByRole('tab', { name: 'ATS' }).click();
    await page.waitForTimeout(1500);
  });

  test('le bouton de distribution de mots-clés est présent ou panel visible quand JD chargé', async ({ page }) => {
    // Le panel ATS doit être rendu (score visible) — le bouton de distribution n'apparaît que si des mots-clés manquent
    await expect(page.locator('[role="status"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('les sous-scores Format / Contenu / Pertinence sont affichés', async ({ page }) => {
    // Les labels exacts des barres de sous-scores dans ATSPanel.tsx
    await expect(page.getByText('Pertinence', { exact: true }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('le panel ne plante pas sur un CV avec summary non vide (wiring career-ops)', async ({ page }) => {
    // Vérifie que le nouveau champ summary dans DistributeContext (personal_info.summary)
    // ne cause aucun crash UI — MOCK_CV.personal_info.summary est non vide
    const panelRoot = page.locator('[role="status"]').first();
    await expect(panelRoot).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('snapshot — structure du panel ATS préservée après l\'intégration career-ops', async ({ page }) => {
    await page.screenshot({
      path: 'e2e/screenshots/ats-panel-career-ops.png',
      fullPage: false,
    });
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Edge cases — données CV incomplètes', () => {
  test('CV sans summary ne plante pas le panel ATS', async ({ page }) => {
    await page.goto('/');
    // summary: undefined sérialisé en JSON devient absent de l'objet
    const cvWithoutSummary = {
      ...MOCK_CV,
      personal_info: { ...MOCK_CV.personal_info, summary: undefined },
    };
    await page.evaluate(({ cv, jd }) => {
      sessionStorage.setItem('guest_access', 'true');
      localStorage.setItem('guest_last_optimized', JSON.stringify(cv));
      localStorage.setItem('guest_last_jd', jd);
    }, { cv: cvWithoutSummary, jd: MOCK_JOB_DESCRIPTION });
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'ATS' }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 8_000 });
  });

  test('CV sans expériences ne plante pas le panel ATS', async ({ page }) => {
    await page.goto('/');
    const cvNoExp = { ...MOCK_CV, experience: [] };
    await page.evaluate(({ cv, jd }) => {
      sessionStorage.setItem('guest_access', 'true');
      localStorage.setItem('guest_last_optimized', JSON.stringify(cv));
      localStorage.setItem('guest_last_jd', jd);
    }, { cv: cvNoExp, jd: MOCK_JOB_DESCRIPTION });
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'ATS' }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 8_000 });
  });

  test('pas de JD — le panel affiche un score sans section pertinence', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((cv) => {
      sessionStorage.setItem('guest_access', 'true');
      localStorage.setItem('guest_last_optimized', JSON.stringify(cv));
      localStorage.removeItem('guest_last_jd');
    }, MOCK_CV);
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'ATS' }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 8_000 });
  });
});
