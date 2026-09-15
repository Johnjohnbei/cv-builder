import { test, expect, type Page } from '@playwright/test';
import { MOCK_CV, MOCK_JOB_DESCRIPTION } from './fixtures/mock-cv';
import { seedGuestSession, watchAICalls, expectNoAICalls, requirementsOf } from './fixtures/hermetic';

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

test.describe('ATS Panel : mode guest', () => {
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

  test('le CV mock est chargé : le nom du candidat est visible', async ({ page }) => {
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

  test('les exigences couvertes sont affichées en vert, les écarts listés', async ({ page }) => {
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(page.locator('.bg-green-100').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/^Écarts \(\d+\)$/)).toBeVisible();
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

test.describe('ATS Panel : régression career-ops integration', () => {
  guardAICalls();
  test.beforeEach(async ({ page }) => {
    await setupGuestEditor(page);
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(atsScore(page)).toBeVisible({ timeout: 8_000 });
  });

  // The score measures one thing, the offer's requirements; readability is a
  // checklist, not points that could hide an unreadable PDF behind a good score.
  test('un seul score, sa définition et la checklist de lisibilité', async ({ page }) => {
    await expect(page.getByText("Part des exigences de l'offre présentes dans votre CV, comme un ATS les recherche.")).toBeVisible();
    await expect(page.getByText('Lisibilité par les ATS')).toBeVisible();
    // Scoped to the panel: "Contenu" is also the name of a sidebar tab
    const panel = page.getByRole('tabpanel');
    for (const label of ['Format', 'Contenu', 'Pertinence']) {
      await expect(panel.getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  test('le panel ne plante pas sur un CV avec summary non vide (wiring career-ops)', async ({ page }) => {
    // MOCK_CV.personal_info.summary est non vide
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});

test.describe('Offre saisie dans l\'éditeur', () => {
  guardAICalls();
  /** Only in the warmed AI list, never in the offer text: seeing it proves the AI keywords are used */
  const AI_ONLY_KEYWORD = 'Zorglub Ops';
  const offerField = (page: Page) => page.getByPlaceholder(/Collez l'offre d'emploi ici/);

  test.beforeEach(async ({ page }) => {
    await setupGuestEditor(page, MOCK_CV, '');
    // Cache warmed for the offer about to be pasted: the analysis is served, no call leaves
    await page.evaluate(
      (entry) => localStorage.setItem('job_requirements_cache', JSON.stringify([entry])),
      { jobDescription: MOCK_JOB_DESCRIPTION.trim(), requirements: requirementsOf([AI_ONLY_KEYWORD]) },
    );
  });

  test('le champ reste ouvert pendant la saisie, puis les exigences IA de l\'offre arrivent', async ({ page }) => {
    const field = offerField(page);
    await field.click();
    await field.pressSequentially('Offre');
    await expect(field).toBeFocused();
    await field.fill(MOCK_JOB_DESCRIPTION);
    await expect(field).toBeFocused();

    // The first click below the field right after typing must land: collapsing
    // the field on blur moved this button up between mousedown and mouseup.
    const onePage = page.getByRole('group', { name: 'Tenir en' }).getByRole('button', { name: '1' });
    await onePage.click();
    await expect(onePage).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(page.getByText(AI_ONLY_KEYWORD).first()).toBeVisible({ timeout: 8_000 });
  });

  test('une offre saisie par un invité revient au rechargement', async ({ page }) => {
    await offerField(page).fill(MOCK_JOB_DESCRIPTION);
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('guest_last_jd'))).toBe(MOCK_JOB_DESCRIPTION);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(AI_ONLY_KEYWORD).first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Analyse de l\'offre indisponible', () => {
  // The only action this test lets through: without an account or an access
  // code, the server refuses it before any AI call, so nothing is billed.
  test('sans code d\'accès : pas de score, la raison et Réessayer', async ({ page }) => {
    const calls = watchAICalls(page);
    await setupGuestEditor(page, MOCK_CV, '');
    await page.getByPlaceholder(/Collez l'offre d'emploi ici/).fill("Offre jamais analysée : Product Designer, Figma, design system, recherche utilisateur.");
    await page.getByRole('tab', { name: 'ATS' }).click();

    await expect(page.getByText("Analyse de l'offre indisponible pour le moment.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Code d'accès requis/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
    await expect(page.getByText('Score ATS')).toHaveCount(0);
    expect(calls.every(name => name === 'extractJobRequirements')).toBe(true);
  });
});

test.describe('Edge cases : données CV incomplètes', () => {
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

  // A ranking by an ATS is always relative to a position: no offer, no score
  test('pas de JD : pas de score, une invitation et la checklist de lisibilité', async ({ page }) => {
    await setupGuestEditor(page, MOCK_CV, '');
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(page.getByText("Importez une offre d'emploi pour mesurer la part de ses exigences présentes dans votre CV.")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Lisibilité par les ATS')).toBeVisible();
    await expect(page.getByText('Score ATS')).toHaveCount(0);
    await expect(page.getByText(/une erreur est survenue/i)).not.toBeVisible();
  });
});
