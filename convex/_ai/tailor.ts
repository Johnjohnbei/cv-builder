"use node";

import type { ATSReport, CVData, JobRequirement } from "../../src/shared/types";
import { computeATSReport, cvSections, isWritable } from "../../src/features/editor/lib/keywordAnalysis";
import { getSkillCategoryTitle } from "../../src/features/editor/lib/atsRules";
import type { SkillCategoryKey } from "../../src/features/editor/lib/skillDictionary";
import { matchPhrase, normalizeForMatch, prepareText, stripInlineMarkdown, type PreparedText } from "../../src/shared/lib/text";
import { getLocalizedStage } from "../../src/shared/constants/companyMeta";
import { getCVLanguage } from "../../src/lib/languageDetection";
import { userError } from "../_shared/errors";
import { chatJSONThen } from "./chat";
import { resolveAdaptLanguage } from "./languageDetection";
import { normalizeCVData, normalizeJobRequirements } from "./normalizers";
import { numbersOf } from "./numbers";
import { buildAdaptPrompt } from "./prompts/adapt";
import { buildRepairPrompt } from "./prompts/distribute";
import { buildJobRequirementsPrompt } from "./prompts/jobDescription";
import { GenerationSchema, JobRequirementsSchema, RepairSchema, type RepairEdit } from "./schemas";

// ─── Tailoring a CV to an offer (plan § 4) ──────────────────────────
// The offer's requirements, one generation, a truth guard in code, the same
// measure as the editor's ATS score, then at most two short repairs. Extracted
// from ai.ts, which was over its size limit.

/** No repair starts after this: the version measured so far is returned */
export const REPAIR_CUTOFF_MS = 240_000;
/** Every AI call of the pipeline ends before this, 30 s under the 10-minute Convex limit */
export const PIPELINE_DEADLINE_MS = 570_000;
/** An offer analysis ends before this, leaving the rest of the budget to writing the CV */
export const EXTRACTION_DEADLINE_MS = 120_000;
export const MAX_REPAIRS = 2;
/** A proof quote shorter than this ("Designer") proves anything */
const MIN_QUOTE_WORDS = 3;

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
  /** Ids of the requirements a rewrite could cover but the source CV gives no proof of */
  unproven: string[];
}

const termsOf = (r: JobRequirement) => [r.label, ...r.variants];

/** Whether `text`, as the templates print it (markdown rendered), writes one of `requirements` */
function mentions(text: string | undefined, requirements: JobRequirement[]): boolean {
  if (!text?.trim()) return false;
  const prepared = prepareText(stripInlineMarkdown(text));
  return requirements.some(r => termsOf(r).some(term => matchPhrase(term, prepared)));
}

/** The CV the client sends, read like an answer: it comes from outside the server */
function readSourceCV(raw: unknown): CVData {
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

/** The model's CV with the source's facts put back: companies, dates, places, schools, levels and contacts are never the model's */
function readGeneration(raw: unknown, source: CVData, requirements: JobRequirement[]): Generation {
  const parsed = GenerationSchema.safeParse(raw);
  if (!parsed.success) throw invalidOutput();
  const cv = normalizeCVData(parsed.data.cv);
  // A dropped or added experience would take another one's company and dates
  if (cv.experience.length !== source.experience.length) throw invalidOutput();
  const ids = new Set(requirements.map(r => r.id));
  const { name, email, phone, location, linkedin, github, website } = source.personal_info;
  return {
    cv: {
      ...cv,
      personal_info: { ...cv.personal_info, name, email, phone, location, linkedin, github, website },
      experience: cv.experience.map((exp, i) => {
        const { company, start_date, end_date, current, location: place } = source.experience[i];
        return { ...exp, company, start_date, end_date, current, location: place };
      }),
      education: cv.education.map((edu, i) => {
        const src = source.education[i];
        return src ? { ...edu, school: src.school, start_date: src.start_date, end_date: src.end_date } : edu;
      }),
      languages: cv.languages.map((lang, i) => (source.languages[i] ? { ...lang, proficiency: source.languages[i].proficiency } : lang)),
    },
    // One malformed entry must not cost the whole generation
    evidence: new Map(parsed.data.evidence.flatMap((entry) => {
      const { id, quote } = (entry ?? {}) as Record<string, unknown>;
      return typeof id === "string" && typeof quote === "string" && ids.has(id) ? [[id, quote] as const] : [];
    })),
  };
}

const stemsOf = (text: PreparedText) => new Set(text.stemmed.split(/[^\p{L}\p{N}]+/u).filter(stem => stem.length >= 4));

/**
 * The requirements the source CV proves: one of its fields writes them, or the
 * model's quote for them is words of a field that shares a word with them
 * ("Mené 30 entretiens utilisateurs" for "recherche utilisateur"). Any three
 * words of the source used to prove any requirement.
 */
function provenIds(requirements: JobRequirement[], fields: PreparedText[], evidence: Map<string, string>): Set<string> {
  const quoted = (r: JobRequirement) => {
    const quote = evidence.get(r.id);
    if (!quote || normalizeForMatch(quote).split(" ").length < MIN_QUOTE_WORDS) return false;
    const stems = new Set(termsOf(r).flatMap(term => [...stemsOf(prepareText(term))]));
    return fields.some(field => matchPhrase(quote, field) && [...stemsOf(field)].some(stem => stems.has(stem)));
  };
  return new Set(requirements
    .filter(r => termsOf(r).some(term => fields.some(field => matchPhrase(term, field))) || quoted(r))
    .map(r => r.id));
}

interface GuardContext {
  source: CVData;
  unproven: JobRequirement[];
  /** Every number the source's content gives, dates and contacts excluded */
  sourceNumbers: Set<string>;
  /** The CV is written in the source's language: a source bullet can stand in for an invented one */
  sameLanguage: boolean;
}

/** Entries at their source place, an invented one replaced by the source's, none past the source's count, no duplicate */
function sourceBacked<T>(entries: T[], sourceEntries: T[], invented: (entry: T) => boolean): T[] {
  const backed = sourceEntries.map((src, i) => (entries[i] !== undefined && !invented(entries[i]) ? entries[i] : src));
  return backed.filter((entry, i) => backed.findIndex(other => JSON.stringify(other) === JSON.stringify(entry)) === i);
}

/**
 * The CV without what nothing in the source backs: a requirement the source
 * does not prove, or a number its content never gives (FABRICATION_GUARD, KPI
 * of the arbitrage Q2), wherever the model wrote it. A bullet takes back the
 * source's bullet at its place when the bullets still line up, a sentence of
 * the summary or an intro is removed, a KPI emptied, a skill removed, and a
 * title, position, tag, degree, language or category name goes back to the
 * source's.
 */
function guard(cv: CVData, { source, unproven, sourceNumbers, sameLanguage }: GuardContext): CVData {
  const writes = (text?: string) => mentions(text, unproven);
  const invents = (text?: string) => writes(text) || numbersOf(text).some(n => !sourceNumbers.has(n));
  const sentencesKept = (text?: string) => text?.split(/(?<=[.!?])\s+/).filter(s => !invents(s)).join(" ");
  const localized = (write: (language: "fr" | "en") => string) => writes(write("fr")) || writes(write("en"));
  return {
    ...cv,
    personal_info: {
      ...cv.personal_info,
      title: invents(cv.personal_info.title) ? source.personal_info.title : cv.personal_info.title,
      summary: sentencesKept(cv.personal_info.summary),
    },
    experience: cv.experience.map((exp, i) => {
      const src = source.experience[i];
      const lineUp = sameLanguage && exp.description.length === src.description.length;
      const bullets = exp.description.map((bullet, b) => (!invents(bullet) ? bullet : lineUp ? src.description[b] : undefined));
      return {
        ...exp,
        position: invents(exp.position) ? src.position : exp.position,
        companyStage: localized(lang => getLocalizedStage(exp.companyStage, lang)) ? src.companyStage : exp.companyStage,
        companyBusinessModel: writes(exp.companyBusinessModel) ? src.companyBusinessModel : exp.companyBusinessModel,
        intro: sentencesKept(exp.intro),
        kpi: invents(exp.kpi) ? "" : exp.kpi,
        description: bullets.filter((b, at): b is string => b !== undefined && bullets.indexOf(b) === at),
      };
    }),
    education: sourceBacked(cv.education, source.education, edu => [edu.degree, edu.field, edu.school].some(invents)),
    languages: sourceBacked(cv.languages, source.languages, lang => writes(lang.name)),
    skills: cv.skills
      .map((cat, i) => ({
        ...cat,
        category: writes(cat.category) || localized(lang => getSkillCategoryTitle(cat.category as SkillCategoryKey, lang))
          ? source.skills[i]?.category ?? "Compétences"
          : cat.category,
        items: cat.items.filter(item => !invents(item)),
      }))
      // A category emptied here is dropped, one the user left empty is kept
      .filter((cat, i) => cat.items.length > 0 || cv.skills[i].items.length === 0),
  };
}

/** The repair's edits applied where they point; an edit pointing nowhere is ignored */
function applyRepair(cv: CVData, edits: RepairEdit[]): CVData {
  return edits.reduce<CVData>((next, edit) => {
    if (edit.target === "summary") return { ...next, personal_info: { ...next.personal_info, summary: edit.text } };
    if (edit.target === "skills") {
      const known = next.skills.some(cat => cat.items.some(item => item.toLowerCase() === edit.text.toLowerCase()));
      if (known) return next;
      const [first, ...rest] = next.skills;
      return { ...next, skills: first ? [{ ...first, items: [...first.items, edit.text] }, ...rest] : [{ category: "Compétences", items: [edit.text] }] };
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

/**
 * The CV rewritten for the offer, everything it writes backed by the source,
 * measured like the editor measures it. A repair that fails or does not score
 * higher ends the repairs, and never costs the version already measured.
 */
export async function tailorPipeline(input: TailorInput, startedAt: number = Date.now()): Promise<TailorResult> {
  const source = readSourceCV(input.cv);
  const { jobDescription, pageLimit, detectedLanguage, languageOverride } = input;
  const deadlineAt = startedAt + PIPELINE_DEADLINE_MS;
  const checked = normalizeJobRequirements(input.requirements ?? [], jobDescription);
  const requirements = checked.length > 0 ? checked : await extractRequirements(jobDescription, startedAt + EXTRACTION_DEADLINE_MS);

  const generation = await chatJSONThen(
    buildAdaptPrompt({ cvData: source, jobDescription, requirements, pageLimit, detectedLanguage, languageOverride }),
    (raw) => readGeneration(raw, source, requirements),
    "default",
    deadlineAt,
  );
  const fields = Object.values(cvSections(source, "content")).flat().map(prepareText);
  const proven = provenIds(requirements, fields, generation.evidence);
  const language = resolveAdaptLanguage(jobDescription, languageOverride, detectedLanguage);
  const context: GuardContext = {
    source,
    // Years are measured from the dates, never written
    unproven: requirements.filter(r => r.kind !== "experience_years" && !proven.has(r.id)),
    sourceNumbers: new Set(fields.flatMap(field => numbersOf(field.raw))),
    sameLanguage: getCVLanguage(source) === language,
  };
  const measure = (cv: CVData) => {
    const guarded = guard(cv, context);
    return { cv: guarded, report: computeATSReport(guarded, requirements, { view: "content" }) };
  };

  let best = measure(generation.cv);
  for (let repair = 0; repair < MAX_REPAIRS && Date.now() - startedAt < REPAIR_CUTOFF_MS; repair++) {
    const missing = best.report.requirements
      .filter(c => !c.found && isWritable(c.requirement) && proven.has(c.requirement.id))
      .map(c => ({ label: c.requirement.label, evidence: generation.evidence.get(c.requirement.id) }));
    if (missing.length === 0) break;
    let edits: RepairEdit[];
    try {
      edits = await chatJSONThen(buildRepairPrompt({ cv: best.cv, missing, language }), (raw) => {
        const parsed = RepairSchema.safeParse(raw);
        if (!parsed.success) throw invalidOutput();
        return parsed.data.edits;
      }, "fast", deadlineAt);
    } catch (e) {
      console.warn("[tailorCV] repair failed, the version measured is returned:", e);
      break;
    }
    const candidate = measure(applyRepair(best.cv, edits));
    // A repair that did not help would not help twice
    if ((candidate.report.score ?? 0) <= (best.report.score ?? 0)) break;
    best = candidate;
  }
  return { cv: best.cv, requirements, report: best.report, unproven: context.unproven.filter(isWritable).map(r => r.id) };
}
