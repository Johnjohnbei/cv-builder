// Text helpers shared by the app and the Convex functions: relative imports
// only here, the Convex bundler does not resolve the "@/" alias.

/** Without diacritics: "Société Générale" is "Societe Generale". Case and spacing kept. */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** A global regex matching any of these code points: typographic and invisible characters stay readable in the source */
const anyOf = (codePoints: number[]) => new RegExp(`[${String.fromCodePoint(...codePoints)}]`, 'g');

/** Typographic marks folded to the plain ones a CV or an AI quote is typed with */
const TYPOGRAPHIC: [RegExp, string][] = [
  [anyOf([0x2018, 0x2019, 0x201b, 0x02bc, 0x00b4, 0x0060, 0x2032]), "'"],
  [anyOf([0x00ab, 0x00bb, 0x201c, 0x201d, 0x201e, 0x2033]), '"'],
  [anyOf([0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212]), '-'],
  [anyOf([0x00ad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]), ''],
];

/**
 * The form two texts are compared in: compatibility-decomposed (ligatures,
 * full-width forms), lowercase, without accents, typographic apostrophes,
 * quotes and dashes folded, invisible characters dropped, whitespace collapsed.
 * Offers copied from a website or Word carry that punctuation; CVs and AI
 * quotes mostly do not.
 */
export function normalizeForMatch(s: string): string {
  const folded = TYPOGRAPHIC.reduce((text, [pattern, plain]) => text.replace(pattern, plain), stripAccents(s.normalize('NFKD').toLowerCase()));
  return folded.replace(/\s+/g, ' ').trim();
}
