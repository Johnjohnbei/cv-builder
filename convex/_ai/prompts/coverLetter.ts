export interface CoverLetterContext {
  cvData: unknown;
  jobDescription: string;
  companyName?: string;
  companyStage?: string;
  companyBusinessModel?: string;
  tone?: string;
  /** Output language. Defaults to 'fr' to preserve legacy behaviour when caller omits it. */
  language?: 'fr' | 'en';
}

function buildCompanyContextFr(ctx: CoverLetterContext): string {
  const parts: string[] = [];
  if (ctx.companyStage) parts.push(`stade : ${ctx.companyStage}`);
  if (ctx.companyBusinessModel) parts.push(`modèle économique : ${ctx.companyBusinessModel}`);
  if (parts.length === 0) return "";
  return `\nContexte entreprise (à utiliser pour adapter le ton et les références — sans le citer littéralement) : ${parts.join(", ")}.\n`;
}

function buildCompanyContextEn(ctx: CoverLetterContext): string {
  const parts: string[] = [];
  if (ctx.companyStage) parts.push(`stage: ${ctx.companyStage}`);
  if (ctx.companyBusinessModel) parts.push(`business model: ${ctx.companyBusinessModel}`);
  if (parts.length === 0) return "";
  return `\nCompany context (use to calibrate tone and references — do not quote verbatim): ${parts.join(", ")}.\n`;
}

function buildFrenchPrompt(ctx: CoverLetterContext): string {
  const tone = ctx.tone || "professionnel et engagé";
  const company = ctx.companyName ? `pour l'entreprise ${ctx.companyName}` : "";
  const companyContext = buildCompanyContextFr(ctx);

  return `
Tu es un senior designer qui écrit sa propre lettre de motivation ${company}, à la première personne, en français, ton ${tone}.
${companyContext}
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

function buildEnglishPrompt(ctx: CoverLetterContext): string {
  const tone = ctx.tone || "professional and engaged";
  const company = ctx.companyName ? `for ${ctx.companyName}` : "";
  const companyContext = buildCompanyContextEn(ctx);

  return `
CRITICAL: THE OUTPUT MUST BE WRITTEN ENTIRELY IN ENGLISH. The candidate's CV may contain French text — IGNORE that and produce ENGLISH OUTPUT ONLY. Every word of subject, greeting, body, closing must be in English.

You are a senior designer writing your own cover letter ${company}, in first person, in English, ${tone} tone.
${companyContext}
Candidate's CV (translate any non-English content to English in your output):
${JSON.stringify(ctx.cvData)}

Job posting:
${ctx.jobDescription}

ABSOLUTE CONSTRAINTS — respect them all:
1. ENGLISH OUTPUT ONLY. Do not produce a single French word in the output, even if the CV is in French.
2. Plain text only. Zero markdown: no **, no *, no #, no dashes for lists.
3. Never reuse section titles from the job posting — that's an AI giveaway, not human writing.
4. 3 to 4 paragraphs of continuous prose, separated by \\n\\n. No bullet points, no lists, no visible structure.
5. Maximum 350 words. Get to the point.
6. Anchor on 2 or 3 concrete quantified achievements from the CV — not an exhaustive list.
7. No conventional openings ("I am writing to apply", "I would like to express my interest", "It is with great interest").
8. No flowery closing. One sober sentence is enough.
9. The tone should sound like someone who knows their worth and speaks directly, not like an AI checking boxes.

Return a JSON object with:
- subject: short, direct email subject in English (without "Application for")
- greeting: sober opening line in English
- body: letter body in English, continuous prose, paragraphs separated by \\n\\n
- closing: sober closing line in English, 1 line max

Return ONLY the JSON. EVERY STRING VALUE MUST BE IN ENGLISH.
`;
}

export function buildCoverLetterPrompt(ctx: CoverLetterContext): string {
  return ctx.language === 'en' ? buildEnglishPrompt(ctx) : buildFrenchPrompt(ctx);
}
