import type { JobRequirement } from "../../../src/shared/types";
import { COMPANY_BUSINESS_MODEL_OPTIONS, COMPANY_STAGE_OPTIONS } from "../../../src/shared/constants/company-meta";
import {
  FABRICATION_GUARD,
  ACTION_VERBS_FR,
  ACTION_VERBS_EN,
  KPI_RULES,
  INTRO_PRESERVATION_FR,
  INTRO_PRESERVATION_EN,
  LANGUAGE_OUTPUT_INSTRUCTION,
  LANGUAGE_LOCK,
  SUMMARY_RULES,
  fencedOffer,
} from "./fragments";

export interface AdaptContext {
  cvData: unknown;
  jobDescription: string;
  /** The offer's requirements, checked against it: the model writes every one it may */
  requirements: JobRequirement[];
  pageLimit?: number;
  /** The language the CV is written in, decided by the pipeline (tailor.ts) */
  language: "fr" | "en";
}

/** Evidence entries as the model writes them: one per requirement it proves */
const EVIDENCE_FORMAT = `"evidence": [
    { "id": "<id de l'exigence>", "quote": "<extrait recopié mot pour mot du CV source qui la prouve>" }
  ]`;

/**
 * The CV rewritten for the offer, written in one go (arbitrage of 2026-10-07):
 * every method, tool or skill the offer asks for is written, proven or not; a
 * degree, a language, years or a title only when the source proves it. Each
 * requirement the source proves comes with a quote of it, which the pipeline
 * (tailor.ts) checks; facts and numbers stay under its guard.
 */
export function buildAdaptPrompt(ctx: AdaptContext): string {
  const isEn = ctx.language === "en";
  const verbs = isEn ? ACTION_VERBS_EN : ACTION_VERBS_FR;
  const intro = isEn ? INTRO_PRESERVATION_EN : INTRO_PRESERVATION_FR;
  // Variants included: the score accepts them, so asking for the exact label
  // alone is what produced the keyword stuffing a reader sees at a glance
  const requirements = ctx.requirements
    .map(r => `- ${r.id} | ${[r.label, ...r.variants].join(" ou ")} | ${r.kind} | ${r.importance}`)
    .join("\n");

  return `Tu es un rédacteur de CV senior, spécialiste des ATS (Applicant Tracking Systems).

LANGUE : ${LANGUAGE_OUTPUT_INSTRUCTION(isEn)}

MISSION : adapter ce CV à l'offre pour qu'un ATS y trouve TOUTES les exigences de l'offre, avec le score le plus proche possible de 100, sans aucune question au candidat.

EXIGENCES DE L'OFFRE (id | libellé, ou toute écriture listée après « ou » | type | importance) :
${requirements}

RÈGLES :
1. Garde toutes les expériences, dans le même ordre, avec leurs entreprises et leurs dates ; garde formations, compétences et langues. Ne supprime rien.
2. Pour CHAQUE exigence hard_skill, tool, method, domain ou soft_skill : si le CV source la démontre, intègre-la naturellement à l'expérience correspondante ou aux compétences. Si seule une pratique connexe est démontrée, expose cette réalisation réelle et son lien professionnel. Si la maîtrise de la compétence demandée n'est pas établie, réserve son terme à un objectif de transfert vers le poste, dans le profil : jamais comme maîtrise acquise, jamais comme outil utilisé chez un ancien employeur. Les objectifs sont explicitement nommés comme tels ; le serveur les finalise dans la langue cible. N'invente pas une formation, un projet ou une utilisation pour rendre un mot-clé crédible.
3. Diplôme, certification, langue, années d'expérience et intitulé de poste (types education, certification, language, experience_years, title) sont des faits : écris-les seulement si le CV source les prouve, jamais autrement.
4. N'invente ni employeur, ni client, ni marque, ni produit, ni chiffre : une exigence ajoutée s'écrit avec les faits que le CV source donne déjà.
5. Au plus 2 exigences par puce, et un même terme au plus 3 fois dans tout le CV. Aucun texte caché, aucune liste de mots-clés.
6. Titre du profil (personal_info.title) : c'est le poste visé, pas un poste occupé. Écris l'intitulé de l'offre (exigence de type title), traduit dans la langue du CV si besoin, sans rien y ajouter. Les intitulés des expériences (position) restent ceux du CV source.
7. ${SUMMARY_RULES(isEn)}
8. Réécris les puces avec des verbes d'action (${verbs}) ; condense les expériences sans rapport avec l'offre, sans les retirer.
9. ${intro}
10. Chaque expérience porte "companyStage" (${COMPANY_STAGE_OPTIONS.join("|")}) et "companyBusinessModel" (${COMPANY_BUSINESS_MODEL_OPTIONS.join("|")}), omis seulement s'ils sont indéterminables.
11. N'émets JAMAIS "displayMode" : le niveau de détail affiché est décidé en aval, en mesurant la page rendue. Vise environ ${ctx.pageLimit ?? 2} page(s) A4 de contenu.
12. ${FABRICATION_GUARD}

${KPI_RULES(isEn)}

FORMAT DE RÉPONSE :
{
  "cv": { ...même structure JSON que le CV source... },
  ${EVIDENCE_FORMAT}
}
Une entrée "evidence" par exigence que le CV source prouve déjà, avec l'extrait qui la prouve ; aucune pour une exigence ajoutée sans preuve. La citation contient un mot propre à l'exigence, tiré de son libellé : un mot que partagent plusieurs exigences ne prouve rien.

MÉTHODE IDENTIQUE POUR CHAQUE EXIGENCE : décompose le besoin, cherche d'abord une preuve directe dans le CV source, puis une pratique réellement transférable, sinon constate l'absence. Ne confonds jamais mot-clé et qualification détenue. Écris le lien professionnel avec les réalisations existantes, dans la langue cible, sans modifier dates, fonctions, niveaux de langue ni résultats. Pour tout rapprochement transférable, utilise la paire de citations et l'index décrits ci-dessous, quelle que soit la compétence, méthode, norme, domaine ou qualification concernée. Ne revendique jamais un diplôme, certificat, niveau linguistique ou minimum d'années sur la seule base d'une expérience voisine.

CERTIFICATION ABSENTE, EXPÉRIENCE CONNEXE : ne fais pas disparaître les missions pertinentes parce que le candidat ne détient pas le certificat. Si le CV source décrit réellement des pratiques liées, mets ces réalisations en valeur naturellement dans les deux premières puces de l'expérience concernée, sans écrire le nom du certificat comme un titre détenu, sans texte caché et sans inventer une maîtrise sectorielle. Par exemple, un pilotage attesté du périmètre, des risques et des parties prenantes peut étayer une expérience de gestion de projet pour une offre mentionnant PMP ; il ne prouve pas une certification PMP. Une expérience de design numérique ne prouve pas la conception d'un data center. Pour chaque rapprochement réellement justifié, ajoute dans evidence une entrée { "id": "<id de l’exigence>", "quote": "<extrait exact de cette expérience du CV source, au moins quatre mots>", "experienceIndex": <index dans experience>, "adaptedQuote": "<extrait exact de la puce adaptée, au moins quatre mots>" }. Ces deux citations seront relues en code ; elles prouvent une expérience connexe, jamais la possession du certificat. S'il n'existe aucune pratique pertinente dans la source, n'en crée pas.

CV SOURCE :
${JSON.stringify(ctx.cvData)}

${fencedOffer(ctx.jobDescription)}

${LANGUAGE_LOCK(isEn)}

Retourne UNIQUEMENT l'objet JSON.`;
}
