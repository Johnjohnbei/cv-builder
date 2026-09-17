"use node";

import { saysWhere, type ATSReport, type CVData, type JobRequirement } from "../../src/shared/types";
import { computeATSReport, cvSections, gapsOf, isProvable, isWritable, yearsOfExperience } from "../../src/features/editor/lib/keywordAnalysis";
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
import { experiencesNamedBy, guard, provenByQuote, provenIds, type GuardContext } from "./truthGuard";

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

export const invalidOutput = () => userError("L'IA a retourné une réponse invalide. Veuillez réessayer.", "AI_INVALID_OUTPUT");

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
  /** Quotes of the CV the client already has (gapsPipeline), checked again against the CV */
  evidence?: unknown[];
  /** The candidate's own words for requirements the CV does not prove: { id, text } */
  proofs?: unknown[];
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
    evidence: readPairs(parsed.data.evidence, "quote", requirements),
  };
}

/**
 * `{ id, [text]: string }` entries read one by one, as a map: a malformed one
 * or one naming no requirement is skipped, never the whole list.
 */
export function readPairs(entries: unknown[], text: "quote" | "text", requirements: JobRequirement[]): Map<string, string> {
  const ids = new Set(requirements.map(r => r.id));
  return new Map(entries.flatMap((entry) => {
    const { id, [text]: value } = (entry ?? {}) as Record<string, unknown>;
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
export function applyRepair(cv: CVData, edits: RepairEdit[]): CVData {
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

/** The edits the fast model answers with, for the pipeline's repair and for a proof */
export function repairEdits(ctx: Parameters<typeof buildRepairPrompt>[0], deadlineAt: number): Promise<RepairEdit[]> {
  return chatJSONThen(buildRepairPrompt(ctx), (raw) => {
    const parsed = RepairSchema.safeParse(raw);
    if (!parsed.success) throw invalidOutput();
    return parsed.data.edits;
  }, "fast", deadlineAt);
}

/** The fields of the CV an ATS reads, as the guard and the proofs read them */
export function preparedFields(source: CVData, language: "fr" | "en"): PreparedText[] {
  return Object.values(cvSections({ ...source, detectedLanguage: language }, "content")).flat().map(prepareText);
}

/** What the guard is allowed to keep: the source, the requirements it proves, the numbers it gives */
export function guardContext(source: CVData, requirements: JobRequirement[], proven: Set<string>, fields: PreparedText[], sameLanguage: boolean, extraNumbers: string[] = []): GuardContext {
  return {
    source,
    // Years are measured from the dates, never written
    unproven: requirements.filter(r => r.kind !== "experience_years" && !proven.has(r.id)),
    sourceNumbers: new Set([...sourceNumbersOf(source, fields.map(field => field.raw)), ...extraNumbers]),
    sameLanguage,
  };
}

/** A CV guarded then measured, the one pair the pipeline compares versions with */
export const measuredBy = (context: GuardContext, requirements: JobRequirement[]) => (cv: CVData) => {
  const guarded = guard(cv, context);
  return { cv: guarded, report: computeATSReport(guarded, requirements, { view: "content" }) };
};

/** The client's requirements checked again against the offer, or the offer analyzed when none holds */
export async function requirementsFor(jobDescription: string, given: unknown[] | undefined, startedAt: number): Promise<JobRequirement[]> {
  const checked = normalizeJobRequirements(given ?? [], jobDescription);
  return checked.length > 0 ? checked : extractRequirements(jobDescription, startedAt + EXTRACTION_DEADLINE_MS);
}

/** The language the source is written in: the client strips it off the CV it sends */
export const sourceLanguageOf = (source: CVData, input: Pick<TailorInput, "detectedLanguage" | "languageOverride">) =>
  input.languageOverride ?? input.detectedLanguage ?? detectCVLanguage(source);

/** What the client sends besides the CV, read as words of the CV or of the candidate */
function clientProofs(input: TailorInput, requirements: JobRequirement[], fields: PreparedText[]) {
  // A quote is words of the CV proving its requirement, or nothing, like the model's
  const given = readPairs(input.evidence ?? [], "quote", requirements);
  const byQuote = provenByQuote(requirements, fields, given);
  const quotes = new Map([...given].filter(([id]) => byQuote.has(id)));
  // A proof stands for a requirement a rewrite can write, and says where
  const proofs = new Map([...readPairs(input.proofs ?? [], "text", requirements.filter(isProvable))].filter(([, text]) => saysWhere(text)));
  return { quotes, proofs };
}

/** What only the candidate's words prove: where it may be written, with which names and numbers */
function claimedBy(proofs: Map<string, string>, ids: string[], source: CVData, requirements: JobRequirement[], fields: PreparedText[]): GuardContext["claimed"] {
  const claimed = requirements.filter(r => ids.includes(r.id));
  const texts = claimed.map(r => proofs.get(r.id)!);
  return {
    requirements: claimed,
    where: new Map(claimed.map(r => [r.id, experiencesNamedBy(source, prepareText(proofs.get(r.id)!))])),
    said: prepareText([...fields.map(field => field.raw), ...texts, ...claimed.flatMap(r => [r.label, ...r.variants])].join(" . ")),
    numbers: new Set(texts.flatMap(numbersOf)),
  };
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
  const requirements = await requirementsFor(jobDescription, input.requirements, startedAt);
  const sourceLanguage = sourceLanguageOf(source, input);
  const fields = preparedFields(source, sourceLanguage);
  const { quotes, proofs } = clientProofs(input, requirements, fields);

  const prompt = buildAdaptPrompt({ cvData: source, jobDescription, requirements, pageLimit, detectedLanguage, languageOverride, quotes, proofs });
  const generation = await chatJSONThen(prompt, (raw) => readGeneration(raw, source, requirements), "default", deadlineAt);
  const byCV = new Set([...quotes.keys(), ...provenIds(requirements, fields, generation.evidence)]);
  const byProof = [...proofs.keys()].filter(id => !byCV.has(id));
  const language = resolveAdaptLanguage(jobDescription, languageOverride, detectedLanguage);
  const context: GuardContext = {
    ...guardContext(source, requirements, new Set([...byCV, ...byProof]), fields, sourceLanguage === language),
    claimed: claimedBy(proofs, byProof, source, requirements, fields),
  };
  const measure = measuredBy(context, requirements);

  let best = measure(generation.cv);
  const generatedScore = best.report.score;
  let repairs = 0;
  for (let repair = 0; repair < MAX_REPAIRS && Date.now() - startedAt < REPAIR_CUTOFF_MS; repair++) {
    // A repair rewrites the bullet carrying words of the CV: none carries a candidate's proof
    const missing = best.report.requirements
      .filter(c => !c.found && isWritable(c.requirement) && byCV.has(c.requirement.id))
      .map(c => ({ label: c.requirement.label, evidence: quotes.get(c.requirement.id) ?? generation.evidence.get(c.requirement.id) }));
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
  console.info(`[tailorCV] requirements=${requirements.length} provenByCV=${byCV.size} provenByProof=${byProof.length} `
    + `generated=${generatedScore} final=${best.report.score} gaps=${gapsOf(best.report).length} repairs=${repairs} language=${sourceLanguage}->${language}`);
  return { cv: best.cv, requirements, report: best.report, unproven: context.unproven.filter(isWritable).map(r => r.id) };
}
