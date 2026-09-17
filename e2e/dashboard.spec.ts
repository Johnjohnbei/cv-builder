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

// Plan of 2026-09-17, lot D: the gaps are asked before the one generation,
// and the score is read in the editor, on the CV as it prints
test.describe("Tableau de bord : les écarts avant l'écriture du CV", () => {
  const LABELS = ['Figma', 'Kubernetes', 'Storybook'];
  const PROOF = "Chez TechCorp, j'ai déployé nos environnements sur Kubernetes";

  test("les écarts sont demandés avant la génération, puis l'éditeur s'ouvre sur l'onglet ATS", async ({ page }) => {
    const tailored: any[] = [];
    const calls = await answerAIActions(page, {
      extractJobRequirements: () => ({ requirements: requirementsOf(LABELS) }),
      analyzeGaps: (args) => ({ requirements: args.requirements, evidence: [], gaps: ['kubernetes', 'storybook'] }),
      tailorCV: (args) => {
        tailored.push(args);
        return {
          cv: { ...args.baseData, detectedLanguage: 'fr' },
          requirements: args.requirements,
          unproven: [],
          report: { score: 100, points: { covered: 9, total: 9 }, checks: [], requirements: [] },
        };
      },
      translateCV: (args) => ({ ...args.cvData, detectedLanguage: args.targetLanguage }),
    });
    await openGuestDashboard(page, { baseCv: MOCK_CV });
    await page.evaluate(() => localStorage.setItem('calibre_access_code', 'CODE-E2E'));
    await page.getByPlaceholder("Collez l'offre d'emploi ici...").fill(MOCK_JOB_DESCRIPTION);
    await page.getByRole('button', { name: 'Optimiser mon CV pour cette offre' }).click();

    const panel = page.getByRole('region', { name: "Avant d'écrire votre CV" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Votre CV prouve 1 exigence de l'offre sur 3.")).toBeVisible();

    // Too short to say where: the button waits
    const kubernetes = panel.getByLabel('Où avez-vous mis en œuvre « Kubernetes » ?');
    await kubernetes.fill('oui');
    await expect(panel.getByText(/4 mots au moins/)).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Écrire mon CV' })).toBeDisabled();
    await kubernetes.fill(PROOF);

    await panel.getByRole('button', { name: "Storybook : je ne l'ai pas" }).click();
    await expect(panel.getByText('Écartées (1)')).toBeVisible();

    await panel.getByRole('button', { name: 'Écrire mon CV' }).click();
    await expect(page).toHaveURL(/\/editor/);
    await expect(page.getByRole('tab', { name: 'ATS' })).toHaveAttribute('aria-selected', 'true');

    expect(tailored).toHaveLength(1);
    expect(tailored[0].proofs).toEqual([{ id: 'kubernetes', text: PROOF }]);
    expect(calls.answered).toEqual(['extractJobRequirements', 'analyzeGaps', 'tailorCV', 'translateCV']);
    expect(calls.forwarded).toEqual([]);
  });

  const tailoredCV = (args: any) => ({
    cv: { ...args.baseData, detectedLanguage: 'fr' },
    requirements: args.requirements,
    unproven: [],
    report: { score: 100, points: { covered: 9, total: 9 }, checks: [], requirements: [] },
  });

  test("sans écart à prouver, le CV s'écrit directement, sans question", async ({ page }) => {
    const calls = await answerAIActions(page, {
      extractJobRequirements: () => ({ requirements: requirementsOf(LABELS) }),
      analyzeGaps: (args) => ({ requirements: args.requirements, evidence: [], gaps: [] }),
      tailorCV: tailoredCV,
      translateCV: (args) => ({ ...args.cvData, detectedLanguage: args.targetLanguage }),
    });
    await openGuestDashboard(page, { baseCv: MOCK_CV });
    await page.evaluate(() => localStorage.setItem('calibre_access_code', 'CODE-E2E'));
    await page.getByPlaceholder("Collez l'offre d'emploi ici...").fill(MOCK_JOB_DESCRIPTION);
    await page.getByRole('button', { name: 'Optimiser mon CV pour cette offre' }).click();

    await expect(page).toHaveURL(/\/editor/);
    expect(calls.answered).toEqual(['extractJobRequirements', 'analyzeGaps', 'tailorCV', 'translateCV']);
    expect(calls.forwarded).toEqual([]);
  });

  test("une génération qui échoue rend les questions, réponses comprises", async ({ page }) => {
    let attempts = 0;
    const calls = await answerAIActions(page, {
      extractJobRequirements: () => ({ requirements: requirementsOf(LABELS) }),
      analyzeGaps: (args) => ({ requirements: args.requirements, evidence: [], gaps: ['kubernetes'] }),
      tailorCV: () => { attempts += 1; throw new Error('Server Error'); },
    });
    await openGuestDashboard(page, { baseCv: MOCK_CV });
    await page.evaluate(() => localStorage.setItem('calibre_access_code', 'CODE-E2E'));
    await page.getByPlaceholder("Collez l'offre d'emploi ici...").fill(MOCK_JOB_DESCRIPTION);
    await page.getByRole('button', { name: 'Optimiser mon CV pour cette offre' }).click();

    const panel = page.getByRole('region', { name: "Avant d'écrire votre CV" });
    await panel.getByLabel('Où avez-vous mis en œuvre « Kubernetes » ?').fill(PROOF);
    await panel.getByRole('button', { name: 'Écrire mon CV' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(panel.getByLabel('Où avez-vous mis en œuvre « Kubernetes » ?')).toHaveValue(PROOF);
    await expect(page).toHaveURL(/\/dashboard/);
    expect(attempts).toBe(1);
    expect(calls.forwarded).toEqual([]);
  });
});
