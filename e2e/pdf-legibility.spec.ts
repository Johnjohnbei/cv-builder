import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { MOCK_CV } from './fixtures/mock-cv';
import { seedGuestSession, watchAICalls, expectNoAICalls } from './fixtures/hermetic';

/**
 * What an ATS reads in the PDF the app exports, for each template: the text of
 * the real download, extracted the way a parser does. The templates were said
 * to be "read in order by an ATS"; this is what says it.
 */
async function pdfPages(path: string): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    pages.push(items.map(item => ('str' in item ? item.str : '')).join(' '));
  }
  return pages;
}

/**
 * Spacing is what a PDF renderer decides, not what the CV wrote: a word can be
 * split across text items, and two words can end up glued. Compared without
 * any of it, the text is what the CV says.
 */
const squash = (text: string) => text.replace(/\s+/gu, '').toLowerCase();

for (const template of ['TEMPLATE_C', 'TEMPLATE_E'] as const) {
  test.describe(`PDF exporté lisible : ${template}`, () => {
    // Headless Chrome renders the PDF server-side: past the 30 s default
    test.setTimeout(180_000);
    let calls: string[] = [];
    test.beforeEach(({ page }) => { calls = watchAICalls(page); });
    test.afterEach(() => { expectNoAICalls(calls); });

    test("contacts, postes, dates et puces sont extraits en texte, dans l'ordre du CV", async ({ page }) => {
      await seedGuestSession(page, { cv: { ...MOCK_CV, design: { ...(MOCK_CV as Record<string, unknown>).design as object, template } } });
      const download = page.waitForEvent('download', { timeout: 120_000 });
      await page.getByRole('button', { name: 'Exporter en PDF' }).click();
      const pages = await pdfPages(await (await download).path());
      const text = squash(pages.join(' '));

      const { personal_info: info, experience, education, skills } = MOCK_CV;
      const at = (value: string) => {
        const index = text.indexOf(squash(value));
        expect(index, `« ${value} » doit être extractible du PDF`).toBeGreaterThanOrEqual(0);
        return index;
      };

      // The header an ATS reads first, on the first page and before the roles
      for (const value of [info.name, info.email, info.phone, info.location, info.title]) at(value);
      expect(squash(pages[0])).toContain(squash(info.name));

      // Roles in the CV's order, each ANNOUNCED then followed by its own
      // bullets: a parser reading the text in order must know whose job it is
      // before reading what was done there
      const firstRole = at(experience[0].company);
      const secondRole = at(experience[1].company);
      expect(at(info.email)).toBeLessThan(firstRole);
      expect(firstRole).toBeLessThan(secondRole);
      for (const bullet of experience[0].description.slice(0, 2)) {
        expect(at(bullet)).toBeGreaterThan(firstRole);
        expect(at(bullet)).toBeLessThan(secondRole);
      }
      expect(at(experience[1].intro!)).toBeGreaterThan(secondRole);
      // The dates of a role are announced with it, never after its bullets.
      // (The position is not asserted here: the mock CV gives the first role the
      // very title of the CV, so its index would be the header's, always first.)
      expect(at('Janv. 2021')).toBeLessThan(at(experience[0].description[0]));
      expect(at('Mars 2018')).toBeGreaterThan(firstRole);
      expect(at('Mars 2018')).toBeLessThan(at(experience[1].description[0]));
      // Degrees and skills: what a parser fills its remaining fields with
      at(education[0].degree);
      at(skills[0].items[0]);
    });
  });
}
