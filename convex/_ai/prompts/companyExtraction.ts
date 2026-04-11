// Prompt builder for extracting structured company metadata from a job description.
// Bilingual (FR/EN) — instructs the LLM to detect the JD language and apply the
// same language-aware rules, but the output JSON keys stay English.

export interface CompanyExtractionContext {
  jobDescription: string;
}

export function buildCompanyExtractionPrompt(ctx: CompanyExtractionContext): string {
  return `Tu es un expert en analyse d'offres d'emploi (FR/EN).

MISSION : Extrais les métadonnées de l'entreprise qui recrute à partir de l'offre ci-dessous.
Détecte la langue de l'offre (français ou anglais) et applique les mêmes règles.

OFFRE D'EMPLOI :
${ctx.jobDescription}

CHAMPS À RETOURNER :
- companyName : le nom exact de l'entité qui recrute (ex: "Google", "Airbus", "Société Générale", "BNP Paribas"). Utilise la casse officielle.
- domainGuess : ta meilleure supposition du domaine officiel de l'entreprise (ex: "google.com", "airbus.com", "bnpparibas.com"). null si tu n'es pas certain.
- industry : catégorie courte du secteur (ex: "Tech", "Banking", "Retail", "Aerospace", "Consulting"). null si ambiguë.

RÈGLES STRICTES (high confidence only) :
1. Si le nom de l'entreprise n'est pas clairement indiqué dans l'offre, retourne null pour companyName.
2. N'invente JAMAIS un nom. Pas d'hallucination — high confidence uniquement.
3. INTERDIT d'utiliser des formulations génériques : "the company", "our client", "a leading firm", "notre client", "l'entreprise", "une société leader", "a fast-growing startup". Si l'offre ne mentionne que ces termes, retourne null pour companyName.
4. Pour domainGuess : retourne null si tu n'es pas certain à 90%+ du domaine exact.
5. Pour industry : retourne null si le secteur n'est pas déductible avec certitude.

FORMAT DE SORTIE (JSON strict, aucun commentaire) :
{ "companyName": string|null, "domainGuess": string|null, "industry": string|null }

Retourne UNIQUEMENT le JSON.`;
}
