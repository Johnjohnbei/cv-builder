"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { chatJSONSchema, chatJSONThen, chatText } from "./_ai/chat";
import { verifyAccessCode } from "./_ai/auth";
import { buildExtractPrompt } from "./_ai/prompts/extract";
import { buildAdaptPrompt } from "./_ai/prompts/adapt";
import {
  buildBulletSuggestionsPrompt,
  buildBulletRewritePrompt,
} from "./_ai/prompts/rewrite";
import { buildATSAnalysisPrompt } from "./_ai/prompts/analysis";
import { buildCoverLetterPrompt } from "./_ai/prompts/coverLetter";
import { detectTextLanguage, resolveAdaptLanguage } from "./_ai/languageDetection";
import { buildCompanyExtractionPrompt } from "./_ai/prompts/companyExtraction";
import { buildExperienceEnrichmentPrompt } from "./_ai/prompts/experienceEnrichment";
import { buildTranslatePrompt } from "./_ai/prompts/translate";
import {
  buildJobDescriptionFromURLPrompt,
  buildJobDescriptionFromPDFPrompt,
  buildJobKeywordsPrompt,
} from "./_ai/prompts/jobDescription";
import { buildKeywordDistributionPrompt } from "./_ai/prompts/distribute";
import {
  BulletSuggestionsSchema,
  BulletRewriteSchema,
  ATSAnalysisSchema,
  CoverLetterSchema,
  CompanyMetaSchema,
  ExperienceEnrichmentSchema,
  KeywordListSchema,
  KeywordDistributionSchema,
} from "./_ai/schemas";
import { normalizeCVData } from "./_ai/normalizers";

// ─── Actions ────────────────────────────────────────────────────────

export const extractCVDataFromPDF = action({
  args: {
    pdfText: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildExtractPrompt({ pdfText: args.pdfText });
    return await chatJSONThen(prompt, normalizeCVData);
  },
});

/**
 * Auto-enrich experiences that lack companyStage / companyBusinessModel tags
 * after a tailor or optimize call. Single batched LLM round-trip on fast model.
 * Never overwrites user-set values; skips entirely if all experiences are
 * already enriched.
 */
async function autoEnrichExperiences(experiences: any[]): Promise<any[]> {
  if (!Array.isArray(experiences) || experiences.length === 0) return experiences;
  const needsEnrichment = experiences.some(e => !e?.companyStage || !e?.companyBusinessModel);
  if (!needsEnrichment) return experiences;
  try {
    const prompt = buildExperienceEnrichmentPrompt({
      experiences: experiences.map(e => ({
        company: e?.company ?? '',
        position: e?.position ?? '',
        intro: e?.intro,
        description: e?.description,
      })),
    });
    const data = await chatJSONSchema(prompt, ExperienceEnrichmentSchema, "fast");
    return experiences.map((e, i) => {
      const r = data.results[i];
      if (!r) return e;
      return {
        ...e,
        // Merge only — never overwrite existing user-set values
        companyStage: e?.companyStage || r.stage || undefined,
        companyBusinessModel: e?.companyBusinessModel || r.businessModel || undefined,
      };
    });
  } catch (err) {
    console.warn("[autoEnrichExperiences] LLM call failed:", err);
    return experiences;
  }
}

export const tailorCV = action({
  args: {
    baseData: v.any(),
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    // Strip _translations: the cache is bound to the current content; once we
    // rewrite, it's obsolete. Drop it explicitly so the LLM doesn't see it
    // (saves tokens) and the return doesn't carry stale translations.
    const { design, detectedLanguage, languageOverride, _translations: _staleCache, ...contentOnly } = args.baseData || {};
    void _staleCache;
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: contentOnly,
      jobDescription: args.jobDescription,
      detectedLanguage,
      languageOverride,
    });
    const normalized = await chatJSONThen(prompt, normalizeCVData);
    const enrichedExperience = await autoEnrichExperiences(normalized.experience);
    // Return the language actually used by the prompt so the UI toggle and
    // section labels match the generated content (JD-first, then user override).
    const effectiveLanguage = resolveAdaptLanguage(args.jobDescription, languageOverride, detectedLanguage);
    return {
      ...normalized,
      experience: enrichedExperience,
      ...(design && { design }),
      detectedLanguage: effectiveLanguage,
      ...(languageOverride && { languageOverride }),
    };
  },
});

export const getATSAnalysis = action({
  args: {
    cvData: v.any(),
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildATSAnalysisPrompt({
      cvData: args.cvData,
      jobDescription: args.jobDescription,
    });
    return await chatJSONSchema(prompt, ATSAnalysisSchema, "fast");
  },
});

export const extractJobDescriptionFromURL = action({
  args: {
    url: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);

    // Step 1: Try Jina Reader first — renders JS (handles SPAs like WTTJ, LinkedIn),
    // expands accordions, returns clean markdown. Free, no API key needed.
    // Anonymous tier is heavily rate-limited (429/402 are routine from cloud
    // IPs) and can hang — hard timeout, then fall through to direct fetch.
    let pageText = "";
    try {
      const jinaResponse = await fetch(`https://r.jina.ai/${args.url}`, {
        headers: {
          Accept: "text/plain",
          "X-Return-Format": "text",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (jinaResponse.ok) {
        pageText = (await jinaResponse.text()).substring(0, 15000);
      } else {
        console.warn(`[extractJobDescriptionFromURL] Jina returned ${jinaResponse.status}, falling back to direct fetch`);
      }
    } catch (e: any) {
      console.warn(`[extractJobDescriptionFromURL] Jina failed (${e?.name === "TimeoutError" ? "timeout" : e?.message?.slice(0, 100)}), falling back to direct fetch`);
    }

    // Step 2: Fallback to direct fetch if Jina failed (faster, works for simple static sites)
    if (!pageText || pageText.length < 100) {
      try {
        const response = await fetch(args.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          },
          signal: AbortSignal.timeout(15_000),
        });
        const html = await response.text();

        pageText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trim()
          .substring(0, 15000);
      } catch (e) {
        pageText = "";
      }
    }

    if (!pageText || pageText.length < 50) {
      throw new Error(
        "Impossible d'extraire le contenu de cette URL. Essayez de copier-coller le texte de l'offre manuellement."
      );
    }

    const prompt = buildJobDescriptionFromURLPrompt({ url: args.url, pageText });
    return await chatText(prompt);
  },
});

export const extractJobDescriptionFromPDF = action({
  args: {
    pdfText: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildJobDescriptionFromPDFPrompt({ pdfText: args.pdfText });
    return await chatText(prompt, "fast");
  },
});

export const extractJobKeywords = action({
  args: {
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildJobKeywordsPrompt({ jobDescription: args.jobDescription });
    const data = await chatJSONSchema(prompt, KeywordListSchema, "fast");
    return { keywords: data.keywords };
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
    await verifyAccessCode(ctx, args.accessCode);
    // Same as tailorCV: drop _translations so the LLM doesn't see the stale
    // cache and we don't return a translation that no longer matches content.
    const { design, detectedLanguage, languageOverride, _translations: _staleCache, ...contentOnly } = args.cvData || {};
    void _staleCache;
    const prompt = buildAdaptPrompt({
      mode: "optimize",
      cvData: contentOnly,
      pageLimit: args.pageLimit,
      jobDescription: args.jobDescription,
      detectedLanguage,
      languageOverride,
    });
    const normalized = await chatJSONThen(prompt, normalizeCVData);
    const enrichedExperience = await autoEnrichExperiences(normalized.experience);
    const effectiveLanguage = resolveAdaptLanguage(args.jobDescription, languageOverride, detectedLanguage);
    return {
      ...normalized,
      experience: enrichedExperience,
      ...(design && { design }),
      detectedLanguage: effectiveLanguage,
      ...(languageOverride && { languageOverride }),
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
    await verifyAccessCode(ctx, args.accessCode);
    // Server-side fallback detection: trust the client's hint when provided,
    // otherwise detect from the job description ourselves so the prompt always
    // matches the JD language even if the caller forgot to pass `language`.
    const language = args.language ?? detectTextLanguage(args.jobDescription);
    console.info(`[generateCoverLetter] language=${language} (client=${args.language ?? 'none'}, server-detected=${detectTextLanguage(args.jobDescription)})`);
    const prompt = buildCoverLetterPrompt({
      cvData: args.cvData,
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
      cvData: contentOnly,
      targetLanguage: args.targetLanguage,
    });
    const normalized = await chatJSONThen(prompt, normalizeCVData);
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
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildBulletSuggestionsPrompt({
      bullet: args.bullet,
      position: args.position,
      company: args.company,
      jobDescription: args.jobDescription,
      missingKeywords: args.missingKeywords,
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
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
    });
    return await chatJSONSchema(prompt, BulletRewriteSchema);
  },
});

export const autoDistributeMissingKeywords = action({
  args: {
    cvData: v.any(),
    missingKeywords: v.array(v.string()),
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildKeywordDistributionPrompt({
      cvData: { experience: args.cvData?.experience ?? [] },
      missingKeywords: args.missingKeywords,
      jobDescription: args.jobDescription,
      summary: args.cvData?.personal_info?.summary,
    });
    const data = await chatJSONSchema(prompt, KeywordDistributionSchema);
    return { assignments: data.assignments };
  },
});
