"use node";

import { chatJSONSchema } from "./chat";
import { buildCompanyExtractionPrompt } from "./prompts/companyExtraction";
import { buildExperienceEnrichmentPrompt } from "./prompts/experienceEnrichment";
import { CompanyMetaSchema, ExperienceEnrichmentSchema, type CompanyMetaParsed } from "./schemas";

// ─── What an offer says of the company, and a CV of its employers ───
// Extracted from ai.ts, over its size limit once proveRequirement was added.
// Both read a context the CV only decorates: a failure is answered with nulls,
// never with an error the user has to act on.

export interface ExperienceMeta {
  stage?: string | null;
  businessModel?: string | null;
}

const NO_COMPANY: CompanyMetaParsed = { companyName: null, domainGuess: null, industry: null, stage: null, businessModel: null };

/** The company an offer is for, read from the offer alone; nulls when it says too little */
export async function companyMetaOf(jobDescription: string): Promise<CompanyMetaParsed> {
  if (!jobDescription || jobDescription.trim().length < 50) return NO_COMPANY;
  try {
    return await chatJSONSchema(buildCompanyExtractionPrompt({ jobDescription }), CompanyMetaSchema, "fast");
  } catch (e) {
    console.warn("[extractCompanyMeta] LLM call failed:", e);
    return NO_COMPANY;
  }
}

/** One (stage, businessModel) pair per experience, in the order they are given */
export async function experienceMetaOf(
  experiences: Array<{ company: string; position: string; intro?: string; description?: string[] }>,
): Promise<ExperienceMeta[]> {
  if (experiences.length === 0) return [];
  try {
    const data = await chatJSONSchema(buildExperienceEnrichmentPrompt({ experiences }), ExperienceEnrichmentSchema, "fast");
    // Padded with nulls when the model answered with fewer items than asked
    return experiences.map((_, i) => data.results[i] ?? { stage: null, businessModel: null });
  } catch (e) {
    console.warn("[enrichExperienceMeta] LLM call failed:", e);
    return experiences.map(() => ({ stage: null, businessModel: null }));
  }
}
