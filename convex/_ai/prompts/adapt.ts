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
  mode: "tailor" | "optimize";
  cvData: unknown;
  jobDescription?: string;
  pageLimit?: number;
  detectedLanguage?: "fr" | "en";
  languageOverride?: "fr" | "en";
}

export function buildAdaptPrompt(ctx: AdaptContext): string {
  const isEn = resolveAdaptLanguage(ctx.jobDescription, ctx.languageOverride, ctx.detectedLanguage) === "en";
  const outputLang = LANGUAGE_OUTPUT_INSTRUCTION(isEn);
  const verbs = isEn ? ACTION_VERBS_EN : ACTION_VERBS_FR;
  const intro = isEn ? INTRO_PRESERVATION_EN : INTRO_PRESERVATION_FR;
  const kpiRules = KPI_RULES(isEn);
  const languageLock = LANGUAGE_LOCK(isEn);
  const cvJson = JSON.stringify(ctx.cvData);

  if (ctx.mode === "tailor") {
    const jd = ctx.jobDescription ?? "";
    return `You are a senior CV writer specialized in ATS optimization (2025-2026).

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
3. Rewrite bullets with strong action verbs (${verbs})
4. Relevant experiences: enrich descriptions, integrate job keywords, develop results
5. Less relevant experiences: condense to 1-2 bullets while keeping them
6. Summary: 2-3 sentences targeting the position directly, weaving in key terms from the job
7. Skills: reorder — most relevant for the job first. Add missing key skills from the job if the candidate likely has them
8. ${intro}
9. Each experience MUST have a non-empty "kpi" field.
10. Each experience MUST also carry "companyStage" (Startup|Scaleup|PME|Grand groupe|ETI|Agence) and "companyBusinessModel" (B2B|B2C|B2B2C|SaaS|Marketplace|E-commerce|Media|Service). Omit a field only if genuinely undeterminable.
11. NEVER output "displayMode" — how much of each experience is shown is decided downstream by measuring the rendered page, not by you.
12. ${FABRICATION_GUARD}

${kpiRules}

CV:
${cvJson}

JOB DESCRIPTION:
${jd}

${languageLock}

Return ONLY the optimized CV JSON.`;
  }

  // mode === "optimize"
  const pageLimit = ctx.pageLimit ?? 2;
  const jobContext = ctx.jobDescription
    ? `
JOB DESCRIPTION:
${ctx.jobDescription}

═══ MOTS-CLÉS À INTÉGRER ═══
Identifie les 15-20 mots-clés critiques de cette offre (outils, méthodologies, compétences techniques, soft skills demandées).
Intègre-les NATURELLEMENT dans les bullets, le summary et les skills — chaque mot-clé dans un contexte crédible.
Priorise les expériences qui correspondent le mieux à ces mots-clés.`
    : `
No job description provided. Prioritize by RECENCY: most recent experiences are most developed.`;

  return `You are an expert in professional CV writing and layout optimization.

LANGUAGE: ${outputLang}

Your mission: rewrite and reorder this CV for maximum professional impact, targeting roughly ${pageLimit} A4 page(s) worth of substance.

CV DATA:
${cvJson}
${jobContext}

═══ RÈGLE ABSOLUE — NE SUPPRIME RIEN ═══
Toutes les expériences, formations, compétences, langues présentes en entrée DOIVENT être présentes en sortie.
Le nombre d'éléments dans chaque section doit être IDENTIQUE.
Tu n'as le droit que de : réordonner, reformuler, condenser, enrichir, et changer le displayMode.

${kpiRules}

${intro}

═══ PRIORISATION ═══

1. RÉORDONNE les expériences par pertinence (la plus importante en premier)
2. REMPLIS kpi SUR CHAQUE EXPÉRIENCE (voir règles ci-dessus)
3. RENSEIGNE companyStage (Startup|Scaleup|PME|Grand groupe|ETI|Agence) et companyBusinessModel (B2B|B2C|B2B2C|SaaS|Marketplace|E-commerce|Media|Service) sur chaque expérience
4. RÉSUMÉ : 2-3 phrases percutantes
5. COMPÉTENCES : Réordonne — les plus pertinentes en premier
6. FORMATIONS et LANGUES : Garde tel quel

N'émets JAMAIS "displayMode" : le niveau de détail affiché pour chaque expérience
est décidé en aval, en mesurant la page rendue. Écris le meilleur contenu possible,
la mise en page n'est pas ton problème.

═══ QUALITÉ DES REFORMULATIONS ═══
- Verbe d'action fort et précis en début de bullet (${verbs})
- Structure : ACTION + CONTEXTE + RÉSULTAT en 1-2 lignes max
- ${FABRICATION_GUARD}
- Mots-clés du secteur / de l'offre intégrés naturellement

${languageLock}

Retourne UNIQUEMENT l'objet JSON complet du CV optimisé. Chaque expérience DOIT avoir kpi.`;
}
