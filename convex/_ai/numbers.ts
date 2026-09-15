import { normalizeForMatch, stripInlineMarkdown, type PreparedText } from "../../src/shared/lib/text";

// ─── Reading numbers in offers and CVs ──────────────────────────────
// Extracted from normalizers.ts, over its size limit: the years a requirement
// states and the numbers the truth guard (tailor.ts) compares share the words.

/** Number words an offer or a CV writes numbers with ("cinq ans", "five years"), from 1 */
export const NUMBER_WORDS = [
  ["un", "une", "one"], ["deux", "two"], ["trois", "three"], ["quatre", "four"], ["cinq", "five"],
  ["six"], ["sept", "seven"], ["huit", "eight"], ["neuf", "nine"], ["dix", "ten"],
  ["onze", "eleven"], ["douze", "twelve"], ["treize", "thirteen"], ["quatorze", "fourteen"], ["quinze", "fifteen"],
];

const WORD_VALUES = new Map(NUMBER_WORDS.flatMap((words, i) => words.map(word => [word, String(i + 1)] as const)));

/**
 * Whether the quote gives `years` as a number of years, in digits or in words:
 * "3 ans", "+5 ans", "trois à cinq années", "entre 3 et 5 ans", "3/5 ans",
 * "5+ years", "two (2) years". The unit is required ("un" is in almost every
 * quote), and the number of a degree is not years ("Bac+5 et 3 ans", "Master 2
 * et 5 ans", "Licence 3 ou 2 ans").
 */
export function statesYears(quote: PreparedText, years: number): boolean {
  const number = [String(years), ...(NUMBER_WORDS[years - 1] ?? [])].join("|");
  const notDegree = String.raw`(?<!(?:^|[^\p{L}])(?:bac|licence|master|bts|dut|m|l)\s*\+?\s*)`;
  // "et"/"and" only after "entre"/"between"
  const between = String.raw`(?:entre|between)\s+(?:${number})\s+(?:et|and)\s+[\p{L}\p{N}]+`;
  const range = String.raw`${notDegree}(?:${number})\+?(?:(?:\s*[-/]\s*|\s+(?:a|to|ou|or)\s+)[\p{L}\p{N}]+)?`;
  const unit = String.raw`\+?(?:\s*\(\s*\d+\s*\))?\s*(?:ans?|annees?|years?|yrs?)(?![\p{L}\p{N}])`;
  return new RegExp(String.raw`(?:^|[^\p{L}\p{N}])(?:${between}|${range})${unit}`, "u").test(quote.normalized);
}

/**
 * The numbers a text gives, each written one way: "1 500", "1,500" and "1500"
 * are 1500, "trois" and "three" are 3, the markdown the templates render is
 * read through. A digit inside a name ("B2B", "S3") is not a number.
 */
export function numbersOf(text: string | undefined): string[] {
  if (!text) return [];
  const normalized = normalizeForMatch(stripInlineMarkdown(text));
  const digits = (normalized.match(/(?<!\p{L})(?:\d{1,3}(?:[\s,.]\d{3})+(?!\d)|\d+)/gu) ?? []).map(n => n.replace(/\D/g, ""));
  const words = (normalized.match(/\p{L}+/gu) ?? []).flatMap(word => WORD_VALUES.get(word) ?? []);
  return [...digits, ...words];
}
