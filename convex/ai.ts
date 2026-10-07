"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { chatJSONThen, chatText } from "./_ai/chat";
import { verifyAccessCode } from "./_ai/auth";
import { userError } from "./_shared/errors";
import { buildExtractPrompt } from "./_ai/prompts/extract";
import { coverLetterOf } from "./_ai/coverLetter";
import { detectCVLanguage } from "./_ai/languageDetection";
import { buildTranslatePrompt } from "./_ai/prompts/translate";
import { buildJobDescriptionFromURLPrompt, buildJobDescriptionFromPDFPrompt } from "./_ai/prompts/jobDescription";
import { companyMetaOf } from "./_ai/companyMeta";
import { normalizeCVData, normalizeTitle, restoreUserOwnedFields, withSourceContacts } from "./_ai/normalizers";
import { fetchOfferText, isPublicUrl, parseHttpUrl } from "./_ai/publicUrl";
import { EXTRACTION_DEADLINE_MS, extractRequirements, readSourceCV, tailorPipeline } from "./_ai/tailor";
import { assertBoundedPrompt, assertMaxLength, cvArgument, MAX_DOCUMENT_CHARS, MAX_OFFER_CHARS } from "./_ai/inputLimits";

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
    // A headline read from a PDF ("Designer | UX | Growth…") is cut to its first part: only at import,
    // a title the user or the generation wrote afterwards is theirs, whole, in every language
    return await chatJSONThen(prompt, (raw) => {
      const cv = normalizeCVData(raw);
      return { ...cv, personal_info: { ...cv.personal_info, title: normalizeTitle(cv.personal_info.title) } };
    });
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
    pageLimit: v.optional(v.number()),
    /** The language the user chose before the generation: it comes before the offer's */
    language: v.optional(v.union(v.literal('fr'), v.literal('en'))),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    const { detectedLanguage, languageOverride, cv, respond } = cvArgument(args.baseData);
    assertBoundedPrompt(cv, args.requirements);
    await verifyAccessCode(ctx, args.accessCode);
    const { jobDescription, requirements, pageLimit, language } = args;
    const result = await tailorPipeline({ cv, jobDescription, requirements, pageLimit, detectedLanguage, languageOverride, language }, startedAt);
    return {
      // The language actually written, so the toggle and the section titles match the content
      cv: respond(result.cv, result.language),
      requirements: result.requirements,
      report: result.report,
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
    // Bounded like in tailorCV
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
    // What the prompt reads is bounded, not the cache and the versions that travel with it
    assertBoundedPrompt(cvArgument(args.cvData).cv);
    await verifyAccessCode(ctx, args.accessCode);
    // The letter is in the CV's language (arbitrage of 2026-10-07): the client
    // says it; a caller that does not gets the CV's hints, then its text read
    const hints = cvArgument(args.cvData);
    const language = args.language ?? hints.languageOverride ?? hints.detectedLanguage ?? detectCVLanguage(readSourceCV(hints.cv));
    console.info(`[generateCoverLetter] language=${language} (client=${args.language ?? 'none'})`);
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
    // What the prompt reads is bounded, not the cache and the versions that travel with it
    assertBoundedPrompt(cvArgument(args.cvData).cv);
    await verifyAccessCode(ctx, args.accessCode);
    // The language hints and the cache stay out: the client rebuilds _translations after the call
    const { design, content: contentOnly, cv } = cvArgument(args.cvData);
    const prompt = buildTranslatePrompt({
      cvData: cv,
      targetLanguage: args.targetLanguage,
    });
    // "fast" model: a 1:1 translation with an imposed structure needs fidelity,
    // not reasoning. Sonnet was doing word-for-word work at 3x the price.
    const source = readSourceCV(cv);
    // An experience dropped or added would take another one's employer and dates: thrown here, the answer is retried
    const translated = await chatJSONThen(prompt, (raw) => {
      const answer = normalizeCVData(raw);
      if (answer.experience.length !== source.experience.length) {
        throw userError("L'IA a retourné une réponse invalide. Veuillez réessayer.", "AI_INVALID_OUTPUT");
      }
      return withSourceContacts(answer, source, { translatedPlaces: true });
    }, "fast");
    const normalized = restoreUserOwnedFields(translated, contentOnly);
    return {
      ...normalized,
      ...(design && { design }),
      detectedLanguage: args.targetLanguage,
      languageOverride: args.targetLanguage,
    };
  },
});
