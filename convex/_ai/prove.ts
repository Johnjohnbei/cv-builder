"use node";

import { saysWhere, type ATSReport, type CVData, type JobRequirement } from "../../src/shared/types";
import { computeATSReport, isProvable, isWritable } from "../../src/features/editor/lib/keyword-analysis";
import { matchPhrase, normalizeForMatch, prepareText } from "../../src/shared/lib/text";
import { detectCVLanguage } from "../../src/lib/language-detection";
import { userError } from "../_shared/errors";
import { normalizeJobRequirements } from "./normalizers";
import { numbersOf } from "./numbers";
import type { RepairEdit } from "./schemas";
import { experiencesNamedBy, namesStated, provenByQuote, provenIds } from "./truthGuard";
import { chatJSONThen } from "./chat";
import { buildEvidencePrompt } from "./prompts/adapt";
import { EvidenceSchema } from "./schemas";
import {
  applyRepair, guardContext, invalidOutput, measuredBy, preparedFields, readPairs, readSourceCV, repairEdits, requirementsFor,
  sourceLanguageOf, PROOF_DEADLINE_MS, type TailorInput,
} from "./tailor";

// ─── The candidate's own words in the CV (plan § 5.2) ────────────────
// Before the tailoring, what the CV does not prove is found and asked about
// (gapsPipeline); after it, one requirement is written from a proof.
// Extracted from tailor.ts, over its size limit. The proof is the user's, so it
// backs what it states; everything else stays under the tailoring's guard, and
// what the model answers is read strictly before a single word reaches the CV.

export interface ProveInput {
  /** The CV on screen, as the client holds it */
  cv: unknown;
  jobDescription: string;
  /** The offer's requirements the client already has: a proof never pays for an extraction */
  requirements?: unknown[];
  /** The requirement the user says they have */
  requirementId: string;
  /** The user's own words: where they put the requirement in practice */
  proof: string;
  detectedLanguage?: "fr" | "en";
  languageOverride?: "fr" | "en";
}

export interface ProveResult {
  cv: CVData;
  report: ATSReport;
  requirements: JobRequirement[];
  /** False when nothing was written: the CV returned is then the one given */
  written: boolean;
}

/** Reading what the CV proves is one short call, before the candidate is asked about the rest */
export const EVIDENCE_DEADLINE_MS = 90_000;

export interface GapsResult {
  requirements: JobRequirement[];
  /** The quotes of the CV that prove a requirement, each checked against the CV */
  evidence: { id: string; quote: string }[];
  /** Ids of the requirements the CV neither proves nor states, in the offer's order */
  gaps: string[];
}

/**
 * What the CV proves of the offer before a word is written, so the candidate
 * is asked about the rest while the one generation can still use the answer.
 * A degree, a language or years are read from the CV as the score reads them.
 */
export async function gapsPipeline(input: TailorInput, startedAt: number = Date.now()): Promise<GapsResult> {
  const source = readSourceCV(input.cv);
  const requirements = await requirementsFor(input.jobDescription, input.requirements, startedAt);
  // Counted from its own start: the analysis of the offer may have used its whole budget
  const quotes = await chatJSONThen(buildEvidencePrompt({ cvData: source, requirements }), (raw) => {
    const parsed = EvidenceSchema.safeParse(raw);
    if (!parsed.success) throw invalidOutput();
    return readPairs(parsed.data.evidence, "quote", requirements);
  }, "fast", Date.now() + EVIDENCE_DEADLINE_MS);
  const language = sourceLanguageOf(source, input);
  const fields = preparedFields(source, language);
  const proven = provenIds(requirements, fields, quotes);
  const stated = computeATSReport({ ...source, detectedLanguage: language }, requirements, { view: "content" });
  const found = new Set(stated.requirements.filter(c => c.found).map(c => c.requirement.id));
  const byQuote = provenByQuote(requirements, fields, quotes);
  return {
    requirements,
    evidence: [...quotes].filter(([id]) => byQuote.has(id) && !found.has(id)).map(([id, quote]) => ({ id, quote })),
    gaps: requirements.filter(r => !found.has(r.id) && (!isWritable(r) || !proven.has(r.id))).map(r => r.id),
  };
}

/**
 * The edits a proof may carry, the model's answer read strictly: a bullet ADDED
 * to an experience the proof names (never one rewritten, the bullet it replaced
 * would be lost), naming nobody the proof, that experience or the offer does
 * not name; and the skill under the offer's own label. The summary is no place
 * for a proof: a whole rewritten summary was the answer the prompt invited, and
 * nothing put the user's back.
 */
function provableEdits(edits: RepairEdit[], requirement: JobRequirement, source: CVData, proof: string, allowed: number[]): RepairEdit[] {
  const label = normalizeForMatch(requirement.label);
  const kept = edits.flatMap<RepairEdit>((edit) => {
    if (edit.target === "skills") {
      return normalizeForMatch(edit.text) === label ? [edit] : [];
    }
    const at = edit.expIndex ?? -1;
    if (edit.target !== "experience" || !allowed.includes(at)) return [];
    const said = prepareText([proof, requirement.label, ...requirement.variants,
      source.experience[at].position, source.experience[at].company, source.experience[at].intro ?? "",
      ...source.experience[at].description].join(" . "));
    // An employer, a client or a brand the model added on its own is what the
    // guard cannot see: it reads requirements and numbers, not names
    if (!namesStated(edit.text).every(name => matchPhrase(name, said))) return [];
    // bulletIndex dropped: the bullet is added, the ones already written stay
    return [{ ...edit, bulletIndex: undefined }];
  });
  // One place, the one the proof points at: a second bullet would write elsewhere
  const bullet = kept.find(edit => edit.target === "experience");
  return [...kept.filter(edit => edit.target === "skills"), ...(bullet ? [bullet] : [])];
}

/**
 * One requirement written into the CV from the user's own proof. Its numbers
 * are added to the source's and the requirement counts as proven; the result is
 * kept only when it scores higher than the CV given, so a proof never costs the
 * user a line of their CV.
 */
export async function provePipeline(input: ProveInput, startedAt: number = Date.now()): Promise<ProveResult> {
  const source = readSourceCV(input.cv);
  const { jobDescription, requirementId, proof, detectedLanguage, languageOverride } = input;
  // Every refusal is decided here, without the model: none of them is billed
  if (!saysWhere(proof)) {
    throw userError("Précisez où vous l'avez mis en œuvre : une mission, un projet, un employeur.", "PROOF_TOO_SHORT");
  }
  // Never extracted here: the editor has already paid for this offer's requirements
  const requirements = normalizeJobRequirements(input.requirements ?? [], jobDescription);
  const target = requirements.find(r => r.id === requirementId);
  if (!target) {
    throw userError("Cette exigence n'est plus celle de l'offre affichée. Relancez l'analyse de l'offre.", "REQUIREMENT_UNKNOWN");
  }
  if (!isProvable(target)) {
    throw userError(
      isWritable(target)
        ? "Un intitulé de poste se change dans l'onglet Contenu : le titre du CV et vos postes vous appartiennent."
        : "Un diplôme, une langue ou des années d'expérience s'ajoutent dans l'onglet Contenu, pas par une réécriture.",
      "REQUIREMENT_NOT_WRITABLE",
    );
  }

  const language = languageOverride ?? detectedLanguage ?? detectCVLanguage(source);
  const fields = preparedFields(source, language);
  // The proof proves its own requirement, and the CV proves what it already writes
  const proven = new Set([...provenIds(requirements, fields, new Map()), target.id]);
  const context = guardContext(source, requirements, proven, fields, true, numbersOf(proof));
  const measure = measuredBy(context, requirements);
  const before = measure(source);

  const allowed = experiencesNamedBy(source, prepareText(proof));
  const answered = await repairEdits(
    { cv: source, missing: [{ label: target.label, evidence: proof }], language, from: "candidate" },
    startedAt + PROOF_DEADLINE_MS,
  );
  const after = measure(applyRepair(source, provableEdits(answered, target, source, proof, allowed)));
  // A CV that scores no higher is a CV the proof did not help: the user keeps theirs
  const written = (after.report.score ?? 0) > (before.report.score ?? 0);
  return { ...(written ? after : before), requirements, written };
}
