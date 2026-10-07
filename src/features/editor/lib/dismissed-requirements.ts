import type { CVData, JobRequirement } from '@/src/shared/types';
import { prepareText, stripInlineMarkdown } from '@/src/shared/lib/text';
import { writesRequirement } from './keyword-analysis';

// ─── Requirements the user said they lack (arbitrage of 2026-10-07) ───
// "Je ne l'ai pas" takes the requirement out of the CV, without any AI call.
// The CV keeps its texts: only the CV as it prints, and as it is measured,
// leaves out what writes a dismissed requirement, so "Remettre" loses nothing.

/** The CV with `id` dismissed, or put back */
export function withDismissed(cv: CVData, id: string, dismissed: boolean): CVData {
  const ids = (cv.dismissedRequirements ?? []).filter(other => other !== id);
  return { ...cv, dismissedRequirements: dismissed ? [...ids, id] : ids };
}

/**
 * The CV as it prints: a summary sentence, a bullet, an intro, a KPI or a
 * skill writing a dismissed requirement is left out. A title, a position, a
 * company tag, a degree or a language is a fact of the imported CV: kept. A
 * summary that loses a sentence and an experience that loses every bullet take
 * the imported version when it does not write it either; an intro writing one
 * takes it the same way, or none.
 */
export function withoutDismissed(cv: CVData, requirements: JobRequirement[]): CVData {
  const ids = cv.dismissedRequirements ?? [];
  const dismissed = requirements.filter(r => ids.includes(r.id));
  if (dismissed.length === 0) return cv;
  const writes = (text: string | undefined) => Boolean(text?.trim())
    && dismissed.some(r => writesRequirement([prepareText(stripInlineMarkdown(text!))], r));
  const clean = (text: string | undefined) => (writes(text) ? undefined : text);

  const summary = cv.personal_info.summary;
  // No lookbehind in client code: a SyntaxError before Safari 16.4 (text.test.ts)
  // A stop followed by a space ends a sentence, never the one inside "Node.js"
  const sentences = (summary ?? '').replace(/([.!?])\s+/g, '$1\u0000').split('\u0000').filter(sentence => sentence.trim());
  const kept = sentences.filter(sentence => !writes(sentence));
  const original = cv.personal_info.versions?.summary?.original;
  const printedSummary = kept.length === sentences.length ? summary : clean(original) ?? kept.join(' ');

  return {
    ...cv,
    personal_info: { ...cv.personal_info, summary: printedSummary },
    experience: cv.experience.map((exp) => {
      const bullets = exp.description.filter(bullet => !writes(bullet));
      const own = exp.versions?.original;
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
