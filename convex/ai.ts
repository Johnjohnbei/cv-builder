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
    Tu es un expert en recrutement. 
    Extrais les informations professionnelles du PDF fourni et retourne-les au format JSON strict.
    
    Structure attendue :
    {
      "personal_info": { "name": "", "email": "", "phone": "", "location": "", "title": "", "summary": "" },
      "experience": [ { "company": "", "position": "", "location": "", "start_date": "", "end_date": "", "current": boolean, "description": [""] } ],
      "education": [ { "school": "", "degree": "", "field": "", "start_date": "", "end_date": "" } ],
      "skills": [ { "category": "", "items": [""] } ],
      "languages": [ { "name": "", "proficiency": "" } ]
    }
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

    return safeParseJSON(response.text);
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
  },
  handler: async (_ctx, args) => {
    const genAI = getAI();

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: `Tu es un expert en design de CV et en mise en page. Ta tâche est d'ajuster la DENSITÉ du contenu de ce CV pour qu'il tienne sur ${args.pageLimit} page(s) A4.
            
            Voici les données actuelles du CV :
            ${JSON.stringify(args.cvData, null, 2)}
            
            RÈGLES FONDAMENTALES — NE SUPPRIME RIEN :
            - Tu ne dois JAMAIS supprimer une expérience, une formation, une compétence ou une section.
            - Toutes les entrées présentes en entrée DOIVENT être présentes en sortie.
            - Le nombre d'expériences, formations, catégories de compétences et langues doit être IDENTIQUE.
            
            STRATÉGIE D'AJUSTEMENT DE DENSITÉ :
            1. RÉSUMÉ : Raccourcis à 2-3 phrases maximum, percutantes et denses.
            2. EXPÉRIENCES RÉCENTES (< 5 ans) : Garde 2-3 bullet points, reformulés pour être concis mais impactants.
            3. EXPÉRIENCES ANCIENNES (> 5 ans) : Réduis à 1 bullet point synthétique résumant l'essentiel.
            4. DESCRIPTIONS : Reformule chaque bullet pour être plus court tout en gardant les chiffres clés et mots-clés.
            5. COMPÉTENCES : Garde toutes les catégories et tous les items, mais formule-les de façon compacte.
            6. FORMATIONS : Garde toutes les entrées, simplifie la présentation si nécessaire.
            
            Le résultat doit paraître complet et professionnel, optimisé pour une lecture rapide.
            
            Retourne UNIQUEMENT l'objet JSON complet du CV ajusté, respectant strictement la structure fournie.`,
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
