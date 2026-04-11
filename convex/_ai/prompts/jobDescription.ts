// Prompts for extracting a structured job description from free-form text (URL scrape / PDF)
// and for extracting ATS-relevant keywords from that description.

export interface JobDescriptionFromURLContext {
  url: string;
  pageText: string;
}

export function buildJobDescriptionFromURLPrompt(ctx: JobDescriptionFromURLContext): string {
  return `Tu es un expert en extraction d'offres d'emploi.

Voici le contenu texte extrait de la page ${ctx.url} :

${ctx.pageText}

Extrais et structure la description complète de l'offre d'emploi :
- Titre du poste
- Entreprise
- Missions et responsabilités
- Profil recherché (compétences hard & soft)
- Avantages et infos entreprise
- Localisation, type de contrat, salaire si mentionnés

Retourne le texte structuré, sans commentaires.`;
}

export interface JobDescriptionFromPDFContext {
  pdfText: string;
}

export function buildJobDescriptionFromPDFPrompt(ctx: JobDescriptionFromPDFContext): string {
  return `
Analyse ce texte extrait d'un document PDF qui est une fiche de poste.
Extrais la description complète de l'offre d'emploi.
Retourne uniquement le texte de la description.

Texte du PDF :
${ctx.pdfText}
`;
}

export interface JobKeywordsContext {
  jobDescription: string;
}

export function buildJobKeywordsPrompt(ctx: JobKeywordsContext): string {
  return `Tu es un expert en recrutement et ATS (Applicant Tracking Systems).

MISSION : Extrais les compétences et mots-clés qu'un ATS rechercherait dans un CV pour cette offre.

OFFRE D'EMPLOI :
${ctx.jobDescription}

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
}
