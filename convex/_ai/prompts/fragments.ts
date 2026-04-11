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

// ─── Intro preservation rule ────────────────────────────────────
export const INTRO_PRESERVATION_FR = `Le champ "intro" de chaque expérience DOIT être préservé (1-2 lignes décrivant le rôle/contexte). Si absent dans l'entrée, synthétise-le à partir de position + company + secteur.`;

export const INTRO_PRESERVATION_EN = `The "intro" field of each experience MUST be preserved (1-2 lines describing the role/context). If missing from input, synthesize from position + company + industry.`;

// ─── Language output instruction ────────────────────────────────
export function LANGUAGE_OUTPUT_INSTRUCTION(isEn: boolean): string {
  return isEn ? "Write ALL content in English." : "Rédige TOUT le contenu en français.";
}
