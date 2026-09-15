import { test, expect, type Page } from '@playwright/test';
import { LONG_CV, LONG_CV_JOB_DESCRIPTION } from './fixtures/long-cv';
import { seedGuestSession, watchAICalls, expectNoAICalls } from './fixtures/hermetic';

/**
 * The fit pass only runs on a CV that has never been triaged, so the fixture
 * deliberately carries no displayMode — that is what a fresh import looks like.
 */
const setupLongCV = (page: Page, cv: unknown = LONG_CV) =>
  seedGuestSession(page, { cv, jd: LONG_CV_JOB_DESCRIPTION });

/** Arms the no-AI-call guard for every test of a describe block. */
function guardAICalls() {
  let calls: string[] = [];
  test.beforeEach(async ({ page }) => { calls = watchAICalls(page); });
  test.afterEach(() => { expectNoAICalls(calls); });
}

/** The fit loop settles over several measure/render passes. */
async function waitForPageCount(page: Page, expected: number) {
  await expect
    .poll(() => page.locator('.cv-page').count(), { timeout: 20_000 })
    .toBe(expected);
}

const readModes = (page: Page): Promise<(string | undefined)[]> =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('guest_last_optimized')!)
      .experience.map((e: { displayMode?: string }) => e.displayMode),
  );

/**
 * Display modes as persisted. The auto-save is debounced 1.5s, so the DOM shows
 * the fitted CV a moment before localStorage catches up — poll instead of
 * racing it.
 */
async function savedModes(page: Page): Promise<string[]> {
  await expect
    .poll(async () => (await readModes(page)).every(Boolean), { timeout: 15_000 })
    .toBe(true);
  return (await readModes(page)) as string[];
}

test.describe('Tri auto sur N pages', () => {
  guardAICalls();

  test('un CV de 6 expériences non trié tient sur 2 pages tout seul', async ({ page }) => {
    await setupLongCV(page);
    await waitForPageCount(page, 2);
  });

  test('les expériences récentes gardent plus de détail que les anciennes', async ({ page }) => {
    await setupLongCV(page);
    await waitForPageCount(page, 2);

    const modes = await savedModes(page);
    const RUNGS = ['extended', 'normal', 'compact', 'hidden'];
    const rungs = modes.map((m: string) => RUNGS.indexOf(m));

    expect(modes).toHaveLength(6);
    expect(rungs.every((r: number) => r >= 0)).toBe(true);
    // The first role is the most recent AND the best keyword match: it must
    // never be leaner than the last one.
    expect(rungs[0]).toBeLessThanOrEqual(rungs[rungs.length - 1]);
    // A gradient, not a cliff: the fit comes down in waves.
    expect(Math.max(...rungs) - Math.min(...rungs)).toBeLessThanOrEqual(1);
  });

  test('les deux pages sont remplies, pas une page et demie de blanc', async ({ page }) => {
    await setupLongCV(page);
    await waitForPageCount(page, 2);

    const fill = await page.evaluate(() =>
      [...document.querySelectorAll('.cv-page')].map(p => {
        const blocks = [...p.querySelectorAll('[data-live-block]')];
        return blocks.reduce((sum, b) => sum + (b as HTMLElement).offsetHeight, 0) / (p as HTMLElement).offsetHeight;
      }),
    );
    // Landing on 2 pages with an almost-empty second one would mean the pass
    // condensed further than the budget required.
    expect(fill[1]).toBeGreaterThan(0.4);
  });

  test('viser 1 page condense davantage et masque les moins pertinentes', async ({ page }) => {
    await setupLongCV(page);
    await waitForPageCount(page, 2);

    await page.getByRole('tab', { name: 'Contenu' }).click();
    await page.getByRole('group', { name: /tenir en/i }).getByRole('button', { name: '1' }).click();
    await page.getByRole('button', { name: /Faire tenir en 1 page/i }).click();

    await waitForPageCount(page, 1);
    const modes = await savedModes(page);
    expect(modes).toContain('hidden');
    // The most relevant role survives the squeeze.
    expect(modes[0]).not.toBe('hidden');
  });

  test('un CV déjà trié à la main n\'est pas ré-ajusté à l\'ouverture', async ({ page }) => {
    const manual = {
      ...LONG_CV,
      experience: LONG_CV.experience.map(e => ({ ...e, displayMode: 'compact' })),
    };
    await setupLongCV(page, manual);
    await page.waitForTimeout(4000);
    expect(await savedModes(page)).toEqual(Array(6).fill('compact'));
  });
});

/**
 * Written the way real offers are: accents and plurals the variant config
 * (playwright.config.ts) spells without. The exact-regex matcher missed all of
 * them, which is why no suggestion ever showed up in production.
 */
const DS_OFFER = `Lead Product Designer H/F. Vous piloterez notre système de design et garantirez l'accessibilité des composants, avec des tokens partagés entre web et mobile, sur un produit SaaS B2B.`;

const headerLinks = (page: Page) => page.locator('[data-cv-section="header"] a');

test.describe('Lien portfolio', () => {
  guardAICalls();

  test('sans offre : les versions sont listées, aucune n\'est suggérée ni ajoutée', async ({ page }) => {
    await seedGuestSession(page, { cv: LONG_CV });
    await page.getByRole('tab', { name: 'ATS' }).click();

    await expect(page.getByLabel('Version à lier')).toBeVisible();
    await expect(page.getByText('Importez une offre pour obtenir une suggestion.')).toBeVisible();
    await expect(headerLinks(page)).toHaveCount(0);
  });

  test('une offre accentuée suggère la bonne version, ajoutée en un clic', async ({ page }) => {
    await seedGuestSession(page, { cv: LONG_CV, jd: DS_OFFER });
    // The editor lands on the ATS tab when an offer arrives: the panel is there.
    await expect(page.getByText(/Suggéré pour cette offre/)).toContainText('Portfolio Design System');

    await page.getByRole('button', { name: 'Ajouter au CV' }).click();

    const link = headerLinks(page).filter({ hasText: 'Portfolio Design System' });
    await expect(link).toHaveAttribute('href', 'https://example.com/portfolio/design-system');
    await expect(page.getByRole('button', { name: 'Déjà sur le CV' })).toBeDisabled();
  });

  test('choisir une autre version la remplace, Retirer enlève le lien', async ({ page }) => {
    await seedGuestSession(page, { cv: LONG_CV, jd: DS_OFFER });
    await page.getByRole('button', { name: 'Ajouter au CV' }).click();

    await page.getByLabel('Version à lier').selectOption('ia');
    await page.getByRole('button', { name: 'Remplacer sur le CV' }).click();
    await expect(headerLinks(page)).toHaveCount(1);
    await expect(headerLinks(page)).toHaveAttribute('href', 'https://example.com/portfolio/ia');

    await page.getByRole('button', { name: 'Retirer', exact: true }).click();
    await expect(headerLinks(page)).toHaveCount(0);
  });

  test('le template Modern affiche aussi LinkedIn et le lien portfolio', async ({ page }) => {
    await seedGuestSession(page, {
      cv: {
        ...LONG_CV,
        personal_info: {
          ...LONG_CV.personal_info,
          portfolio_url: 'https://example.com/portfolio/design-system',
          portfolio_label: 'Portfolio Design System',
        },
        design: {
          template: 'TEMPLATE_B', primaryColor: '#1A73E8', secondaryColor: '#5F6368',
          fontFamily: 'sans', pageLimit: 2, showPhoto: true,
        },
      },
    });

    const header = page.locator('[data-cv-section="header"]').first();
    await expect(header).toContainText('linkedin.com/in/marie-dupont', { timeout: 15_000 });
    await expect(header.locator('a')).toHaveAttribute('href', 'https://example.com/portfolio/design-system');
  });

  test('un lien portfolio saisi à la main est rendu et cliquable', async ({ page }) => {
    await setupLongCV(page, {
      ...LONG_CV,
      personal_info: {
        ...LONG_CV.personal_info,
        portfolio_url: 'https://example.com/portfolio/design-system',
        portfolio_label: 'Portfolio Design System',
      },
    });

    const link = page.locator('[data-cv-section="header"] a').first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    await expect(link).toHaveAttribute('href', 'https://example.com/portfolio/design-system');
    await expect(link).toHaveText('Portfolio Design System');
  });

  test('le mode anonyme bascule sur le lien anonyme et masque le nom', async ({ page }) => {
    await setupLongCV(page, {
      ...LONG_CV,
      personal_info: {
        ...LONG_CV.personal_info,
        portfolio_url: 'https://example.com/portfolio/design-system',
        portfolio_label: 'Portfolio Design System',
        portfolio_anon_url: 'https://example.com/cv/ab12',
      },
    });
    await expect(page.locator('[data-cv-section="header"] a').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Anonyme/i }).click();

    const header = page.locator('[data-cv-section="header"]').first();
    await expect(header).toContainText('Candidat anonyme');
    await expect(header).not.toContainText(LONG_CV.personal_info.email);
    await expect(header.locator('a').first()).toHaveAttribute('href', 'https://example.com/cv/ab12');
    // The free-text label could carry the name: a masked CV prints a neutral one
    await expect(header.locator('a').first()).toHaveText('Portfolio');
  });
});
