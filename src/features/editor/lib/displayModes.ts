import type { Experience, ExperienceDisplayMode, SkillCategory, SkillDisplayMode } from '@/src/shared/types';

/**
 * Pure logic: returns the visible bullets for an experience based on its displayMode.
 * hidden: nothing rendered
 * compact: 1 bullet (summary line)
 * normal: 2 bullets (key actions)
 * extended: up to 5 bullets (detailed + KPI)
 */
export function getVisibleBullets(exp: Experience): string[] {
  const mode = getMode(exp);
  const desc = exp.description || [];
  
  switch (mode) {
    case 'hidden': return [];
    case 'compact': return desc.slice(0, 1);
    case 'normal': return desc.slice(0, 2);
    case 'extended': return desc.slice(0, 5);
    default: return desc.slice(0, 2);
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
