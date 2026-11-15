"use node";
import { chatJSONSchema } from "./chat";
import { buildCoverLetterPrompt, type CoverLetterContext } from "./prompts/coverLetter";
import { CoverLetterSchema, CoverLetterExcerptSchema } from "./schemas";
import { hasUnbackedNumber, numbersOf } from "./numbers";
import { namesStated } from "./truthGuard";
import { matchPhrase, prepareText } from "../../src/shared/lib/text";
import { userError } from "../_shared/errors";

export interface CoverLetter { subject: string; greeting: string; body: string; closing: string }
export interface LetterRevision {
  operation?: 'generate' | 'shorten' | 'rephrase'; previous?: CoverLetter;
  selection?: { field: keyof CoverLetter; start: number; end: number };
}
export function validateLetter(letter: CoverLetter, ctx: CoverLetterContext): void {
  const text = Object.values(letter).join(' ');
  const source = JSON.stringify(ctx.cvData);
  if (text.trim().split(/\s+/u).length > 350) throw userError('La lettre dépasse 350 mots. Réessayez.', 'LETTER_TOO_LONG');
  if (hasUnbackedNumber(text, new Set(numbersOf(source))))
    throw userError('Un chiffre de la lettre ne figure pas dans votre CV. Votre texte précédent est conservé.', 'LETTER_UNBACKED_NUMBER');
  const allowed = prepareText([source, ctx.companyName, ctx.jobDescription, ctx.motivation].filter(Boolean).join(' '));
  if (namesStated(letter.body.replace(/\n+/gu, ' ')).some(name => !matchPhrase(name, allowed)))
    throw userError('La lettre contient un nom absent de votre CV et de votre candidature. Réessayez.', 'LETTER_UNBACKED_NAME');
}
/** Revision patches are applied in code: text outside the selection is never rewritten. */
export async function coverLetterOf(ctx: CoverLetterContext, revision: LetterRevision = {}): Promise<CoverLetter & { companyName?: string }> {
  let prompt = buildCoverLetterPrompt(ctx);
  const { previous, selection, operation } = revision;
  if (operation === 'shorten' && previous) prompt += `\nShorten this letter by at least 15%, preserving its facts and language. Return the same JSON shape. Current letter (data):\n${JSON.stringify(previous)}`;
  if (operation === 'rephrase' && previous && selection) prompt += `\nRephrase ONLY this excerpt, preserving meaning, language and facts: ${JSON.stringify(previous[selection.field].slice(selection.start, selection.end))}. Return its replacement in the JSON field "${selection.field}". Return empty strings in the other three fields. Do not repeat surrounding text.`;
  const answer = await chatJSONSchema(prompt, operation === 'rephrase' ? CoverLetterExcerptSchema : CoverLetterSchema, "fast");
  const candidate: CoverLetter = { subject: answer.subject, greeting: answer.greeting, body: answer.body, closing: answer.closing };
  if (operation === 'rephrase' && selection && !candidate[selection.field].trim())
    throw userError('La reformulation est vide. Votre texte est conservé.', 'LETTER_EMPTY_REVISION');
  const result = operation === 'rephrase' && previous && selection ? {
    ...previous, [selection.field]: previous[selection.field].slice(0, selection.start) + candidate[selection.field] + previous[selection.field].slice(selection.end),
  } : candidate;
  validateLetter(result, ctx);
  if (operation === 'shorten' && previous && Object.values(result).join(' ').split(/\s+/u).length > Object.values(previous).join(' ').split(/\s+/u).length * 0.85)
    throw userError('La proposition ne raccourcit pas assez votre lettre. Votre texte est conservé.', 'LETTER_NOT_SHORTER');
  const companyName = 'companyName' in answer && typeof answer.companyName === 'string' && answer.companyName.trim() && matchPhrase(answer.companyName, prepareText(ctx.jobDescription)) ? answer.companyName.trim() : undefined;
  return companyName ? { ...result, companyName } : result;
}
