import { userError } from "../_shared/errors";

// ─── Input size ─────────────────────────────────────────────────────
// Extracted from ai.ts, over its size limit once proveRequirement was added.

export const MAX_DOCUMENT_CHARS = 60_000; // an extracted PDF (CV or offer)
export const MAX_OFFER_CHARS = 20_000; // a job description
/** A proof is a sentence or two: where the user put the requirement in practice */
export const MAX_PROOF_CHARS = 500;

/**
 * Refuse an oversized text before it reaches the model, and before the access
 * code is used up. Nothing bounded these inputs: a 40-page PDF became a huge
 * billed prompt.
 */
export function assertMaxLength(value: string | undefined, max: number) {
  if (value && value.length > max) {
    throw userError(
      `Texte trop long pour l'IA (${Math.ceil(value.length / 1000)} k caractères, maximum ${max / 1000} k) : raccourcissez-le.`,
      "INPUT_TOO_LONG",
    );
  }
}
