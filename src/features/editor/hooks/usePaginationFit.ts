import { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { ContentBlock, PageAssignment, PlacedBlock, SubBlock, SubBlockType } from '../lib/pagination/types';
import { MEASUREMENT_SAFETY_PX } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';

/**
 * Pagination pipeline — reconcile-from-live-DOM.
 *
 * Architecture (systematic, no magic constants):
 *
 * 1. Initial render uses buildBlocks() heuristic heights (instant first paint).
 * 2. After paint, read REAL heights from the live [data-cv-root] DOM tree —
 *    each rendered block is tagged with [data-live-block="{id}"] and each
 *    injected section title with [data-live-title="{name}"]. We measure each
 *    in its actual CSS context (real font, real width, real padding, real gaps).
 * 3. Feed those reconciled heights back into allocatePages and re-render.
 * 4. Iterate until heights stabilize or MAX_RECONCILE_ITERS reached.
 *
 * No safety padding, no magic SECTION_TITLE constants — every height comes
 * from what the browser actually laid out.
 */

/**
 * Max reconcile iterations per content change. Convergence is typically
 * reached in 3 iterations:
 *   iter 0: heuristic → render → reconcile measured heights
 *   iter 1: alloc with measured → render → reconcile again (blocks may move
 *           between contexts, e.g. narrow ↔ full-width, causing height shifts)
 *   iter 2: allocation stabilizes — reconcile matches previous → stable
 * A ceiling of 5 gives safe headroom without letting pathological oscillation
 * loops run unbounded.
 */
const MAX_RECONCILE_ITERS = 5;
/** Ignore sub-pixel drift below this threshold when checking stability */
const HEIGHT_DIFF_THRESHOLD_PX = 1;

interface LiveMeasurements {
  /** Per-block measured heights (offsetHeight in its rendered context) */
  blockHeights: Map<string, number>;
  /** Per-block sub-block heights for splittable blocks */
  blockSubBlocks: Map<string, SubBlock[]>;
  /** Measured section-title heights (experience + skills), if present */
  sectionTitles: { experience?: number; skills?: number };
}

/** Read all live heights from the unified CV DOM tree. Null if not yet rendered. */
function readLiveDOM(): LiveMeasurements | null {
  const cvRoot = document.querySelector('[data-cv-root]');
  if (!cvRoot) return null;

  const blockHeights = new Map<string, number>();
  const blockSubBlocks = new Map<string, SubBlock[]>();

  const blockEls = cvRoot.querySelectorAll('[data-live-block]') as NodeListOf<HTMLElement>;
  blockEls.forEach(el => {
    const id = el.getAttribute('data-live-block');
    if (!id) return;
    blockHeights.set(id, el.offsetHeight);

    // Read sub-blocks from within this block
    const subEls = el.querySelectorAll('[data-sub-id]') as NodeListOf<HTMLElement>;
    if (subEls.length > 0) {
      const subs = Array.from(subEls).map(subEl => ({
        id: subEl.getAttribute('data-sub-id') || '',
        heightPx: subEl.offsetHeight,
        type: (subEl.getAttribute('data-sub-type') || 'bullet') as SubBlockType,
      }));
      blockSubBlocks.set(id, subs);
    }
  });

  const sectionTitles: { experience?: number; skills?: number } = {};
  const expTitleEl = cvRoot.querySelector('[data-live-title="experience"]') as HTMLElement | null;
  if (expTitleEl) sectionTitles.experience = expTitleEl.offsetHeight;
  const skillsTitleEl = cvRoot.querySelector('[data-live-title="skills"]') as HTMLElement | null;
  if (skillsTitleEl) sectionTitles.skills = skillsTitleEl.offsetHeight;

  return { blockHeights, blockSubBlocks, sectionTitles };
}

/**
 * Apply live measurements to source blocks. Returns new array (immutable).
 *
 * Context-aware to prevent oscillation. A single block can be rendered in
 * multiple CSS contexts across iterations (page 0 narrow main column,
 * page 0 narrow sidebar, page 2+ full-width). Its offsetHeight differs
 * by context because text wraps at different widths. ContentBlock stores
 * TWO heights to match:
 *   - block.heightPx          = narrow (page 0) context
 *   - block.fullWidthHeightPx = page 2+ full-width context
 *
 * Reconcile writes to the field matching the block's CURRENT placement so
 * each field only ever captures its own context. Over iterations both fields
 * get accurate values for blocks that move between contexts.
 *
 * Split blocks (startSubBlock/endSubBlock defined) are partial renders —
 * their offsetHeight doesn't represent the full block. For those, we update
 * individual sub-block heights (atomic) instead of the total.
 */
function reconcileBlocks(
  source: ContentBlock[],
  live: LiveMeasurements,
  pageAssignments: PageAssignment[],
): ContentBlock[] {
  // Build a map: block.id → { placed block, pageIndex }
  interface Placement { placed: PlacedBlock; pageIndex: number }
  const placements = new Map<string, Placement>();
  pageAssignments.forEach(page => {
    page.blocks.forEach(pb => placements.set(pb.block.id, { placed: pb, pageIndex: page.pageIndex }));
    page.sidebarBlocks?.forEach(pb => placements.set(pb.block.id, { placed: pb, pageIndex: page.pageIndex }));
  });

  return source.map(block => {
    const liveH = live.blockHeights.get(block.id);
    if (liveH === undefined) return block;

    const info = placements.get(block.id);
    if (!info) return block;

    const wasSplit = info.placed.startSubBlock !== undefined;
    const isNarrowContext = info.pageIndex === 0; // page 0 → narrow (main or sidebar column)
    const liveSubs = live.blockSubBlocks.get(block.id);

    if (wasSplit) {
      // Partial render — don't trust offsetHeight as full block height, but do
      // merge live sub-block heights (the rendered subset) and compute a new
      // total from sum of all sub-blocks. This lets heightPx progressively
      // converge toward the true full-block height across iterations, even
      // though no single render ever shows all sub-blocks at once.
      if (!liveSubs || liveSubs.length === 0 || !block.subBlocks) return block;
      const liveMap = new Map(liveSubs.map(s => [s.id, s.heightPx]));
      const mergedSubs = block.subBlocks.map(sb => ({
        ...sb,
        heightPx: liveMap.get(sb.id) ?? sb.heightPx,
      }));
      const subTotal = mergedSubs.reduce((acc, s) => acc + s.heightPx, 0) + MEASUREMENT_SAFETY_PX;
      // Only update narrow heightPx; sub-blocks are narrow-context measurements
      // (splits happen against page 0 main column budget)
      return isNarrowContext
        ? { ...block, subBlocks: mergedSubs, heightPx: subTotal }
        : { ...block, subBlocks: mergedSubs };
    }

    // Full render — write to the field matching the rendering context
    if (isNarrowContext) {
      return {
        ...block,
        heightPx: liveH,
        subBlocks: liveSubs ?? block.subBlocks,
      };
    }
    // Full-width context (page 2+): update fullWidthHeightPx only.
    // Don't touch sub-blocks — their heights at full-width differ from narrow
    // context, and splitBlock needs narrow-context sub-block heights.
    return {
      ...block,
      fullWidthHeightPx: liveH,
    };
  });
}

/**
 * Compare both heightPx AND fullWidthHeightPx for stability.
 * The reconcile loop can update either field depending on placement context.
 */
function blocksStable(a: ContentBlock[], b: ContentBlock[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].heightPx - b[i].heightPx) > HEIGHT_DIFF_THRESHOLD_PX) return false;
    if (Math.abs(a[i].fullWidthHeightPx - b[i].fullWidthHeightPx) > HEIGHT_DIFF_THRESHOLD_PX) return false;
  }
  return true;
}

export function usePaginationFit(
  cvData: CVData | null,
  designSettings: DesignSettings,
  selectedTemplate: string,
): {
  pageAssignments: PageAssignment[];
  actualPageCount: number;
} {
  const layout = useMemo(() => getTemplateLayout(selectedTemplate), [selectedTemplate]);

  const heuristicBlocks = useMemo(() => {
    if (!cvData) return [];
    return buildBlocks(cvData);
  }, [cvData]);

  /** Content fingerprint — any change resets the reconcile loop */
  const contentKey = useMemo(
    () => heuristicBlocks.map(b => `${b.id}:${b.heightPx}`).join('|')
      + `|${selectedTemplate}|${designSettings.fontFamily}`,
    [heuristicBlocks, selectedTemplate, designSettings.fontFamily],
  );

  /** Reconciled blocks: live-measured heights, fed back into allocation */
  const [reconciledBlocks, setReconciledBlocks] = useState<ContentBlock[] | null>(null);
  /** Live-measured section title heights (feeds allocatePages) */
  const [sectionTitles, setSectionTitles] = useState<{ experience?: number; skills?: number }>({});
  /** Iteration counter (bounded, reset per content change) */
  const iterCountRef = useRef(0);
  /** Last content key we processed — used to detect content changes */
  const lastContentKeyRef = useRef('');

  // Reset reconciliation state whenever content changes
  useEffect(() => {
    if (lastContentKeyRef.current === contentKey) return;
    lastContentKeyRef.current = contentKey;
    iterCountRef.current = 0;
    setReconciledBlocks(null);
    setSectionTitles({});
  }, [contentKey]);

  // When cvData changes without altering estimated heights (same line count),
  // contentKey stays identical and reconciledBlocks would serve stale data.
  // Propagate the latest data fields while preserving measured heights.
  useEffect(() => {
    setReconciledBlocks(prev => {
      if (!prev) return prev;
      const dataById = new Map(heuristicBlocks.map(b => [b.id, b.data]));
      let changed = false;
      const next = prev.map(b => {
        const newData = dataById.get(b.id);
        if (newData !== undefined && newData !== b.data) {
          changed = true;
          return { ...b, data: newData };
        }
        return b;
      });
      return changed ? next : prev;
    });
  }, [heuristicBlocks]);

  /** Blocks used for allocation: reconciled if available, else heuristic */
  const activeBlocks = reconciledBlocks ?? heuristicBlocks;

  const pageAssignments = useMemo(() => {
    if (activeBlocks.length === 0) return [];
    return allocatePages(activeBlocks, layout, 99, { sectionTitleHeights: sectionTitles });
  }, [activeBlocks, layout, sectionTitles]);

  // Post-render reconciliation: read live heights SYNCHRONOUSLY after commit.
  // useLayoutEffect runs after React commits the DOM but before the browser
  // paints — offsetHeight is fully valid here and we avoid the rAF cancellation
  // race that happens when multiple effects fire in rapid succession.
  useLayoutEffect(() => {
    if (pageAssignments.length === 0) return;
    if (iterCountRef.current >= MAX_RECONCILE_ITERS) return;

    const live = readLiveDOM();
    if (!live || live.blockHeights.size === 0) return;

    const nextBlocks = reconcileBlocks(activeBlocks, live, pageAssignments);

    const heightsStable = blocksStable(nextBlocks, activeBlocks);
    const titlesStable =
      live.sectionTitles.experience === sectionTitles.experience
      && live.sectionTitles.skills === sectionTitles.skills;

    if (heightsStable && titlesStable) {
      // Converged — stop iterating for this content version
      iterCountRef.current = MAX_RECONCILE_ITERS;
      return;
    }

    iterCountRef.current += 1;
    if (!heightsStable) setReconciledBlocks(nextBlocks);
    if (!titlesStable) setSectionTitles(live.sectionTitles);
  }, [pageAssignments, activeBlocks, sectionTitles]);

  return { pageAssignments, actualPageCount: pageAssignments.length };
}
