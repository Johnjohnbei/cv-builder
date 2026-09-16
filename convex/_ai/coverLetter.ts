"use node";

import { chatJSONSchema } from "./chat";
import { buildCoverLetterPrompt, type CoverLetterContext } from "./prompts/coverLetter";
import { CoverLetterSchema } from "./schemas";

// ─── The cover letter the model writes ───────────────────────────────
// Extracted from ai.ts, over its size limit: the action checks the access code
// and the input sizes, this writes the letter.

export interface CoverLetter {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
}

/** The letter for this CV and this offer, on the fast model */
export async function coverLetterOf(ctx: CoverLetterContext): Promise<CoverLetter> {
  const { subject, greeting, body, closing } = await chatJSONSchema(buildCoverLetterPrompt(ctx), CoverLetterSchema, "fast");
  return { subject, greeting, body, closing };
}
