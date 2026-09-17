"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { chatJSONThen, chatText } from "./_ai/chat";
import { verifyAccessCode } from "./_ai/auth";
import { userError } from "./_shared/errors";
import { buildExtractPrompt } from "./_ai/prompts/extract";
import { coverLetterOf } from "./_ai/coverLetter";
import { detectTextLanguage, resolveAdaptLanguage } from "./_ai/languageDetection";
import { buildTranslatePrompt } from "./_ai/prompts/translate";
import { buildJobDescriptionFromURLPrompt, buildJobDescriptionFromPDFPrompt } from "./_ai/prompts/jobDescription";
import { companyMetaOf, experienceMetaOf } from "./_ai/companyMeta";
import { normalizeCVData, restoreUserOwnedFields } from "./_ai/normalizers";
import { fetchOfferText, isPublicUrl, parseHttpUrl } from "./_ai/publicUrl";
import { EXTRACTION_DEADLINE_MS, extractRequirements, tailorPipeline } from "./_ai/tailor";
import { gapsPipeline, provePipeline } from "./_ai/prove";
import { assertBoundedPrompt, assertMaxLength, cvArgument, MAX_DOCUMENT_CHARS, MAX_OFFER_CHARS, MAX_PROOF_CHARS } from "./_ai/inputLimits";

// ─── Actions ────────────────────────────────────────────────────────

export const extractCVDataFromPDF = action({
  args: {
    pdfText: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.pdfText, MAX_DOCUMENT_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildExtractPrompt({ pdfText: args.pdfText });
    return await chatJSONThen(prompt, normalizeCVData);
  },
});

/**
 * What the CV proves of an offer before it is tailored (convex/_ai/tailor.ts):
 * the requirements, the quotes of the CV proving them, and the gaps the
 * candidate is asked about while the generation can still use the answer.
 */
export const analyzeGaps = action({
  args: {
    baseData: v.any(),
    jobDescription: v.string(),
    requirements: v.optional(v.array(v.any())),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    const { cv, detectedLanguage, languageOverride } = cvArgument(args.baseData);
    assertBoundedPrompt(cv, args.requirements);
    await verifyAccessCode(ctx, args.accessCode);
    return await gapsPipeline({ cv, jobDescription: args.jobDescription, requirements: args.requirements, detectedLanguage, languageOverride }, startedAt);
  },
});

/**
 * The CV tailored to an offer by the verified pipeline (convex/_ai/tailor.ts),
 * with the offer's requirements and the ATS report measured on the result.
 */
export const tailorCV = action({
  args: {
    baseData: v.any(),
    jobDescription: v.string(),
    /** Requirements the client already has for this offer: checked again, extracted when none is valid */
    requirements: v.optional(v.array(v.any())),
    /** Quotes of the CV analyzeGaps returned: checked again against the CV */
    evidence: v.optional(v.array(v.any())),
    /** The candidate's own words for the gaps: { id, text } */
    proofs: v.optional(v.array(v.object({ id: v.string(), text: v.string() }))),
    pageLimit: v.optional(v.number()),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    for (const proof of args.proofs ?? []) assertMaxLength(proof.text, MAX_PROOF_CHARS);
    const { detectedLanguage, languageOverride, cv, respond } = cvArgument(args.baseData);
    assertBoundedPrompt(cv, args.requirements);
    // Both travel back from the client: their size and their count are bounded too
    assertBoundedPrompt({ evidence: args.evidence, proofs: args.proofs }, [...(args.evidence ?? []), ...(args.proofs ?? [])]);
    await verifyAccessCode(ctx, args.accessCode);
    const { jobDescription, requirements, evidence, proofs, pageLimit } = args;
    const result = await tailorPipeline({ cv, jobDescription, requirements, evidence, proofs, pageLimit, detectedLanguage, languageOverride }, startedAt);
    return {
      // The language actually written (offer first, then the user's override),
      // so the toggle and the section titles match the content
      cv: respond(result.cv, resolveAdaptLanguage(jobDescription, languageOverride, detectedLanguage)),
      requirements: result.requirements,
      report: result.report,
      unproven: result.unproven,
    };
  },
});

/**
 * One requirement of the offer written into the CV from the user's own proof
 * (plan § 5.2): the same truth guard as the tailoring, the proof standing for
 * the source on what it states.
 */
export const proveRequirement = action({
  args: {
    cvData: v.any(),
    jobDescription: v.string(),
    requirements: v.optional(v.array(v.any())),
    requirementId: v.string(),
    proof: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    assertMaxLength(args.proof, MAX_PROOF_CHARS);
    // The translation cache is dropped like in tailorCV: the CV it mirrors has
    // just changed, and a cached other language missing the requirement just
    // written would be exported as the CV. The next language switch pays for a
    // fresh translation (arbitrage: a stale bilingual CV is worse than a call).
    const { detectedLanguage, languageOverride, cv, respond } = cvArgument(args.cvData);
    assertBoundedPrompt(cv, args.requirements);
    await verifyAccessCode(ctx, args.accessCode);
    const { jobDescription, requirements, requirementId, proof } = args;
    const result = await provePipeline({ cv, jobDescription, requirements, requirementId, proof, detectedLanguage, languageOverride }, startedAt);
    return {
      cv: respond(result.cv),
      requirements: result.requirements,
      report: result.report,
      written: result.written,
    };
  },
});

export const extractJobDescriptionFromURL = action({
  args: {
    url: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Syntax and literal addresses before the access code, so a malformed or
    // private link does not use up a code; DNS names are resolved after it,
    // so an anonymous caller cannot probe DNS through the deployment
    // (order tested in _ai/__tests__/actions.test.ts).
    const target = parseHttpUrl(args.url);
    if (!target) {
      throw userError("Lien invalide : collez l'adresse http(s) publique de l'offre.", "URL_INVALID");
    }
    await verifyAccessCode(ctx, args.accessCode);
    if (!(await isPublicUrl(target))) {
      throw userError("Lien injoignable ou non public : vérifiez l'adresse de l'offre, ou collez son texte.", "URL_UNREACHABLE");
    }

    const pageText = await fetchOfferText(target);
    if (pageText.length < 50) {
      throw userError(
        "Impossible d'extraire le contenu de cette URL. Essayez de copier-coller le texte de l'offre manuellement.",
        "URL_EXTRACT_FAILED",
      );
    }

    const prompt = buildJobDescriptionFromURLPrompt({ url: target.toString(), pageText });
    return await chatText(prompt);
  },
});

export const extractJobDescriptionFromPDF = action({
  args: {
    pdfText: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.pdfText, MAX_DOCUMENT_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildJobDescriptionFromPDFPrompt({ pdfText: args.pdfText });
    return await chatText(prompt, "fast");
  },
});

/** The requirements of an offer, each quoted from it (the extraction lives in tailor.ts) */
export const extractJobRequirements = action({
  args: {
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    // Bounded like in tailorCV: "Adapter" in the editor waits on this analysis
    return { requirements: await extractRequirements(args.jobDescription, Date.now() + EXTRACTION_DEADLINE_MS) };
  },
});

export const generateCoverLetter = action({
  args: {
    cvData: v.any(),
    jobDescription: v.string(),
    companyName: v.optional(v.string()),
    companyStage: v.optional(v.string()),
    companyBusinessModel: v.optional(v.string()),
    tone: v.optional(v.string()),
    language: v.optional(v.union(v.literal('fr'), v.literal('en'))),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    assertBoundedPrompt(args.cvData);
    await verifyAccessCode(ctx, args.accessCode);
    // Server-side fallback detection: trust the client's hint when provided,
    // otherwise detect from the job description ourselves so the prompt always
    // matches the JD language even if the caller forgot to pass `language`.
    const language = args.language ?? detectTextLanguage(args.jobDescription);
    console.info(`[generateCoverLetter] language=${language} (client=${args.language ?? 'none'}, server-detected=${detectTextLanguage(args.jobDescription)})`);
    // Same as tailorCV: the prompt reads the content only (the language is decided above)
    return await coverLetterOf({
      cvData: cvArgument(args.cvData).cv,
      jobDescription: args.jobDescription,
      companyName: args.companyName,
      companyStage: args.companyStage,
      companyBusinessModel: args.companyBusinessModel,
      tone: args.tone,
      language,
    });
  },
});

export const extractCompanyMeta = action({
  args: {
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    return await companyMetaOf(args.jobDescription);
  },
});

/**
 * Batch-enrich every work experience on the CV with a deduced (stage, businessModel)
 * pair. Returns an array aligned with the input order. Each item is { stage, businessModel }
 * with possibly-null values when the LLM is not confident.
 */
export const enrichExperienceMeta = action({
  args: {
    experiences: v.array(v.object({
      company: v.string(),
      position: v.string(),
      intro: v.optional(v.string()),
      description: v.optional(v.array(v.string())),
    })),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertBoundedPrompt(args.experiences);
    await verifyAccessCode(ctx, args.accessCode);
    return { results: await experienceMetaOf(args.experiences) };
  },
});

/**
 * Pure 1:1 translation of a CV to a target language. PRESERVES structure
 * exactly — same number of bullets, same KPIs, same order. Distinct from
 * tailorCV which rewrites content. Use this when the user wants
 * "same CV, different language", not "regenerated for this language".
 */
export const translateCV = action({
  args: {
    cvData: v.any(),
    targetLanguage: v.union(v.literal('fr'), v.literal('en')),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertBoundedPrompt(args.cvData);
    await verifyAccessCode(ctx, args.accessCode);
    // The language hints and the cache stay out: the client rebuilds _translations after the call
    const { design, content: contentOnly, cv } = cvArgument(args.cvData);
    const prompt = buildTranslatePrompt({
      cvData: cv,
      targetLanguage: args.targetLanguage,
    });
    // "fast" model: a 1:1 translation with an imposed structure needs fidelity,
    // not reasoning. Sonnet was doing word-for-word work at 3x the price.
    const normalized = restoreUserOwnedFields(await chatJSONThen(prompt, normalizeCVData, "fast"), contentOnly);
    return {
      ...normalized,
      ...(design && { design }),
      detectedLanguage: args.targetLanguage,
      languageOverride: args.targetLanguage,
    };
  },
});
