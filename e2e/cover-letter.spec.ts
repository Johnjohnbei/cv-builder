import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { MOCK_CV, MOCK_JOB_DESCRIPTION, MOCK_COMPANY_NAME } from './fixtures/mock-cv';
import { REQUIREMENTS_CACHE_KEY, answerAIActions, seedGuestSession, watchAICalls, expectNoAICalls } from './fixtures/hermetic';
const LETTER = { subject: 'Un poste de designer', greeting: 'Madame, Monsieur,', body: 'Je conçois des produits utiles. Je vérifie chaque fichier.\n\nMon expérience accompagne votre projet.', closing: 'Au plaisir d’échanger.' };
async function setup(page: Page, letter = true) {
  await seedGuestSession(page, { cv: MOCK_CV, jd: MOCK_JOB_DESCRIPTION });
  await page.evaluate(({ letter, jd, companyName }) => localStorage.setItem('guest_last_cover_letter', JSON.stringify({ letter, companyName, jobDescription: jd })), { letter: letter ? LETTER : null, jd: MOCK_JOB_DESCRIPTION, companyName: MOCK_COMPANY_NAME });
}
async function openLetter(page: Page) {
  await page.getByRole('button', { name: 'Lettre de motivation', exact: true }).click();
  const workspace = page.getByRole('region', { name: 'Lettre de motivation', exact: true });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByLabel('Entreprise', { exact: true })).toHaveValue(MOCK_COMPANY_NAME);
  return workspace;
}

test.describe('Lettre intégrée à la candidature', () => {
  let calls: string[];
  test.beforeEach(async ({ page }) => { calls = watchAICalls(page); await setup(page); });
  test.afterEach(() => expectNoAICalls(calls));
  test('ouvre un document sans modal ni appel IA et revient au CV', async ({ page }) => {
    const view = await openLetter(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(view.getByRole('article', { name: 'Document lettre' })).toBeVisible();
    await expect(view.getByRole('button', { name: 'Revenir au CV' })).toBeFocused();
    await view.getByRole('button', { name: 'Revenir au CV' }).click();
    await expect(page.getByRole('tab', { selected: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lettre de motivation', exact: true })).toBeFocused();
  });
  test('sauvegarde automatique, reprise après rechargement et aucune lettre d’une autre offre', async ({ page }) => {
    let view = await openLetter(page);
    await view.getByLabel('Texte de la lettre').fill('Mon texte personnel et conservé.');
    await expect(view.getByRole('status')).toHaveText('Enregistré automatiquement dans ce navigateur');
    await page.reload();
    view = await openLetter(page);
    await expect(view.getByLabel('Texte de la lettre')).toHaveValue('Mon texte personnel et conservé.');
    await view.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(view.getByLabel('Texte de la lettre')).toHaveValue(LETTER.body);
    await view.getByRole('button', { name: 'Modifier l’offre commune' }).click();
    await page.evaluate(cacheKey => { const entries = JSON.parse(localStorage.getItem(cacheKey) || '[]'); entries.push({ ...entries[0], jobDescription: 'Autre offre' }); localStorage.setItem(cacheKey, JSON.stringify(entries)); }, REQUIREMENTS_CACHE_KEY);
    await view.getByLabel('Offre d’emploi commune').fill('Autre offre');
    await view.getByLabel('Offre d’emploi commune').press('Tab');
    await expect(view.getByRole('article')).toHaveCount(0);
    await expect(view.getByRole('button', { name: 'Rédiger ma lettre' })).toBeDisabled();
    await view.getByRole('button', { name: 'Revenir au CV' }).click();
    await page.getByRole('tab', { name: 'Mise en page' }).click();
    await expect(page.getByRole('button', { name: /Offre importée/ })).toContainText('Autre offre');
  });
  test('sauve immédiatement quand on quitte la lettre et permet d’annuler une modification', async ({ page }) => {
    let view = await openLetter(page);
    await view.getByLabel('Texte de la lettre').fill('Une nouvelle version.');
    await view.getByRole('button', { name: 'Raccourcir', exact: true }).focus();
    await page.keyboard.press('Control+z');
    await expect(view.getByLabel('Texte de la lettre')).toHaveValue(LETTER.body);
    await view.getByLabel('Objet', { exact: true }).fill('Objet conservé');
    await view.getByRole('button', { name: 'Revenir au CV' }).click();
    await page.reload(); view = await openLetter(page);
    await expect(view.getByLabel('Objet', { exact: true })).toHaveValue('Objet conservé');
  });
  test('reprend une candidature avec son CV et sa lettre depuis le tableau de bord', async ({ page }) => {
    const view = await openLetter(page);
    await view.getByLabel('Objet', { exact: true }).fill('Candidature à reprendre');
    await view.getByRole('link', { name: 'Tableau de bord' }).click();
    await page.getByRole('button', { name: 'Mes CV', exact: true }).first().click();
    await expect(page.getByRole('region', { name: 'Candidatures enregistrées' })).toContainText('Candidature à reprendre');
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Reprendre la candidature' }).click();
    await expect(page.getByLabel('Objet', { exact: true })).toHaveValue('Candidature à reprendre');
  });
  test('les options sont repliées et les exports sont regroupés', async ({ page }) => {
    const view = await openLetter(page);
    await expect(view.getByLabel('Ton', { exact: true })).not.toBeVisible();
    await view.getByText('Options de rédaction', { exact: true }).click();
    await expect(view.getByLabel('Ton', { exact: true })).toBeVisible();
    await view.getByRole('button', { name: 'Exporter la lettre' }).click();
    const download = page.waitForEvent('download');
    await view.getByRole('button', { name: 'Exporter en texte (.txt)' }).click();
    expect((await download).suggestedFilename()).toMatch(/lettre-.*\.txt$/);
    await view.getByRole('button', { name: 'Exporter la lettre' }).click();
    const word = page.waitForEvent('download');
    await view.getByRole('button', { name: 'Télécharger en Word (.docx)' }).click();
    expect((await word).suggestedFilename()).toMatch(/\.docx$/);
  });
  for (const width of [375, 768, 1440]) test(`document et exports accessibles à ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    if (width < 768) await page.getByRole('button', { name: 'Fermer le panneau latéral' }).first().click();
    // Open without assuming the context controls remain expanded on mobile.
    await page.getByRole('button', { name: 'Lettre de motivation', exact: true }).click();
    const view = page.getByRole('region', { name: 'Lettre de motivation', exact: true });
    await expect(view.getByLabel('Texte de la lettre')).toHaveValue(LETTER.body);
    await expect(view.getByLabel('Texte de la lettre')).toBeVisible();
    await expect(view.getByRole('button', { name: 'Exporter la lettre' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.CAPTURE_LETTER_DIR) await page.screenshot({ path: `${process.env.CAPTURE_LETTER_DIR}/letter-${width}.png` });
    const field = view.getByLabel('Texte de la lettre');
    expect(await field.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  });
});

test('rédaction et révisions utilisent la motivation et conservent une version annulable', async ({ page }) => {
  const asked: Record<string, any>[] = [];
  const calls = await answerAIActions(page, { generateCoverLetter: args => {
    asked.push(args);
    return { ...LETTER, body: args.operation === 'shorten' ? 'Une lettre courte.' : args.operation === 'rephrase' ? 'Texte reformulé.' : LETTER.body };
  } });
  await setup(page, false);
  const view = await openLetter(page);
  await view.getByLabel('Pourquoi ce poste vous intéresse-t-il ?').fill('Construire un produit accessible.');
  await view.getByRole('button', { name: 'Rédiger ma lettre' }).click();
  await expect(view.getByLabel('Texte de la lettre')).toHaveValue(LETTER.body);
  expect(asked[0].motivation).toBe('Construire un produit accessible.');
  await view.getByRole('button', { name: 'Raccourcir', exact: true }).click();
  await expect(view.getByLabel('Texte de la lettre')).toHaveValue('Une lettre courte.');
  await view.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(view.getByLabel('Texte de la lettre')).toHaveValue(LETTER.body);
  const body = view.getByLabel('Texte de la lettre');
  await body.focus(); await body.press('Control+Home');
  for (let i = 0; i < 10; i++) await body.press('Shift+ArrowRight');
  await view.getByRole('button', { name: 'Reformuler la sélection' }).click();
  await expect.poll(() => asked.length).toBe(3);
  expect(asked[2].selection).toEqual({ field: 'body', start: 0, end: 10 });
  expect(calls.forwarded).toEqual([]);
});


test('le PDF réel de la lettre contient le texte, dans l’ordre', async ({ page }) => {
  test.setTimeout(120000);
  const calls = watchAICalls(page);
  await setup(page);
  const view = await openLetter(page);
  await view.getByRole('button', { name: 'Exporter la lettre' }).click();
  const download = page.waitForEvent('download', { timeout: 90000 });
  await view.getByRole('button', { name: 'Exporter en PDF' }).click();
  const path = await (await download).path();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)) }).promise;
  expect(doc.numPages).toBe(1);
  const { items } = await (await doc.getPage(1)).getTextContent();
  const text = items.map(item => 'str' in item ? item.str : '').join(' ').replace(/\s+/gu, ' ');
  expect(items.some(item => 'str' in item && item.str.includes('vérifie'))).toBe(true);
  const first = text.indexOf(LETTER.subject);
  const body = text.indexOf('Je conçois des produits utiles.');
  const closing = text.indexOf(LETTER.closing);
  expect(first).toBeGreaterThanOrEqual(0); expect(body).toBeGreaterThan(first); expect(closing).toBeGreaterThan(body);
  expectNoAICalls(calls);
});


test('une réponse tardive ne remplace pas une candidature modifiée pendant la rédaction', async ({ page }) => {
  let finish: ((letter: typeof LETTER) => void) | undefined;
  const calls = await answerAIActions(page, { generateCoverLetter: () => new Promise(resolve => { finish = resolve; }) });
  await setup(page);
  const view = await openLetter(page);
  await view.getByRole('button', { name: 'Réécrire la lettre' }).click();
  await expect.poll(() => Boolean(finish)).toBe(true);
  await view.getByLabel('Entreprise', { exact: true }).fill('Nouvelle entreprise');
  finish!({ ...LETTER, body: 'Une réponse devenue obsolète.' });
  await expect(view.getByRole('button', { name: 'Réécrire la lettre' })).toBeEnabled();
  await expect(view.getByLabel('Texte de la lettre')).toHaveValue(LETTER.body);
  expect(calls.forwarded).toEqual([]);
});

test('un échec IA conserve la lettre et rend les actions disponibles', async ({ page }) => {
  const calls = await answerAIActions(page, { generateCoverLetter: () => { throw new Error('Service indisponible'); } });
  await setup(page);
  const view = await openLetter(page);
  await view.getByRole('button', { name: 'Réécrire la lettre' }).click();
  await expect.poll(() => calls.answered.length).toBe(1);
  await expect(view.getByRole('button', { name: 'Réécrire la lettre' })).toBeEnabled();
  await expect(view.getByLabel('Texte de la lettre')).toHaveValue(LETTER.body);
  expect(calls.forwarded).toEqual([]);
});

test('un ancien brouillon sans offre demande un import explicite', async ({ page }) => {
  const calls = watchAICalls(page);
  await setup(page);
  await page.evaluate(letter => localStorage.setItem('guest_last_cover_letter', JSON.stringify(letter)), LETTER);
  await page.getByRole('button', { name: 'Lettre de motivation', exact: true }).click();
  const view = page.getByRole('region', { name: 'Lettre de motivation', exact: true });
  await expect(view.getByRole('article')).toHaveCount(0);
  await view.getByRole('button', { name: 'Importer l’ancien brouillon' }).click();
  await expect(view.getByLabel('Texte de la lettre')).toHaveValue(LETTER.body);
  expectNoAICalls(calls);
});
