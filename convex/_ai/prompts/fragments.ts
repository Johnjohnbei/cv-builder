// Shared prompt fragments — single source of truth for ATS rules.
// Each fragment is a raw template string referenced by prompt builders in convex/_ai/prompts/*.

// ─── Fabrication guard (was convex/ai.ts:798) ────────────────────
export const FABRICATION_GUARD = `RÈGLE ABSOLUE : Ne JAMAIS inventer de chiffres, métriques ou résultats. Si le bullet original ne contient pas de données chiffrées, la version réécrite ne doit pas en ajouter. Tu peux reformuler pour être plus percutant sans fabriquer de données.`;

// ─── Action verbs (FR/EN) ────────────────────────────────────────
// FR verbs used in tailorCV, optimizeCVForPage, improveBulletPoint, rewriteBulletsForJob
export const ACTION_VERBS_FR = `Pilote, Conçoit, Orchestre, Déploie, Optimise, Structure, Dirige — JAMAIS "Responsable de", "Aide à", "Participe à", "Gère"`;

// EN verbs used in tailorCV
export const ACTION_VERBS_EN = `Led, Designed, Orchestrated, Deployed, Optimized, Structured — NEVER "Responsible for", "Helped with", "Participated in"`;

// ─── Weak verbs (also used for bullet detection hints) ──────────
export const WEAK_VERBS_FR = `"Responsable de", "Aide à", "Participe à", "Gère"`;
export const WEAK_VERBS_EN = `"Responsible for", "Helped with", "Participated in", "Managed" (when vague)`;

// ─── KPI rules (consolidated from extract & optimize prompts) ───
export const KPI_RULES_FR = `═══ CHAMP "kpi" — OBLIGATOIRE SUR TOUTES LES EXPÉRIENCES ═══

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
- "Stack Notion / Figma / GTM déployée" (scope technique pour une mission courte)`;

// English twin of KPI_RULES_FR. The few-shot examples MUST be in English —
// a French example set is the main reason Gemini bleeds French into an
// English CV (it copies the sample phrasing). Keep both lists in sync.
export const KPI_RULES_EN = `═══ "kpi" FIELD — MANDATORY ON EVERY EXPERIENCE ═══

Every experience MUST have a filled "kpi" (string), whatever its displayMode.
The KPI is a quantified result or a striking scope indicator, calibrated to the mission's duration.

CALIBRATION RULES:
- DURATION: a 3-month internship cannot claim "+50% revenue over 3 years". Scale the KPI
  to the time actually spent on the mission (start_date → end_date or current=true).
- REALISM: extract the KPI from the source text if present. Otherwise SYNTHESIZE it from the role,
  industry and context — staying credible.
- PREFER SCOPE OVER INVENTED PERCENTAGES: when the source gives no metric,
  use team size, number of projects, scope (brands/markets/users), deployed stack.
- DO NOT invent precise percentages without a factual basis.
- NEVER leave "kpi" empty — always produce a coherent scope indicator.

EXAMPLES OF GOOD KPIs:
- "+35% organic traffic in 6 months" (if data exists in the source)
- "Led a team of 8 designers" (managerial scope)
- "Redesign spanning 5 brands and 30M+ users" (project scope)
- "12 concurrent projects delivered" (volume)
- "Notion / Figma / GTM stack deployed" (technical scope for a short mission)`;

export function KPI_RULES(isEn: boolean): string {
  return isEn ? KPI_RULES_EN : KPI_RULES_FR;
}

// ─── Intro preservation rule ────────────────────────────────────
export const INTRO_PRESERVATION_FR = `Le champ "intro" de chaque expérience DOIT être préservé (1-2 lignes décrivant le rôle/contexte). Si absent dans l'entrée, synthétise-le à partir de position + company + secteur.`;

export const INTRO_PRESERVATION_EN = `The "intro" field of each experience MUST be preserved (1-2 lines describing the role/context). If missing from input, synthesize from position + company + industry.`;

// ─── Language output instruction ────────────────────────────────
export function LANGUAGE_OUTPUT_INSTRUCTION(isEn: boolean): string {
  return isEn ? "Write ALL content in English." : "Rédige TOUT le contenu en français.";
}

// ─── Anti-mix language lock ──────────────────────────────────────
// Placed at the END of a prompt (last instruction = strongest recency weight).
// These prompts mix French scaffolding with a target output language, and
// weaker models leak the scaffolding language into the output. This is the
// hard stop: every human-readable value in ONE language, no exceptions.
export function LANGUAGE_LOCK(isEn: boolean): string {
  return isEn
    ? `⚠️ LANGUAGE LOCK — ABSOLUTE: Some instructions above are written in French, but the OUTPUT CV must be 100% ENGLISH. Every human-readable value (summary, intro, bullets, kpi, position, title, skill category labels) must be English. Do NOT copy any French word from the instructions or examples. A CV mixing French and English is a FAILURE — re-read and fix before returning.`
    : `⚠️ VERROU DE LANGUE — ABSOLU : le CV de sortie doit être 100% en FRANÇAIS. Chaque valeur lisible (résumé, intro, bullets, kpi, intitulé de poste, titre, libellés de catégories de compétences) doit être en français. Un CV mélangeant français et anglais est un ÉCHEC — relis et corrige avant de répondre.`;
}
