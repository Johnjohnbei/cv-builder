import { FABRICATION_GUARD, ACTION_VERBS_FR, INTRO_PRESERVATION_FR } from "./fragments";

export interface DistributeContext {
  cvData: {
    experience: Array<{
      position?: string;
      company?: string;
      intro?: string;
      description?: string[];
      kpi?: string;
    }>;
  };
  missingKeywords: string[];
  jobDescription: string;
}

/**
 * Build a compact experience summary for the prompt.
 * Each experience is indexed and its bullets are indexed for precise targeting.
 */
function summarizeExperiences(experiences: DistributeContext["cvData"]["experience"]): string {
  return experiences
    .map((exp, i) => {
      const header = `[${i}] ${exp.position ?? ""} @ ${exp.company ?? ""}`;
      const intro = exp.intro ? `  intro: ${exp.intro}` : "";
      const bullets = (exp.description ?? [])
        .map((b, bi) => `  - [${bi}] ${b}`)
        .join("\n");
      const kpi = exp.kpi ? `  kpi: ${exp.kpi}` : "";
      return [header, intro, bullets, kpi].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export function buildKeywordDistributionPrompt(ctx: DistributeContext): string {
  const expSummary = summarizeExperiences(ctx.cvData.experience);
  const keywordsList = ctx.missingKeywords.map((k) => `- ${k}`).join("\n");

  return `Tu es un expert en optimisation de CV pour ATS.

MISSION : Pour CHAQUE mot-clé manquant, propose son intégration dans UNE expérience spécifique en réécrivant UN bullet point précis pour qu'il contienne ce mot-clé de manière naturelle.

OFFRE D'EMPLOI :
${ctx.jobDescription}

EXPÉRIENCES DU CV (index 0 = la plus récente) :
${expSummary}

MOTS-CLÉS MANQUANTS À DISTRIBUER :
${keywordsList}

RÈGLES DE DISTRIBUTION :
1. Pour chaque mot-clé, choisis l'expérience la PLUS crédible (pas forcer un mot-clé technique sur un poste sans rapport).
2. Choisis UN bullet point spécifique de cette expérience à réécrire (indexer par expIndex + bulletIndex).
3. Réécris le bullet pour intégrer le mot-clé NATURELLEMENT — pas en liste, pas parachuté.
4. Si un mot-clé n'a AUCUNE expérience crédible pour l'accueillir, retourne expIndex: null (l'utilisateur décidera).
5. Un même bullet ne doit PAS recevoir 2 mots-clés d'un coup — distribue intelligemment.
6. Verbe d'action fort en début de bullet (${ACTION_VERBS_FR}).
7. ${INTRO_PRESERVATION_FR}
8. ${FABRICATION_GUARD}
9. Explique ton choix en 1 phrase dans "reason".

FORMAT JSON ATTENDU :
{
  "assignments": [
    {
      "keyword": "Figma",
      "expIndex": 0,
      "bulletIndex": 1,
      "originalBullet": "Pilote les ateliers de discovery",
      "rewrittenBullet": "Pilote les ateliers de discovery et prototypes Figma pour valider les concepts",
      "reason": "L'expérience de Senior Designer mentionne déjà des ateliers de discovery, contexte naturel pour Figma."
    }
  ]
}

Retourne UNIQUEMENT le JSON.`;
}
