import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { MOCK_CV } from './fixtures/mock-cv';
import { seedGuestSession, watchAICalls, expectNoAICalls } from './fixtures/hermetic';

/**
 * What an ATS reads in the PDF the app exports: the text items of the real
 * download, as a parser receives them. Items, not one joined string: a word
 * split into one item per letter is exactly the failure Greenhouse documents
 * ("a resume with spaces between the letters"), and joining hides it.
 */
async function pdfItems(path: string): Promise<string[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)) }).promise;
  const pages: string[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    pages.push(items.map(item => ('str' in item ? item.str : '')));
  }
  return pages;
}

/**
 * Spacing is what a PDF renderer decides, not what the CV wrote: a word can be
 * split across text items, and two words can end up glued. Compared without
 * any of it, the text is what the CV says. Used for the ORDER assertions only,
 * never to decide whether a word is readable: it removes the very spaces that
 * say it is not.
 */
const squash = (text: string) => text.replace(/\s+/gu, '').toLowerCase();

/**
 * The same template on two geometries. Template C used to be the second one;
 * it was removed on 2026-11-06, and with it the only proof that the rules hold
 * on another layout. A different document font changes the metrics, the line
 * breaks and the text items, which is what this guard reads.
 */
const GEOMETRIES = [
  { name: 'Elegant', design: {} },
  { name: 'Elegant en serif', design: { fontFamily: 'playfair' } },
] as const;

for (const geometry of GEOMETRIES) {
  test.describe(`PDF exporté lisible : ${geometry.name}`, () => {
    // Headless Chrome renders the PDF server-side: past the 30 s default
    test.setTimeout(180_000);
    let calls: string[] = [];
    test.beforeEach(({ page }) => { calls = watchAICalls(page); });
    test.afterEach(() => { expectNoAICalls(calls); });

    test("contacts, postes, dates et puces sont extraits en texte, dans l'ordre du CV", async ({ page }) => {
      const design = { ...(MOCK_CV as Record<string, unknown>).design as object, template: 'TEMPLATE_E', ...geometry.design };
      await seedGuestSession(page, { cv: { ...MOCK_CV, design } });
      const download = page.waitForEvent('download', { timeout: 120_000 });
      await page.getByRole('button', { name: 'Exporter en PDF' }).click();
      const pages = await pdfItems(await (await download).path());
      const items = pages.flat();
      const text = squash(items.join(' '));

      const { personal_info: info, experience, education, skills } = MOCK_CV;
      const at = (value: string) => {
        const index = text.indexOf(squash(value));
        expect(index, `« ${value} » doit être extractible du PDF`).toBeGreaterThanOrEqual(0);
        return index;
      };

      // Beyond 0.1em of letter-spacing, Chrome writes the word with a space
      // between every letter, and no parser reads it (measured 2026-11-06:
      // "S E N I O R" at 0.3em). This is the failure Greenhouse documents, and
      // it hit the costliest word of the CV, the profile title, which is the
      // offer's own job title. Read on the items as they come out, never on
      // squashed text: squashing removes the very spaces that say it is broken.
      const spacedOut = items.filter(item => /(?:^|\s)(?:\p{L}\s){2,}\p{L}(?:\s|$)/u.test(item));
      expect(spacedOut, `aucun mot ne doit sortir lettre par lettre : ${spacedOut.join(' | ')}`).toEqual([]);
      // And every word of the title comes out whole, in one item
      for (const word of info.title.split(/\s+/)) {
        const whole = items.some(item => item.toLowerCase().includes(word.toLowerCase()));
        expect(whole, `« ${word} » doit sortir en un seul morceau`).toBe(true);
      }

      // The header an ATS reads first, on the first page and before the roles
      for (const value of [info.name, info.email, info.phone, info.location, info.title]) at(value);
      expect(squash(pages[0].join(' '))).toContain(squash(info.name));

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
      // Degrees and skills: what a parser fills its remaining fields with.
      // Each skill is its own item, never glued to the next one.
      at(education[0].degree);
      for (const skill of skills[0].items) {
        expect(items.some(item => item.trim() === skill), `« ${skill} » doit sortir seul`).toBe(true);
      }
    });
  });
}
