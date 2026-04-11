import { FABRICATION_GUARD, ACTION_VERBS_FR } from "./fragments";

export interface BulletSuggestionsContext {
  bullet: string;
  position: string;
  company: string;
  jobDescription?: string;
  missingKeywords?: string[];
}

export interface BulletRewriteContext {
  bullets: Array<{
    index: number;
    text: string;
    position: string;
    company: string;
  }>;
  jobDescription: string;
  missingKeywords: string[];
}

export function buildBulletSuggestionsPrompt(ctx: BulletSuggestionsContext): string {
  const jobContext = ctx.jobDescription
    ? `\n\nOffre ciblée :\n${ctx.jobDescription}`
    : "";

  const keywordContext = ctx.missingKeywords?.length
    ? `\nMots-clés manquants à intégrer si pertinent : ${ctx.missingKeywords.join(", ")}`
    : "";

  return `Tu es un rédacteur de CV senior spécialisé dans l'optimisation ATS et le recrutement tech/business en France.

CONTEXTE :
- Poste : ${ctx.position} chez ${ctx.company}
- Bullet actuel : "${ctx.bullet}"${jobContext}${keywordContext}

MISSION : Propose exactement 3 reformulations de ce bullet, chacune avec un angle différent :
1. **Version impact** : met en avant le résultat business ou l'impact concret
2. **Version leadership** : met en avant le rôle de pilotage, de décision ou de collaboration
3. **Version technique** : met en avant la méthodologie, les outils ou l'expertise déployée

RÈGLES DE RÉDACTION :
- Commence TOUJOURS par un verbe d'action fort et précis (${ACTION_VERBS_FR})
- Une bullet = UNE action + UN contexte + UN résultat/impact
- Maximum 2 lignes, privilégie la concision
- Vocabulaire professionnel et naturel, adapté au secteur de ${ctx.company}
- ${FABRICATION_GUARD}
- Si le bullet original contient des chiffres, conserve-les. Sinon, utilise des indicateurs qualitatifs (équipe de X, X projets, périmètre Y)

EXEMPLES DE BONNE QUALITÉ :
- "Pilote la refonte du Design System multi-marques pour 5 marques premium, couvrant 30M+ utilisateurs"
- "Orchestre la transition data-driven du product management avec définition de KPIs et dashboards de suivi"
- "Conçoit l'architecture front-end modulaire permettant le déploiement simultané sur 3 plateformes"

Retourne un JSON : { "suggestions": ["suggestion1", "suggestion2", "suggestion3"] }
Retourne UNIQUEMENT le JSON.`;
}

export function buildBulletRewritePrompt(ctx: BulletRewriteContext): string {
  const bulletsList = ctx.bullets
    .map((b) => `[${b.index}] (${b.position} @ ${b.company}) "${b.text}"`)
    .join("\n");

  const keywordsLine = ctx.missingKeywords.length
    ? `Intègre naturellement ces mots-clés si pertinent : ${ctx.missingKeywords.join(", ")}`
    : "";

  return `Tu es un rédacteur de CV senior spécialisé dans l'optimisation ATS pour le marché français.

MISSION : Réécris chaque bullet point pour maximiser l'alignement avec l'offre d'emploi tout en restant fidèle à l'expérience réelle du candidat.

OFFRE D'EMPLOI :
${ctx.jobDescription}

${keywordsLine}

${FABRICATION_GUARD}

BULLETS À RÉÉCRIRE :
${bulletsList}

RÈGLES DE RÉDACTION :
1. Verbe d'action fort en début (${ACTION_VERBS_FR})
2. Structure : ACTION + CONTEXTE + RÉSULTAT/IMPACT en 1-2 lignes
3. Intègre les mots-clés de l'offre de façon naturelle, pas forcée
4. Conserve le sens original — tu améliores la formulation, tu ne changes pas l'expérience
5. Si le bullet original a des chiffres, conserve-les. Sinon, ne pas en inventer — utilise des indicateurs qualitatifs si possible
6. Adapte le vocabulaire au secteur de l'entreprise

EXEMPLES AVANT/APRÈS :
- AVANT : "Responsable de la gestion de projets digitaux"
  APRÈS : "Pilote un portefeuille de projets digitaux de la conception au déploiement, en coordination avec les équipes tech et marketing"
- AVANT : "Aide à la création de maquettes"
  APRÈS : "Conçoit les maquettes UI/UX et prototypes interactifs, validés en user testing auprès de panels utilisateurs"

Retourne un JSON : { "rewrites": [{ "index": <numero>, "original": "<texte original>", "rewritten": "<version améliorée>" }] }
Retourne UNIQUEMENT le JSON.`;
}
