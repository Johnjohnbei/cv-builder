"use node";

import type { ATSReport, CVData, JobRequirement } from "../../src/shared/types";
import { computeATSReport, cvSections, isWritable } from "../../src/features/editor/lib/keywordAnalysis";
import { matchPhrase, prepareText } from "../../src/shared/lib/text";
import { getLocalizedStage } from "../../src/shared/constants/companyMeta";
import { userError } from "../_shared/errors";
import { chatJSONThen } from "./chat";
import { resolveAdaptLanguage } from "./languageDetection";
import { normalizeCVData, normalizeJobRequirements } from "./normalizers";
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
/** The offer analysis leaves the rest of the budget to writing the CV */
const EXTRACTION_DEADLINE_MS = 120_000;
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
  /** Ids of the requirements a rewrite could cover but the source CV gives no proof of */
  unproven: string[];
}

const termsOf = (r: JobRequirement) => [r.label, ...r.variants];

function mentions(text: string | undefined, requirements: JobRequirement[]): boolean {
  if (!text?.trim()) return false;
  const prepared = prepareText(text);
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

/** The model's CV with the source's facts put back: companies, dates and places are never the model's */
function readGeneration(raw: unknown, source: CVData, requirements: JobRequirement[]): Generation {
  const parsed = GenerationSchema.safeParse(raw);
  if (!parsed.success) throw invalidOutput();
  const cv = normalizeCVData(parsed.data.cv);
  // A dropped or added experience would take another one's company and dates
  if (cv.experience.length !== source.experience.length) throw invalidOutput();
  const ids = new Set(requirements.map(r => r.id));
  return {
    cv: {
      ...cv,
      experience: cv.experience.map((exp, i) => {
        const { company, start_date, end_date, current, location } = source.experience[i];
        return { ...exp, company, start_date, end_date, current, location };
      }),
    },
    evidence: new Map(parsed.data.evidence.filter(e => ids.has(e.id)).map(e => [e.id, e.quote])),
  };
}

/** The requirements the source CV proves: it writes them, or the model's quote for them is words of the source */
function provenIds(requirements: JobRequirement[], source: CVData, evidence: Map<string, string>): Set<string> {
  const text = prepareText(Object.values(cvSections(source, "content")).flat().join(" | "));
  const quote = (r: JobRequirement) => evidence.get(r.id);
  return new Set(requirements
    .filter(r => termsOf(r).some(term => matchPhrase(term, text)) || Boolean(quote(r) && matchPhrase(quote(r)!, text)))
    .map(r => r.id));
}

/** `text` without its sentences that write one of `requirements` */
const withoutSentencesMentioning = (text: string | undefined, requirements: JobRequirement[]) =>
  text === undefined ? text : (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).filter(s => !mentions(s, requirements)).join("").trim();

/**
 * The CV without the requirements nothing in the source proves, wherever the
 * model wrote them: a bullet, a skill or a company tag is removed, a sentence
 * of the summary or an intro too, a KPI emptied, and a title, a position or a
 * degree goes back to the source's.
 */
function removeUnproven(cv: CVData, source: CVData, unproven: JobRequirement[]): CVData {
  if (unproven.length === 0) return cv;
  const has = (text?: string) => mentions(text, unproven);
  const stageWrites = (stage?: string) => has(getLocalizedStage(stage, "fr")) || has(getLocalizedStage(stage, "en"));
  return {
    ...cv,
    personal_info: {
      ...cv.personal_info,
      title: has(cv.personal_info.title) ? source.personal_info.title : cv.personal_info.title,
      summary: withoutSentencesMentioning(cv.personal_info.summary, unproven),
    },
    experience: cv.experience.map((exp, i) => ({
      ...exp,
      position: has(exp.position) ? source.experience[i].position : exp.position,
      companyStage: stageWrites(exp.companyStage) ? source.experience[i].companyStage : exp.companyStage,
      companyBusinessModel: has(exp.companyBusinessModel) ? source.experience[i].companyBusinessModel : exp.companyBusinessModel,
      intro: withoutSentencesMentioning(exp.intro, unproven),
      kpi: has(exp.kpi) ? "" : exp.kpi,
      description: exp.description.filter(bullet => !has(bullet)),
    })),
    education: cv.education
      .map((edu, i) => (has(edu.degree) || has(edu.field) ? source.education[i] : edu))
      .filter(edu => edu !== undefined),
    skills: cv.skills
      .map(cat => ({ ...cat, items: cat.items.filter(item => !has(item)) }))
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
 * The CV rewritten for the offer, every requirement it writes proven by the
 * source, measured like the editor measures it. A repair that fails or scores
 * lower never costs the version already measured.
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
  const proven = provenIds(requirements, source, generation.evidence);
  const unproven = requirements.filter(r => isWritable(r) && !proven.has(r.id));
  const measure = (cv: CVData) => {
    const guarded = removeUnproven(cv, source, unproven);
    return { cv: guarded, report: computeATSReport(guarded, requirements, { view: "content" }) };
  };

  let best = measure(generation.cv);
  const language = resolveAdaptLanguage(jobDescription, languageOverride, detectedLanguage);
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
    if ((candidate.report.score ?? 0) >= (best.report.score ?? 0)) best = candidate;
  }
  return { cv: best.cv, requirements, report: best.report, unproven: unproven.map(r => r.id) };
}
