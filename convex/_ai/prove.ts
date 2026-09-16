"use node";

import type { ATSReport, CVData, JobRequirement } from "../../src/shared/types";
import { isProvable, isWritable } from "../../src/features/editor/lib/keywordAnalysis";
import { matchPhrase, normalizeForMatch, prepareText, type PreparedText } from "../../src/shared/lib/text";
import { detectCVLanguage } from "../../src/lib/languageDetection";
import { userError } from "../_shared/errors";
import { normalizeJobRequirements } from "./normalizers";
import { numbersOf } from "./numbers";
import type { RepairEdit } from "./schemas";
import { provenIds } from "./truthGuard";
import {
  applyRepair, guardContext, measuredBy, preparedFields, readSourceCV, repairEdits, PROOF_DEADLINE_MS,
} from "./tailor";

// ─── Writing one requirement from the user's own proof (plan § 5.2) ──
// Extracted from tailor.ts, over its size limit. The proof is the user's, so it
// backs what it states; everything else stays under the tailoring's guard, and
// what the model answers is read strictly before a single word reaches the CV.

/** A proof shorter than this ("oui") says nothing of where the requirement was put in practice */
const MIN_PROOF_WORDS = 4;

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

/**
 * The experiences a proof allows writing under: those whose employer it names,
 * or, when it names none, those whose position it names. The employer decides
 * first — a proof saying "chez Beta, en tant que product designer" is about
 * Beta, even when another role carries that very position. Several roles at
 * one employer all qualify, and the model says which one it means.
 */
function experiencesNamedBy(source: CVData, proof: PreparedText): number[] {
  const named = (name: string | undefined) => Boolean(name && name.trim().length > 2 && matchPhrase(name, proof));
  const byCompany = source.experience.flatMap((exp, i) => (named(exp.company) ? [i] : []));
  return byCompany.length > 0 ? byCompany : source.experience.flatMap((exp, i) => (named(exp.position) ? [i] : []));
}

/**
 * The names a text states: a capitalised word that does not open a sentence,
 * and an acronym. A model writing freely adds employers, clients and brands
 * that way ("du groupe LVMH"), and the guard reads numbers, never names.
 */
const namesStated = (text: string): string[] =>
  (text.match(/(?<=[^.!?]\s)\p{Lu}[\p{L}\p{N}'’&.-]*|\p{Lu}{2,}/gu) ?? [])
    .map(normalizeForMatch)
    .filter(name => name.length > 1);

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
  if (proof.trim().split(/\s+/).filter(Boolean).length < MIN_PROOF_WORDS) {
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
