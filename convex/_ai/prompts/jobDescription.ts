// Prompts for extracting a structured job description from free-form text (URL scrape / PDF)
// and for extracting the requirements of that description.

import type { RequirementImportance, RequirementKind } from "../../../src/shared/types";
import { fencedOffer } from "./fragments";
import { ATS_POLICY } from '../../../src/features/editor/lib/ats-rules';

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

export interface JobRequirementsContext {
  jobDescription: string;
}

/** One line of guidance per kind: typed by the kind list, so a kind cannot go unexplained */
const KIND_GUIDE: Record<RequirementKind, string> = {
  title: "l'intitulé du poste visé",
  experience_years: 'un nombre minimal d\'années d\'expérience (renseigne "minYears")',
  education: "un diplôme ou un niveau d'études",
  language: "une langue exigée",
  hard_skill: "une compétence technique ou métier (UX design, analyse de données, audit financier)",
  tool: "un outil ou une technologie (Figma, React, SAP, Salesforce)",
  method: "une méthode (Agile, Scrum, Design Thinking)",
  certification: "une certification (PMP, AWS, ITIL)",
  domain: "un secteur ou un domaine (SaaS B2B, e-commerce, santé)",
  soft_skill: "une qualité humaine, UNIQUEMENT si l'offre la demande explicitement",
  location: "la ville ou la région où le poste est basé, UNIQUEMENT si l'offre exige d'y être (présence sur site), jamais un simple siège social",
  screening: "une condition à vérifier par le candidat : droit au travail, habilitation, disponibilité, permis, mobilité ; needsVerification=true",
};

/** Typed by the importance list, like KIND_GUIDE */
const IMPORTANCE_GUIDE: Record<RequirementImportance, string> = {
  required: "l'offre l'exige",
  preferred: "l'offre la présente comme un plus (souhaité, apprécié, idéalement)",
};

/**
 * The requirements a recruiter filters on in an ATS, each with the excerpt of
 * the offer that states it. The server (normalizeJobRequirements) drops a
 * requirement whose quote is not words of the offer, none of whose label and
 * variants are words of its quote (title, education and experience_years
 * excepted), or whose years are not the number its quote gives: the rules
 * below tell the model so.
 */
export function buildJobRequirementsPrompt(ctx: JobRequirementsContext): string {
  return `Tu es un recruteur expert des ATS (Applicant Tracking Systems).

MISSION : liste les exigences de cette offre, celles sur lesquelles un recruteur filtre les candidatures dans son ATS.

${fencedOffer(ctx.jobDescription)}

TYPES D'EXIGENCES ("kind") :
${Object.entries(KIND_GUIDE).map(([kind, guide]) => `- ${kind} : ${guide}`).join("\n")}

RÈGLES :
- Toutes les exigences explicites, sans quota minimal, au maximum ${ATS_POLICY.maxRequirements}. Les requises d'abord. Sépare les compétences composées : chacune doit être vérifiable indépendamment.
- Vérifie chaque phrase de la partie profil, puis les responsabilités : aucun intitulé, diplôme ou compétence explicite ne doit être oublié. Une alternative (architecture OU ingénierie) reste une seule exigence, avec ses variantes acceptées.
- Une connaissance d’une norme (EN 50600, ISO) est une compétence hard_skill. Réserve certification à la possession explicite d’un certificat. La localisation du poste et les déplacements sont des conditions screening, sauf si une résidence précise du candidat est explicitement exigée.
- Pour les années spécialisées, conserve le secteur précis dans experienceScope : « design for data centre » n’est pas « design » en général. Ne remplace jamais une spécialisation par son terme générique. Sépare aussi un second minimum, par exemple cinq ans de management.
- Langue : "minLevel" est le niveau CECR explicitement cité (A1, A2, B1, B2, C1, C2), sinon omets-le. Si un niveau est demandé sans équivalence explicite (courant, professionnel, TOEIC), needsVerification=true.
- Années : "experienceScope" contient le métier ou la discipline demandée et ses traductions FR/EN (exemple : ["UX", "expérience utilisateur"]). Omet ce champ UNIQUEMENT pour des années d'expérience générale. Ne compte jamais toute une carrière pour une demande spécialisée.
- Diplôme ou certification : needsVerification=true si l'offre exige une équivalence, une spécialité précise, une validité en cours ou un niveau minimal qui ne peut pas être vérifié par le seul libellé.
- "importance" :
${Object.entries(IMPORTANCE_GUIDE).map(([importance, guide]) => `  - "${importance}" : ${guide}`).join("\n")}
- "minYears" : le nombre d'années écrit dans "quote", en chiffres ou en lettres ; uniquement pour experience_years.
- "label" : la forme exacte employée par l'offre, dans sa langue ; elle doit figurer dans "quote" (sauf pour title et education). CINQ MOTS AU PLUS : si l'offre écrit une phrase (« Capacité à travailler en autonomie dans un environnement international »), le label est le terme qu'elle contient (« autonomie »), jamais la phrase.
- "variants" : TOUJOURS la traduction du libellé dans l'autre langue (en français si l'offre est en anglais, en anglais si elle est en français), écrite comme un CV l'écrirait ("user research" : "recherche utilisateur") ; puis les autres écritures qu'un CV peut employer pour la même exigence (acronyme, forme longue). Un nom propre (outil, certification) ne se traduit pas, mais donne TOUJOURS ses autres écritures : « React.js » donne « React » et « ReactJS », « CI/CD » donne « CICD » et « intégration continue ».
- "quote" : l'extrait de l'offre, recopié mot pour mot, qui énonce l'exigence.
- N'extrais JAMAIS les avantages, la rémunération, la présentation de l'entreprise, le processus de recrutement, ni une mission qui ne demande aucune compétence.
- "company" : le nom de l'entreprise qui recrute, recopié mot pour mot de l'offre, sans forme juridique ni slogan. Le nom du produit si l'offre ne nomme que lui. Chaîne vide si l'offre ne le dit pas. Ce n'est jamais une exigence : il ne figure pas dans "requirements".
- N'extrais JAMAIS de mot générique (équipe, projet, entreprise, gestion), ni de verbe d'action, ni le nom de l'entreprise qui recrute, ni le type de contrat (CDI, stage, alternance).

FORMAT :
{ "company": "Wero",
  "requirements": [
  { "label": "Figma", "variants": [], "kind": "tool", "importance": "required", "quote": "Maîtrise de Figma" },
  { "label": "recherche utilisateur", "variants": ["user research", "UX research"], "kind": "hard_skill", "importance": "required", "quote": "Vous menez la recherche utilisateur" },
  { "label": "5 ans d'expérience", "variants": ["5 years of experience"], "kind": "experience_years", "importance": "required", "quote": "5 ans d'expérience minimum", "minYears": 5 }
] }

Retourne UNIQUEMENT le JSON.`;
}
