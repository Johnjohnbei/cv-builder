// Shared prompt fragments — single source of truth for ATS rules.
// Each fragment is a raw template string referenced by prompt builders in convex/_ai/prompts/*.

// ─── Fabrication guard (was convex/ai.ts:798) ────────────────────
export const FABRICATION_GUARD = `RÈGLE ABSOLUE : Ne JAMAIS inventer de chiffres, métriques ou résultats. Si le bullet original ne contient pas de données chiffrées, la version réécrite ne doit pas en ajouter. Tu peux reformuler pour être plus percutant sans fabriquer de données.`;

// ─── Action verbs (FR/EN) ────────────────────────────────────────
// Used by the tailoring and repair prompts (adapt.ts, distribute.ts)
export const ACTION_VERBS_FR = `Pilote, Conçoit, Orchestre, Déploie, Optimise, Structure, Dirige ; JAMAIS "Responsable de", "Aide à", "Participe à", "Gère"`;

export const ACTION_VERBS_EN = `Led, Designed, Orchestrated, Deployed, Optimized, Structured; NEVER "Responsible for", "Helped with", "Participated in"`;

// ─── KPI rules (arbitrage Q2 of 2026-09-15: only what the source gives) ───
// A KPI synthesized from the role was an invention found out in an interview.
export const KPI_RULES_FR = `═══ CHAMP "kpi" ═══

Le KPI est un résultat chiffré ou un indicateur d'envergure (taille d'équipe, nombre de projets, périmètre, utilisateurs) QUE LE CV SOURCE DONNE DÉJÀ pour cette expérience.
- Présent dans le texte source de l'expérience : reprends-le, reformulé si besoin, avec la même valeur.
- Absent : laisse "kpi" vide (""). N'en fabrique jamais un : un indicateur que la source ne donne pas est une invention découverte en entretien.
- DURÉE : un chiffre ne dépasse jamais la période réelle de la mission (start_date à end_date, ou current=true).`;

// English twin of KPI_RULES_FR, so an English CV is not written from French rules
export const KPI_RULES_EN = `═══ "kpi" FIELD ═══

The KPI is a quantified result or a scope indicator (team size, number of projects, scope, users) THAT THE SOURCE CV ALREADY GIVES for this experience.
- Present in the experience's source text: keep it, reworded if needed, with the same value.
- Absent: leave "kpi" empty (""). Never make one up: an indicator the source does not give is an invention found out in an interview.
- DURATION: a figure never exceeds the mission's real period (start_date to end_date, or current=true).`;

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
    ? `⚠️ LANGUAGE LOCK, ABSOLUTE: Some instructions above are written in French, but the OUTPUT CV must be 100% ENGLISH. Every human-readable value (summary, intro, bullets, kpi, position, title, skill category labels) must be English. Do NOT copy any French word from the instructions or examples. A CV mixing French and English is a FAILURE: re-read and fix before returning.`
    : `⚠️ VERROU DE LANGUE, ABSOLU : le CV de sortie doit être 100% en FRANÇAIS. Chaque valeur lisible (résumé, intro, bullets, kpi, intitulé de poste, titre, libellés de catégories de compétences) doit être en français. Un CV mélangeant français et anglais est un ÉCHEC : relis et corrige avant de répondre.`;
}
