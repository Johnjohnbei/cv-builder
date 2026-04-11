"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getModel } from "./_ai/providers";
import { chatJSON, chatText } from "./_ai/chat";
import { verifyAccessCode } from "./_ai/auth";
import { buildExtractPrompt } from "./_ai/prompts/extract";
import { buildAdaptPrompt } from "./_ai/prompts/adapt";
import {
  buildBulletSuggestionsPrompt,
  buildBulletRewritePrompt,
} from "./_ai/prompts/rewrite";
import {
  BulletSuggestionsSchema,
  BulletRewriteSchema,
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

    const prompt = `
Tu es un expert en recrutement et en systèmes ATS.
Analyse le CV suivant par rapport à l'offre d'emploi fournie.

CV : ${JSON.stringify(args.cvData)}
Offre : ${args.jobDescription}

Retourne un objet JSON avec :
- score : un nombre entre 0 et 100
- missingKeywords : liste des mots-clés importants manquants
- strengths : points forts du CV pour ce poste
- improvements : conseils concrets d'amélioration
- ats_compatibility : 'LOW', 'MEDIUM' ou 'HIGH'

Retourne UNIQUEMENT le JSON.
`;

    return await chatJSON(prompt, getModel("fast"));
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

    const prompt = `Tu es un expert en extraction d'offres d'emploi.

Voici le contenu texte extrait de la page ${args.url} :

${pageText}

Extrais et structure la description complète de l'offre d'emploi :
- Titre du poste
- Entreprise
- Missions et responsabilités
- Profil recherché (compétences hard & soft)
- Avantages et infos entreprise
- Localisation, type de contrat, salaire si mentionnés

Retourne le texte structuré, sans commentaires.`;

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

    const prompt = `
Analyse ce texte extrait d'un document PDF qui est une fiche de poste.
Extrais la description complète de l'offre d'emploi.
Retourne uniquement le texte de la description.

Texte du PDF :
${args.pdfText}
`;

    return await chatText(prompt, getModel("fast"));
  },
});

export const extractJobKeywords = action({
  args: {
    jobDescription: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);

    const prompt = `Tu es un expert en recrutement et ATS (Applicant Tracking Systems).

MISSION : Extrais les compétences et mots-clés qu'un ATS rechercherait dans un CV pour cette offre.

OFFRE D'EMPLOI :
${args.jobDescription}

RÈGLES D'EXTRACTION :
- Extrais UNIQUEMENT des compétences concrètes et vérifiables :
  • Outils et technologies (Figma, React, SAP, Excel, Salesforce...)
  • Méthodologies (Agile, Scrum, Lean, Design Thinking, Six Sigma...)
  • Compétences techniques (UX Design, data analysis, product management, SEO...)
  • Certifications (PMP, AWS, Google Analytics, ITIL...)
  • Compétences métier spécifiques au poste (brand management, supply chain, audit financier...)
  • Soft skills UNIQUEMENT si explicitement demandées dans l'offre (leadership, négociation...)
- N'extrais JAMAIS de mots génériques (gestion, projet, équipe, entreprise, travail, expérience...)
- N'extrais JAMAIS de verbes d'action (gérer, piloter, développer, concevoir...)
- N'extrais JAMAIS de mots courants qui ne sont pas des compétences
- Maximum 30 mots-clés, triés par importance pour le poste

Retourne un JSON : { "keywords": ["keyword1", "keyword2", ...] }
Retourne UNIQUEMENT le JSON.`;

    return await chatJSON(prompt, getModel("fast"));
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
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);
    const tone = args.tone || "professionnel et engagé";
    const company = args.companyName ? `pour l'entreprise ${args.companyName}` : "";

    const prompt = `
Tu es un expert en rédaction de lettres de motivation ${company}.
Rédige une lettre de motivation percutante en français, ton ${tone}.

CV du candidat :
${JSON.stringify(args.cvData)}

Offre d'emploi :
${args.jobDescription}

Règles :
1. Maximum 400 mots
2. Structure : accroche → compétences clés liées au poste → motivation → conclusion avec appel à l'action
3. Utilise les mots-clés de l'offre naturellement
4. Mentionne des réalisations concrètes du CV
5. Pas de formules clichées ("je me permets de vous écrire", "veuillez agréer")
6. Ton : direct, confiant, spécifique

Retourne un objet JSON avec :
- subject: l'objet du mail (court)
- greeting: la formule d'appel
- body: le corps de la lettre (en paragraphes séparés par \\n\\n)
- closing: la formule de fin

Retourne UNIQUEMENT le JSON.
`;

    return await chatJSON(prompt, getModel("fast"));
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
    const raw = await chatJSON(prompt, getModel("fast"));
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
