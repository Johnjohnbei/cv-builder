"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";

const MODEL_PRO = "gemini-2.5-pro";
const MODEL_FLASH = "gemini-2.5-flash";

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in Convex environment variables");
  return new GoogleGenAI({ apiKey });
}

function safeParseJSON(text: string | undefined, fallback: any = {}): any {
  try {
    return JSON.parse(text || JSON.stringify(fallback));
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", text?.slice(0, 200));
    throw new Error("L'IA a retourné une réponse invalide. Veuillez réessayer.");
  }
}

export const extractCVDataFromPDF = action({
  args: { base64PDF: v.string() },
  handler: async (_ctx, args) => {
    const genAI = getAI();

    const prompt = `
    Tu es un expert en recrutement et en structuration de données CV.
    Extrais les informations professionnelles du PDF fourni et retourne-les au format JSON strict.
    
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
      "experience": [ { "company": "", "position": "", "location": "", "start_date": "", "end_date": "", "current": boolean, "intro": "Description courte du rôle (1-2 lignes)", "description": ["action bullet 1", "action bullet 2"] } ],
      "education": [ { "school": "", "degree": "", "field": "", "start_date": "", "end_date": "" } ],
      "skills": [ { "category": "", "items": ["item1", "item2"] } ],
      "languages": [ { "name": "", "proficiency": "" } ]
    }
    
    IMPORTANT : Retourne TOUTES les expériences du CV, même les anciennes. L'utilisateur choisira lesquelles afficher.
  `;

    const response = await genAI.models.generateContent({
      model: MODEL_PRO,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: args.base64PDF,
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const data = safeParseJSON(response.text);

    // ─── Post-processing: normalize and clean the extracted data ───
    
    // Normalize experience descriptions: split long paragraphs into bullets
    if (data.experience) {
      data.experience = data.experience.map((exp: any) => ({
        ...exp,
        current: exp.current === true || exp.end_date === '' || exp.end_date?.toLowerCase?.() === 'présent' || exp.end_date?.toLowerCase?.() === 'present',
        end_date: (exp.current === true || exp.end_date?.toLowerCase?.() === 'présent' || exp.end_date?.toLowerCase?.() === 'present') ? '' : exp.end_date,
        description: Array.isArray(exp.description) 
          ? exp.description.flatMap((d: string) => {
              // Split paragraphs that contain multiple sentences/bullets
              if (typeof d === 'string' && d.length > 200) {
                return d.split(/[•·\-–—]\s+|(?:\.\s+)(?=[A-Z])/).filter(s => s.trim().length > 10).map(s => s.trim());
              }
              return [typeof d === 'string' ? d.trim() : String(d)];
            }).slice(0, 5) // max 5 bullets
          : [],
      }));
    }

    // Normalize skills: ensure items are strings
    if (data.skills) {
      data.skills = data.skills.map((cat: any) => ({
        category: typeof cat.category === 'string' ? cat.category : 'Compétences',
        items: Array.isArray(cat.items)
          ? cat.items.map((item: any) => typeof item === 'string' ? item : item?.name || item?.skill || String(item)).slice(0, 8)
          : [],
      })).slice(0, 5); // max 5 categories
    }

    // Truncate summary if too long
    if (data.personal_info?.summary && data.personal_info.summary.length > 300) {
      data.personal_info.summary = data.personal_info.summary.substring(0, 297) + '...';
    }

    // Clean title: remove pipe-separated lists
    if (data.personal_info?.title && data.personal_info.title.length > 50) {
      const parts = data.personal_info.title.split(/[|,]/);
      data.personal_info.title = parts[0].trim();
    }

    // Normalize language proficiency: translate English LinkedIn levels to French
    const proficiencyMap: Record<string, string> = {
      'native or bilingual': 'Natif / Bilingue',
      'native or bilingual proficiency': 'Natif / Bilingue',
      'full professional': 'Courant (C1)',
      'full professional proficiency': 'Courant (C1)',
      'professional working': 'Professionnel (B2)',
      'professional working proficiency': 'Professionnel (B2)',
      'limited working': 'Intermédiaire (B1)',
      'limited working proficiency': 'Intermédiaire (B1)',
      'elementary': 'Débutant (A2)',
      'elementary proficiency': 'Débutant (A2)',
    };
    if (data.languages) {
      data.languages = data.languages.map((lang: any) => ({
        ...lang,
        proficiency: proficiencyMap[lang.proficiency?.toLowerCase?.().trim()] || lang.proficiency,
      }));
    }

    return data;
  },
});

export const tailorCV = action({
  args: {
    baseData: v.any(),
    jobDescription: v.string(),
  },
  handler: async (_ctx, args) => {
    const genAI = getAI();

    const prompt = `
    Tu es un expert en optimisation ATS (Applicant Tracking Systems) pour les années 2025-2026.
    Adapte le CV suivant pour qu'il corresponde au mieux à l'offre d'emploi fournie.
    
    RÈGLES FONDAMENTALES :
    1. NE SUPPRIME JAMAIS aucune expérience, formation, compétence ou section. Toutes les données d'entrée DOIVENT être présentes dans la sortie.
    2. Utilise les mots-clés exacts de l'offre dans les reformulations.
    3. Réécris les bullet points d'expérience pour mettre en avant les réalisations quantifiables et pertinentes pour le poste.
    4. Pour les expériences les plus pertinentes par rapport à l'offre : enrichis les descriptions, ajoute des mots-clés du poste, développe les résultats.
    5. Pour les expériences moins pertinentes : raccourcis les descriptions (1-2 bullets) tout en les gardant.
    6. Réécris le résumé professionnel (summary) pour qu'il cible directement le poste, en 3-4 phrases percutantes.
    7. Réordonne les compétences pour mettre en premier celles qui correspondent à l'offre.
    8. La structure JSON de sortie doit être IDENTIQUE à celle d'entrée — même nombre d'expériences, formations, etc.

    CV de base :
    ${JSON.stringify(args.baseData)}

    Offre d'emploi :
    ${args.jobDescription}
    
    Retourne UNIQUEMENT l'objet JSON complet du CV optimisé.
  `;

    const response = await genAI.models.generateContent({
      model: MODEL_PRO,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return safeParseJSON(response.text);
  },
});

export const getATSAnalysis = action({
  args: {
    cvData: v.any(),
    jobDescription: v.string(),
  },
  handler: async (_ctx, args) => {
    const genAI = getAI();

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
  `;

    const response = await genAI.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return safeParseJSON(response.text);
  },
});

export const extractJobDescriptionFromURL = action({
  args: { url: v.string() },
  handler: async (_ctx, args) => {
    const genAI = getAI();

    const prompt = `
    Tu es un expert en extraction de données. 
    Analyse le contenu de cette URL : ${args.url}
    
    IMPORTANT : Extrais la description complète de l'offre d'emploi. 
    Certaines informations peuvent être cachées dans des accordéons ou des sections repliables (comme sur Welcome to the Jungle). 
    Assure-toi de récupérer :
    - Le titre du poste
    - Les missions et responsabilités
    - Le profil recherché et les compétences (hard & soft skills)
    - Les avantages et informations sur l'entreprise
    
    Retourne uniquement le texte de la description, structuré de manière lisible, sans fioritures ni commentaires.
  `;

    const response = await genAI.models.generateContent({
      model: MODEL_PRO,
      contents: prompt,
      config: {
        tools: [{ urlContext: {} }, { googleSearch: {} }],
      },
    });

    return response.text || "";
  },
});

export const extractJobDescriptionFromPDF = action({
  args: { base64PDF: v.string() },
  handler: async (_ctx, args) => {
    const genAI = getAI();

    const prompt = `
    Analyse ce document PDF qui est une fiche de poste.
    Extrais la description complète de l'offre d'emploi.
    Retourne uniquement le texte de la description.
  `;

    const response = await genAI.models.generateContent({
      model: MODEL_FLASH,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: args.base64PDF,
          },
        },
      ],
    });

    return response.text || "";
  },
});

export const optimizeCVForPage = action({
  args: {
    cvData: v.any(),
    pageLimit: v.number(),
    jobDescription: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const genAI = getAI();

    const jobContext = args.jobDescription
      ? `
    OFFRE D'EMPLOI CIBLÉE :
    ${args.jobDescription}
    
    Utilise cette offre pour PRIORISER : les expériences et compétences les plus pertinentes pour ce poste doivent être les plus développées.`
      : `
    Pas d'offre d'emploi fournie. Priorise par RÉCENCE : les expériences les plus récentes sont les plus développées.`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: `Tu es un expert en rédaction de CV professionnels et en optimisation de mise en page.

Ta mission : réorganiser et ajuster le contenu de ce CV pour qu'il tienne sur ${args.pageLimit} page(s) A4 tout en maximisant l'impact professionnel.

DONNÉES DU CV :
${JSON.stringify(args.cvData, null, 2)}
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
- Verbe d'action fort en début de bullet
- Métriques/résultats quand possible
- Concis : une ligne par bullet
- Mots-clés du secteur / de l'offre

═══ CONTRAINTE TAILLE ═══
Pour ${args.pageLimit} page(s) A4, un bon équilibre est :
- 1 page : max 1 extended + 1-2 normal + le reste compact
- 2 pages : max 2-3 extended + 2-3 normal + le reste compact

Retourne UNIQUEMENT l'objet JSON complet du CV optimisé. Chaque expérience DOIT avoir displayMode et les extended DOIVENT avoir kpi.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const optimizedData = safeParseJSON(response.text);

    // Sanitize skills to ensure they are strings
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

    // Ensure displayMode is set on all experiences
    if (optimizedData.experience) {
      optimizedData.experience = optimizedData.experience.map((exp: any) => ({
        ...exp,
        displayMode: exp.displayMode || 'normal',
      }));
    }

    return optimizedData;
  },
});

export const generateCoverLetter = action({
  args: {
    cvData: v.any(),
    jobDescription: v.string(),
    companyName: v.optional(v.string()),
    tone: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const genAI = getAI();
    const tone = args.tone || "professionnel et engagé";
    const company = args.companyName ? `pour l'entreprise ${args.companyName}` : "";

    const response = await genAI.models.generateContent({
      model: MODEL_FLASH,
      contents: `
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
`,
      config: { responseMimeType: "application/json" },
    });

    return safeParseJSON(response.text);
  },
});

export const improveBulletPoint = action({
  args: {
    bullet: v.string(),
    position: v.string(),
    company: v.string(),
    jobDescription: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const genAI = getAI();
    const jobContext = args.jobDescription
      ? `\n\nOffre ciblée :\n${args.jobDescription}`
      : "";

    const response = await genAI.models.generateContent({
      model: MODEL_FLASH,
      contents: `
Tu es un expert en rédaction de CV optimisés ATS.
Améliore ce point d'expérience pour le rendre plus impactant.

Poste : ${args.position} chez ${args.company}
Point actuel : "${args.bullet}"${jobContext}

Règles :
1. Commence par un verbe d'action fort
2. Ajoute des métriques/résultats quantifiables si possible
3. Utilise des mots-clés pertinents pour le secteur
4. Maximum 2 lignes
5. Retourne exactement 3 suggestions alternatives

Retourne un JSON : { "suggestions": ["suggestion1", "suggestion2", "suggestion3"] }
`,
      config: { responseMimeType: "application/json" },
    });

    return safeParseJSON(response.text);
  },
});
