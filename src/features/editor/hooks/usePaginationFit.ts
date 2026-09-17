import { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { ContentBlock, PageAssignment } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages, isPageOverfilled } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';
import { blocksStable, carryOver, readLiveDOM, reconcileBlocks } from '../lib/pagination/reconcile';
import { getCVLanguage } from '@/src/lib/languageDetection';

/**
 * Max reconcile iterations per content change. Convergence is typically
 * reached in 3: heuristic render then measure, allocation with the measured
 * heights then measure again (blocks move between pages, a split changes what
 * is measured), then a stable allocation. 5 leaves headroom without letting
 * an oscillation run unbounded.
 */
const MAX_RECONCILE_ITERS = 5;

/**
 * Pagination pipeline, reconciled from the live DOM: first paint on the
 * buildBlocks() estimates, then the real heights of every [data-live-block]
 * and [data-live-title] (reconcile.ts) fed back into allocatePages until they
 * stabilize. No safety padding: every height comes from what the browser laid out.
 */
export function usePaginationFit(
  cvData: CVData | null,
  designSettings: DesignSettings,
  selectedTemplate: string,
  /** The painted header is masked when true: its height differs from the real one */
  isAnonymous = false,
): {
  pageAssignments: PageAssignment[];
  actualPageCount: number;
  /**
   * Page count once measured heights have converged for the CURRENT content,
   * null while a measurement pass is still running. Anything that feeds back
   * into the content (the fit-to-pages loop) must read this: mid-reconcile the
   * count can be off by a page.
   */
  stablePageCount: number | null;
  /** A block taller than a page is cut at the page edge: the user must shorten it */
  hasClippedContent: boolean;
} {
  const layout = useMemo(() => getTemplateLayout(selectedTemplate), [selectedTemplate]);

  const includedSections = designSettings.includedSections;
  const heuristicBlocks = useMemo(
    () => (cvData ? buildBlocks(cvData, includedSections) : []),
    [cvData, includedSections],
  );

  // Fingerprint of everything that changes the rendered heights: any change
  // resets the loop. Photo, language and anonymization change what is painted
  // without touching the estimates: left out, turning the photo on clipped the
  // last block of page 1 in the preview and the PDF.
  const language = cvData ? getCVLanguage(cvData) : 'fr';
  const contentKey = useMemo(
    () => heuristicBlocks.map(b => `${b.id}:${b.heightPx}`).join('|')
      + `|${selectedTemplate}|${designSettings.fontFamily}|${designSettings.showPhoto}`
      + `|${language}|${isAnonymous}`,
    [heuristicBlocks, selectedTemplate, designSettings.fontFamily, designSettings.showPhoto, language, isAnonymous],
  );

  /** Reconciled blocks: live-measured heights, fed back into allocation */
  const [reconciledBlocks, setReconciledBlocks] = useState<ContentBlock[] | null>(null);
  /** Live-measured section title heights (feeds allocatePages) */
  const [sectionTitles, setSectionTitles] = useState<{ experience?: number; skills?: number }>({});
  const iterCountRef = useRef(0);
  /**
   * The blocks whose measured heights converged: the page count holds for them
   * only. A boolean kept the previous verdict for a render, and the fit loop
   * condensed again on that stale count, down to one page.
   */
  const [stableFor, setStableFor] = useState<ContentBlock[] | null>(null);
  const lastContentKeyRef = useRef('');
  /** The blocks the last measuring pass read: a capped pass only stands for them */
  const measuredForRef = useRef<ContentBlock[] | null>(null);

  // One effect for both cases (carryOver): as two effects, the second ran in
  // the same pass on the list the first had just cleared, and put it back. A
  // keystroke that leaves the estimates unchanged keeps the measured heights
  // and measures again, since the real wrap can differ.
  useEffect(() => {
    const estimatesChanged = lastContentKeyRef.current !== contentKey;
    lastContentKeyRef.current = contentKey;
    const next = carryOver(reconciledBlocks, estimatesChanged, heuristicBlocks);
    if (estimatesChanged) setSectionTitles({});
    if (!next.remeasure) {
      // Same data in every block: the verdict holds for these blocks too
      if (next.blocks) setStableFor(current => (current ? heuristicBlocks : current));
      return;
    }
    iterCountRef.current = 0;
    setStableFor(null);
    setReconciledBlocks(next.blocks);
  }, [contentKey, heuristicBlocks, reconciledBlocks]);

  const activeBlocks = reconciledBlocks ?? heuristicBlocks;

  const pageAssignments = useMemo(() => {
    if (activeBlocks.length === 0) return [];
    return allocatePages(activeBlocks, layout, { sectionTitleHeights: sectionTitles });
  }, [activeBlocks, layout, sectionTitles]);

  // Read live heights synchronously after commit, before paint: offsetHeight is
  // valid and no rAF can be cancelled by effects firing in rapid succession.
  useLayoutEffect(() => {
    if (pageAssignments.length === 0) return;
    // Blocks never measured are measured, whatever a pass concluded for others
    if (measuredForRef.current !== heuristicBlocks) iterCountRef.current = 0;
    if (iterCountRef.current >= MAX_RECONCILE_ITERS) {
      setStableFor(heuristicBlocks);
      return;
    }
    measuredForRef.current = heuristicBlocks;

    const live = readLiveDOM();
    if (!live || live.blockHeights.size === 0) return;

    const nextBlocks = reconcileBlocks(activeBlocks, live, pageAssignments);
    const heightsStable = blocksStable(nextBlocks, activeBlocks);
    const titlesStable =
      live.sectionTitles.experience === sectionTitles.experience
      && live.sectionTitles.skills === sectionTitles.skills;

    if (heightsStable && titlesStable) {
      iterCountRef.current = MAX_RECONCILE_ITERS;
      setStableFor(heuristicBlocks);
      return;
    }

    iterCountRef.current += 1;
    if (!heightsStable) setReconciledBlocks(nextBlocks);
    if (!titlesStable) setSectionTitles(live.sectionTitles);
    // heuristicBlocks is read, never a trigger: a content change arrives through
    // the blocks reconciled, once they carry the new data
  }, [pageAssignments, activeBlocks, sectionTitles]);

  // Computed during render: right after a content change the verdict still
  // names the previous content, and an effect clearing it runs too late.
  const measuringCurrentContent = lastContentKeyRef.current !== contentKey;
  const stablePageCount = stableFor === heuristicBlocks && !measuringCurrentContent ? pageAssignments.length : null;

  const hasClippedContent = useMemo(
    () => pageAssignments.some(page => isPageOverfilled(page, layout)),
    [pageAssignments, layout],
  );

  return { pageAssignments, actualPageCount: pageAssignments.length, stablePageCount, hasClippedContent };
}
