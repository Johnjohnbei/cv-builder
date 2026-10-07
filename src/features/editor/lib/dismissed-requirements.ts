import type { CVData, JobRequirement } from '@/src/shared/types';
import { prepareText, stripInlineMarkdown } from '@/src/shared/lib/text';
import { isWrittenFreely, writesRequirement } from './keyword-analysis';
import { experienceVersionOf, versionOf } from './cv-versions';

// ─── Requirements the user said they lack (arbitrage of 2026-10-07) ───
// "Je ne l'ai pas" takes the requirement out of the CV, without any AI call.
// The CV keeps its texts and the requirement itself (its terms, its kind):
// only the CV as it prints, and as it is measured, leaves out what writes it,
// on any device and whatever the cache of the offer's analysis holds, so
// "Remettre" loses nothing.

/** Ids of the requirements the CV says the user lacks */
export const dismissedIdsOf = (cv: CVData | null | undefined): string[] => (cv?.dismissedRequirements ?? []).map(r => r.id);

/** The CV with `requirement` dismissed, or put back */
export function withDismissed(cv: CVData, requirement: JobRequirement, dismissed: boolean): CVData {
  const others = (cv.dismissedRequirements ?? []).filter(r => r.id !== requirement.id);
  const { id, label, variants, kind } = requirement;
  return { ...cv, dismissedRequirements: dismissed ? [...others, { id, label, variants, kind }] : others };
}

/**
 * The CV as it prints: a summary sentence, a bullet, an intro, a KPI or a
 * skill writing a dismissed skill, tool, method or domain is left out. A
 * degree, a language, years or a title are facts of the user's own CV:
 * dismissing one only sets the gap aside. Where the generation's text loses
 * everything (the summary loses a sentence, an experience every bullet, an
 * intro), the imported version prints if it does not write it either; a text
 * the user picked or typed keeps what is left of it.
 */
export function withoutDismissed(cv: CVData): CVData {
  // A skill, a tool, a method or a domain: what a generation writes freely, the only texts a dismissal takes out
  const dismissed = (cv.dismissedRequirements ?? []).filter(isWrittenFreely);
  if (dismissed.length === 0) return cv;
  const writes = (text: string | undefined) => Boolean(text?.trim())
    && dismissed.some(r => writesRequirement([prepareText(stripInlineMarkdown(text!))], r));
  const clean = (text: string | undefined) => (writes(text) ? undefined : text);

  const summary = cv.personal_info.summary;
  // A stop followed by a space ends a sentence, never the one inside "Node.js".
  // No lookbehind in client code: a SyntaxError before Safari 16.4 (text.test.ts)
  const sentences = (summary ?? '').replace(/([.!?])\s+/g, '$1\u0000').split('\u0000').filter(sentence => sentence.trim());
  const kept = sentences.filter(sentence => !writes(sentence));
  const summaryVersions = cv.personal_info.versions?.summary;
  const adaptedSummary = summaryVersions && versionOf(summary, summaryVersions) === 'adapted';
  const printedSummary = kept.length === sentences.length
    ? summary
    : (adaptedSummary ? clean(summaryVersions.original) : undefined) ?? kept.join(' ');

  return {
    ...cv,
    personal_info: { ...cv.personal_info, summary: printedSummary },
    experience: cv.experience.map((exp) => {
      // The imported texts stand in for the adapted ones only, never for the user's
      const own = experienceVersionOf(exp) === 'adapted' ? exp.versions?.original : undefined;
      const bullets = exp.description.filter(bullet => !writes(bullet));
      const description = bullets.length === 0 && exp.description.length > 0 && own
        ? own.description.filter(bullet => !writes(bullet))
        : bullets;
      const intro = writes(exp.intro) ? clean(own?.intro) : exp.intro;
      const kpi = writes(exp.kpi) ? '' : exp.kpi;
      const unchanged = intro === exp.intro && kpi === exp.kpi && description.length === exp.description.length
        && description.every((bullet, i) => bullet === exp.description[i]);
      return unchanged ? exp : { ...exp, intro, kpi, description };
    }),
    skills: cv.skills
      .map(cat => ({ ...cat, items: cat.items.filter(item => !writes(item)) }))
      .filter((cat, i) => cat.items.length > 0 || cv.skills[i].items.length === 0),
  };
}

