import { test, expect, type Page } from '@playwright/test';
import { MOCK_CV, MOCK_JOB_DESCRIPTION } from './fixtures/mock-cv';
import { answerAIActions, watchAICalls, expectNoAICalls, requirementsOf } from './fixtures/hermetic';

interface GuestSeed {
  baseCv?: unknown;
  draft?: unknown;
  savedCvs?: unknown[];
}

/** Guest session without access code, on the dashboard. */
async function openGuestDashboard(page: Page, seed: GuestSeed = {}) {
  await page.goto('/');
  await page.evaluate(({ baseCv, draft, savedCvs }) => {
    sessionStorage.setItem('guest_access', 'true');
    localStorage.removeItem('calibre_access_code');
    const put = (key: string, value: unknown) =>
      value ? localStorage.setItem(key, JSON.stringify(value)) : localStorage.removeItem(key);
    put('guest_base_cv', baseCv);
    put('guest_last_optimized', draft);
    put('guest_cvs', savedCvs);
  }, { baseCv: seed.baseCv ?? null, draft: seed.draft ?? null, savedCvs: seed.savedCvs ?? null });
  await page.goto('/dashboard');
  await expect(page.getByText('1. Votre CV')).toBeVisible({ timeout: 15_000 });
}

test.describe('Tableau de bord (mode invité)', () => {
  let calls: string[] = [];
  test.beforeEach(({ page }) => { calls = watchAICalls(page); });
  test.afterEach(() => { expectNoAICalls(calls); });

  test('écran unique : ni en-tête ni pied de page de l\'accueil, statut invité affiché', async ({ page }) => {
    await openGuestDashboard(page);
    await expect(page.getByText(/L'IA au service de votre carrière/)).toHaveCount(0);
    await expect(page.getByText('Mode invité', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quitter le mode invité' })).toBeVisible();
  });

  test('sans code, une action IA ouvre la demande de code au lieu de partir', async ({ page }) => {
    await openGuestDashboard(page);
    await page.getByLabel('Depuis une URL').fill('https://example.com/offre');
    await page.getByRole('button', { name: 'Importer' }).click();

    const dialog = page.getByRole('dialog', { name: 'Accès aux fonctionnalités IA' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Code d'accès")).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('un fichier qui n\'est pas un PDF est refusé avec un message, sans extraction', async ({ page }) => {
    await openGuestDashboard(page);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'cv.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('not a pdf'),
    });
    await expect(page.getByRole('alert')).toContainText('Fichier refusé');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Créer un CV vide confirme le remplacement du brouillon puis ouvre l\'éditeur sur le CV vide', async ({ page }) => {
    await openGuestDashboard(page, { draft: MOCK_CV });
    page.once('dialog', (confirm) => confirm.accept());
    await page.getByRole('button', { name: /Créer un CV vide/i }).click();

    await expect(page).toHaveURL(/\/editor/);
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('guest_last_optimized')!));
    expect(draft.experience).toEqual([]);
  });

  test('supprimer un CV passe par une vraie boîte de dialogue, fermable avec Échap', async ({ page }) => {
    await openGuestDashboard(page, {
      savedCvs: [{ ...MOCK_CV, _id: 'guest_1', createdAt: new Date().toISOString() }],
    });
    await page.getByRole('button', { name: 'Mes CV', exact: true }).click();

    const trash = page.getByRole('button', { name: /Supprimer le CV/ });
    await trash.focus();
    await expect(trash).toBeVisible();
    await trash.click();

    const dialog = page.getByRole('dialog', { name: 'Supprimer ce CV ?' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await trash.click();
    await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(page.getByText('Aucun CV sauvegardé pour le moment.')).toBeVisible();
  });
});

// Arbitrage of 2026-10-07: the CV is written from A to Z with no question asked,
// and the score is read in the editor, on the CV as it prints
test.describe("Tableau de bord : le CV s'écrit d'un trait", () => {
  const LABELS = ['Figma', 'Kubernetes', 'Storybook'];

  const tailoredCV = (args: any) => ({
    cv: { ...args.baseData, detectedLanguage: 'fr' },
    requirements: args.requirements,
    report: { score: 100, points: { covered: 9, total: 9 }, checks: [], requirements: [] },
  });

  test("le CV s'écrit sans aucune question, puis l'éditeur s'ouvre sur l'onglet ATS", async ({ page }) => {
    const tailored: any[] = [];
    const calls = await answerAIActions(page, {
      extractJobRequirements: () => ({ requirements: requirementsOf(LABELS) }),
      tailorCV: (args) => { tailored.push(args); return tailoredCV(args); },
      translateCV: (args) => ({ ...args.cvData, detectedLanguage: args.targetLanguage }),
    });
    await openGuestDashboard(page, { baseCv: MOCK_CV });
    await page.evaluate(() => localStorage.setItem('calibre_access_code', 'CODE-E2E'));
    await page.getByPlaceholder("Collez l'offre d'emploi ici...").fill(MOCK_JOB_DESCRIPTION);
    await page.getByRole('button', { name: 'Optimiser mon CV pour cette offre' }).click();

    await expect(page).toHaveURL(/\/editor/);
    await expect(page.getByRole('tab', { name: 'ATS' })).toHaveAttribute('aria-selected', 'true');
    expect(tailored).toHaveLength(1);
    expect(tailored[0].requirements.map((r: any) => r.label)).toEqual(LABELS);
    expect(tailored[0]).not.toHaveProperty('proofs');
    expect(calls.answered).toEqual(['extractJobRequirements', 'tailorCV', 'translateCV']);
    expect(calls.forwarded).toEqual([]);
  });

  test("une génération qui échoue le dit et rend l'offre, sans question", async ({ page }) => {
    let attempts = 0;
    const calls = await answerAIActions(page, {
      extractJobRequirements: () => ({ requirements: requirementsOf(LABELS) }),
      tailorCV: () => { attempts += 1; throw new Error('Server Error'); },
    });
    await openGuestDashboard(page, { baseCv: MOCK_CV });
    await page.evaluate(() => localStorage.setItem('calibre_access_code', 'CODE-E2E'));
    await page.getByPlaceholder("Collez l'offre d'emploi ici...").fill(MOCK_JOB_DESCRIPTION);
    await page.getByRole('button', { name: 'Optimiser mon CV pour cette offre' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('button', { name: 'Optimiser mon CV pour cette offre' })).toBeEnabled();
    expect(attempts).toBe(1);
    expect(calls.forwarded).toEqual([]);
  });
});
