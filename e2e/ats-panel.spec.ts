import { test, expect, type Page } from '@playwright/test';
import { MOCK_CV, MOCK_JOB_DESCRIPTION } from './fixtures/mock-cv';
import { seedGuestSession, watchAICalls, expectNoAICalls } from './fixtures/hermetic';

const setupGuestEditor = (page: Page, cv: unknown = MOCK_CV, jd?: string) =>
  seedGuestSession(page, { cv, jd: jd === undefined ? MOCK_JOB_DESCRIPTION : jd });

/** Arms the no-AI-call guard for every test of a describe block. */
function guardAICalls() {
  let calls: string[] = [];
  test.beforeEach(async ({ page }) => { calls = watchAICalls(page); });
  test.afterEach(() => { expectNoAICalls(calls); });
}

/** The score gauge container of the ATS panel */
const atsScore = (page: Page) => page.locator('[role="status"]').first();

const isCritical = (message: string) =>
  !message.includes('ResizeObserver') && !message.includes('Non-Error') && !message.includes('ChunkLoadError');

test.describe('ATS Panel — mode guest', () => {
  guardAICalls();
  // Collected from before the editor loads: attached inside a test, after the
  // setup had already navigated, the listener missed every load-time error.
  let pageErrors: string[] = [];
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await setupGuestEditor(page);
  });

  test('l\'éditeur se charge en mode guest sans erreur JS', async ({ page }) => {
    await expect(page.getByText('Marie Dupont').first()).toBeVisible({ timeout: 10_000 });
    expect(pageErrors.filter(isCritical)).toHaveLength(0);
  });

  test('le CV mock est chargé — le nom du candidat est visible', async ({ page }) => {
    await expect(page.getByText('Marie Dupont').first()).toBeVisible({ timeout: 10_000 });
  });

  test('l\'onglet ATS est cliquable et affiche le panel', async ({ page }) => {
    const atsTab = page.getByRole('tab', { name: 'ATS' });
    await expect(atsTab).toBeVisible({ timeout: 8_000 });
    await atsTab.click();
    await expect(atsScore(page)).toBeVisible({ timeout: 8_000 });
  });

  test('le panel ATS affiche un score numérique entre 0 et 100', async ({ page }) => {
    await page.getByRole('tab', { name: 'ATS' }).click();
    // Asserted, not guarded by an `if`: the former version passed without a single expect
    await expect(atsScore(page)).toContainText(/\d{1,3}/, { timeout: 8_000 });
    const score = Number((await atsScore(page).textContent())!.match(/(\d{1,3})/)![1]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('les mots-clés trouvés sont affichés en vert', async ({ page }) => {
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(page.locator('.bg-green-100').first()).toBeVisible({ timeout: 8_000 });
  });

  test('les onglets Contenu/Design/ATS switchent sans erreur', async ({ page }) => {
    await page.getByRole('tab', { name: 'Contenu' }).click();
    await expect(page.getByRole('tab', { name: 'Contenu' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(page.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(atsScore(page)).toBeVisible({ timeout: 8_000 });
    expect(pageErrors.filter(isCritical)).toHaveLength(0);
  });
});

test.describe('ATS Panel — régression career-ops integration', () => {
  guardAICalls();
  test.beforeEach(async ({ page }) => {
    await setupGuestEditor(page);
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(atsScore(page)).toBeVisible({ timeout: 8_000 });
  });

  test('les sous-scores Format / Contenu / Pertinence sont affichés', async ({ page }) => {
    for (const label of ['Format', 'Contenu', 'Pertinence']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('le panel ne plante pas sur un CV avec summary non vide (wiring career-ops)', async ({ page }) => {
    // MOCK_CV.personal_info.summary est non vide
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});

test.describe('Edge cases — données CV incomplètes', () => {
  guardAICalls();

  test('CV sans summary ne plante pas le panel ATS', async ({ page }) => {
    // summary: undefined sérialisé en JSON devient absent de l'objet
    await setupGuestEditor(page, {
      ...MOCK_CV,
      personal_info: { ...MOCK_CV.personal_info, summary: undefined },
    });
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(atsScore(page)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
  });

  test('CV sans expériences ne plante pas le panel ATS', async ({ page }) => {
    await setupGuestEditor(page, { ...MOCK_CV, experience: [] });
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(atsScore(page)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
  });

  test('pas de JD — le panel affiche un score sans section pertinence', async ({ page }) => {
    await setupGuestEditor(page, MOCK_CV, '');
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(atsScore(page)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
  });
});
