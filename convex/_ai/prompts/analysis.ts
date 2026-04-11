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

Retourne UNIQUEMENT le JSON.
`;
}
