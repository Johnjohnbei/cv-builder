// Prompt builder for enriching each work experience with companyStage and
// companyBusinessModel tags deduced from the experience's content (company,
// position, intro, description bullets).

export interface ExperienceForEnrichment {
  company: string;
  position: string;
  intro?: string;
  description?: string[];
}

export interface ExperienceEnrichmentContext {
  experiences: ExperienceForEnrichment[];
}

export function buildExperienceEnrichmentPrompt(ctx: ExperienceEnrichmentContext): string {
  const lines = ctx.experiences.map((exp, idx) => {
    const bullets = (exp.description || []).join(' | ');
    return `[${idx}] company="${exp.company}", position="${exp.position}", intro="${exp.intro || ''}", bullets="${bullets}"`;
  }).join('\n');

  return `Tu es un expert en analyse d'entreprises (FR/EN).

MISSION : Pour chaque expérience pro listée ci-dessous, déduis 2 tags qui caractérisent l'entreprise où la personne a travaillé.

EXPÉRIENCES (une par ligne, indexées) :
${lines}

POUR CHAQUE EXPÉRIENCE, retourne :
- stage : stade de maturité de l'entreprise au moment de l'expérience. UNE valeur exacte parmi : "Startup", "Scaleup", "PME", "Grande entreprise", "Multinationale", "Cabinet", "Secteur public", "Association". null si non déductible.
- businessModel : modèle économique de l'entreprise. UNE valeur exacte parmi : "B2C", "B2B", "B2B2C", "B2G", "D2C", "Marketplace", "SaaS". null si non déductible.

INDICES UTILES :
- Nom connu (Google, Airbnb, Stripe, BNP Paribas) → tes connaissances générales suffisent
- Position type "Founder", "CTO", "Head of" sur petite équipe → Startup
- Mentions "leader mondial", "groupe", "international" → Multinationale
- "agence", "conseil", "consulting" → Cabinet
- "association", "ONG", "fondation" → Association
- Industrie B2C : retail, mobile app grand public, e-commerce direct
- Industrie B2B : SaaS entreprise, conseil, services pro
- Marketplace : Airbnb, Uber, eBay, Doctolib

RÈGLES STRICTES :
1. Réponds avec un tableau JSON strict, un objet par expérience, dans le MÊME ORDRE que les inputs.
2. Si l'info est ambiguë, retourne null. PAS d'hallucination.
3. UNIQUEMENT les valeurs exactes listées (case-sensitive).

FORMAT DE SORTIE :
{ "results": [ { "stage": string|null, "businessModel": string|null }, ... ] }

Retourne UNIQUEMENT le JSON.`;
}
