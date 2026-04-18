export interface ATSAnalysisContext {
  cvData: unknown;
  jobDescription: string;
}

export function buildATSAnalysisPrompt(ctx: ATSAnalysisContext): string {
  return `
Tu es un expert en recrutement et en systèmes ATS.
Analyse le CV suivant par rapport à l'offre d'emploi fournie.

CV : ${JSON.stringify(ctx.cvData)}
Offre : ${ctx.jobDescription}

Retourne un objet JSON avec :
- score : un nombre entre 0 et 100
- missingKeywords : liste des mots-clés importants manquants
- strengths : points forts du CV pour ce poste
- improvements : conseils concrets d'amélioration
- ats_compatibility : 'LOW', 'MEDIUM' ou 'HIGH'
- seniority_match : 'UNDER', 'MATCH' ou 'OVER' — niveau du candidat vs seniorité demandée dans l'offre
- compensation_estimate : string | null — fourchette salariale estimée (ex: "45k-65k€") basée sur les signaux de l'offre, null si aucun signal détectable

Retourne UNIQUEMENT le JSON.
`;
}
