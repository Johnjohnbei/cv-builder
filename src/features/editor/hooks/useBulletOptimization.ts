import { useCallback, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { CVData, Experience } from '@/src/shared/types';

// ─── Types ───

export type RewriteKey = `${number}-${number}`;

export interface BulletRewriteEntry {
  original: string;
  rewritten: string;
}

export interface BulletSuggestionState {
  key: RewriteKey;
  suggestions: string[];
}

interface BulletRef {
  index: number;
  text: string;
  position: string;
  company: string;
}

export interface UseBulletOptimizationDeps {
  cvData: CVData | null;
  setCvData: (updater: (prev: CVData | null) => CVData | null) => void;
  jobDescription: string;
  missingKeywords: string[];
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
  accessCode?: string;
}

export interface UseBulletOptimizationResult {
  pendingRewrites: Map<RewriteKey, BulletRewriteEntry>;
  isOptimizing: boolean;
  integratingKeyword: string | null;
  improvingBulletKey: RewriteKey | null;
  bulletSuggestions: BulletSuggestionState | null;
  optimize: () => Promise<void>;
  acceptRewrite: (key: RewriteKey) => void;
  rejectRewrite: (key: RewriteKey) => void;
  integrateKeyword: (keyword: string, expIndex: number) => Promise<void>;
  requestSuggestions: (key: RewriteKey, bullet: string, exp: Experience) => Promise<void>;
  pickSuggestion: (key: RewriteKey, suggestion: string) => void;
  dismissSuggestions: () => void;
}

// ─── Pure helpers (exported for unit tests) ───

/**
 * Flatten all bullets of all non-hidden experiences into a single indexed list.
 * Returns the flat list + an index map allowing reverse lookup (flat idx → expIdx/bulletIdx).
 */
export function flattenVisibleBullets(experience: Experience[]): {
  bullets: BulletRef[];
  indexMap: Array<{ expIndex: number; bulletIndex: number }>;
} {
  const bullets: BulletRef[] = [];
  const indexMap: Array<{ expIndex: number; bulletIndex: number }> = [];
  let flatIdx = 0;
  for (let ei = 0; ei < experience.length; ei++) {
    const exp = experience[ei];
    if (exp.displayMode === 'hidden') continue;
    for (let bi = 0; bi < exp.description.length; bi++) {
      bullets.push({
        index: flatIdx,
        text: exp.description[bi],
        position: exp.position,
        company: exp.company,
      });
      indexMap.push({ expIndex: ei, bulletIndex: bi });
      flatIdx++;
    }
  }
  return { bullets, indexMap };
}

/**
 * Return a new experience array where the bullet at (expIdx, bulIdx) is replaced
 * with the given rewritten text. Immutable — no mutation of input.
 * Returns the original array unchanged if indices are out of bounds.
 */
export function applyRewriteToCV(
  experience: Experience[],
  expIdx: number,
  bulIdx: number,
  rewritten: string,
): Experience[] {
  if (expIdx < 0 || expIdx >= experience.length) return experience;
  const exp = experience[expIdx];
  if (bulIdx < 0 || bulIdx >= exp.description.length) return experience;
  return experience.map((e, i) => {
    if (i !== expIdx) return e;
    const newDesc = [...e.description];
    newDesc[bulIdx] = rewritten;
    return { ...e, description: newDesc };
  });
}

/** Find the longest bullet index in an experience — used by integrateKeyword for best context. */
function longestBulletIndex(description: string[]): number {
  if (description.length === 0) return -1;
  let bestIdx = 0;
  for (let i = 1; i < description.length; i++) {
    if (description[i].length > description[bestIdx].length) bestIdx = i;
  }
  return bestIdx;
}

// ─── Hook ───

/**
 * Owns bullet optimization state for the editor.
 * Covers:
 *   - Batch rewrite via rewriteBulletsForJob (ATS panel CTA)
 *   - Per-keyword integration via improveBulletPoint (ATS panel per-kw button)
 *   - Inline per-bullet suggestions picker (Sparkles button on each bullet)
 */
export function useBulletOptimization(
  deps: UseBulletOptimizationDeps,
): UseBulletOptimizationResult {
  const { cvData, setCvData, jobDescription, missingKeywords, notify, accessCode } = deps;
  const rewriteBulletsAction = useAction(api.ai.rewriteBulletsForJob);
  const improveBulletAction = useAction(api.ai.improveBulletPoint);

  const [pendingRewrites, setPendingRewrites] = useState<Map<RewriteKey, BulletRewriteEntry>>(
    new Map(),
  );
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [integratingKeyword, setIntegratingKeyword] = useState<string | null>(null);
  const [improvingBulletKey, setImprovingBulletKey] = useState<RewriteKey | null>(null);
  const [bulletSuggestions, setBulletSuggestions] = useState<BulletSuggestionState | null>(null);

  const optimize = useCallback(async () => {
    if (!cvData || !jobDescription) return;
    setIsOptimizing(true);
    try {
      const { bullets, indexMap } = flattenVisibleBullets(cvData.experience);
      const data = await rewriteBulletsAction({
        bullets,
        jobDescription,
        missingKeywords,
        accessCode,
      });
      const next = new Map<RewriteKey, BulletRewriteEntry>();
      for (const rw of data.rewrites) {
        const mapping = indexMap[rw.index];
        if (mapping) {
          next.set(`${mapping.expIndex}-${mapping.bulletIndex}` as RewriteKey, {
            original: rw.original,
            rewritten: rw.rewritten,
          });
        }
      }
      setPendingRewrites(next);
      notify({ message: `${next.size} bullet(s) optimisé(s)`, type: 'success' });
    } catch {
      notify({ message: "Erreur lors de l'optimisation", type: 'error' });
    } finally {
      setIsOptimizing(false);
    }
  }, [cvData, jobDescription, missingKeywords, rewriteBulletsAction, accessCode, notify]);

  const acceptRewrite = useCallback(
    (key: RewriteKey) => {
      const entry = pendingRewrites.get(key);
      if (!entry || !cvData) return;
      const [expIdx, bulIdx] = key.split('-').map(Number);
      const newExp = applyRewriteToCV(cvData.experience, expIdx, bulIdx, entry.rewritten);
      setCvData(prev => (prev ? { ...prev, experience: newExp } : null));
      setPendingRewrites(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
    [pendingRewrites, cvData, setCvData],
  );

  const rejectRewrite = useCallback((key: RewriteKey) => {
    setPendingRewrites(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const integrateKeyword = useCallback(
    async (keyword: string, expIndex: number) => {
      if (!cvData || !jobDescription) return;
      const exp = cvData.experience[expIndex];
      if (!exp || exp.description.length === 0) return;

      setIntegratingKeyword(keyword);
      try {
        const bestIdx = longestBulletIndex(exp.description);
        const data = await improveBulletAction({
          bullet: exp.description[bestIdx],
          position: exp.position,
          company: exp.company,
          jobDescription,
          missingKeywords: [keyword],
          accessCode,
        });

        const firstSuggestion = data.suggestions?.[0];
        if (firstSuggestion) {
          const rewriteKey: RewriteKey = `${expIndex}-${bestIdx}`;
          setPendingRewrites(prev => {
            const next = new Map(prev);
            next.set(rewriteKey, {
              original: exp.description[bestIdx],
              rewritten: firstSuggestion,
            });
            return next;
          });
          notify({
            message: `"${keyword}" intégré dans ${exp.position} — vérifiez la suggestion`,
            type: 'success',
          });
        }
      } catch {
        notify({ message: `Erreur lors de l'intégration de "${keyword}"`, type: 'error' });
      } finally {
        setIntegratingKeyword(null);
      }
    },
    [cvData, jobDescription, improveBulletAction, accessCode, notify],
  );

  const requestSuggestions = useCallback(
    async (key: RewriteKey, bullet: string, exp: Experience) => {
      setImprovingBulletKey(key);
      setBulletSuggestions(null);
      try {
        const result = await improveBulletAction({
          bullet,
          position: exp.position,
          company: exp.company,
          jobDescription: jobDescription || undefined,
          missingKeywords,
          accessCode,
        });
        setBulletSuggestions({ key, suggestions: result.suggestions ?? [] });
      } catch {
        // Silent — the picker just won't open, matches original behavior
      } finally {
        setImprovingBulletKey(null);
      }
    },
    [improveBulletAction, jobDescription, missingKeywords, accessCode],
  );

  const pickSuggestion = useCallback(
    (key: RewriteKey, suggestion: string) => {
      if (!cvData) return;
      const [expIdx, bulIdx] = key.split('-').map(Number);
      const newExp = applyRewriteToCV(cvData.experience, expIdx, bulIdx, suggestion);
      setCvData(prev => (prev ? { ...prev, experience: newExp } : null));
      setBulletSuggestions(null);
    },
    [cvData, setCvData],
  );

  const dismissSuggestions = useCallback(() => {
    setBulletSuggestions(null);
  }, []);

  return {
    pendingRewrites,
    isOptimizing,
    integratingKeyword,
    improvingBulletKey,
    bulletSuggestions,
    optimize,
    acceptRewrite,
    rejectRewrite,
    integrateKeyword,
    requestSuggestions,
    pickSuggestion,
    dismissSuggestions,
  };
}
