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
  // One approximate value: "dizaines" translates as "dozens", "douzaine" as "dozen", and each pair must back the other
  [["dizaine", "dizaines", "douzaine", "douzaines", "dozen", "dozens"], 10], [["quinzaine"], 15],
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

/** Units written against a figure ("40ms", "48h", "3j", "16Go", "15e"): the figure is a number, not the start of a name */
const UNITS = "ms|sec|min|mn|hrs?|h|s|jrs?|j|jours?|ans?|mois|sem|km|kg|go|mo|ko|gb|mb|kb|tb|to|eme|ere|er|re|nde|e|nd|rd|th|st|pts?|x";
// The digits are taken whole ((?!\d)): backtracking read "40ms" as 4 and "99designs" as 9.
// A letter before the digits makes them a name ("B2B", "iOS17"), except the x of a
// multiplier ("x3") and the h of "2h30", whose minutes are read as well as its hours.
const FIGURE = new RegExp(
  String.raw`(?<!(?<!\d)h|(?![x×h])\p{L})(?<!\p{N})(\d{1,3}(?:[\s,.]\d{3})+(?!\d)|\d+(?!\d))(?:\s?(${SCALE})(?!\p{L}))?(?=(?:${UNITS})?(?![\p{L}\p{N}])|h\d)`,
  "gu",
);

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
  const normalized = normalizeForMatch(stripInlineMarkdown(text));
  const taken: [number, number][] = [];
  const figures = [...normalized.matchAll(FIGURE)].map((match) => {
    const [all, figure, scale] = match;
    taken.push([match.index, match.index + all.length]);
    const parts = figure.split(/[\s,.]/);
    const whole = Number(parts.join("")) * (scale ? SCALE_VALUES.get(scale)! : 1);
    return [[String(whole)], ...(parts.length > 1 && !scale ? [parts.map(part => String(Number(part)))] : [])];
  });
  let previous = "";
  const words = [...normalized.matchAll(/\p{L}+(?:-\p{L}+)*/gu)].flatMap((match): string[][][] => {
    const parts = match[0].split("-");
    const before = previous;
    previous = parts[parts.length - 1];
    if (taken.some(([start, end]) => match.index >= start && match.index < end)) return [];
    if (parts.length > 1) {
      if (!parts.some(part => WORD_VALUES.has(part))) return [];
      // "un", "one", "neuf" only after "et"/"and" or a number word: "vingt-et-un", "twenty-one", "dix-neuf", never "one-hundred" nor "deux-en-un"
      return parts.flatMap((part, at) => {
        const counts = WORD_VALUES.has(part) || (at > 0 && (["et", "and"].includes(parts[at - 1]) || WORD_VALUES.has(parts[at - 1])));
        return counts && COMPOUND_VALUES.has(part) ? [[[String(COMPOUND_VALUES.get(part))]]] : [];
      });
    }
    const [word] = parts;
    const rest = normalized.slice(match.index + word.length);
    const notNumber = (word === "cent" && ["pour", "per"].includes(before)) || (word === "sept" && /^\.?\s*(\d|(a|au|to)\s|-)/.test(rest));
    const value = WORD_VALUES.get(word);
    return value === undefined || notNumber ? [] : [[[String(value)]]];
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
