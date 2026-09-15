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

/**
 * Words the truth guard reads as numbers. Not "un", "une", "one" (an article
 * in almost every sentence) nor "neuf" (new): read as 1 and 9, they removed
 * legitimate bullets.
 */
const GUARD_WORD_VALUES = new Map<string, string>([
  ...NUMBER_WORDS.flatMap((words, i) => words.map(word => [word, String(i + 1)] as const))
    .filter(([word]) => !["un", "une", "one", "neuf"].includes(word)),
  ["vingt", "20"], ["trente", "30"], ["quarante", "40"], ["cinquante", "50"], ["soixante", "60"], ["cent", "100"], ["mille", "1000"],
  ["twenty", "20"], ["thirty", "30"], ["forty", "40"], ["fifty", "50"], ["sixty", "60"], ["hundred", "100"], ["thousand", "1000"],
]);

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

/**
 * The numbers a text gives, each with the readings it may have: "1 500" is
 * 1500, or 1 and 500 ("Top 3 100 clients"); "5k" is 5000 or 5 ("5 milliers"),
 * "30M" 30000000 or 30 ("30 millions"); "trois" and "three" are 3; a multiplier
 * "x3" is 3. The markdown the templates render is read through, and a digit
 * inside a name ("B2B", "S3") is no number.
 */
export function numberReadings(text: string | undefined): string[][] {
  if (!text) return [];
  const normalized = normalizeForMatch(stripInlineMarkdown(text));
  const figures = [...normalized.matchAll(/(?<!(?![x×])\p{L})(\d{1,3}(?:[\s,.]\d{3})+(?!\d)|\d+)(?:\s?([km])(?!\p{L}))?/gu)]
    .map(([, figure, scale]) => {
      const parts = figure.split(/[\s,.]/);
      const whole = Number(parts.join(""));
      const scaled = scale ? [String(whole * (scale === "k" ? 1_000 : 1_000_000))] : [];
      return [...scaled, String(whole), ...(parts.length > 1 ? parts.map(part => String(Number(part))) : [])];
    });
  const words = (normalized.match(/\p{L}+/gu) ?? []).flatMap(word => {
    const value = GUARD_WORD_VALUES.get(word);
    return value ? [[value]] : [];
  });
  return [...figures, ...words];
}
