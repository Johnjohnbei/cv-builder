import type { CVData, Experience } from '@/src/shared/types';

// ─── Editing the CV where it is read (arbitrage of 2026-11-06) ───
// A defect the code cannot fix without inventing is changed in the preview,
// at the place it shows, instead of hunting for the field in the sidebar.
// This module is the only owner of that write: the preview never edits the
// rendered text, it names a target here and the CV data changes, so the fit
// pass and the pagination keep measuring the same source.

/**
 * What a click in the preview designates in `cvData`.
 *
 * An experience keeps its place in the printed CV (`withoutDismissed` maps the
 * array, it never filters it), so its index is enough. A bullet and a skill
 * carry the text they showed instead: a dismissed requirement can take one out
 * of what prints, so the printed position is not the stored position.
 */
export type EditTarget =
  | { kind: 'title' }
  | { kind: 'summary' }
  | { kind: 'position'; experience: number }
  | { kind: 'company'; experience: number }
  | { kind: 'intro'; experience: number }
  | { kind: 'kpi'; experience: number }
  | { kind: 'bullet'; experience: number; was: string }
  | { kind: 'skill'; category: string; was: string };

/** Passed down to the block renderers: without it, nothing in the preview is editable */
export interface InPlaceEditing {
  /** Writes `text` where `target` points */
  onEdit: (target: EditTarget, text: string) => void;
}

const withExperience = (cv: CVData, index: number, change: (exp: Experience) => Experience): CVData => ({
  ...cv,
  experience: cv.experience.map((exp, i) => (i === index ? change(exp) : exp)),
});

/**
 * `was` replaced by `text` in a printed list.
 *
 * The printed list is normally a subset of the stored one, so the old text is
 * found as it stands. It is not when the printed text came from the imported
 * version of the experience (every current bullet written off by a dismissal):
 * the edit is then added rather than dropped, because what the user typed is
 * never lost.
 */
function replaceText(list: string[], was: string, text: string): string[] {
  const at = list.findIndex(item => item === was);
  const loose = at === -1 ? list.findIndex(item => item.trim() === was.trim()) : at;
  if (loose === -1) return text ? [...list, text] : list;
  return text ? list.map((item, i) => (i === loose ? text : item)) : list.filter((_, i) => i !== loose);
}

/**
 * The CV with the edited text written where `target` points. An unchanged text
 * returns the very same object, so the caller can tell nothing happened (no
 * undo entry, no auto-save).
 */
export function applyEdit(cv: CVData, target: EditTarget, text: string): CVData {
  const value = text.trim();
  switch (target.kind) {
    case 'title':
    case 'summary': {
      if ((cv.personal_info[target.kind] ?? '') === value) return cv;
      return { ...cv, personal_info: { ...cv.personal_info, [target.kind]: value } };
    }
    case 'position':
    case 'company':
    case 'intro':
    case 'kpi': {
      const exp = cv.experience[target.experience];
      if (!exp || (exp[target.kind] ?? '') === value) return cv;
      return withExperience(cv, target.experience, x => ({ ...x, [target.kind]: value }));
    }
    case 'bullet': {
      const exp = cv.experience[target.experience];
      if (!exp || target.was === value) return cv;
      const description = replaceText(exp.description ?? [], target.was, value);
      return withExperience(cv, target.experience, x => ({ ...x, description }));
    }
    case 'skill': {
      if (target.was === value) return cv;
      const cat = cv.skills?.find(c => c.category === target.category);
      if (!cat) return cv;
      return {
        ...cv,
        skills: cv.skills.map(c => (c.category === target.category ? { ...c, items: replaceText(c.items, target.was, value) } : c)),
      };
    }
  }
}
