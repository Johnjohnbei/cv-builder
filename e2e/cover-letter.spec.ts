import { test, expect } from '@playwright/test';
import { MOCK_CV, MOCK_JOB_DESCRIPTION, MOCK_COMPANY_NAME } from './fixtures/mock-cv';
import { seedGuestSession, watchAICalls, expectNoAICalls } from './fixtures/hermetic';

// Contexte entreprise pré-seedé : le drawer reste vierge côté contenu, mais
// l'entreprise est déjà connue donc aucune extraction IA ne part à l'ouverture.
const setupGuestEditor = (page: import('@playwright/test').Page) =>
  seedGuestSession(page, {
    cv: MOCK_CV,
    jd: MOCK_JOB_DESCRIPTION,
    coverLetter: { companyName: MOCK_COMPANY_NAME, jobDescription: MOCK_JOB_DESCRIPTION },
  });

// Ouvre le drawer via le bouton "Lettre" de la barre d'onglets et renvoie son locator
async function openDrawer(page: import('@playwright/test').Page) {
  const lettreBtn = page.getByRole('button', { name: 'Lettre', exact: true });
  await expect(lettreBtn).toBeVisible({ timeout: 10_000 });
  await lettreBtn.click();
  const dialog = page.getByRole('dialog', { name: 'Lettre de motivation' });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  return dialog;
}

// Textarea "Offre d'emploi" du drawer (scopé au dialog : l'éditeur a son propre champ JD)
const drawerJD = (dialog: ReturnType<import('@playwright/test').Page['locator']>) =>
  dialog.getByPlaceholder(/Collez l'offre d'emploi/);

test.describe('Lettre de motivation : drawer (mode guest)', () => {
  // Garde d'hermétisme, élargie le 2026-08-16 de `extractCompanyMeta` seul à
  // TOUS les appels IA : l'extraction de mots-clés passait à travers.
  let aiCalls: string[] = [];

  test.beforeEach(async ({ page }) => {
    aiCalls = watchAICalls(page);
    await setupGuestEditor(page);
  });

  test.afterEach(() => { expectNoAICalls(aiCalls); });

  test("le contexte entreprise persisté est restauré à l'ouverture", async ({ page }) => {
    const dialog = await openDrawer(page);
    // Non-régression persistance : le nom seedé est relu depuis localStorage,
    // donc aucune extraction automatique n'est déclenchée.
    await expect(dialog.getByLabel("Nom de l'entreprise")).toHaveValue(MOCK_COMPANY_NAME);
    await expect(dialog.getByPlaceholder('Détection automatique...')).toHaveCount(0);
  });

  test('le bouton Lettre ouvre le drawer (role dialog, aria-modal)', async ({ page }) => {
    const dialog = await openDrawer(page);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Focus initial déplacé dans le drawer (premier élément focusable = bouton Fermer)
    await expect(dialog.getByRole('button', { name: 'Fermer' })).toBeFocused();
  });

  test('fermeture par Escape : pas de panneau vide, un onglet avec du contenu reste actif', async ({ page }) => {
    const dialog = await openDrawer(page);
    // Focus initial hors champ (bouton Fermer) → un seul Escape ferme
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('tab', { selected: true })).toBeVisible();
    const panelText = await page.getByRole('tabpanel').innerText();
    expect(panelText.trim().length).toBeGreaterThan(0);
  });

  test('Escape en deux temps depuis un champ : blur d\'abord, fermeture ensuite', async ({ page }) => {
    const dialog = await openDrawer(page);
    const jd = drawerJD(dialog);
    await jd.click();
    await expect(jd).toBeFocused();
    // 1er Escape : le champ perd le focus, le drawer reste ouvert
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(jd).not.toBeFocused();
    // 2e Escape : fermeture
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('fermeture par clic sur le backdrop : un onglet reste actif', async ({ page }) => {
    const dialog = await openDrawer(page);
    // Le drawer (max-w-xl) est ancré à droite : (20, 300) tombe sur le backdrop
    await page.mouse.click(20, 300);
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('tab', { selected: true })).toBeVisible();
    const panelText = await page.getByRole('tabpanel').innerText();
    expect(panelText.trim().length).toBeGreaterThan(0);
  });

  test('fermeture par le bouton X : focus restauré sur le bouton Lettre', async ({ page }) => {
    const dialog = await openDrawer(page);
    await dialog.getByRole('button', { name: 'Fermer' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Lettre', exact: true })).toBeFocused();
    await expect(page.getByRole('tab', { selected: true })).toBeVisible();
  });

  test('le focus reste piégé dans le drawer (Tab en boucle)', async ({ page }) => {
    const dialog = await openDrawer(page);
    // Plus de Tab que d'éléments focusables → au moins un wrap complet
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
    }
    const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(inside).toBe(true);
  });

  test('Générer la lettre : désactivé sous 50 caractères, activé sinon', async ({ page }) => {
    const dialog = await openDrawer(page);
    const jd = drawerJD(dialog);
    const generateBtn = dialog.getByRole('button', { name: 'Générer la lettre' });

    await jd.fill('');
    await expect(generateBtn).toBeDisabled();

    await jd.fill('Texte trop court');
    await expect(generateBtn).toBeDisabled();

    await jd.fill(MOCK_JOB_DESCRIPTION);
    await expect(generateBtn).toBeEnabled();
  });

  test('bandeau "pas encore optimisé" : visible avec offre chargée, masqué sans offre', async ({ page }) => {
    const dialog = await openDrawer(page);
    // Mode guest : CV jamais tailored côté Convex → bandeau visible avec l'offre chargée
    const banner = dialog.getByText(/n'a pas encore été optimisé/);
    await expect(banner).toBeVisible();
    // Offre vidée (< 50 caractères) → le bandeau disparaît
    await drawerJD(dialog).fill('');
    await expect(banner).not.toBeVisible();
  });

  test('mode guest : Sauvegarder désactivé avec la mention de connexion', async ({ page }) => {
    const dialog = await openDrawer(page);
    await expect(dialog.getByRole('button', { name: 'Sauvegarder' })).toBeDisabled();
    await expect(dialog.getByText('Connectez-vous pour sauvegarder')).toBeVisible();
  });
});
