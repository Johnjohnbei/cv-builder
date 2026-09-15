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

/** French + English stop words for keyword extraction filtering. */
export const STOP_WORDS = new Set([
  // French
  'les', 'des', 'une', 'pour', 'dans', 'avec', 'sur', 'par', 'est', 'sont', 'qui', 'que',
  'vous', 'nous', 'être', 'avoir', 'tout', 'plus', 'très', 'votre', 'notre',
  'aux', 'son', 'ses', 'ces', 'pas', 'mais', 'aussi', 'bien', 'elle', 'elles',
  'ils', 'leur', 'leurs', 'lui', 'mes', 'mon', 'ton', 'tes', 'vos', 'nos',
  'donc', 'car', 'soit', 'dont', 'comme', 'même', 'entre', 'après', 'avant',
  'chez', 'sans', 'sous', 'vers', 'depuis', 'lors', 'dès', 'hors',
  'cette', 'cet', 'ceux', 'celle', 'celles', 'chaque', 'quel', 'quelle',
  'quels', 'quelles', 'quelque', 'quelques', 'autre', 'autres',
  'fait', 'faire', 'été', 'peut', 'fera', 'font', 'faut', 'doit',
  'sera', 'seront', 'était', 'étaient', 'ont', 'avait',
  'êtes', 'sommes', 'suis', 'avez', 'avons', 'serez', 'serons',
  'étais', 'étiez', 'étions', 'aurais', 'aurait', 'auraient',
  'tous', 'toute', 'toutes', 'aucun', 'aucune', 'tant', 'peu', 'trop',
  'encore', 'déjà', 'alors', 'ainsi', 'jamais', 'toujours',
  'souvent', 'parfois', 'seulement', 'vraiment', 'environ',
  'où', 'quand', 'comment', 'pourquoi', 'combien',
  'celui', 'cela', 'ceci', 'lequel', 'laquelle', 'lesquels', 'lesquelles',
  'oui', 'non', 'si',
  'peut', 'doit', 'veut', 'sait', 'voit',
  'jour', 'jours', 'fois', 'temps', 'ans', 'année', 'années',
  'bon', 'bonne', 'grand', 'grande', 'petit', 'petite',
  'premier', 'première', 'nouveau', 'nouvelle', 'nouveaux', 'nouvelles',
  'propre', 'propres', 'véritable', 'forte', 'fortes',
  'vie', 'monde', 'façon', 'manière', 'part', 'place',
  // English
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'will', 'been',
  'not', 'but', 'all', 'can', 'has', 'her', 'his', 'its', 'may', 'our', 'she',
  'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'how', 'when', 'where',
  'would', 'could', 'should', 'have', 'had', 'does', 'did', 'being', 'having',
  'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'into', 'over', 'after', 'before', 'between', 'through', 'about',
  'than', 'then', 'just', 'also', 'very', 'often', 'here', 'there',
  'your', 'you', 'we', 'my', 'me', 'him',
]);
