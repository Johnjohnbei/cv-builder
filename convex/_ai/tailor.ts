"use node";

import type { ATSReport, CVData, JobRequirement } from "../../src/shared/types";
import { computeATSReport, cvSections, gapsOf, isWritable, isWrittenFreely } from "../../src/features/editor/lib/keyword-analysis";
import { yearsOfExperience } from "../../src/features/editor/lib/experience-years";
import { prepareText, type PreparedText } from "../../src/shared/lib/text";
import { detectCVLanguage } from "../../src/lib/language-detection";
import { userError } from "../_shared/errors";
import { chatJSONThen } from "./chat";
import { resolveAdaptLanguage } from "./languageDetection";
import { normalizeCVData, normalizeJobRequirements, withSourceContacts } from "./normalizers";
import { numbersOf } from "./numbers";
import { buildAdaptPrompt } from "./prompts/adapt";
import { buildRepairPrompt } from "./prompts/distribute";
import { buildJobRequirementsPrompt } from "./prompts/jobDescription";
import { GenerationSchema, JobRequirementsSchema, RepairSchema, type RepairEdit } from "./schemas";
import { guard, provenIds, type GuardContext } from "./truthGuard";

// ─── Tailoring a CV to an offer (plan § 4) ──────────────────────────
// The offer's requirements, one generation, a truth guard in code
// (truthGuard.ts), the same measure as the editor's ATS score, then at most two
// short repairs. Extracted from ai.ts, which was over its size limit.
// Since 2026-10-07 (arbitrage of the user) the CV is written in one go, no
// question asked: every method, tool or skill of the offer is written even when
// the source does not prove it. A degree, a language, years, a title and any
// number stay the source's.

/** No repair starts after this: the version measured so far is returned */
export const REPAIR_CUTOFF_MS = 240_000;
/** Every AI call of the pipeline ends before this, 30 s under the 10-minute Convex limit */
export const PIPELINE_DEADLINE_MS = 570_000;
/** An offer analysis ends before this, leaving the rest of the budget to writing the CV */
export const EXTRACTION_DEADLINE_MS = 120_000;
export const MAX_REPAIRS = 2;

const invalidOutput = () => userError("L'IA a retourné une réponse invalide. Veuillez réessayer.", "AI_INVALID_OUTPUT");

/** The requirements an offer states, each quoted from it. An answer with none is invalid: thrown inside the transform, it is retried. */
export async function extractRequirements(jobDescription: string, deadlineAt?: number): Promise<JobRequirement[]> {
  return chatJSONThen(buildJobRequirementsPrompt({ jobDescription }), (raw) => {
    const parsed = JobRequirementsSchema.safeParse(raw);
    const found = parsed.success ? normalizeJobRequirements(parsed.data.requirements, jobDescription) : [];
    if (found.length === 0) throw invalidOutput();
    return found;
  }, "fast", deadlineAt);
}

export interface TailorInput {
  /** The CV to tailor, without the fields the user owns */
  cv: unknown;
  jobDescription: string;
  /** Requirements the client already has for this offer, checked again against it */
  requirements?: unknown[];
  pageLimit?: number;
  detectedLanguage?: "fr" | "en";
  languageOverride?: "fr" | "en";
}

export interface TailorResult {
  cv: CVData;
  requirements: JobRequirement[];
  /** Measured on every experience and skill, before the fit to pages */
  report: ATSReport;
}

/** The CV the client sends, read like an answer: it comes from outside the server */
export function readSourceCV(raw: unknown): CVData {
  try {
    return normalizeCVData(raw);
  } catch {
    throw userError("Le CV à adapter est illisible. Rechargez la page puis réessayez.", "CV_INVALID");
  }
}

interface Generation {
  cv: CVData;
  /** Requirement id to the quote of the source CV the model gave as its proof */
  evidence: Map<string, string>;
}

/**
 * The model's CV with the source's facts put back: companies, dates, places and
 * contacts are never the model's. Degrees and languages are matched to the
 * source's by the guard, which reads what they name.
 */
function readGeneration(raw: unknown, source: CVData, requirements: JobRequirement[]): Generation {
  const parsed = GenerationSchema.safeParse(raw);
  if (!parsed.success) throw invalidOutput();
  const cv = normalizeCVData(parsed.data.cv);
  // A dropped or added experience would take another one's company and dates
  if (cv.experience.length !== source.experience.length) throw invalidOutput();
  return {
    // The source's places: a model reading the offer would move the candidate to its city
    cv: withSourceContacts(cv, source),
    evidence: readQuotes(parsed.data.evidence, requirements),
  };
}

/**
 * `{ id, quote }` entries read one by one, as a map: a malformed one or one
 * naming no requirement is skipped, never the whole list.
 */
function readQuotes(entries: unknown[], requirements: JobRequirement[]): Map<string, string> {
  const ids = new Set(requirements.map(r => r.id));
  return new Map(entries.flatMap((entry) => {
    const { id, quote: value } = (entry ?? {}) as Record<string, unknown>;
    return typeof id === "string" && typeof value === "string" && ids.has(id) ? [[id, value] as const] : [];
  }));
}

/** The numbers the source gives: its content, the years of its dates (never their months), its years of experience */
function sourceNumbersOf(source: CVData, contents: string[]): Set<string> {
  const years = yearsOfExperience(source.experience);
  const dateYears = [...source.experience, ...source.education].flatMap(entry => `${entry.start_date ?? ""} ${entry.end_date ?? ""}`.match(/\d{4}/g) ?? []);
  return new Set([...contents.flatMap(numbersOf), ...dateYears, String(Math.floor(years)), String(Math.round(years))]);
}

/** The repair's edits applied where they point; an edit pointing nowhere is ignored */
function applyRepair(cv: CVData, edits: RepairEdit[]): CVData {
  return edits.reduce<CVData>((next, edit) => {
    if (edit.target === "summary") return { ...next, personal_info: { ...next.personal_info, summary: edit.text } };
    if (edit.target === "skills") {
      const known = next.skills.some(cat => cat.items.some(item => item.toLowerCase() === edit.text.toLowerCase()));
      if (known) return next;
      const [first, ...rest] = next.skills;
      return { ...next, skills: first ? [{ ...first, items: [...first.items, edit.text] }, ...rest] : [{ category: "other", items: [edit.text] }] };
    }
    const expIndex = edit.expIndex ?? -1;
    const exp = next.experience[expIndex];
    const at = edit.bulletIndex ?? exp?.description.length ?? -1;
    if (!exp || at < 0 || at > exp.description.length) return next;
    const description = [...exp.description];
    description[at] = edit.text; // at the end, a new bullet
    return { ...next, experience: next.experience.map((e, i) => (i === expIndex ? { ...e, description } : e)) };
  }, cv);
}

/** The edits the fast model answers with, for the pipeline's repair and for a proof */
function repairEdits(ctx: Parameters<typeof buildRepairPrompt>[0], deadlineAt: number): Promise<RepairEdit[]> {
  return chatJSONThen(buildRepairPrompt(ctx), (raw) => {
    const parsed = RepairSchema.safeParse(raw);
    if (!parsed.success) throw invalidOutput();
    return parsed.data.edits;
  }, "fast", deadlineAt);
}

/** The fields of the CV an ATS reads, as the guard and the proofs read them */
function preparedFields(source: CVData, language: "fr" | "en"): PreparedText[] {
  return Object.values(cvSections({ ...source, detectedLanguage: language }, "content")).flat().map(prepareText);
}

/** What the guard is allowed to keep: the source, the requirements it proves, the numbers it gives */
function guardContext(source: CVData, requirements: JobRequirement[], proven: Set<string>, fields: PreparedText[], sameLanguage: boolean): GuardContext {
  return {
    source,
    // Years are measured from the dates, never written
    unproven: requirements.filter(r => r.kind !== "experience_years" && !proven.has(r.id)),
    sourceNumbers: sourceNumbersOf(source, fields.map(field => field.raw)),
    sameLanguage,
  };
}

/** Sentences and words under which a summary reads as filler: one plain sentence proves nothing */
const SUMMARY_MIN_SENTENCES = 2;
const SUMMARY_MIN_WORDS = 30;

function isSubstantialSummary(text: string | undefined): boolean {
  const summary = text?.trim() ?? "";
  return summary.split(/(?<=[.!?])\s+/).filter(Boolean).length >= SUMMARY_MIN_SENTENCES
    && summary.split(/\s+/).length >= SUMMARY_MIN_WORDS;
}

/**
 * The summary is where a reader decides whether a person wrote the CV. A thin
 * one (the guard may have cut its sentences) gives way to the source's when
 * that one says more in the same language, or to none: no summary prints
 * better than one plain sentence.
 */
function withSubstantialSummary(cv: CVData, source: CVData, sameLanguage: boolean): CVData {
  const written = cv.personal_info.summary;
  if (isSubstantialSummary(written)) return cv;
  const fallback = sameLanguage && isSubstantialSummary(source.personal_info.summary) ? source.personal_info.summary : "";
  return { ...cv, personal_info: { ...cv.personal_info, summary: fallback } };
}

/** The client's requirements checked again against the offer, or the offer analyzed when none holds */
async function requirementsFor(jobDescription: string, given: unknown[] | undefined, startedAt: number): Promise<JobRequirement[]> {
  const checked = normalizeJobRequirements(given ?? [], jobDescription);
  return checked.length > 0 ? checked : extractRequirements(jobDescription, startedAt + EXTRACTION_DEADLINE_MS);
}

/** The language the source is written in: the client strips it off the CV it sends */
const sourceLanguageOf = (source: CVData, input: Pick<TailorInput, "detectedLanguage" | "languageOverride">) =>
  input.languageOverride ?? input.detectedLanguage ?? detectCVLanguage(source);

/**
 * The CV rewritten for the offer: every method, tool or skill it asks for
 * written, the facts (degrees, languages, years, titles, numbers) backed by the
 * source, measured like the editor measures it. A repair that fails or does not
 * score higher ends the repairs, and never costs the version already measured.
 */
export async function tailorPipeline(input: TailorInput, startedAt: number = Date.now()): Promise<TailorResult> {
  const source = readSourceCV(input.cv);
  const { jobDescription, pageLimit, detectedLanguage, languageOverride } = input;
  const deadlineAt = startedAt + PIPELINE_DEADLINE_MS;
  const requirements = await requirementsFor(jobDescription, input.requirements, startedAt);
  const sourceLanguage = sourceLanguageOf(source, input);
  const fields = preparedFields(source, sourceLanguage);

  const language = resolveAdaptLanguage(jobDescription, languageOverride, detectedLanguage);
  const prompt = buildAdaptPrompt({
    cvData: source, jobDescription, requirements, pageLimit, detectedLanguage, languageOverride,
  });
  const generation = await chatJSONThen(prompt, (raw) => readGeneration(raw, source, requirements), "default", deadlineAt);
  const byCV = provenIds(requirements, fields, generation.evidence);
  // Written whatever the source says: the user's choice of 2026-10-07
  const free = requirements.filter(r => isWrittenFreely(r) && !byCV.has(r.id));
  const context: GuardContext = {
    ...guardContext(source, requirements, new Set([...byCV, ...free.map(r => r.id)]), fields, sourceLanguage === language),
    free: {
      requirements: free,
      said: prepareText([...fields.map(field => field.raw), ...requirements.flatMap(r => [r.label, ...r.variants])].join(" . ")),
    },
  };
  // The summary rule after the guard, which cuts sentences, and inside the
  // measure: a repair writing a thin summary is never kept on a score it then loses
  const measure = (cv: CVData) => {
    const kept = withSubstantialSummary(guard(cv, context), source, sourceLanguage === language);
    return { cv: kept, report: computeATSReport(kept, requirements, { view: "content" }) };
  };

  let best = measure(generation.cv);
  const generatedScore = best.report.score;
  let repairs = 0;
  for (let repair = 0; repair < MAX_REPAIRS && Date.now() - startedAt < REPAIR_CUTOFF_MS; repair++) {
    const missing = best.report.requirements
      .filter(c => !c.found && isWritable(c.requirement) && (free.some(r => r.id === c.requirement.id) || byCV.has(c.requirement.id)))
      .map(c => ({ label: c.requirement.label, evidence: generation.evidence.get(c.requirement.id) }));
    if (missing.length === 0) break;
    let edits: RepairEdit[];
    try {
      edits = await repairEdits({ cv: best.cv, missing, language }, deadlineAt);
    } catch (e) {
      console.warn("[tailorCV] repair failed, the version measured is returned:", e);
      break;
    }
    const candidate = measure(applyRepair(best.cv, edits));
    // A repair that did not help would not help twice
    if ((candidate.report.score ?? 0) <= (best.report.score ?? 0)) break;
    best = candidate;
    repairs += 1;
  }
  // One line per tailoring: a low score is explained by the logs, never guessed
  console.info(`[tailorCV] requirements=${requirements.length} provenByCV=${byCV.size} free=${free.length} `
    + `generated=${generatedScore} final=${best.report.score} gaps=${gapsOf(best.report).length} repairs=${repairs} `
    + `summary=${best.cv.personal_info.summary ? "kept" : "hidden"} language=${sourceLanguage}->${language}`);
  return { cv: best.cv, requirements, report: best.report };
}
