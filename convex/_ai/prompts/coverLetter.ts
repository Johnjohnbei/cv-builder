export interface CoverLetterContext {
  cvData: unknown;
  jobDescription: string;
  companyName?: string;
  tone?: string;
}

export function buildCoverLetterPrompt(ctx: CoverLetterContext): string {
  const tone = ctx.tone || "professionnel et engagé";
  const company = ctx.companyName ? `pour l'entreprise ${ctx.companyName}` : "";

  return `
Tu es un expert en rédaction de lettres de motivation ${company}.
Rédige une lettre de motivation percutante en français, ton ${tone}.

CV du candidat :
${JSON.stringify(ctx.cvData)}

Offre d'emploi :
${ctx.jobDescription}

Règles :
1. Maximum 400 mots
2. Structure : accroche → compétences clés liées au poste → motivation → conclusion avec appel à l'action
3. Utilise les mots-clés de l'offre naturellement
4. Mentionne des réalisations concrètes du CV
5. Pas de formules clichées ("je me permets de vous écrire", "veuillez agréer")
6. Ton : direct, confiant, spécifique

Retourne un objet JSON avec :
- subject: l'objet du mail (court)
- greeting: la formule d'appel
- body: le corps de la lettre (en paragraphes séparés par \\n\\n)
- closing: la formule de fin

Retourne UNIQUEMENT le JSON.
`;
}
