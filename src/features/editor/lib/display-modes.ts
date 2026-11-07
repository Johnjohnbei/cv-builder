import type { Experience, ExperienceDisplayMode, SkillCategory, SkillDisplayMode } from '@/src/shared/types';

/**
 * A text with something in it. "Ajouter un point" and "Ajouter une
 * compétence" leave an empty field for the user to type in, and an empty
 * field is a bullet dot or a chip with nothing beside it in the preview and in
 * the exported PDF. The field stays in the sidebar, it just does not print.
 */
const written = (text: string) => text.trim().length > 0;

/**
 * Returns the action bullet points for an experience based on displayMode.
 * The intro text is always shown separately (not included here).
 * compact: 0 bullets (intro only)
 * normal: 2 bullets
 * extended: up to 4 bullets
 */
export function getVisibleBullets(exp: Experience): string[] {
  const mode = getMode(exp);
  const desc = (exp.description || []).filter(written);
  
  switch (mode) {
    case 'hidden': return [];
    case 'compact': return [];  // intro only, no bullets
    case 'normal': return desc.slice(0, 2);
    case 'extended': return desc.slice(0, 4);
    default: return desc.slice(0, 2);
  }
}

/**
 * Returns the intro text for an experience.
 * Falls back to first description item if no dedicated intro field.
 */
export function getIntro(exp: Experience): string | null {
  if (exp.intro?.trim()) return exp.intro;
  // Fallback: use first description as intro if no dedicated field
  return (exp.description || []).filter(written)[0] || null;
}

/**
 * Returns bullets EXCLUDING the intro (when intro comes from description[0]).
 */
export function getActionBullets(exp: Experience): string[] {
  const mode = getMode(exp);
  if (mode === 'hidden') return [];
  
  // If there's a dedicated intro, all description items are action bullets
  const writtenBullets = (exp.description || []).filter(written);
  const bullets = exp.intro?.trim() ? writtenBullets : writtenBullets.slice(1);
  
  switch (mode) {
    case 'compact': return [];  // no action bullets
    case 'normal': return bullets.slice(0, 2);
    case 'extended': return bullets.slice(0, 4);
    default: return bullets.slice(0, 2);
  }
}

export function shouldShowKPI(exp: Experience): boolean {
  // No KPI content → nothing to show
  if (!exp.kpi?.trim()) return false;
  // Explicit per-experience override wins over default
  if (exp.showKpi === true) return true;
  if (exp.showKpi === false) return false;
  // Default: visible only when displayMode is 'extended'
  return getMode(exp) === 'extended';
}

export function isCompact(exp: Experience): boolean {
  return getMode(exp) === 'compact';
}

export function isHidden(exp: Experience): boolean {
  return getMode(exp) === 'hidden';
}

function getMode(exp: Experience): ExperienceDisplayMode {
  return exp.displayMode || 'normal';
}

/** All available display modes for experiences */
// Colors double as active-button background (white text on top) and as the
// mode label color, so each must clear WCAG AA both ways. 'hidden' takes
// gray-600 rather than gray-500 to stay distinct from 'normal'.
// Measured 2026-11-07: #f59e0b carried white at 2.15:1 and #10b981 at 2.54:1,
// both under 4.5:1, and the same hues read the label on a gray-50 card at
// 2.06:1 and 2.43:1. Darkened to 4.99:1 and 5.10:1 against white.
export const DISPLAY_MODES: { value: ExperienceDisplayMode; label: string; icon: string; color: string }[] = [
  { value: 'hidden', label: 'Masqué', icon: '⊘', color: '#4b5563' },
  { value: 'compact', label: 'Compact', icon: '▪', color: '#b45309' },
  { value: 'normal', label: 'Normal', icon: '▪▪', color: '#6b7280' },
  { value: 'extended', label: 'Étendu', icon: '▪▪▪', color: '#047857' },
];

// ─── Skills display modes ───

export function getSkillMode(cat: SkillCategory): SkillDisplayMode {
  return cat.displayMode || 'normal';
}

export function isSkillHidden(cat: SkillCategory): boolean {
  return getSkillMode(cat) === 'hidden';
}

/** In compact mode, show only the category name, no individual items */
export function getVisibleSkills(cat: SkillCategory): string[] {
  const mode = getSkillMode(cat);
  if (mode === 'hidden') return [];
  const items = cat.items.filter(written);
  if (mode === 'compact') return items.slice(0, 3);
  return items; // normal: all
}

export const SKILL_DISPLAY_MODES: { value: SkillDisplayMode; label: string; icon: string; color: string }[] = [
  { value: 'hidden', label: 'Masqué', icon: '⊘', color: '#4b5563' },
  { value: 'compact', label: 'Top 3', icon: '▪', color: '#b45309' },
  { value: 'normal', label: 'Tout', icon: '▪▪', color: '#6b7280' },
];
