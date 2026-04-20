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
Tu es un senior designer qui écrit sa propre lettre de motivation ${company}, à la première personne, en français, ton ${tone}.

CV du candidat :
${JSON.stringify(ctx.cvData)}

Offre d'emploi :
${ctx.jobDescription}

CONTRAINTES ABSOLUES — respecte-les toutes :
1. Texte brut uniquement. Zéro markdown : pas de **, pas de *, pas de #, pas de tirets en liste.
2. Ne jamais reprendre les titres de section de l'offre ("Penser produit, pas pixels", "Commencer dans un LLM"...) — c'est la marque d'une IA, pas d'un humain.
3. 3 à 4 paragraphes de prose continue, séparés par \\n\\n. Pas de bullet points, pas de liste, pas de structure visible.
4. Maximum 350 mots. Aller à l'essentiel.
5. Ancrer sur 2 ou 3 réalisations concrètes chiffrées tirées du CV — pas une liste exhaustive.
6. Pas de formules d'ouverture convenues ("je me permets", "suite à votre offre", "c'est avec intérêt").
7. Pas de formule de fermeture ampoulée. Une phrase sobre suffit.
8. Le ton doit sonner comme quelqu'un qui sait ce qu'il vaut et parle directement, pas comme une IA qui coche des cases.

Retourne un objet JSON avec :
- subject: objet du mail, court et direct (sans "Candidature à")
- greeting: formule d'appel sobre
- body: corps de la lettre, prose continue, paragraphes séparés par \\n\\n
- closing: formule de fin sobre, 1 ligne max

Retourne UNIQUEMENT le JSON.
`;
}
