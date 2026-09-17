import { userError } from "../_shared/errors";
import { MAX_PROOF_CHARS, type CVData } from "../../src/shared/types";
import { restoreUserOwnedFields, withoutUserOwnedFields } from "./normalizers";

export { MAX_PROOF_CHARS };

// ─── Input size ─────────────────────────────────────────────────────
// Extracted from ai.ts, over its size limit once proveRequirement was added.

export const MAX_DOCUMENT_CHARS = 60_000; // an extracted PDF (CV or offer)
export const MAX_OFFER_CHARS = 20_000; // a job description
export const MAX_CV_CHARS = 60_000; // a CV as the prompt writes it, photo and portfolio already out
/** An offer states a couple of dozen requirements; each one sent is read and matched */
export const MAX_REQUIREMENTS_SENT = 100;

/**
 * Bound what a CV action puts in a prompt, the pasted texts aside: the CV
 * itself, and the requirements the client sends back. Both travel as `v.any()`,
 * so nothing else bounds them, and both are read in full on every call.
 */
export function assertBoundedPrompt(cv: unknown, requirements?: unknown[]) {
  let written: string;
  try {
    written = JSON.stringify(cv ?? null) ?? "";
  } catch {
    // An argument travels as v.any(): a BigInt in it threw a TypeError here,
    // and the caller read a server error instead of "this CV is unreadable"
    throw userError("Le CV envoyé est illisible. Rechargez la page puis réessayez.", "CV_INVALID");
  }
  assertMaxLength(written, MAX_CV_CHARS);
  if (requirements && requirements.length > MAX_REQUIREMENTS_SENT) {
    throw userError(
      `Trop d'exigences envoyées (${requirements.length}, maximum ${MAX_REQUIREMENTS_SENT}) : relancez l'analyse de l'offre.`,
      "INPUT_TOO_LONG",
    );
  }
}

export function assertMaxLength(value: string | undefined, max: number) {
  if (value && value.length > max) {
    throw userError(
      `Texte trop long pour l'IA (${Math.ceil(value.length / 1000)} k caractères, maximum ${max / 1000} k) : raccourcissez-le.`,
      "INPUT_TOO_LONG",
    );
  }
}

// ─── Input shape ────────────────────────────────────────────────────

type Language = "fr" | "en";

/**
 * A CV argument split into what the prompt reads (`cv`, without the fields the
 * user owns: photo, portfolio) and what only the client uses. The translation
 * cache is bound to the content being rewritten: never sent to the model,
 * never returned. `respond` puts back what the model never saw.
 */
export function cvArgument(raw: unknown) {
  const { design, detectedLanguage, languageOverride, _translations: _staleCache, ...rest } = (raw || {}) as Record<string, any>;
  void _staleCache;
  const content = rest as { personal_info?: CVData["personal_info"] };
  const hints = { detectedLanguage: detectedLanguage as Language | undefined, languageOverride: languageOverride as Language | undefined };
  return {
    design: design as CVData["design"] | undefined,
    ...hints,
    content,
    cv: withoutUserOwnedFields(content),
    /**
     * The model's CV with the user's fields and the design back. `written` is
     * the language the CV is now in: an override older than it follows it, or
     * the client, reading the override first, titled a French CV in English.
     */
    respond: (cv: CVData, written?: Language) => ({
      ...restoreUserOwnedFields(cv, content),
      ...(design && { design }),
      ...(written
        ? { detectedLanguage: written, ...(hints.languageOverride && { languageOverride: written }) }
        : { ...(hints.detectedLanguage && { detectedLanguage: hints.detectedLanguage }), ...(hints.languageOverride && { languageOverride: hints.languageOverride }) }),
    }),
  };
}
