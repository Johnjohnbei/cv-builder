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
9. Each experience MUST have a non-empty "kpi" field and a valid "displayMode" ("hidden"|"compact"|"normal"|"extended"). Default to "normal" when unsure.
10. ${FABRICATION_GUARD}

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

Your mission: reorganize and adjust the content of this CV to fit on ${pageLimit} A4 page(s) while maximizing professional impact.

CV DATA:
${cvJson}
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

${kpiRules}

${intro}

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
- Verbe d'action fort et précis en début de bullet (${verbs})
- Structure : ACTION + CONTEXTE + RÉSULTAT en 1-2 lignes max
- ${FABRICATION_GUARD}
- Mots-clés du secteur / de l'offre intégrés naturellement

═══ CONTRAINTE TAILLE ═══
Pour ${pageLimit} page(s) A4, un bon équilibre est :
- 1 page : max 1 extended + 1-2 normal + le reste compact
- 2 pages : max 2-3 extended + 2-3 normal + le reste compact

${languageLock}

Retourne UNIQUEMENT l'objet JSON complet du CV optimisé. Chaque expérience DOIT avoir displayMode ET kpi.`;
}
