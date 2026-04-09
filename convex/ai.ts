"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";

// ─── Multi-provider configuration ───────────────────────────────────
// All providers expose an OpenAI-compatible API.
// Switch provider by changing the env var or adding new entries.

interface AIProvider {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  fastModel: string;
}

function getProvider(): AIProvider {
  // Primary: Gemini Flash (free tier, 15 req/min, best quality/cost ratio)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: geminiKey,
      defaultModel: "gemini-2.5-flash",
      fastModel: "gemini-2.5-flash",
    };
  }

  // Fallback: NVIDIA NIM (free tier, 40 req/min)
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    return {
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: nvidiaKey,
      defaultModel: "meta/llama-3.1-70b-instruct",
      fastModel: "meta/llama-3.1-70b-instruct",
    };
  }

  throw new Error(
    "No AI provider configured. Set GEMINI_API_KEY (recommended) or NVIDIA_API_KEY in Convex env vars."
  );
}

function getClient(): OpenAI {
  const provider = getProvider();
  return new OpenAI({
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
  });
}

function getModel(speed: "default" | "fast" = "default"): string {
  const provider = getProvider();
  return speed === "fast" ? provider.fastModel : provider.defaultModel;
}

// ─── Helpers ────────────────────────────────────────────────────────

async function verifyAccessCode(ctx: any, code?: string) {
  // Admin bypass via env var
  if (process.env.REQUIRE_ACCESS_CODE !== "true") return;
  if (!code) throw new Error("Code d'accès requis.");

  const { internal } = await import("./_generated/api");
  const result = await ctx.runQuery(internal.accessCodes.verifyInternal, { code });
  if (!result.valid) {
    throw new Error(result.reason || "Code d'accès invalide.");
  }
  // Increment usage
  await ctx.runMutation(internal.accessCodes.incrementUsageInternal, { code });
}

function safeParseJSON(text: string | undefined | null, fallback: any = {}): any {
  if (!text) throw new Error("L'IA a retourné une réponse vide. Veuillez réessayer.");
  
  // Sometimes the model wraps JSON in ```json ... ``` markdown blocks
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", text.slice(0, 300));
    throw new Error("L'IA a retourné une réponse invalide. Veuillez réessayer.");
  }
}

async function chatJSON(prompt: string, model?: string): Promise<any> {
  const client = getClient();
  try {
    // Try with JSON mode first (supported by most models)
    const response = await client.chat.completions.create({
      model: model || getModel(),
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    return safeParseJSON(response.choices[0]?.message?.content);
  } catch (e: any) {
    // Fallback: some NIM models don't support response_format — retry without it
    if (e?.status === 400 || e?.message?.includes("400")) {
      console.log("JSON mode not supported, retrying without response_format...");
      const response = await client.chat.completions.create({
        model: model || getModel(),
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });
      return safeParseJSON(response.choices[0]?.message?.content);
    }
    throw e;
  }
}

async function chatText(prompt: string, model?: string): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: model || getModel(),
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content || "";
}

// ─── Actions ────────────────────────────────────────────────────────

export const extractCVDataFromPDF = action({
  args: {
    pdfText: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);

    const prompt = `
Tu es un expert en recrutement et en structuration de données CV.
Extrais les informations professionnelles du texte de CV suivant et retourne-les au format JSON strict.

TEXTE DU CV :
${args.pdfText}

RÈGLES IMPORTANTES :

1. DATES : Utilise TOUJOURS le format "Mois YYYY" (ex: "Septembre 2016", "Janvier 2024").
   Si seule l'année est disponible, utilise juste "YYYY".
   Pour un poste actuel, met end_date à "" et current à true.

2. EXPÉRIENCES : Chaque expérience a deux parties distinctes :
   - "intro" : UNE phrase de description du rôle/contexte (1-2 lignes). Toujours présent.
   - "description" : Liste de bullet points d'ACTIONS concrètes et résultats.
   Chaque bullet commence par un verbe d'action. Maximum 4 bullets par expérience.
   L'intro décrit LE QUOI, les bullets décrivent LE COMMENT et LES RÉSULTATS.

3. TITRE PROFESSIONNEL : Utilise un titre court et percutant (max 5 mots).
   Pas de liste de postes, pas de "Ex-xxx".

4. SUMMARY : Maximum 3 phrases. Résume le profil, les spécialités et la valeur ajoutée.

5. COMPÉTENCES : Regroupe en 2-4 catégories max. Chaque catégorie a 3-6 items.
   Catégories typiques : "Métier/Product", "Technique", "Outils", "Soft Skills".
   Chaque item est un mot ou expression courte (1-3 mots).

6. LANGUES : Utilise les proficiencies standards : "Natif", "Bilingue", "Courant (C1)", "Intermédiaire (B1/B2)", "Débutant (A1/A2)".

Structure JSON attendue :
{
  "personal_info": { "name": "", "email": "", "phone": "", "location": "", "title": "", "summary": "" },
  "experience": [ { "company": "", "position": "", "location": "", "start_date": "", "end_date": "", "current": false, "intro": "Description courte du rôle (1-2 lignes)", "description": ["action bullet 1", "action bullet 2"] } ],
  "education": [ { "school": "", "degree": "", "field": "", "start_date": "", "end_date": "" } ],
  "skills": [ { "category": "", "items": ["item1", "item2"] } ],
  "languages": [ { "name": "", "proficiency": "" } ]
}

IMPORTANT : Retourne TOUTES les expériences du CV, même les anciennes. L'utilisateur choisira lesquelles afficher.
Retourne UNIQUEMENT le JSON, rien d'autre.
`;

    const data = await chatJSON(prompt);

    // ─── Post-processing: normalize and clean the extracted data ───

    if (data.experience) {
      data.experience = data.experience.map((exp: any) => ({
        ...exp,
        current:
          exp.current === true ||
          exp.end_date === "" ||
          exp.end_date?.toLowerCase?.() === "présent" ||
          exp.end_date?.toLowerCase?.() === "present",
        end_date:
          exp.current === true ||
          exp.end_date?.toLowerCase?.() === "présent" ||
          exp.end_date?.toLowerCase?.() === "present"
            ? ""
            : exp.end_date,
        description: Array.isArray(exp.description)
          ? exp.description
              .flatMap((d: string) => {
                if (typeof d === "string" && d.length > 200) {
                  return d
                    .split(/[•·\-–—]\s+|(?:\.\s+)(?=[A-Z])/)
                    .filter((s) => s.trim().length > 10)
                    .map((s) => s.trim());
                }
                return [typeof d === "string" ? d.trim() : String(d)];
              })
              .slice(0, 5)
          : [],
      }));
    }

    if (data.skills) {
      data.skills = data.skills
        .map((cat: any) => ({
          category: typeof cat.category === "string" ? cat.category : "Compétences",
          items: Array.isArray(cat.items)
            ? cat.items
                .map((item: any) =>
                  typeof item === "string"
                    ? item
                    : item?.name || item?.skill || String(item)
                )
                .slice(0, 8)
            : [],
        }))
        .slice(0, 5);
    }

    if (data.personal_info?.summary && data.personal_info.summary.length > 300) {
      data.personal_info.summary = data.personal_info.summary.substring(0, 297) + "...";
    }

    if (data.personal_info?.title && data.personal_info.title.length > 50) {
      const parts = data.personal_info.title.split(/[|,]/);
      data.personal_info.title = parts[0].trim();
    }

    const proficiencyMap: Record<string, string> = {
      "native or bilingual": "Natif / Bilingue",
      "native or bilingual proficiency": "Natif / Bilingue",
      "full professional": "Courant (C1)",
      "full professional proficiency": "Courant (C1)",
      "professional working": "Professionnel (B2)",
      "professional working proficiency": "Professionnel (B2)",
      "limited working": "Intermédiaire (B1)",
      "limited working proficiency": "Intermédiaire (B1)",
      elementary: "Débutant (A2)",
      "elementary proficiency": "Débutant (A2)",
    };
    if (data.languages) {
      data.languages = data.languages.map((lang: any) => ({
        ...lang,
        proficiency:
          proficiencyMap[lang.proficiency?.toLowerCase?.().trim()] || lang.proficiency,
      }));
    }

    return data;
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

    // Strip non-content fields to reduce prompt size ~50%
    const { design, detectedLanguage, languageOverride, ...contentOnly } = args.baseData;

    const prompt = `Tu es un rédacteur de CV senior spécialisé en optimisation ATS pour le marché français (2025-2026).

MISSION : Adapte ce CV pour maximiser l'alignement avec l'offre d'emploi.

RÈGLES :
1. CONSERVE toutes les expériences, formations, compétences, langues — ne supprime RIEN
2. Structure JSON de sortie IDENTIQUE à l'entrée (même nombre d'éléments partout)
3. Réécris les bullets avec des verbes d'action forts (Pilote, Conçoit, Orchestre — JAMAIS "Responsable de", "Aide à")
4. Expériences pertinentes : enrichis les descriptions, intègre les mots-clés de l'offre, développe les résultats
5. Expériences moins pertinentes : condense à 1-2 bullets tout en les gardant
6. Résumé (summary) : 2-3 phrases ciblant directement le poste
7. Compétences : réordonne — les plus pertinentes pour l'offre en premier
8. ${FABRICATION_GUARD}

CV :
${JSON.stringify(contentOnly)}

OFFRE :
${args.jobDescription}

Retourne UNIQUEMENT le JSON du CV optimisé.`;

    const result = await chatJSON(prompt);
    // Re-attach stripped fields
    if (design) result.design = design;
    if (detectedLanguage) result.detectedLanguage = detectedLanguage;
    if (languageOverride) result.languageOverride = languageOverride;
    return result;
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

export const optimizeCVForPage = action({
  args: {
    cvData: v.any(),
    pageLimit: v.number(),
    jobDescription: v.optional(v.string()),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAccessCode(ctx, args.accessCode);

    // Strip non-content fields to reduce prompt size
    const { design, detectedLanguage, languageOverride, ...contentOnly } = args.cvData || {};

    const jobContext = args.jobDescription
      ? `
OFFRE D'EMPLOI CIBLÉE :
${args.jobDescription}

Utilise cette offre pour PRIORISER : les expériences et compétences les plus pertinentes pour ce poste doivent être les plus développées.`
      : `
Pas d'offre d'emploi fournie. Priorise par RÉCENCE : les expériences les plus récentes sont les plus développées.`;

    const prompt = `Tu es un expert en rédaction de CV professionnels et en optimisation de mise en page.

Ta mission : réorganiser et ajuster le contenu de ce CV pour qu'il tienne sur ${args.pageLimit} page(s) A4 tout en maximisant l'impact professionnel.

DONNÉES DU CV :
${JSON.stringify(contentOnly)}
${jobContext}

═══ RÈGLE ABSOLUE — NE SUPPRIME RIEN ═══
Toutes les expériences, formations, compétences, langues présentes en entrée DOIVENT être présentes en sortie.
Le nombre d'éléments dans chaque section doit être IDENTIQUE.
Tu n'as le droit que de : réordonner, reformuler, condenser, enrichir, et changer le displayMode.

═══ SYSTÈME DE BLOCS MODULABLES ═══

Chaque expérience a un champ "displayMode" qui contrôle la place qu'elle prend :

- "compact" : Le poste + entreprise + 1 ligne de description synthétique. Pour les postes anciens ou peu pertinents.
- "normal" : Le poste + entreprise + 2 bullet points d'actions clés (une ligne chacun). Le mode par défaut.
- "extended" : Le poste + entreprise + jusqu'à 5 bullet points détaillés + un champ "kpi" avec un résultat chiffré. Pour les postes les plus importants.

Chaque expérience a aussi un champ optionnel "kpi" (string) : un résultat chiffré clé (ex: "+35% de CA", "Management de 12 personnes", "Réduction de 40% des coûts"). Remplis-le UNIQUEMENT pour les expériences en mode "extended".

═══ STRATÉGIE DE PRIORISATION ═══

1. RÉORDONNE les expériences par pertinence (la plus importante en premier)
2. ASSIGNE un displayMode à chaque expérience :
   - TOP priorité (1-2 premières) → "extended" avec kpi rempli
   - MOYENNE priorité → "normal"
   - BASSE priorité (anciennes/peu pertinentes) → "compact"
3. Ajuste le nombre de bullets selon le mode :
   - "extended" : 3-5 bullets détaillés + kpi
   - "normal" : exactement 2 bullets concis
   - "compact" : 1 seule phrase descriptive dans description[0]

4. RÉSUMÉ : 2-3 phrases percutantes.
5. COMPÉTENCES : Réordonne — les plus pertinentes en premier.
6. FORMATIONS et LANGUES : Garde tel quel.

═══ QUALITÉ DES REFORMULATIONS ═══
- Verbe d'action fort et précis en début de bullet (Pilote, Conçoit, Orchestre, Déploie, Optimise, Structure — JAMAIS "Responsable de", "Participe à", "Aide à", "Gère")
- Structure : ACTION + CONTEXTE + RÉSULTAT en 1-2 lignes max
- Conserve les chiffres existants, ne PAS en inventer
- Si pas de chiffres, utilise des indicateurs qualitatifs réalistes (périmètre, équipe, nombre de projets)
- Mots-clés du secteur / de l'offre intégrés naturellement
- KPI (champ "kpi" des extended) : résultat concret et crédible. Exemples de bons KPIs :
  * "+35% de trafic organique en 6 mois" (si données existantes)
  * "Management d'une équipe de 8 designers" (périmètre)
  * "Refonte couvrant 5 marques et 30M+ utilisateurs" (envergure)
  * "Réduction de 40% du time-to-market" (si données existantes)
  Ne PAS inventer de pourcentages ou chiffres. Préférer l'envergure (taille équipe, nombre projets, périmètre) aux métriques inventées.

═══ CONTRAINTE TAILLE ═══
Pour ${args.pageLimit} page(s) A4, un bon équilibre est :
- 1 page : max 1 extended + 1-2 normal + le reste compact
- 2 pages : max 2-3 extended + 2-3 normal + le reste compact

Retourne UNIQUEMENT l'objet JSON complet du CV optimisé. Chaque expérience DOIT avoir displayMode et les extended DOIVENT avoir kpi.`;

    const optimizedData = await chatJSON(prompt);

    // Sanitize skills
    if (optimizedData.skills) {
      optimizedData.skills = optimizedData.skills.map((cat: any) => ({
        ...cat,
        category: typeof cat.category === "string" ? cat.category : "Compétences",
        items: Array.isArray(cat.items)
          ? cat.items.map((item: any) => {
              if (typeof item === "string") return item;
              if (typeof item === "object" && item !== null) {
                return item.name || item.skill || item.title || JSON.stringify(item);
              }
              return String(item);
            })
          : [],
      }));
    }

    // Ensure displayMode on all experiences
    if (optimizedData.experience) {
      optimizedData.experience = optimizedData.experience.map((exp: any) => ({
        ...exp,
        displayMode: exp.displayMode || "normal",
      }));
    }

    // Re-attach stripped fields
    if (design) optimizedData.design = design;
    if (detectedLanguage) optimizedData.detectedLanguage = detectedLanguage;
    if (languageOverride) optimizedData.languageOverride = languageOverride;

    return optimizedData;
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
    const jobContext = args.jobDescription
      ? `\n\nOffre ciblée :\n${args.jobDescription}`
      : "";

    const keywordContext = args.missingKeywords?.length
      ? `\nMots-clés manquants à intégrer si pertinent : ${args.missingKeywords.join(", ")}`
      : "";

    const prompt = `Tu es un rédacteur de CV senior spécialisé dans l'optimisation ATS et le recrutement tech/business en France.

CONTEXTE :
- Poste : ${args.position} chez ${args.company}
- Bullet actuel : "${args.bullet}"${jobContext}${keywordContext}

MISSION : Propose exactement 3 reformulations de ce bullet, chacune avec un angle différent :
1. **Version impact** : met en avant le résultat business ou l'impact concret
2. **Version leadership** : met en avant le rôle de pilotage, de décision ou de collaboration
3. **Version technique** : met en avant la méthodologie, les outils ou l'expertise déployée

RÈGLES DE RÉDACTION :
- Commence TOUJOURS par un verbe d'action fort et précis (Pilote, Conçoit, Orchestre, Déploie, Optimise, Structure, Dirige — PAS "Responsable de", "Participe à", "Aide à", "Gère")
- Une bullet = UNE action + UN contexte + UN résultat/impact
- Maximum 2 lignes, privilégie la concision
- Vocabulaire professionnel et naturel, adapté au secteur de ${args.company}
- ${FABRICATION_GUARD}
- Si le bullet original contient des chiffres, conserve-les. Sinon, utilise des indicateurs qualitatifs (équipe de X, X projets, périmètre Y)

EXEMPLES DE BONNE QUALITÉ :
- "Pilote la refonte du Design System multi-marques pour 5 marques premium, couvrant 30M+ utilisateurs"
- "Orchestre la transition data-driven du product management avec définition de KPIs et dashboards de suivi"
- "Conçoit l'architecture front-end modulaire permettant le déploiement simultané sur 3 plateformes"

Retourne un JSON : { "suggestions": ["suggestion1", "suggestion2", "suggestion3"] }
Retourne UNIQUEMENT le JSON.`;

    return await chatJSON(prompt, getModel("fast"));
  },
});

// ─── Bullet rewriting actions ──────────────────────────────────────

const FABRICATION_GUARD = `RÈGLE ABSOLUE : Ne JAMAIS inventer de chiffres, métriques ou résultats. Si le bullet original ne contient pas de données chiffrées, la version réécrite ne doit pas en ajouter. Tu peux reformuler pour être plus percutant sans fabriquer de données.`;

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

    const bulletsList = args.bullets
      .map((b) => `[${b.index}] (${b.position} @ ${b.company}) "${b.text}"`)
      .join("\n");

    const keywordsLine = args.missingKeywords.length
      ? `Intègre naturellement ces mots-clés si pertinent : ${args.missingKeywords.join(", ")}`
      : "";

    const prompt = `Tu es un rédacteur de CV senior spécialisé dans l'optimisation ATS pour le marché français.

MISSION : Réécris chaque bullet point pour maximiser l'alignement avec l'offre d'emploi tout en restant fidèle à l'expérience réelle du candidat.

OFFRE D'EMPLOI :
${args.jobDescription}

${keywordsLine}

${FABRICATION_GUARD}

BULLETS À RÉÉCRIRE :
${bulletsList}

RÈGLES DE RÉDACTION :
1. Verbe d'action fort en début (Pilote, Conçoit, Orchestre, Déploie, Optimise, Structure — JAMAIS "Responsable de", "Participe à", "Aide à")
2. Structure : ACTION + CONTEXTE + RÉSULTAT/IMPACT en 1-2 lignes
3. Intègre les mots-clés de l'offre de façon naturelle, pas forcée
4. Conserve le sens original — tu améliores la formulation, tu ne changes pas l'expérience
5. Si le bullet original a des chiffres, conserve-les. Sinon, ne pas en inventer — utilise des indicateurs qualitatifs si possible
6. Adapte le vocabulaire au secteur de l'entreprise

EXEMPLES AVANT/APRÈS :
- AVANT : "Responsable de la gestion de projets digitaux"
  APRÈS : "Pilote un portefeuille de projets digitaux de la conception au déploiement, en coordination avec les équipes tech et marketing"
- AVANT : "Aide à la création de maquettes"
  APRÈS : "Conçoit les maquettes UI/UX et prototypes interactifs, validés en user testing auprès de panels utilisateurs"

Retourne un JSON : { "rewrites": [{ "index": <numero>, "original": "<texte original>", "rewritten": "<version améliorée>" }] }
Retourne UNIQUEMENT le JSON.`;

    const data = await chatJSON(prompt);

    if (!data.rewrites || !Array.isArray(data.rewrites)) {
      throw new Error("L'IA a retourné un format invalide.");
    }

    return data;
  },
});
