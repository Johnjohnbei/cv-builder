import { test, expect, type Page } from '@playwright/test';
import { MOCK_CV, MOCK_JOB_DESCRIPTION } from './fixtures/mock-cv';
import { answerAIActions, seedGuestSession, watchAICalls, expectNoAICalls, requirementsOf, REQUIREMENTS_CACHE_KEY, type RoutedAICalls } from './fixtures/hermetic';

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
      ({ key, entry }) => localStorage.setItem(key, JSON.stringify([entry])),
      { key: REQUIREMENTS_CACHE_KEY, entry: { jobDescription: MOCK_JOB_DESCRIPTION.trim(), requirements: requirementsOf([AI_ONLY_KEYWORD]) } },
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

// Arbitrage of 2026-10-07: no AI call in the editor after the generation. A
// requirement the user lacks is taken out of the CV as it prints, without one.
test.describe('ATS Panel : actions sur un écart', () => {
  const LABELS = ['Figma', 'Kubernetes', 'Terraform'];
  guardAICalls();

  const open = async (page: Page) => {
    await seedGuestSession(page, { cv: MOCK_CV, jd: MOCK_JOB_DESCRIPTION, requirementLabels: LABELS });
    await page.getByRole('tab', { name: 'ATS' }).click();
  };
  const preview = (page: Page) => page.locator('.cv-page');

  test("« Je ne l'ai pas » range un écart, « Remettre » le ramène", async ({ page }) => {
    await open(page);
    await expect(page.getByText('Écarts (2)')).toBeVisible({ timeout: 8_000 });
    // Each gap names itself: two identical names would be one ambiguous control
    await page.getByRole('button', { name: "Kubernetes : je ne l'ai pas" }).click();
    await expect(page.getByText('Écartées (1)')).toBeVisible();
    await expect(page.getByText('Écarts (1)')).toBeVisible();
    await expect(atsScore(page)).toContainText(/\d{1,3}/);

    await page.getByRole('button', { name: 'Remettre' }).click();
    await expect(page.getByText('Écarts (2)')).toBeVisible();
  });

  test("« Retirer » une exigence couverte l'enlève du CV imprimé, « Remettre » la rend", async ({ page }) => {
    await open(page);
    await expect(preview(page).first()).toContainText('Figma', { timeout: 8_000 });

    await page.getByRole('button', { name: "Figma : je ne l'ai pas, retirer du CV" }).click();
    await expect(page.getByText('Écartées (1)')).toBeVisible();
    // The whole preview, polled: the pagination settles on fewer pages meanwhile
    await expect.poll(async () => (await preview(page).allInnerTexts()).join(' ')).not.toContain('Figma');
    // The texts stay the user's: the summary still names it in the Contenu tab
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('guest_last_optimized') ?? '{}'));
    expect(JSON.stringify(saved.skills ?? [])).toContain('Figma');

    await page.getByRole('button', { name: 'Remettre' }).click();
    await expect(preview(page).first()).toContainText('Figma');
  });

  // Another offer on screen: the dismissal still takes its text out, and stays restorable
  test("une exigence écartée que l'offre affichée ne demande pas reste listée, « Remettre » la rend", async ({ page }) => {
    const sketch = { id: 'sketch-pro', label: 'Sketch', variants: [], kind: 'tool' };
    await seedGuestSession(page, { cv: { ...MOCK_CV, dismissedRequirements: [sketch] }, jd: MOCK_JOB_DESCRIPTION, requirementLabels: LABELS });
    await page.getByRole('tab', { name: 'ATS' }).click();
    await expect(page.getByText('Écartées (1)')).toBeVisible({ timeout: 8_000 });
    await expect.poll(async () => (await preview(page).allInnerTexts()).join(' ')).not.toContain('Sketch');

    await page.getByRole('button', { name: 'Sketch : remettre' }).click();
    await expect(page.getByText('Écartées (1)')).toHaveCount(0);
    await expect(preview(page).first()).toContainText('Sketch');
  });

  test("l'onglet Contenu ne propose plus aucune réécriture par l'IA", async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: 'Contenu' }).click();
    await expect(page.getByRole('button', { name: "Adapter le CV à l'offre" })).toHaveCount(0);
    await page.getByRole('button', { name: /Expériences/ }).click();
    await expect(page.getByRole('button', { name: /Auto-détecter/ })).toHaveCount(0);
  });
});

// The two versions a generation leaves, picked in the editor without any AI call
test.describe('Contenu : version adaptée ou d\'origine', () => {
  guardAICalls();
  const ORIGINAL = "Mon résumé d'origine, écrit à la main pour mes candidatures, sans les mots de l'offre.";

  test('le résumé passe de la version adaptée à la mienne, et revient', async ({ page }) => {
    const adapted = MOCK_CV.personal_info.summary;
    await seedGuestSession(page, {
      cv: { ...MOCK_CV, personal_info: { ...MOCK_CV.personal_info, versions: { summary: { adapted, original: ORIGINAL } } } },
      jd: MOCK_JOB_DESCRIPTION,
    });
    await page.getByRole('tab', { name: 'Contenu' }).click();
    await page.getByRole('button', { name: /Résumé professionnel/ }).click();
    const choice = page.getByLabel('Version du résumé');
    await expect(choice).toHaveValue('adapted');

    await choice.selectOption('original');
    await expect(page.locator('[data-cv-section="summary"]').first()).toContainText(ORIGINAL);

    await choice.selectOption('adapted');
    await expect(page.locator('[data-cv-section="summary"]').first()).toContainText(adapted.slice(0, 40));
  });
});

test.describe('Contenu : version d\'une expérience', () => {
  guardAICalls();

  test("une expérience passe à mes puces d'origine, et ma modification reste un choix", async ({ page }) => {
    const [first, ...rest] = MOCK_CV.experience;
    const adapted = { intro: first.intro, description: first.description };
    await seedGuestSession(page, {
      cv: { ...MOCK_CV, experience: [{ ...first, versions: { key: 0, adapted, original: { intro: first.intro, description: ['Ma puce importée, telle quelle'] } } }, ...rest] },
      jd: MOCK_JOB_DESCRIPTION,
    });
    await page.getByRole('tab', { name: 'Contenu' }).click();
    await page.getByRole('button', { name: /Expériences/ }).click();
    const choice = page.getByLabel("Version de l'intro et des puces").first();
    await choice.selectOption('original');
    await expect(page.locator('.cv-page').first()).toContainText('Ma puce importée, telle quelle');
    await choice.selectOption('adapted');
    await expect(page.locator('.cv-page').first()).not.toContainText('Ma puce importée, telle quelle');
  });
});

// The translation the generation could not cache runs later, in one call
// (arbitrage of 2026-10-07): what the user dismissed stays out, no version choice there
test.describe('Langue : traduction de secours', () => {
  test('une traduction garde les exigences écartées, en un seul appel', async ({ page }) => {
    const calls = await answerAIActions(page, {
      translateCV: (args) => {
        const { dismissedRequirements: _d, ...cv } = args.cvData;
        return { ...cv, personal_info: { ...cv.personal_info, versions: undefined }, detectedLanguage: args.targetLanguage, languageOverride: args.targetLanguage };
      },
    });
    const figma = { id: 'figma', label: 'Figma', variants: [], kind: 'tool' };
    const summary = MOCK_CV.personal_info.summary;
    await seedGuestSession(page, {
      cv: {
        ...MOCK_CV, _translations: undefined, dismissedRequirements: [figma],
        personal_info: { ...MOCK_CV.personal_info, versions: { summary: { adapted: summary, original: 'Mon résumé importé, écrit pour mes candidatures.' } } },
      },
      jd: MOCK_JOB_DESCRIPTION,
      requirementLabels: ['Figma', 'Kubernetes', 'Terraform'],
    });
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: 'Traduire le contenu en anglais' }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('guest_last_optimized') ?? '{}').detectedLanguage)).toBe('en');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('guest_last_optimized') ?? '{}'));
    expect(saved.dismissedRequirements).toEqual([figma]);
    expect(saved.personal_info.versions).toBeUndefined();
    // The French versions are kept for the way back
    expect(saved._translations.fr.personal_info.versions.summary.original).toBe('Mon résumé importé, écrit pour mes candidatures.');
    expect(calls).toEqual({ answered: ['translateCV'], forwarded: [] });
  });
});

// A version picked in one language shows in the other, no AI call
test.describe('Langue : un choix pour les deux langues', () => {
  guardAICalls();

  test("mon résumé d'origine choisi en français s'affiche aussi en anglais", async ({ page }) => {
    const adaptedFr = MOCK_CV.personal_info.summary;
    const versionsFr = { summary: { adapted: adaptedFr, original: "Mon résumé d'origine, écrit à la main." } };
    const versionsEn = { summary: { adapted: 'Senior UX designer, ten years in design systems.', original: 'My own summary, written by hand.' } };
    await seedGuestSession(page, {
      cv: {
        ...MOCK_CV, detectedLanguage: 'fr',
        personal_info: { ...MOCK_CV.personal_info, versions: versionsFr },
        _translations: { en: { ...MOCK_CV, personal_info: { ...MOCK_CV.personal_info, summary: versionsEn.summary.adapted, versions: versionsEn } } },
      },
      jd: MOCK_JOB_DESCRIPTION,
    });
    await page.getByRole('tab', { name: 'Contenu' }).click();
    await page.getByRole('button', { name: /Résumé professionnel/ }).click();
    await page.getByLabel('Version du résumé').selectOption('original');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.locator('[data-cv-section="summary"]').first()).toContainText('My own summary, written by hand.');
  });
});
