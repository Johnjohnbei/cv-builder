import { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { ContentBlock, PageAssignment } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages, isPageOverfilled } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';
import { blocksStable, readLiveDOM, reconcileBlocks } from '../lib/pagination/reconcile';
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
  /** Measured heights have converged — the page count can be trusted */
  const [isStable, setIsStable] = useState(false);
  const lastContentKeyRef = useRef('');

  useEffect(() => {
    if (lastContentKeyRef.current === contentKey) return;
    lastContentKeyRef.current = contentKey;
    iterCountRef.current = 0;
    setReconciledBlocks(null);
    setSectionTitles({});
    setIsStable(false);
  }, [contentKey]);

  // A keystroke that leaves the estimates unchanged keeps contentKey: carry the
  // new data over, keep the measured heights, and measure again, since the real
  // wrap can differ (a block that grew a line used to be clipped).
  useEffect(() => {
    if (!reconciledBlocks) return;
    const dataById = new Map(heuristicBlocks.map(b => [b.id, b.data]));
    const isOutdated = (b: ContentBlock) => {
      const data = dataById.get(b.id);
      return data !== undefined && data !== b.data;
    };
    if (!reconciledBlocks.some(isOutdated)) return;
    iterCountRef.current = 0;
    setIsStable(false);
    setReconciledBlocks(reconciledBlocks.map(b => (isOutdated(b) ? { ...b, data: dataById.get(b.id)! } : b)));
  }, [heuristicBlocks, reconciledBlocks]);

  const activeBlocks = reconciledBlocks ?? heuristicBlocks;

  const pageAssignments = useMemo(() => {
    if (activeBlocks.length === 0) return [];
    return allocatePages(activeBlocks, layout, { sectionTitleHeights: sectionTitles });
  }, [activeBlocks, layout, sectionTitles]);

  // Read live heights synchronously after commit, before paint: offsetHeight is
  // valid and no rAF can be cancelled by effects firing in rapid succession.
  useLayoutEffect(() => {
    if (pageAssignments.length === 0) return;
    if (iterCountRef.current >= MAX_RECONCILE_ITERS) {
      setIsStable(true);
      return;
    }

    const live = readLiveDOM();
    if (!live || live.blockHeights.size === 0) return;

    const nextBlocks = reconcileBlocks(activeBlocks, live, pageAssignments);
    const heightsStable = blocksStable(nextBlocks, activeBlocks);
    const titlesStable =
      live.sectionTitles.experience === sectionTitles.experience
      && live.sectionTitles.skills === sectionTitles.skills;

    if (heightsStable && titlesStable) {
      iterCountRef.current = MAX_RECONCILE_ITERS;
      setIsStable(true);
      return;
    }

    iterCountRef.current += 1;
    if (!heightsStable) setReconciledBlocks(nextBlocks);
    if (!titlesStable) setSectionTitles(live.sectionTitles);
  }, [pageAssignments, activeBlocks, sectionTitles]);

  // Computed during render: right after a content change `isStable` still holds
  // the previous content's verdict, and an effect clearing it runs too late.
  const measuringCurrentContent = lastContentKeyRef.current !== contentKey;
  const stablePageCount = isStable && !measuringCurrentContent ? pageAssignments.length : null;

  const hasClippedContent = useMemo(
    () => pageAssignments.some(page => isPageOverfilled(page, layout)),
    [pageAssignments, layout],
  );

  return { pageAssignments, actualPageCount: pageAssignments.length, stablePageCount, hasClippedContent };
}
