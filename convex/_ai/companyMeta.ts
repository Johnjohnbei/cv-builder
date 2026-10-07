"use node";

import { chatJSONSchema } from "./chat";
import { buildCompanyExtractionPrompt } from "./prompts/companyExtraction";
import { CompanyMetaSchema, type CompanyMetaParsed } from "./schemas";

// ─── What an offer says of the company ───
// Extracted from ai.ts, over its size limit. It reads a context the cover
// letter only decorates: a failure is answered with nulls, never with an error
// the user has to act on.

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
