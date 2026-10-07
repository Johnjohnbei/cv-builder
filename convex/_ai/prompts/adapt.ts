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
} from "./fragments";
import { resolveAdaptLanguage } from "../languageDetection";

export interface AdaptContext {
  cvData: unknown;
  jobDescription: string;
  /** The offer's requirements, checked against it: the model writes every one it may */
  requirements: JobRequirement[];
  pageLimit?: number;
  detectedLanguage?: "fr" | "en";
  languageOverride?: "fr" | "en";
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
  const isEn = resolveAdaptLanguage(ctx.jobDescription, ctx.languageOverride, ctx.detectedLanguage) === "en";
  const verbs = isEn ? ACTION_VERBS_EN : ACTION_VERBS_FR;
  const intro = isEn ? INTRO_PRESERVATION_EN : INTRO_PRESERVATION_FR;
  const requirements = ctx.requirements.map(r => `- ${r.id} | ${r.label} | ${r.kind} | ${r.importance}`).join("\n");

  return `Tu es un rédacteur de CV senior, spécialiste des ATS (Applicant Tracking Systems).

LANGUE : ${LANGUAGE_OUTPUT_INSTRUCTION(isEn)}

MISSION : adapter ce CV à l'offre pour qu'un ATS y trouve TOUTES les exigences de l'offre, avec le score le plus proche possible de 100, sans aucune question au candidat.

EXIGENCES DE L'OFFRE (id | libellé exact | type | importance) :
${requirements}

RÈGLES :
1. Garde toutes les expériences, dans le même ordre, avec leurs entreprises et leurs dates ; garde formations, compétences et langues. Ne supprime rien.
2. Écris CHAQUE exigence de type hard_skill, tool, method, domain ou soft_skill sous son libellé exact, même si le CV source ne la mentionne pas : dans une puce de l'expérience où elle est la plus crédible (même métier, même domaine, poste le plus récent d'abord), dans les compétences pour un outil ou une compétence nommée, dans le résumé pour une exigence transverse. Chacune absente du CV est un point perdu devant l'ATS.
3. Diplôme, certification, langue, années d'expérience et intitulé de poste (types education, certification, language, experience_years, title) sont des faits : écris-les seulement si le CV source les prouve, jamais autrement.
4. N'invente ni employeur, ni client, ni marque, ni produit, ni chiffre : une exigence ajoutée s'écrit avec les faits que le CV source donne déjà.
5. Au plus 2 exigences par puce, et un même terme au plus 3 fois dans tout le CV. Aucun texte caché, aucune liste de mots-clés.
6. Titre du profil (personal_info.title) : aligne-le sur l'intitulé de l'offre seulement si une expérience le justifie.
7. Résumé (personal_info.summary) : c'est la partie qui prouve qu'un humain a écrit ce CV. 3 à 4 phrases, 50 à 90 mots, sans titre ni puce, à la première personne implicite (sans « je »). Il dit, avec les faits du CV source : le métier et le niveau, le parcours (secteurs, types d'entreprises, employeurs marquants cités tels quels), une réalisation concrète tirée d'une expérience, et ce que le candidat apporte à CE poste. Interdits : formules creuses (passionné, dynamique, rigoureux, orienté résultats, fort de, doté de, véritable, n'hésitez pas), superlatifs, enchaînement de mots-clés, phrase générique qui irait à n'importe quel candidat.
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

CV SOURCE :
${JSON.stringify(ctx.cvData)}

OFFRE D'EMPLOI :
${ctx.jobDescription}

${LANGUAGE_LOCK(isEn)}

Retourne UNIQUEMENT l'objet JSON.`;
}
