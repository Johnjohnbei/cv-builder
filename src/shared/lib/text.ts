// Text helpers shared by the app and the Convex functions: relative imports
// only here, the Convex bundler does not resolve the "@/" alias.

/** Without diacritics: "Société Générale" is "Societe Generale". Case and spacing kept. */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** A global regex matching any of these code points: typographic and invisible characters stay readable in the source */
const anyOf = (codePoints: number[]) => new RegExp(`[${String.fromCodePoint(...codePoints)}]`, 'gu');

/**
 * Typographic marks folded to the plain ones a CV or an AI quote is typed with.
 * Applied BEFORE the compatibility decomposition, which splits an acute accent
 * into a space and a combining mark, and a trade mark sign into "tm".
 */
const TYPOGRAPHIC: [RegExp, string][] = [
  [anyOf([0x2018, 0x2019, 0x201b, 0x02bc, 0x00b4, 0x0060, 0x2032]), "'"],
  [anyOf([0x00ab, 0x00bb, 0x201c, 0x201d, 0x201e, 0x2033, 0x2039, 0x203a]), '"'],
  [anyOf([0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212]), '-'],
  [anyOf([0x2122, 0x2120, 0x00ae, 0x00a9]), ' '],
  // soft hyphen, zero-width, direction marks and isolates, word joiner, BOM
  [anyOf([0x00ad, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2060, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff]), ''],
];

/**
 * The form two texts are compared in: typographic marks folded, invisible
 * characters dropped, compatibility-decomposed (ligatures, full-width forms),
 * lowercase, without accents, whitespace collapsed. Offers copied from a
 * website or Word carry that punctuation; CVs and AI quotes mostly do not.
 */
export function normalizeForMatch(s: string): string {
  const fold = (text: string) => TYPOGRAPHIC.reduce((folded, [pattern, plain]) => folded.replace(pattern, plain), text);
  // Folded again after: the decomposition also makes marks (U+FE58 is an em dash)
  return stripAccents(fold(fold(s).normalize('NFKD')).toLowerCase()).replace(/\s+/g, ' ').trim();
}

/**
 * Text without the inline markdown AI output carries (**bold**, *italic*,
 * `code`), as renderInlineMarkdown prints it. Underscores are left alone:
 * snake_case and emails would be mangled.
 */
export function stripInlineMarkdown(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/`([^`\n]+?)`/g, '$1');
}

// ─── Phrase matching: the owner for the ATS score, the requirement checks and the portfolio suggestion ───

/**
 * Strip common FR/EN suffixes for lightweight stemming.
 *
 * Scope (intentionally minimal):
 *   - Plural normalization:  -s / -es / -x
 *   - EN present participle: -ing
 *   - FR profession suffix:  -eur / -eurs
 *
 * NOT covered: FR verb conjugations (gestion, gère), synonyms and
 * abbreviations (React, ReactJS: requirement variants are for that), typos.
 *
 * Preserves roots of 3 chars or more after stripping to avoid over-reduction
 * ("les" stays "les", "iOS" stays "iOS").
 */
export function stripSimpleSuffixes(word: string): string {
  if (word.length < 4) return word;
  // A trailing -e goes last: without it "systemes" stemmed to "system" but
  // "systeme" stayed "systeme", so a singular never matched its own plural.
  const suffixes = ['ings', 'ing', 'eurs', 'eur', 'es', 's', 'x', 'e'];
  for (const suf of suffixes) {
    const root = word.length - suf.length;
    // x is a French plural after au, eu, ou (reseaux, jeux, bijoux), never in unix or redux
    if (!word.endsWith(suf) || root < 3 || (suf === 'x' && !/[aeo]u$/.test(word.slice(0, root)))) continue;
    // A double s is never a plural: "less", "sass" and "access" are names, not "les" or "sas"
    if (suf === 's' && word[root - 1] === 's') return word;
    return word.slice(0, root);
  }
  return word;
}

/** Stem a normalized phrase word by word (words under 4 chars kept), punctuation left in place: "apis," is "api," */
function stemPhrase(s: string): string {
  return s.replace(/[\p{L}\p{M}\p{N}]+/gu, w => (w.length >= 4 ? stripSimpleSuffixes(w) : w));
}

/** The views of a haystack matching needs, built once per text instead of once per term */
export interface PreparedText {
  raw: string;
  normalized: string;
  stemmed: string;
}

export function prepareText(text: string): PreparedText {
  const normalized = normalizeForMatch(text);
  return { raw: text, normalized, stemmed: stemPhrase(normalized) };
}

/** A letter, combining mark or digit, in any script */
const WORD = '[\\p{L}\\p{M}\\p{N}]';
const NOT_WORD = '[^\\p{L}\\p{M}\\p{N}]';
const STARTS_WITH_WORD = new RegExp(`^${WORD}`, 'u');
const ENDS_WITH_WORD = new RegExp(`${WORD}$`, 'u');

/**
 * What a technical name writes between its parts, and what a CV writes
 * instead: "CI/CD" is also "CI / CD" and "CICD", "full-stack" is "full stack",
 * "e-commerce" is "ecommerce". The offer gives the label, so it is always the
 * CV that spells it the other way, and the requirement was counted lost.
 */
const SEPARATOR = '[\\s./-]*';
const SEGMENTED = new RegExp(`^${WORD}+(?:[\\s./-]+${WORD}+)+$`, 'u');

/**
 * The "js" of a framework, optional on both sides: an offer asking for
 * "React.js" is answered by a CV writing "React", and "Angular" is written
 * "AngularJS". Only on a root of three characters or more, so "js" alone keeps
 * its meaning.
 */
const JS_SUFFIX = /^(.{3,}?)[.\s-]?js$/u;
const ALPHANUMERIC = /^[\p{L}\p{M}\p{N}]+$/u;

/** A name of three characters or less: Go, R, C, Vue, SAS are exactly the ones an offer filters on */
const SHORT_NAME = /^[\p{L}\p{M}\p{N}]{1,3}$/u;

const escapeRegExp = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `term` as a regular expression, its parts allowed to be written with another
 * separator or none. Two parts of three characters or less may come in either
 * order ("UX/UI" is "UI/UX"), which longer names never get: "front end" is not
 * "end front".
 */
function patternOf(term: string): string {
  const js = term.match(JS_SUFFIX);
  const base = js ? js[1] : term;
  const tail = ALPHANUMERIC.test(base) && base.length >= 3 ? '(?:[.\\s-]?js)?' : '';
  if (!SEGMENTED.test(base)) return escapeRegExp(base) + tail;
  const parts = base.split(/[\s./-]+/).map(escapeRegExp);
  const joined = parts.join(SEPARATOR);
  const swapped = parts.length === 2 && parts.every(part => part.length <= 3)
    ? `|${parts[1]}${SEPARATOR}${parts[0]}`
    : '';
  return `(?:${joined}${swapped})${tail}`;
}

/**
 * `term` as whole words of `text`, both normalized. A term starting or ending
 * with a symbol (the dot of .NET) needs no boundary on that side. "+" and "#"
 * ending a name belong to it (C is not in C++ or C#), not when a word follows
 * (Bac is in Bac+5). A hyphen or an ampersand glued to another word is not a
 * boundary either: "Office" is not in "back-office", "Go" is not in
 * "go-to-market", "R" is not in "R&D". The left boundary consumes a character:
 * a lookbehind is a SyntaxError before Safari 16.4.
 */
function containsWords(text: string, term: string): boolean {
  const left = STARTS_WITH_WORD.test(term) ? `(?:^[-&]?|[^\\p{L}\\p{M}\\p{N}&-]|${NOT_WORD}[-&])` : '';
  const right = ENDS_WITH_WORD.test(term) ? `(?!${WORD}|[-&]${WORD}|[+#]+(?!${WORD}))` : '';
  return new RegExp(`${left}${patternOf(term)}${right}`, 'u').test(text);
}

/**
 * A short name written with the capitals the offer gives it.
 *
 * Under four characters nothing is stemmed and a word boundary is cheap, so
 * "Vue" was found in "vue d'ensemble" and "Go" in a sentence that merely says
 * go. Capitals are what tells a product from a common word, and only a term
 * carrying one is asked for them, in its own case or in full capitals (a CV
 * listing its skills in capitals still answers).
 */
function writtenAsNamed(phrase: string, raw: string): boolean {
  // One short word, its js left aside ("Vue.js" is the name "Vue"). A name
  // written with a separator ("C/C++", "CI/CD") is not one of these.
  const name = stripAccents(phrase).replace(/[.\s-]?js$/i, '');
  if (!SHORT_NAME.test(name) || name === name.toLowerCase()) return true;
  const text = stripAccents(raw);
  return text.includes(name) || text.includes(name.toUpperCase());
}

/**
 * Contiguous phrase match on word boundaries of any script, tolerant to
 * accents, typography, plural or suffix variants on both sides, and to the
 * separator a technical name is written with. Word order and adjacency are
 * kept: "equipe design" must not match an "équipe" in one paragraph and a
 * "design" in another, and "Java" is not in "JavaScript".
 */
export function matchPhrase(phrase: string, text: PreparedText): boolean {
  const normalized = normalizeForMatch(phrase);
  if (!normalized) return false;
  if (!writtenAsNamed(phrase, text.raw)) return false;
  return containsWords(text.normalized, normalized) || containsWords(text.stemmed, stemPhrase(normalized));
}
