"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { chatJSONSchema, chatJSONThen, chatText } from "./_ai/chat";
import { verifyAccessCode } from "./_ai/auth";
import { userError } from "./_shared/errors";
import { buildExtractPrompt } from "./_ai/prompts/extract";
import { buildAdaptPrompt } from "./_ai/prompts/adapt";
import {
  buildBulletSuggestionsPrompt,
  buildBulletRewritePrompt,
} from "./_ai/prompts/rewrite";
import { buildCoverLetterPrompt } from "./_ai/prompts/coverLetter";
import { detectTextLanguage, resolveAdaptLanguage } from "./_ai/languageDetection";
import { buildCompanyExtractionPrompt } from "./_ai/prompts/companyExtraction";
import { buildExperienceEnrichmentPrompt } from "./_ai/prompts/experienceEnrichment";
import { buildTranslatePrompt } from "./_ai/prompts/translate";
import {
  buildJobDescriptionFromURLPrompt,
  buildJobDescriptionFromPDFPrompt,
  buildJobRequirementsPrompt,
} from "./_ai/prompts/jobDescription";
import { buildKeywordDistributionPrompt } from "./_ai/prompts/distribute";
import {
  BulletSuggestionsSchema,
  BulletRewriteSchema,
  CoverLetterSchema,
  CompanyMetaSchema,
  ExperienceEnrichmentSchema,
  JobRequirementsSchema,
  KeywordDistributionSchema,
} from "./_ai/schemas";
import { normalizeCVData, normalizeJobRequirements, restoreUserOwnedFields, withoutUserOwnedFields } from "./_ai/normalizers";
import { fetchPublicPage, htmlToText, isPublicUrl, JINA_MAX_BYTES, JINA_TIMEOUT_MS, parseHttpUrl, readTextUpTo } from "./_ai/publicUrl";

// ─── Input size ─────────────────────────────────────────────────────
const MAX_DOCUMENT_CHARS = 60_000; // an extracted PDF (CV or offer)
const MAX_OFFER_CHARS = 20_000; // a job description

/**
 * Refuse an oversized text before it reaches the model, and before the access
 * code is used up. Nothing bounded these inputs: a 40-page PDF became a huge
 * billed prompt.
 */
function assertMaxLength(value: string | undefined, max: number) {
  if (value && value.length > max) {
    throw userError(
      `Texte trop long pour l'IA (${Math.ceil(value.length / 1000)} k caractères, maximum ${max / 1000} k) : raccourcissez-le.`,
      "INPUT_TOO_LONG",
    );
  }
}

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

export const tailorCV = action({
  args: {
    baseData: v.any(),
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    // Strip _translations: the cache is bound to the current content; once we
    // rewrite, it's obsolete. Drop it explicitly so the LLM doesn't see it
    // (saves tokens) and the return doesn't carry stale translations.
    const { design, detectedLanguage, languageOverride, _translations: _staleCache, ...contentOnly } = args.baseData || {};
    void _staleCache;
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: withoutUserOwnedFields(contentOnly),
      jobDescription: args.jobDescription,
      detectedLanguage,
      languageOverride,
    });
    // companyStage / companyBusinessModel come back from this same call — a
    // separate enrichment round-trip used to cost a full extra request to
    // deduce two tags per experience.
    const normalized = restoreUserOwnedFields(await chatJSONThen(prompt, normalizeCVData), contentOnly);
    // Return the language actually used by the prompt so the UI toggle and
    // section labels match the generated content (JD-first, then user override).
    const effectiveLanguage = resolveAdaptLanguage(args.jobDescription, languageOverride, detectedLanguage);
    return {
      ...normalized,
      ...(design && { design }),
      detectedLanguage: effectiveLanguage,
      // An override older than the offer must follow the language actually
      // written: the client reads languageOverride first, so returning the
      // stale one left an English UI (dates, titles) on a French CV.
      ...(languageOverride && { languageOverride: effectiveLanguage }),
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

    // Step 1: Try Jina Reader first — renders JS (handles SPAs like WTTJ, LinkedIn),
    // expands accordions, returns clean markdown. Free, no API key needed.
    // Anonymous tier is heavily rate-limited (429/402 are routine from cloud
    // IPs) and can hang — hard timeout, then fall through to direct fetch.
    let pageText = "";
    try {
      const jinaResponse = await fetch(`https://r.jina.ai/${target.toString()}`, {
        headers: {
          Accept: "text/plain",
          "X-Return-Format": "text",
        },
        // Part of URL_ACTION_BUDGET_MS: the page fetch and the AI call must fit the 10-minute action
        signal: AbortSignal.timeout(JINA_TIMEOUT_MS),
      });
      if (jinaResponse.ok) {
        pageText = (await readTextUpTo(jinaResponse, JINA_MAX_BYTES)).substring(0, 15000);
      } else {
        void jinaResponse.body?.cancel(); // an unread body holds the socket
        console.warn(`[extractJobDescriptionFromURL] Jina returned ${jinaResponse.status}, falling back to direct fetch`);
      }
    } catch (e: any) {
      console.warn(`[extractJobDescriptionFromURL] Jina failed (${e?.name === "TimeoutError" ? "timeout" : e?.message?.slice(0, 100)}), falling back to direct fetch`);
    }

    // Step 2: Fallback to direct fetch if Jina failed (faster, works for simple static sites)
    if (!pageText || pageText.length < 100) {
      try {
        pageText = htmlToText(await fetchPublicPage(target));
      } catch (e) {
        pageText = "";
      }
    }

    if (!pageText || pageText.length < 50) {
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

/**
 * The requirements of an offer, each quoted from it. An answer where the offer
 * states none of them is invalid: thrown inside the transform, it is retried.
 */
export const extractJobRequirements = action({
  args: {
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildJobRequirementsPrompt({ jobDescription: args.jobDescription });
    const requirements = await chatJSONThen(prompt, (raw) => {
      const parsed = JobRequirementsSchema.safeParse(raw);
      const found = parsed.success ? normalizeJobRequirements(parsed.data.requirements, args.jobDescription) : [];
      if (found.length === 0) throw userError("L'IA a retourné une réponse invalide. Veuillez réessayer.", "AI_INVALID_OUTPUT");
      return found;
    }, "fast");
    return { requirements };
  },
});

export const optimizeCVForPage = action({
  args: {
    cvData: v.any(),
    pageLimit: v.number(),
    jobDescription: v.optional(v.string()),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    // Same as tailorCV: drop _translations so the LLM doesn't see the stale
    // cache and we don't return a translation that no longer matches content.
    const { design, detectedLanguage, languageOverride, _translations: _staleCache, ...contentOnly } = args.cvData || {};
    void _staleCache;
    const prompt = buildAdaptPrompt({
      mode: "optimize",
      cvData: withoutUserOwnedFields(contentOnly),
      pageLimit: args.pageLimit,
      jobDescription: args.jobDescription,
      detectedLanguage,
      languageOverride,
    });
    const normalized = restoreUserOwnedFields(await chatJSONThen(prompt, normalizeCVData), contentOnly);
    const effectiveLanguage = resolveAdaptLanguage(args.jobDescription, languageOverride, detectedLanguage);
    return {
      ...normalized,
      ...(design && { design }),
      detectedLanguage: effectiveLanguage,
      // Same as tailorCV: never hand back an override the content no longer matches
      ...(languageOverride && { languageOverride: effectiveLanguage }),
    };
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
    await verifyAccessCode(ctx, args.accessCode);
    // Server-side fallback detection: trust the client's hint when provided,
    // otherwise detect from the job description ourselves so the prompt always
    // matches the JD language even if the caller forgot to pass `language`.
    const language = args.language ?? detectTextLanguage(args.jobDescription);
    console.info(`[generateCoverLetter] language=${language} (client=${args.language ?? 'none'}, server-detected=${detectTextLanguage(args.jobDescription)})`);
    // Same as tailorCV/optimizeCVForPage: drop the translation cache and design
    // settings before prompting — the LLM doesn't need them (saves tokens).
    const { design: _design, _translations: _staleCache, ...contentOnly } = args.cvData || {};
    void _design;
    void _staleCache;
    const prompt = buildCoverLetterPrompt({
      cvData: withoutUserOwnedFields(contentOnly),
      jobDescription: args.jobDescription,
      companyName: args.companyName,
      companyStage: args.companyStage,
      companyBusinessModel: args.companyBusinessModel,
      tone: args.tone,
      language,
    });
    const data = await chatJSONSchema(prompt, CoverLetterSchema, "fast");
    return {
      subject: data.subject,
      greeting: data.greeting,
      body: data.body,
      closing: data.closing,
    };
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
    const FALLBACK = { companyName: null, domainGuess: null, industry: null, stage: null, businessModel: null };
    if (!args.jobDescription || args.jobDescription.trim().length < 50) return FALLBACK;
    try {
      const prompt = buildCompanyExtractionPrompt({ jobDescription: args.jobDescription });
      return await chatJSONSchema(prompt, CompanyMetaSchema, "fast");
    } catch (e) {
      console.warn("[extractCompanyMeta] LLM call failed:", e);
      return FALLBACK;
    }
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
    await verifyAccessCode(ctx, args.accessCode);
    if (args.experiences.length === 0) return { results: [] };
    try {
      const prompt = buildExperienceEnrichmentPrompt({ experiences: args.experiences });
      const data = await chatJSONSchema(prompt, ExperienceEnrichmentSchema, "fast");
      // Pad with nulls if the LLM returned fewer items than asked
      const results = args.experiences.map((_, i) =>
        data.results[i] ?? { stage: null, businessModel: null },
      );
      return { results };
    } catch (e) {
      console.warn("[enrichExperienceMeta] LLM call failed:", e);
      return { results: args.experiences.map(() => ({ stage: null, businessModel: null })) };
    }
  },
});

/**
 * Pure 1:1 translation of a CV to a target language. PRESERVES structure
 * exactly — same number of bullets, same KPIs, same order. Distinct from
 * optimizeCVForPage which rewrites content. Use this when the user wants
 * "same CV, different language", not "regenerated for this language".
 */
export const translateCV = action({
  args: {
    cvData: v.any(),
    targetLanguage: v.union(v.literal('fr'), v.literal('en')),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    // Strip the meta-fields the LLM doesn't need to see (design + language hints
    // + the cache itself — the client rebuilds _translations after the call).
    const { design, detectedLanguage, languageOverride, _translations: _existingCache, ...contentOnly } = args.cvData || {};
    void _existingCache;
    const prompt = buildTranslatePrompt({
      cvData: withoutUserOwnedFields(contentOnly),
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

export const improveBulletPoint = action({
  args: {
    bullet: v.string(),
    position: v.string(),
    company: v.string(),
    jobDescription: v.optional(v.string()),
    missingKeywords: v.optional(v.array(v.string())),
    language: v.optional(v.union(v.literal('fr'), v.literal('en'))),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildBulletSuggestionsPrompt({
      bullet: args.bullet,
      position: args.position,
      company: args.company,
      jobDescription: args.jobDescription,
      missingKeywords: args.missingKeywords,
      language: args.language,
    });
    return await chatJSONSchema(prompt, BulletSuggestionsSchema, "fast");
  },
});

export const rewriteBulletsForJob = action({
  args: {
    bullets: v.array(
      v.object({
        index: v.number(),
        text: v.string(),
        position: v.string(),
        company: v.string(),
      })
    ),
    jobDescription: v.string(),
    missingKeywords: v.array(v.string()),
    language: v.optional(v.union(v.literal('fr'), v.literal('en'))),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildBulletRewritePrompt({
      bullets: args.bullets.map((b) => ({
        index: b.index,
        text: b.text,
        position: b.position,
        company: b.company,
      })),
      jobDescription: args.jobDescription,
      missingKeywords: args.missingKeywords,
      language: args.language,
    });
    return await chatJSONSchema(prompt, BulletRewriteSchema);
  },
});

export const autoDistributeMissingKeywords = action({
  args: {
    cvData: v.any(),
    missingKeywords: v.array(v.string()),
    jobDescription: v.string(),
    language: v.optional(v.union(v.literal('fr'), v.literal('en'))),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildKeywordDistributionPrompt({
      cvData: { experience: args.cvData?.experience ?? [] },
      missingKeywords: args.missingKeywords,
      jobDescription: args.jobDescription,
      summary: args.cvData?.personal_info?.summary,
      language: args.language,
    });
    const data = await chatJSONSchema(prompt, KeywordDistributionSchema);
    return { assignments: data.assignments };
  },
});
