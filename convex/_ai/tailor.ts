"use node";

import type { ATSReport, CVData, JobRequirement } from "../../src/shared/types";
import { computeATSReport, cvSections, isWritable, yearsOfExperience } from "../../src/features/editor/lib/keywordAnalysis";
import { prepareText, type PreparedText } from "../../src/shared/lib/text";
import { detectCVLanguage } from "../../src/lib/languageDetection";
import { userError } from "../_shared/errors";
import { chatJSONThen } from "./chat";
import { resolveAdaptLanguage } from "./languageDetection";
import { normalizeCVData, normalizeJobRequirements } from "./normalizers";
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

/** No repair starts after this: the version measured so far is returned */
export const REPAIR_CUTOFF_MS = 240_000;
/** Every AI call of the pipeline ends before this, 30 s under the 10-minute Convex limit */
export const PIPELINE_DEADLINE_MS = 570_000;
/** An offer analysis ends before this, leaving the rest of the budget to writing the CV */
export const EXTRACTION_DEADLINE_MS = 120_000;
/** Writing one requirement from the user's proof is one short call */
export const PROOF_DEADLINE_MS = 120_000;
export const MAX_REPAIRS = 2;
/** A proof shorter than this ("oui") says nothing of where the requirement was put in practice */
const MIN_PROOF_WORDS = 4;

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
    },
    // One malformed entry must not cost the whole generation
    evidence: new Map(parsed.data.evidence.flatMap((entry) => {
      const { id, quote } = (entry ?? {}) as Record<string, unknown>;
      return typeof id === "string" && typeof quote === "string" && ids.has(id) ? [[id, quote] as const] : [];
    })),
  };
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

/** The fields of the CV an ATS reads, as the guard and the proofs read them */
function preparedFields(source: CVData, language: "fr" | "en"): PreparedText[] {
  return Object.values(cvSections({ ...source, detectedLanguage: language }, "content")).flat().map(prepareText);
}

/** What the guard is allowed to keep: the source, the requirements it proves, the numbers it gives */
function guardContext(source: CVData, requirements: JobRequirement[], proven: Set<string>, fields: PreparedText[], sameLanguage: boolean, extraNumbers: string[] = []): GuardContext {
  return {
    source,
    // Years are measured from the dates, never written
    unproven: requirements.filter(r => r.kind !== "experience_years" && !proven.has(r.id)),
    sourceNumbers: new Set([...sourceNumbersOf(source, fields.map(field => field.raw)), ...extraNumbers]),
    sameLanguage,
  };
}

/** A CV guarded then measured, the one pair the pipeline compares versions with */
const measuredBy = (context: GuardContext, requirements: JobRequirement[]) => (cv: CVData) => {
  const guarded = guard(cv, context);
  return { cv: guarded, report: computeATSReport(guarded, requirements, { view: "content" }) };
};

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
  // The language the source is written in: the client strips it off the CV it sends
  const sourceLanguage = languageOverride ?? detectedLanguage ?? detectCVLanguage(source);
  const fields = preparedFields(source, sourceLanguage);
  const proven = provenIds(requirements, fields, generation.evidence);
  const language = resolveAdaptLanguage(jobDescription, languageOverride, detectedLanguage);
  const context = guardContext(source, requirements, proven, fields, sourceLanguage === language);
  const measure = measuredBy(context, requirements);

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


export interface ProveInput {
  /** The CV on screen, as the client holds it */
  cv: unknown;
  jobDescription: string;
  /** The offer's requirements the client already has, checked again against it */
  requirements?: unknown[];
  /** The requirement the user says they have */
  requirementId: string;
  /** The user's own words: where they put the requirement in practice */
  proof: string;
  detectedLanguage?: "fr" | "en";
  languageOverride?: "fr" | "en";
}

/**
 * One requirement written into the CV from the user's own proof (plan § 5.2).
 * The proof is theirs, so it backs what it states: its numbers are added to the
 * source's and the requirement counts as proven. Everything else stays under
 * the same guard as the tailoring, the same measure ends it.
 */
export async function provePipeline(input: ProveInput, startedAt: number = Date.now()): Promise<{ cv: CVData; report: ATSReport; requirements: JobRequirement[] }> {
  const source = readSourceCV(input.cv);
  const { jobDescription, requirementId, proof, detectedLanguage, languageOverride } = input;
  const checked = normalizeJobRequirements(input.requirements ?? [], jobDescription);
  const requirements = checked.length > 0 ? checked : await extractRequirements(jobDescription, startedAt + EXTRACTION_DEADLINE_MS);
  const target = requirements.find(r => r.id === requirementId);
  if (!target) {
    throw userError("Cette exigence n'est plus celle de l'offre affichée. Relancez l'analyse de l'offre.", "REQUIREMENT_UNKNOWN");
  }
  if (!isWritable(target)) {
    throw userError("Un diplôme, une langue ou des années d'expérience s'ajoutent dans l'onglet Contenu, pas par une réécriture.", "REQUIREMENT_NOT_WRITABLE");
  }
  if (proof.trim().split(/\s+/).filter(Boolean).length < MIN_PROOF_WORDS) {
    throw userError("Précisez où vous l'avez mis en œuvre : une mission, un projet, un employeur.", "PROOF_TOO_SHORT");
  }

  const language = languageOverride ?? detectedLanguage ?? detectCVLanguage(source);
  const fields = preparedFields(source, language);
  // The proof proves its own requirement, and the CV proves what it already writes
  const proven = new Set([...provenIds(requirements, fields, new Map()), target.id]);
  const context = guardContext(source, requirements, proven, fields, true, numbersOf(proof));

  const edits = await chatJSONThen(
    buildRepairPrompt({ cv: source, missing: [{ label: target.label, evidence: proof }], language }),
    (raw) => {
      const parsed = RepairSchema.safeParse(raw);
      if (!parsed.success) throw invalidOutput();
      return parsed.data.edits;
    },
    "fast",
    startedAt + PROOF_DEADLINE_MS,
  );
  const { cv, report } = measuredBy(context, requirements)(applyRepair(source, edits));
  return { cv, report, requirements };
}
