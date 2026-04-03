import type { Experience, ExperienceDisplayMode, SkillCategory, SkillDisplayMode } from '@/src/shared/types';

const EXP_MODES: ExperienceDisplayMode[] = ['extended', 'normal', 'compact', 'hidden'];
const SKILL_MODES: SkillDisplayMode[] = ['normal', 'compact', 'hidden'];

/**
 * Condense one block by one step. Alternates between experiences and skills
 * to keep the CV balanced. Never hides ALL experiences — keeps at least
 * the top priority one visible (compact minimum).
 * 
 * Returns null if nothing can be condensed further.
 */
export function condenseOneStep(
  experiences: Experience[],
  skills: SkillCategory[],
  priorities: number[],
): { experiences: Experience[]; skills: SkillCategory[] } | null {
  
  // Count visible experiences (not hidden)
  const visibleExpCount = experiences.filter(e => (e.displayMode || 'normal') !== 'hidden').length;
  
  // Find the lowest-priority experience that can be condensed
  const expCandidates = experiences
    .map((exp, idx) => {
      const mode = (exp.displayMode || 'normal') as ExperienceDisplayMode;
      const modeIdx = EXP_MODES.indexOf(mode);
      const canCondense = modeIdx >= 0 && modeIdx < EXP_MODES.length - 1;
      // Don't hide the last visible experience
      const wouldHide = EXP_MODES[modeIdx + 1] === 'hidden';
      const blocked = wouldHide && visibleExpCount <= 1;
      return { idx, mode, modeIdx, priority: priorities[idx] ?? 50, canCondense: canCondense && !blocked };
    })
    .filter(e => e.canCondense)
    .sort((a, b) => a.priority - b.priority);

  // Find skills that can be condensed
  const skillCandidates = skills
    .map((cat, idx) => {
      const mode = (cat.displayMode || 'normal') as SkillDisplayMode;
      const modeIdx = SKILL_MODES.indexOf(mode);
      return { idx, mode, modeIdx, canCondense: modeIdx >= 0 && modeIdx < SKILL_MODES.length - 1 };
    })
    .filter(s => s.canCondense);

  // Alternate: condense skills first if there are more normal skills than normal experiences
  // This keeps the CV balanced
  const normalSkills = skillCandidates.filter(s => s.mode === 'normal').length;
  const normalExps = expCandidates.filter(e => e.mode === 'normal' || e.mode === 'extended').length;
  
  const preferSkills = normalSkills > 0 && (normalSkills >= normalExps || expCandidates.length === 0);

  if (preferSkills && skillCandidates.length > 0) {
    // Condense the last skill category (least important by position)
    const target = skillCandidates[skillCandidates.length - 1];
    const nextMode = SKILL_MODES[target.modeIdx + 1];
    const newSkills = skills.map((cat, idx) =>
      idx === target.idx ? { ...cat, displayMode: nextMode } : cat
    );
    return { experiences, skills: newSkills };
  }

  if (expCandidates.length > 0) {
    const target = expCandidates[0]; // lowest priority
    const nextMode = EXP_MODES[target.modeIdx + 1];
    const newExps = experiences.map((exp, idx) =>
      idx === target.idx ? { ...exp, displayMode: nextMode } : exp
    );
    return { experiences: newExps, skills };
  }

  // Try remaining skills
  if (skillCandidates.length > 0) {
    const target = skillCandidates[skillCandidates.length - 1];
    const nextMode = SKILL_MODES[target.modeIdx + 1];
    const newSkills = skills.map((cat, idx) =>
      idx === target.idx ? { ...cat, displayMode: nextMode } : cat
    );
    return { experiences, skills: newSkills };
  }

  return null;
}
