// ─── Weak Bullet Detection ───
// Pure utility to flag weak CV bullet points (FR + EN).
// Detects: weak verbs, missing metrics, passive voice, too short, too vague.

import type { Experience } from '@/src/shared/types';

// ─── Types ───

export type WeakBulletIssue =
  | 'weak-verb'
  | 'no-metrics'
  | 'passive-voice'
  | 'too-short'
  | 'too-vague';

export interface WeakBulletResult {
  expIndex: number;
  bulletIndex: number;
  issues: { type: WeakBulletIssue; label: string }[];
}

// ─── Labels (French) ───

const LABELS: Record<WeakBulletIssue, string> = {
  'weak-verb': 'Verbe faible',
  'no-metrics': 'Aucune metrique',
  'passive-voice': 'Voix passive',
  'too-short': 'Trop court',
  'too-vague': 'Trop vague',
};

// ─── Detection patterns ───

const WEAK_VERBS: RegExp[] = [
  /\bresponsable\s+de\b/i,
  /\bresponsible\s+for\b/i,
  /\ben\s+charge\s+de\b/i,
  /\bin\s+charge\s+of\b/i,
  /(?:^|\W)particip[eéè]\s+[aà]/i,
  /\bparticipated\s+in\b/i,
  /(?:^|\W)aid[eéè](?:\W|$)/i,
  /\bhelped\b/i,
  /(?:^|\W)g[eéè]r[eéè]?(?:\W|$)/i,
  /\bmanaged\b/i,
  /(?:^|\W)travaill[eéè]\s+sur/i,
  /\bworked\s+on\b/i,
  /\bhandled\b/i,
  /\bdealt\s+with\b/i,
  /\binvolved\s+in\b/i,
  /\btasked\s+with\b/i,
  /\bassisted\b/i,
];

const PASSIVE_MARKERS: RegExp[] = [
  /(?:^|\W)a\s+[eéè]t[eéè](?:\W|$)/i,
  /(?:^|\W)ont\s+[eéè]t[eéè](?:\W|$)/i,
  /(?:^|\W)[eéè]tait(?:\W|$)/i,
  /(?:^|\W)[eéè]taient(?:\W|$)/i,
  /\bwas\s+done\b/i,
  /\bwere\s+done\b/i,
  /\bhas\s+been\b/i,
  /\bhave\s+been\b/i,
  /\bwas\s+made\b/i,
  /\bwere\s+made\b/i,
];

const VAGUE_TERMS: RegExp[] = [
  /(?:^|\W)diverses\s+t[aâ]ches(?:\W|$)/i,
  /\bvarious\s+tasks\b/i,
  /\betc\./i,
  /(?:^|\W)plusieurs\s+projets(?:\W|$)/i,
  /\bvarious\s+projects\b/i,
];

const HAS_DIGIT = /\d/;
const MIN_LENGTH = 20;

// ─── Internal detection ───

function detectIssues(bullet: string): { type: WeakBulletIssue; label: string }[] {
  const issues: { type: WeakBulletIssue; label: string }[] = [];

  if (bullet.length < MIN_LENGTH) {
    issues.push({ type: 'too-short', label: LABELS['too-short'] });
  }

  if (WEAK_VERBS.some((re) => re.test(bullet))) {
    issues.push({ type: 'weak-verb', label: LABELS['weak-verb'] });
  }

  if (!HAS_DIGIT.test(bullet)) {
    issues.push({ type: 'no-metrics', label: LABELS['no-metrics'] });
  }

  if (PASSIVE_MARKERS.some((re) => re.test(bullet))) {
    issues.push({ type: 'passive-voice', label: LABELS['passive-voice'] });
  }

  if (VAGUE_TERMS.some((re) => re.test(bullet))) {
    issues.push({ type: 'too-vague', label: LABELS['too-vague'] });
  }

  return issues;
}

// ─── Public API ───

/** Analyze all visible experience bullets and return those with issues. */
export function analyzeWeakBullets(experiences: Experience[]): WeakBulletResult[] {
  const results: WeakBulletResult[] = [];

  for (let ei = 0; ei < experiences.length; ei++) {
    const exp = experiences[ei];

    // Skip hidden experiences
    if (exp.displayMode === 'hidden') continue;

    for (let bi = 0; bi < exp.description.length; bi++) {
      const bullet = exp.description[bi];
      const issues = detectIssues(bullet);

      if (issues.length > 0) {
        results.push({ expIndex: ei, bulletIndex: bi, issues });
      }
    }
  }

  return results;
}
