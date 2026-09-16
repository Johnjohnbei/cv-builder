import { normalizeForMatch, stripInlineMarkdown, type PreparedText } from "../../src/shared/lib/text";

// ─── Reading numbers in offers and CVs ──────────────────────────────
// Extracted from normalizers.ts, over its size limit: the years a requirement
// states and the numbers the truth guard (truthGuard.ts) compares.

/** Number words an offer writes years with ("cinq ans", "five years"), from 1 */
const NUMBER_WORDS = [
  ["un", "une", "one"], ["deux", "two"], ["trois", "three"], ["quatre", "four"], ["cinq", "five"],
  ["six"], ["sept", "seven"], ["huit", "eight"], ["neuf", "nine"], ["dix", "ten"],
  ["onze", "eleven"], ["douze", "twelve"], ["treize", "thirteen"], ["quatorze", "fourteen"], ["quinze", "fifteen"],
];

/** A number word's value, and the scale a word after a figure gives it ("30 millions") */
const TENS: [string[], number][] = [
  // Not "seize": the English verb ("seize opportunities") is far more common in a CV
  [["sixteen"], 16], [["seventeen"], 17], [["eighteen"], 18], [["nineteen"], 19],
  [["vingt", "vingts", "twenty"], 20], [["trente", "thirty"], 30], [["quarante", "forty"], 40],
  [["cinquante", "fifty"], 50], [["soixante", "sixty"], 60], [["septante", "seventy"], 70],
  [["huitante", "octante", "eighty"], 80], [["nonante", "ninety"], 90],
  // "dozens" translates "dizaines", not "douzaines": each reads as the other's value
  [["dizaine", "dizaines", "dozens"], 10], [["douzaine", "douzaines", "dozen"], 12], [["quinzaine"], 15],
  [["vingtaine"], 20], [["trentaine"], 30], [["cinquantaine"], 50], [["centaine", "centaines"], 100],
];
const SCALES: [string[], number][] = [
  [["cent", "cents", "hundred", "hundreds"], 100],
  [["k", "mille", "millier", "milliers", "thousand", "thousands"], 1_000],
  [["m", "million", "millions"], 1_000_000],
  [["md", "mds", "bn", "milliard", "milliards", "billion", "billions"], 1_000_000_000],
];

/**
 * Words the truth guard reads as numbers. Not "un", "une", "one" (an article
 * in almost every sentence) nor "neuf" (new): read as 1 and 9, they removed
 * legitimate bullets. A scale word alone ("des millions") is its own number,
 * an abbreviation alone ("k", "MD") is not.
 */
const WORD_VALUES = new Map<string, number>([
  ...NUMBER_WORDS.flatMap((words, i) => words.map(word => [word, i + 1] as const))
    .filter(([word]) => !["un", "une", "one", "neuf"].includes(word)),
  ...[...TENS, ...SCALES.map(([words, value]) => [words.filter(word => word.length > 3), value] as const)]
    .flatMap(([words, value]) => words.map(word => [word, value] as const)),
]);
/** Inside a number compound ("vingt-et-un", "dix-neuf", "twenty-one"), the excluded words are numbers too */
// (read only after "et"/"and" or a number word: see numberReadings)
const COMPOUND_VALUES = new Map([...WORD_VALUES, ["un", 1], ["une", 1], ["one", 1], ["neuf", 9]]);
/**
 * Words giving an order of magnitude, read apart from the figure they are near
 * ("~10"): "une dizaine" is not the exact "10", and "10" does not back it.
 */
const APPROXIMATE = new Set([
  "dizaine", "dizaines", "dozens", "douzaine", "douzaines", "dozen", "quinzaine",
  "vingtaine", "trentaine", "cinquantaine", "centaine", "centaines",
]);
/** A word's number as it is compared: an approximate word never matches an exact figure */
const reading = (word: string, value: number) => (APPROXIMATE.has(word) ? `~${value}` : String(value));
const SCALE_VALUES = new Map(SCALES.flatMap(([words, value]) => words.map(word => [word, value] as const)));
const SCALE = SCALES.flatMap(([words]) => words).sort((a, b) => b.length - a.length).join("|");

/**
 * Whether the quote gives `years` as a number of years, in digits or in words:
 * "3 ans", "+5 ans", "trois à cinq années", "entre 3 et 5 ans", "3/5 ans",
 * "5+ years", "two (2) years". The unit is required ("un" is in almost every
 * quote), and the number of a degree is not years ("Bac+5 et 3 ans", "Master 2
 * et 5 ans", "Licence 3 ou 2 ans", "Bac+3/5 ans").
 */
export function statesYears(quote: PreparedText, years: number): boolean {
  const number = [String(years), ...(NUMBER_WORDS[years - 1] ?? [])].join("|");
  const degree = String.raw`(?:^|[^\p{L}])(?:bac|licence|master|bts|dut|m|l)\s*\+?\s*`;
  const notDegree = String.raw`(?<!${degree})(?<!${degree}\d+\s*[-/]\s*)`;
  // "et"/"and" only after "entre"/"between"
  const between = String.raw`(?:entre|between)\s+(?:${number})\s+(?:et|and)\s+[\p{L}\p{N}]+`;
  const range = String.raw`${notDegree}(?:${number})\+?(?:(?:\s*[-/]\s*|\s+(?:a|to|ou|or)\s+)[\p{L}\p{N}]+)?`;
  const unit = String.raw`\+?(?:\s*\(\s*\d+\s*\))?\s*(?:ans?|annees?|years?|yrs?)(?![\p{L}\p{N}])`;
  return new RegExp(String.raw`(?:^|[^\p{L}\p{N}])(?:${between}|${range})${unit}`, "u").test(quote.normalized);
}

// The digits are taken whole ((?!\d)): backtracking read "40ms" as 4 and "99designs" as 9.
// A unit glued to the figure leaves it a number, whatever the unit is ("40ms",
// "30fps", "5L", "1080p"): up to five letters, past which it is a name
// ("99designs", "360Learning"). A closed list of units read "120fps" as no
// number at all, and an invented one passed the guard.
// A letter BEFORE the digits also makes a name ("B2B", "iOS17", "Linux3",
// "H.264"), except the x of a multiplier ("x3", "10x") and the h of "2h30",
// whose minutes are read as well as its hours.
const FIGURE = new RegExp(
  String.raw`(?<!(?<!\d)h|(?![x×h])\p{L}|\p{L}[x×h]|\p{L}\.)(?<!\p{N})(\d{1,3}(?:[\s,.]\d{3})+(?!\d)|\d+(?:[.,]\d+)?(?!\d))(?:\s?(${SCALE})(?!\p{L}))?(?=\p{L}{0,5}(?![\p{L}\p{N}])|h\d)`,
  "gu",
);

/** Months as a date abbreviates them, in French and in English, accents gone */
const MONTHS = "janv|jan|fevr|feb|mars|mar|avr|apr|mai|may|juin|jun|juil|jul|aout|aug|sept|sep|oct|nov|dec";
/**
 * What follows "sept" when it abbreviates September: a year, or a range ending
 * on another month ("sept. 2019", "de sept. à déc. 2019", "sept.-déc."). The
 * rest reads as seven, the point included ("équipe de sept.", "sept à dix
 * personnes", "sept. Au total"): a point is the end of a sentence far more
 * often than the mark of a month.
 */
const SEPTEMBER = new RegExp(String.raw`^\.?\s*(?:\d{4}(?!\d)|(?:[-/]|(?:a|au|to)\s+)\s*(?:${MONTHS}))`, "u");

/** The month "sept." and the "cent" of "pour cent" are no numbers, wherever they are read from */
function notNumberWord(word: string, before: string, rest: string): boolean {
  if (word === "cent") return ["pour", "per"].includes(before);
  return word === "sept" && SEPTEMBER.test(rest);
}

/**
 * Digits every reading below expects: those of another script read as their
 * value ("٣"), and a fraction NFKD leaves as digits around a slash ("½" is
 * "1⁄2") read as the number it is.
 */
const OTHER_ZEROS = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0e50];
function plainDigits(text: string): string {
  return text
    .replace(/\p{Nd}/gu, (digit) => {
      const code = digit.codePointAt(0)!;
      const zero = OTHER_ZEROS.find(start => code >= start && code < start + 10);
      return zero === undefined ? digit : String(code - zero);
    })
    .replace(/(\d+)⁄(\d+)/g, (all, top, bottom) => (Number(bottom) ? String(Number(top) / Number(bottom)) : all));
}

/**
 * The numbers a text gives, each with the ways it can be read, a way being the
 * values that must all be backed: "1 500" is 1500, or 1 and 500 ("Top 3 100
 * clients"); "5k" and "5 milliers" are 5000; "trois" and "three" are 3; "x3" is
 * 3; each part of "vingt-et-un" is read. The first way is the plain reading.
 * The markdown the templates render is read through; digits in a name ("B2B",
 * "iOS17", "3D", "99designs"), "pour cent" and the month "sept." are no numbers.
 */
function numberReadings(text: string | undefined): string[][][] {
  if (!text) return [];
  const normalized = plainDigits(normalizeForMatch(stripInlineMarkdown(text)));
  // One flag per character, not a list of spans scanned again for every word:
  // the scan was quadratic, and an offer of 240 kB took four seconds
  const taken = new Uint8Array(normalized.length);
  const figures = [...normalized.matchAll(FIGURE)].map((match) => {
    const [all, figure, scale] = match;
    taken.fill(1, match.index, match.index + all.length);
    const parts = figure.split(/[\s,.]/);
    // A separator followed by three digits groups thousands ("1 500", "1,500");
    // anything else is a decimal ("1,5 M" is 1 500 000, never 1 and 5 000 000)
    const grouped = parts.length > 1 && parts.slice(1).every(part => part.length === 3);
    const base = grouped ? Number(parts.join("")) : Number(figure.replace(",", "."));
    const whole = base * (scale ? SCALE_VALUES.get(scale)! : 1);
    return [[String(whole)], ...(grouped && !scale ? [parts.map(part => String(Number(part)))] : [])];
  });
  let previous = "";
  const words = [...normalized.matchAll(/\p{L}+(?:-\p{L}+)*/gu)].flatMap((match): string[][][] => {
    const parts = match[0].split("-");
    const before = previous;
    previous = parts[parts.length - 1];
    if (taken[match.index]) return [];
    const after = normalized.slice(match.index + match[0].length);
    if (parts.length > 1) {
      if (!parts.some(part => WORD_VALUES.has(part))) return [];
      // "un", "one", "neuf" only after "et"/"and" or a number word: "vingt-et-un", "twenty-one", "dix-neuf", never "one-hundred" nor "deux-en-un"
      return parts.flatMap((part, at) => {
        const counts = WORD_VALUES.has(part) || (at > 0 && (["et", "and"].includes(parts[at - 1]) || WORD_VALUES.has(parts[at - 1])));
        // The words of a compound are read one by one: "sept-oct 2020" and
        // "pour-cent" write a month and a share there too
        const rest = parts.slice(at + 1).map(next => `-${next}`).join("") + after;
        if (!counts || !COMPOUND_VALUES.has(part) || notNumberWord(part, at > 0 ? parts[at - 1] : before, rest)) return [];
        return [[[reading(part, COMPOUND_VALUES.get(part)!)]]];
      });
    }
    const [word] = parts;
    const value = WORD_VALUES.get(word);
    return value === undefined || notNumberWord(word, before, after) ? [] : [[[reading(word, value)]]];
  });
  return [...figures, ...words];
}

/** The numbers a text gives, each read the plain way: what a source backs */
export function numbersOf(text: string | undefined): string[] {
  return numberReadings(text).map(([plain]) => plain[0]);
}

/** Whether `text` gives a number no way of reading of which `backed` holds whole */
export function hasUnbackedNumber(text: string | undefined, backed: Set<string>): boolean {
  return numberReadings(text).some(ways => !ways.some(values => values.every(value => backed.has(value))));
}
