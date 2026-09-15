import { CVDataSchema, JobRequirementSchema } from "./schemas";
import type {
  JobRequirement,
  CVData,
  Experience,
  SkillCategory,
  Language,
  ExperienceDisplayMode,
} from "../../src/shared/types";
import { omitUserOwnedFields, pickUserOwnedFields } from "../../src/shared/types";
import { matchPhrase, normalizeForMatch, prepareText } from "../../src/shared/lib/text";

// ─── Job requirements ────────────────────────────────────────────
const MAX_REQUIREMENTS = 25;

/** Symbols carry meaning in skill names: C++, C# and C must not share an id. Combining marks are kept (バス is not パス). */
const slugOf = (key: string) => key
  .replace(/\+/g, " plus ").replace(/#/g, " sharp ").replace(/^\./, "dot ")
  .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

/** Number words an offer writes years with ("cinq ans", "five years"), from 1 */
const NUMBER_WORDS = [
  ["un", "une", "one"], ["deux", "two"], ["trois", "three"], ["quatre", "four"], ["cinq", "five"],
  ["six"], ["sept", "seven"], ["huit", "eight"], ["neuf", "nine"], ["dix", "ten"],
  ["onze", "eleven"], ["douze", "twelve"], ["treize", "thirteen"], ["quatorze", "fourteen"], ["quinze", "fifteen"],
];

/**
 * Whether the quote gives `years` as a number of years, in digits or in words:
 * "3 ans", "trois à cinq années", "entre 3 et 5 ans", "3/5 ans", "5+ years",
 * "two (2) years". The unit is
 * required, "un" or the 5 of "Bac+5" are in almost every quote.
 */
function statesYears(quote: ReturnType<typeof prepareText>, years: number): boolean {
  const number = [String(years), ...(NUMBER_WORDS[years - 1] ?? [])].join("|");
  const range = String.raw`(?:\s*[-/]\s*|\s+(?:a|to|ou|or|et|and)\s+)[\p{L}\p{N}]+`;
  const unit = String.raw`\+?(?:\s*\(\s*\d+\s*\))?\s*(?:ans?|annees?|years?|yrs?)(?![\p{L}\p{N}])`;
  return new RegExp(String.raw`(?:^|[^\p{L}\p{N}])(?:${number})\+?(?:${range})?${unit}`, "u").test(quote.normalized);
}

/**
 * The requirements the offer actually states, checked one by one. A malformed
 * item is dropped, not the list. A requirement is dropped when its quote is not
 * words of the offer, or when the quote does not state it: its label or a
 * variant must be words of the quote (a title or a degree may be reworded),
 * and years of experience must be the number the quote gives. Otherwise any
 * label passed by quoting a real fragment of the offer. Text injected in the
 * offer is quotable too: the prompt fences the offer as data.
 * The id is computed from the label, never taken from the model.
 */
export function normalizeJobRequirements(items: unknown[], jobDescription: string): JobRequirement[] {
  const offer = prepareText(jobDescription);
  const ids = new Set<string>();
  const requirements: JobRequirement[] = [];
  for (const item of items) {
    const parsed = JobRequirementSchema.safeParse(withoutNulls(item));
    if (!parsed.success) continue;
    const { label, variants, kind, importance, quote, minYears } = parsed.data;
    const key = normalizeForMatch(label);
    const id = slugOf(key);
    const quoted = prepareText(quote);
    if (!id || ids.has(id) || !quoted.normalized || !matchPhrase(quote, offer)) continue;

    const seen = new Set([key]);
    const cleanVariants = variants.map(v => v.trim()).filter(v => {
      const k = normalizeForMatch(v);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (kind === "experience_years") {
      // Years are measured from the dates, which needs the number the offer gives
      if (!(typeof minYears === "number" && minYears > 0 && statesYears(quoted, minYears))) continue;
    } else if (kind !== "title" && kind !== "education") {
      if (![label, ...cleanVariants].some(term => matchPhrase(term, quoted))) continue;
    }
    ids.add(id);
    requirements.push({
      id, label: label.trim(), variants: cleanVariants, kind, importance, quote: quote.trim(),
      ...(kind === "experience_years" && { minYears }),
    });
    if (requirements.length === MAX_REQUIREMENTS) break;
  }
  return requirements;
}

// ─── User-owned fields: kept away from the model ─────────────────
/** The CV as the model should see it: no photo, no portfolio link. */
export function withoutUserOwnedFields<T extends { personal_info?: CVData["personal_info"] }>(cv: T): T {
  if (!cv?.personal_info) return cv;
  return { ...cv, personal_info: omitUserOwnedFields(cv.personal_info) as CVData["personal_info"] };
}

/**
 * Put the user-owned fields of `source` back on the model's answer. Whatever
 * the model returned for them is discarded, even a photo it made up.
 */
export function restoreUserOwnedFields(result: CVData, source: { personal_info?: CVData["personal_info"] } | undefined): CVData {
  return {
    ...result,
    personal_info: {
      ...omitUserOwnedFields(result.personal_info),
      ...pickUserOwnedFields(source?.personal_info),
    },
  };
}

// ─── Proficiency: store RAW, localize at render ──────────────────
// The backend must NOT freeze proficiency to a localized string. It used to
// map to French ("Courant (C1)"), which then rendered French even on an
// English CV, AND survived translateCV (re-frozen after translation). The
// bilingual owner is the render-side normalizeProficiency in
// src/features/editor/lib/formatting.ts — it localizes FR↔EN from the raw
// source value (LinkedIn "Full professional", "Native or bilingual", …). So
// here we only trim: keep the raw value, let the render localize it.
export function normalizeProficiency(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim();
}

// ─── Title coercion ──────────────────────────────────────────────
export function normalizeTitle(title: string | undefined): string | undefined {
  if (!title || typeof title !== "string") return title;
  if (title.length <= 50) return title;
  const parts = title.split(/[|,]/);
  return parts[0].trim();
}

// ─── displayMode coercion ────────────────────────────────────────
// Absence is meaningful and must survive: an experience with NO displayMode is
// one that has never been triaged, which is exactly the signal useFitToPages
// waits for to fit the CV to its page budget from real measurements. Defaulting
// to "normal" here used to erase that signal on every AI rewrite, so the CV
// came back pre-assigned by a model that cannot measure anything.
const VALID_DISPLAY_MODES: ExperienceDisplayMode[] = ["hidden", "compact", "normal", "extended"];
function normalizeDisplayMode(mode: unknown): ExperienceDisplayMode | undefined {
  if (typeof mode === "string" && (VALID_DISPLAY_MODES as string[]).includes(mode)) {
    return mode as ExperienceDisplayMode;
  }
  return undefined;
}

// ─── Description coercion ────────────────────────────────────────
// Every bullet survives: the prompts promise to delete nothing, and the
// fit-to-pages pass decides what is shown. A cap of 5 used to drop the 6th
// bullet on every rewrite and translation, and long bullets were cut on any
// hyphen ("B2B - SaaS") with short fragments thrown away. Only bullets the
// model glued into one string with line breaks or "•" markers are split back.
function normalizeDescription(raw: unknown): string[] {
  const items = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
  return items
    .filter((d): d is string => typeof d === "string")
    .flatMap((d) => d.split(/\n+|(?:^|\s)•\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─── Experience coercion ─────────────────────────────────────────
const PRESENT_END_DATES = new Set([
  "present", "aujourd'hui", "actuel", "actuellement", "en cours", "now", "today", "current", "ongoing",
]);

export function normalizeExperience(raw: any): Experience {
  const endDateRaw = typeof raw.end_date === "string" ? raw.end_date.trim() : "";
  const endDateKey = normalizeForMatch(endDateRaw);
  // An empty end date only means "current" when the model did not say
  // otherwise: a past role whose end date is unknown is not a current one.
  const isCurrent =
    raw.current === true ||
    raw.current === "true" ||
    PRESENT_END_DATES.has(endDateKey) ||
    (endDateRaw === "" && raw.current !== false && raw.current !== "false");

  return {
    company: typeof raw.company === "string" ? raw.company : "",
    position: typeof raw.position === "string" ? raw.position : "",
    location: typeof raw.location === "string" ? raw.location : undefined,
    start_date: typeof raw.start_date === "string" ? raw.start_date : "",
    end_date: isCurrent ? "" : endDateRaw,
    current: isCurrent,
    intro: typeof raw.intro === "string" ? raw.intro : undefined,
    description: normalizeDescription(raw.description),
    kpi: typeof raw.kpi === "string" ? raw.kpi.trim() : "",
    showKpi: typeof raw.showKpi === "boolean" ? raw.showKpi : undefined,
    displayMode: normalizeDisplayMode(raw.displayMode),
    // Deduced by the same call that rewrites the CV. Kept here because this
    // normalizer rebuilds the object field by field: anything not listed is
    // dropped, which is what used to force a separate enrichment round-trip.
    companyStage: typeof raw.companyStage === "string" ? raw.companyStage : undefined,
    companyBusinessModel: typeof raw.companyBusinessModel === "string" ? raw.companyBusinessModel : undefined,
  };
}

// ─── Skills coercion ─────────────────────────────────────────────
export function normalizeSkills(raw: unknown): SkillCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((cat: any): SkillCategory => {
      const category =
        typeof cat?.category === "string" && cat.category.trim().length > 0
          ? cat.category
          : "Compétences";
      const rawItems = Array.isArray(cat?.items) ? cat.items : [];
      const stringItems: string[] = rawItems
        .map((item: any): string => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object") {
            return String(item.name ?? item.skill ?? item.title ?? "").trim();
          }
          return String(item ?? "").trim();
        })
        .filter((s: string) => s.length > 0);
      // Dedupe case-insensitively, preserve first occurrence
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const item of stringItems) {
        const key = item.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(item);
        }
      }
      // No cap on items or categories: same reason as the bullets, a
      // translation must not silently shorten the CV.
      return {
        category,
        items: deduped,
        displayMode: cat?.displayMode,
      };
    });
}

// ─── Languages coercion ──────────────────────────────────────────
function normalizeLanguages(raw: unknown): Language[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(
    (lang: any): Language => ({
      name: typeof lang?.name === "string" ? lang.name : "",
      proficiency: normalizeProficiency(lang?.proficiency),
    })
  );
}

// ─── Top-level normalizer (D-05) ─────────────────────────────────
/**
 * Drop null values, in objects and arrays. Models emit `"end_date": null` for
 * "unknown"; the schema's optional fields refuse null, so a single one used to
 * reject the whole CV ("L'IA a retourné un CV invalide"), and Convex refuses
 * null on save anyway.
 */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((v) => v !== null).map(withoutNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, withoutNulls(v)]),
    );
  }
  return value;
}

export function normalizeCVData(raw: unknown): CVData {
  const parsed = CVDataSchema.safeParse(withoutNulls(raw));
  if (!parsed.success) {
    const preview = JSON.stringify(raw).slice(0, 500);
    console.error(
      "[normalizeCVData] Zod parse failed:",
      parsed.error.message,
      "raw:",
      preview
    );
    throw new Error("L'IA a retourné un CV invalide. Veuillez réessayer.");
  }
  const data = parsed.data;

  return {
    personal_info: {
      name: typeof data.personal_info.name === "string" ? data.personal_info.name : "",
      email: typeof data.personal_info.email === "string" ? data.personal_info.email : "",
      phone: data.personal_info.phone,
      location: data.personal_info.location,
      title: normalizeTitle(data.personal_info.title),
      summary: data.personal_info.summary,
      linkedin: (data.personal_info as any).linkedin,
      github: (data.personal_info as any).github,
      website: (data.personal_info as any).website,
      photo_url: (data.personal_info as any).photo_url,
    },
    experience: (data.experience ?? []).map(normalizeExperience),
    education: (data.education ?? []).map((e: any) => ({
      school: typeof e.school === "string" ? e.school : "",
      degree: typeof e.degree === "string" ? e.degree : "",
      field: typeof e.field === "string" ? e.field : undefined,
      start_date: typeof e.start_date === "string" ? e.start_date : "",
      end_date: typeof e.end_date === "string" ? e.end_date : undefined,
    })),
    skills: normalizeSkills(data.skills),
    languages: normalizeLanguages(data.languages),
  };
}
