"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { chatJSON, chatText } from "./_ai/chat";
import { verifyAccessCode } from "./_ai/auth";
import { buildExtractPrompt } from "./_ai/prompts/extract";
import { buildAdaptPrompt } from "./_ai/prompts/adapt";
import {
  buildBulletSuggestionsPrompt,
  buildBulletRewritePrompt,
} from "./_ai/prompts/rewrite";
import { buildATSAnalysisPrompt } from "./_ai/prompts/analysis";
import { buildCoverLetterPrompt } from "./_ai/prompts/coverLetter";
import { buildCompanyExtractionPrompt } from "./_ai/prompts/companyExtraction";
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
    const raw = await chatJSON(prompt);
    return normalizeCVData(raw);
  },
});

export const tailorCV = action({
  args: {
    baseData: v.any(),
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    const { design, detectedLanguage, languageOverride, ...contentOnly } = args.baseData || {};
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: contentOnly,
      jobDescription: args.jobDescription,
      detectedLanguage,
      languageOverride,
    });
    const raw = await chatJSON(prompt);
    const normalized = normalizeCVData(raw);
    return {
      ...normalized,
      ...(design && { design }),
      ...(detectedLanguage && { detectedLanguage }),
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
    const raw = await chatJSON(prompt, "fast");
    const parsed = ATSAnalysisSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[getATSAnalysis] schema parse failed:", parsed.error.message);
      throw new Error("L'IA a retourné une analyse invalide. Veuillez réessayer.");
    }
    return parsed.data;
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
    let pageText = "";
    try {
      const jinaResponse = await fetch(`https://r.jina.ai/${args.url}`, {
        headers: {
          Accept: "text/plain",
          "X-Return-Format": "text",
        },
      });
      if (jinaResponse.ok) {
        pageText = (await jinaResponse.text()).substring(0, 15000);
      }
    } catch (e) {
      // Jina failed, try direct fetch
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
    const raw = await chatJSON(prompt, "fast");
    const parsed = KeywordListSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[extractJobKeywords] schema parse failed:", parsed.error.message);
      throw new Error("L'IA a retourné un format invalide. Veuillez réessayer.");
    }
    return { keywords: parsed.data.keywords };
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
    const { design, detectedLanguage, languageOverride, ...contentOnly } = args.cvData || {};
    const prompt = buildAdaptPrompt({
      mode: "optimize",
      cvData: contentOnly,
      pageLimit: args.pageLimit,
      jobDescription: args.jobDescription,
      detectedLanguage,
      languageOverride,
    });
    const raw = await chatJSON(prompt);
    const normalized = normalizeCVData(raw);
    return {
      ...normalized,
      ...(design && { design }),
      ...(detectedLanguage && { detectedLanguage }),
      ...(languageOverride && { languageOverride }),
    };
  },
});

export const generateCoverLetter = action({
  args: {
    cvData: v.any(),
    jobDescription: v.string(),
    companyName: v.optional(v.string()),
    tone: v.optional(v.string()),
    language: v.optional(v.union(v.literal('fr'), v.literal('en'))),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    const prompt = buildCoverLetterPrompt({
      cvData: args.cvData,
      jobDescription: args.jobDescription,
      companyName: args.companyName,
      tone: args.tone,
      language: args.language,
    });
    const raw = await chatJSON(prompt, "fast");
    const parsed = CoverLetterSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[generateCoverLetter] schema parse failed:", parsed.error.message);
      throw new Error("L'IA a retourné une lettre invalide. Veuillez réessayer.");
    }
    return {
      subject: parsed.data.subject,
      greeting: parsed.data.greeting,
      body: parsed.data.body,
      closing: parsed.data.closing,
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
    const FALLBACK = { companyName: null, domainGuess: null, industry: null };
    if (!args.jobDescription || args.jobDescription.trim().length < 50) return FALLBACK;
    try {
      const prompt = buildCompanyExtractionPrompt({ jobDescription: args.jobDescription });
      const raw = await chatJSON(prompt, "fast");
      const parsed = CompanyMetaSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn("[extractCompanyMeta] schema parse failed:", parsed.error.message);
        return FALLBACK;
      }
      return parsed.data;
    } catch (e) {
      console.warn("[extractCompanyMeta] LLM call failed:", e);
      return FALLBACK;
    }
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
    const raw = await chatJSON(prompt, "fast");
    const parsed = BulletSuggestionsSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[improveBulletPoint] schema parse failed:", parsed.error.message);
      throw new Error("L'IA a retourné un format invalide. Veuillez réessayer.");
    }
    return parsed.data;
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
    const raw = await chatJSON(prompt);
    const parsed = BulletRewriteSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[rewriteBulletsForJob] schema parse failed:", parsed.error.message);
      throw new Error("L'IA a retourné un format invalide. Veuillez réessayer.");
    }
    return parsed.data;
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
    const raw = await chatJSON(prompt);
    const parsed = KeywordDistributionSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[autoDistributeMissingKeywords] schema parse failed:", parsed.error.message);
      throw new Error("L'IA a retourné un format invalide. Veuillez réessayer.");
    }
    return { assignments: parsed.data.assignments };
  },
});
