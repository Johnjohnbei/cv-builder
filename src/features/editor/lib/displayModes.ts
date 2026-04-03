import type { Experience, ExperienceDisplayMode, SkillCategory, SkillDisplayMode } from '@/src/shared/types';

/**
 * Returns the action bullet points for an experience based on displayMode.
 * The intro text is always shown separately (not included here).
 * compact: 0 bullets (intro only)
 * normal: 2 bullets
 * extended: up to 4 bullets
 */
export function getVisibleBullets(exp: Experience): string[] {
  const mode = getMode(exp);
  const desc = exp.description || [];
  
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
  if (exp.intro) return exp.intro;
  // Fallback: use first description as intro if no dedicated field
  return exp.description?.[0] || null;
}

/**
 * Returns bullets EXCLUDING the intro (when intro comes from description[0]).
 */
export function getActionBullets(exp: Experience): string[] {
  const mode = getMode(exp);
  if (mode === 'hidden') return [];
  
  // If there's a dedicated intro, all description items are action bullets
  const bullets = exp.intro ? (exp.description || []) : (exp.description || []).slice(1);
  
  switch (mode) {
    case 'compact': return [];  // no action bullets
    case 'normal': return bullets.slice(0, 2);
    case 'extended': return bullets.slice(0, 4);
    default: return bullets.slice(0, 2);
  }
}

export function shouldShowKPI(exp: Experience): boolean {
  return getMode(exp) === 'extended' && !!exp.kpi;
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
export const DISPLAY_MODES: { value: ExperienceDisplayMode; label: string; icon: string; color: string }[] = [
  { value: 'hidden', label: 'Masqué', icon: '⊘', color: '#9ca3af' },
  { value: 'compact', label: 'Compact', icon: '▪', color: '#f59e0b' },
  { value: 'normal', label: 'Normal', icon: '▪▪', color: '#6b7280' },
  { value: 'extended', label: 'Étendu', icon: '▪▪▪', color: '#10b981' },
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
  if (mode === 'compact') return cat.items.slice(0, 3);
  return cat.items; // normal: all
}

export const SKILL_DISPLAY_MODES: { value: SkillDisplayMode; label: string; icon: string; color: string }[] = [
  { value: 'hidden', label: 'Masqué', icon: '⊘', color: '#9ca3af' },
  { value: 'compact', label: 'Top 3', icon: '▪', color: '#f59e0b' },
  { value: 'normal', label: 'Tout', icon: '▪▪', color: '#6b7280' },
];
