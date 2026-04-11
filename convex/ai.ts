"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getModel } from "./_ai/providers";
import { chatJSON, chatText } from "./_ai/chat";
import { verifyAccessCode } from "./_ai/auth";
import { FABRICATION_GUARD } from "./_ai/prompts/fragments";
import { buildExtractPrompt } from "./_ai/prompts/extract";
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

    // Strip non-content fields to reduce prompt size ~50%
    const { design, detectedLanguage, languageOverride, ...contentOnly } = args.baseData;

    // Detect language from JD or CV
    const lang = languageOverride || detectedLanguage || 'fr';
    const isEn = lang === 'en' || /\b(experience|skills|education|responsibilities|requirements)\b/i.test(args.jobDescription.slice(0, 500));
    const actionVerbs = isEn
      ? 'Led, Designed, Orchestrated, Deployed, Optimized — NEVER "Responsible for", "Helped with", "Participated in"'
      : 'Pilote, Conçoit, Orchestre, Déploie, Optimise — JAMAIS "Responsable de", "Aide à", "Participe à"';
    const outputLang = isEn ? 'Write ALL content in English.' : 'Rédige TOUT le contenu en français.';

    const prompt = `You are a senior CV writer specialized in ATS optimization (2025-2026).

LANGUAGE: ${outputLang}

MISSION: Adapt this CV to maximize alignment with the job description.

═══ ÉTAPE 1 — ANALYSE DES MOTS-CLÉS ═══
Avant de réécrire, identifie les 15-20 mots-clés et compétences les plus importants de l'offre :
- Outils et technologies (Figma, React, SAP...)
- Méthodologies (Agile, Scrum, Design Thinking...)
- Compétences techniques spécifiques au poste
- Soft skills explicitement demandées
Intègre ces mots-clés NATURELLEMENT dans le CV (summary, bullets, skills). Ne les force pas — chaque mot-clé doit apparaître dans un contexte crédible.

═══ ÉTAPE 2 — RÉÉCRITURE ═══
RULES:
1. KEEP all experiences, education, skills, languages — delete NOTHING
2. Output JSON structure IDENTICAL to input (same number of elements everywhere)
3. Rewrite bullets with strong action verbs (${actionVerbs})
4. Relevant experiences: enrich descriptions, integrate job keywords, develop results
5. Less relevant experiences: condense to 1-2 bullets while keeping them
6. Summary: 2-3 sentences targeting the position directly, weaving in key terms from the job
7. Skills: reorder — most relevant for the job first. Add missing key skills from the job if the candidate likely has them
8. ${FABRICATION_GUARD}

CV:
${JSON.stringify(contentOnly)}

JOB DESCRIPTION:
${args.jobDescription}

Return ONLY the optimized CV JSON.`;

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

    // Strip non-content fields to reduce prompt size
    const { design, detectedLanguage, languageOverride, ...contentOnly } = args.cvData || {};

    // Detect language
    const lang = languageOverride || detectedLanguage || 'fr';
    const isEn = lang === 'en' || (args.jobDescription && /\b(experience|skills|education|responsibilities|requirements)\b/i.test(args.jobDescription.slice(0, 500)));
    const outputLang = isEn ? 'Write ALL content in English.' : 'Rédige TOUT le contenu en français.';

    const jobContext = args.jobDescription
      ? `
JOB DESCRIPTION:
${args.jobDescription}

═══ MOTS-CLÉS À INTÉGRER ═══
Identifie les 15-20 mots-clés critiques de cette offre (outils, méthodologies, compétences techniques, soft skills demandées).
Intègre-les NATURELLEMENT dans les bullets, le summary et les skills — chaque mot-clé dans un contexte crédible.
Priorise les expériences qui correspondent le mieux à ces mots-clés.`
      : `
No job description provided. Prioritize by RECENCY: most recent experiences are most developed.`;

    const prompt = `You are an expert in professional CV writing and layout optimization.

LANGUAGE: ${outputLang}

Your mission: reorganize and adjust the content of this CV to fit on ${args.pageLimit} A4 page(s) while maximizing professional impact.

CV DATA:
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
- "extended" : Le poste + entreprise + jusqu'à 5 bullet points détaillés. Pour les postes les plus importants.

═══ CHAMP "kpi" — OBLIGATOIRE SUR TOUTES LES EXPÉRIENCES ═══

Chaque expérience DOIT avoir un champ "kpi" (string) rempli, quel que soit son displayMode.
Le KPI est un résultat chiffré ou un indicateur d'envergure marquant, calibré sur la durée de la mission.

RÈGLES DE CALIBRAGE :
- DURÉE : un stage de 3 mois ne peut pas afficher "+50% de CA sur 3 ans". Adapte l'ampleur
  du KPI au temps réellement passé sur la mission (start_date → end_date ou current=true).
- RÉALISME : extrais le KPI du texte source si présent. Sinon, SYNTHÉTISE-le à partir du rôle,
  du secteur, et du contexte — en restant crédible.
- PRÉFÈRE L'ENVERGURE AUX POURCENTAGES INVENTÉS : quand le source ne fournit pas de métrique,
  utilise taille d'équipe, nombre de projets, périmètre (marques/marchés/utilisateurs), stack déployée.
- NE PAS INVENTER de pourcentages précis sans base factuelle.
- NE JAMAIS laisser "kpi" vide — toujours produire un indicateur d'envergure cohérent.

EXEMPLES DE BONS KPI :
- "+35% de trafic organique en 6 mois" (si données existantes dans le source)
- "Équipe de 8 designers encadrée" (périmètre managérial)
- "Refonte couvrant 5 marques et 30M+ utilisateurs" (envergure projet)
- "12 projets simultanés livrés" (volumétrie)
- "Stack Notion / Figma / GTM déployée" (scope technique pour une mission courte)

Note : la visibilité du KPI à l'écran est contrôlée par le displayMode + un override user.
Ta mission est de GÉNÉRER la donnée pour toutes les expériences, indépendamment de sa visibilité future.

═══ STRATÉGIE DE PRIORISATION ═══

1. RÉORDONNE les expériences par pertinence (la plus importante en premier)
2. ASSIGNE un displayMode à chaque expérience :
   - TOP priorité (1-2 premières) → "extended"
   - MOYENNE priorité → "normal"
   - BASSE priorité (anciennes/peu pertinentes) → "compact"
3. Ajuste le nombre de bullets selon le mode :
   - "extended" : 3-5 bullets détaillés
   - "normal" : exactement 2 bullets concis
   - "compact" : 1 seule phrase descriptive dans description[0]
4. REMPLIS kpi SUR CHAQUE EXPÉRIENCE (voir règles ci-dessus).

5. RÉSUMÉ : 2-3 phrases percutantes.
6. COMPÉTENCES : Réordonne — les plus pertinentes en premier.
7. FORMATIONS et LANGUES : Garde tel quel.

═══ QUALITÉ DES REFORMULATIONS ═══
- Verbe d'action fort et précis en début de bullet (Pilote, Conçoit, Orchestre, Déploie, Optimise, Structure — JAMAIS "Responsable de", "Participe à", "Aide à", "Gère")
- Structure : ACTION + CONTEXTE + RÉSULTAT en 1-2 lignes max
- Conserve les chiffres existants, ne PAS en inventer dans les bullets
- Mots-clés du secteur / de l'offre intégrés naturellement

═══ CONTRAINTE TAILLE ═══
Pour ${args.pageLimit} page(s) A4, un bon équilibre est :
- 1 page : max 1 extended + 1-2 normal + le reste compact
- 2 pages : max 2-3 extended + 2-3 normal + le reste compact

Retourne UNIQUEMENT l'objet JSON complet du CV optimisé. Chaque expérience DOIT avoir displayMode ET kpi.`;

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

    // Ensure displayMode and kpi on all experiences
    if (optimizedData.experience) {
      optimizedData.experience = optimizedData.experience.map((exp: any) => ({
        ...exp,
        displayMode: exp.displayMode || "normal",
        kpi: typeof exp.kpi === "string" ? exp.kpi.trim() : "",
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
