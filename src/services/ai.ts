import { GoogleGenAI } from "@google/genai";
import { CVData } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const MODEL_PRO = "gemini-2.5-pro-preview-05-06";
const MODEL_FLASH = "gemini-2.0-flash";

export async function extractCVDataFromPDF(base64PDF: string): Promise<CVData> {
  const model = MODEL_PRO;
  
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
    model,
    contents: [
      { text: prompt },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64PDF
        }
      }
    ],
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function tailorCV(baseData: CVData, jobDescription: string): Promise<CVData> {
  const model = MODEL_PRO;
  
  const prompt = `
    Tu es un expert en optimisation ATS (Applicant Tracking Systems) pour les années 2025-2026.
    Adapte le CV suivant pour qu'il corresponde parfaitement à l'offre d'emploi fournie.
    
    Règles :
    1. Utilise les mots-clés exacts de l'offre.
    2. Réécris les points d'expérience pour mettre en avant les réalisations quantifiables.
    3. Filtre les compétences non pertinentes.
    4. Garde une structure JSON identique.

    CV de base :
    ${JSON.stringify(baseData)}

    Offre d'emploi :
    ${jobDescription}
  `;

  const response = await genAI.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function getATSAnalysis(cvData: CVData, jobDescription: string): Promise<{
  score: number;
  missingKeywords: string[];
  strengths: string[];
  improvements: string[];
  ats_compatibility: 'LOW' | 'MEDIUM' | 'HIGH';
}> {
  const model = MODEL_FLASH;

  const prompt = `
    Tu es un expert en recrutement et en systèmes ATS.
    Analyse le CV suivant par rapport à l'offre d'emploi fournie.
    
    CV : ${JSON.stringify(cvData)}
    Offre : ${jobDescription}

    Retourne un objet JSON avec :
    - score : un nombre entre 0 et 100
    - missingKeywords : liste des mots-clés importants manquants
    - strengths : points forts du CV pour ce poste
    - improvements : conseils concrets d'amélioration
    - ats_compatibility : 'LOW', 'MEDIUM' ou 'HIGH'
  `;

  const response = await genAI.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function extractJobDescriptionFromURL(url: string): Promise<string> {
  const model = MODEL_PRO;
  
  const prompt = `
    Tu es un expert en extraction de données. 
    Analyse le contenu de cette URL : ${url}
    
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
    model,
    contents: prompt,
    config: {
      tools: [
        { urlContext: {} },
        { googleSearch: {} }
      ]
    }
  });

  return response.text || "";
}

export async function extractJobDescriptionFromPDF(base64PDF: string): Promise<string> {
  const model = MODEL_FLASH;
  
  const prompt = `
    Analyse ce document PDF qui est une fiche de poste.
    Extrais la description complète de l'offre d'emploi.
    Retourne uniquement le texte de la description.
  `;

  const response = await genAI.models.generateContent({
    model,
    contents: [
      { text: prompt },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64PDF
        }
      }
    ]
  });

  return response.text || "";
}
