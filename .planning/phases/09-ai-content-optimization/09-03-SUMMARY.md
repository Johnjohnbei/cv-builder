---
phase: 09-ai-content-optimization
plan: 03
subsystem: editor-integration
tags: [ai, bullet-rewrite, diff-view, ats, editor]
dependency_graph:
  requires: [09-01, 09-02]
  provides: [end-to-end-ai-bullet-optimization-flow]
  affects: [EditorPage, ATSPanel]
tech_stack:
  added: []
  patterns: [inline-diff-component, pending-rewrites-map, flat-index-mapping]
key_files:
  created:
    - src/features/editor/components/BulletDiffView.tsx
  modified:
    - src/features/editor/components/ATSPanel.tsx
    - src/features/editor/components/index.ts
    - src/pages/EditorPage.tsx
decisions:
  - "Used Map<string, {original, rewritten}> with 'expIndex-bulletIndex' keys for O(1) lookup of pending rewrites per bullet"
  - "Flat index mapping array to bridge between rewriteBulletsForJob sequential index and EditorPage experience/bullet indices"
  - "Weak bullet badges use inline IIFE pattern to keep JSX compact without extracting a sub-component"
metrics:
  duration: ~7min
  completed: "2026-04-09T13:26:00Z"
  tasks: 3
  files: 4

requirements-completed: [AICV-01, AICV-02, AICV-03, AICV-04, AICV-05]
---

# Phase 9 Plan 03: EditorPage AI Content Optimization Integration Summary

End-to-end AI bullet optimization flow wired into the editor: weak bullet badges via analyzeWeakBullets, global rewrite via rewriteBulletsForJob with inline diff view, per-bullet Accept/Reject, and JD-context-aware sparkles improvements.

## What Was Built

### BulletDiffView Component (32 lines)
- `src/features/editor/components/BulletDiffView.tsx` -- inline diff atom
- Shows original text struck-through in red, rewritten text in green
- Accept (green) and Reject (gray) buttons per rewrite
- Exported via barrel at `src/features/editor/components/index.ts`

### ATSPanel Updates (200 lines total)
- Replaced disabled "Analyse IA complete" placeholder button with active "Optimiser pour cette offre"
- Added `onOptimizeBullets` and `isOptimizing` props
- Button disabled when no job description imported or during optimization
- Shows "Optimisation en cours..." loading text during AI processing

### EditorPage Integration (1810 lines total, +82 lines added)
- **State:** `pendingRewrites` Map and `isOptimizingBullets` boolean
- **Weak bullet detection:** `useMemo` calling `analyzeWeakBullets` on experiences, with `getWeakIssues` lookup helper
- **Global rewrite handler:** `handleOptimizeBullets` -- collects all visible bullets with flat-index-to-exp/bullet mapping, calls `rewriteBulletsForJob`, populates pending rewrites Map
- **Accept/Reject handlers:** `handleAcceptRewrite` applies rewrite to cvData immutably, `handleRejectRewrite` removes from Map
- **Weak bullet badges:** Orange dot with tooltip showing issue labels (before sparkles button)
- **Diff view:** `BulletDiffView` rendered inline below each bullet that has a pending rewrite
- **Enhanced sparkles:** `improveBulletPoint` now receives `jobDescription` and `missingKeywords` for context-aware suggestions

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | BulletDiffView + ATSPanel update | 1baf45b |
| 2 | EditorPage integration | 06db0ae |
| 3 | Checkpoint (auto-approved) | -- |

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all functionality is fully wired and operational. No placeholder data or TODO markers.

## Verification

- `npx tsc --noEmit` -- 0 errors
- `npx vite build` -- passes (3.38s)
- BulletDiffView: 32 lines (under 200 limit)
- ATSPanel: 200 lines (under 300 limit)
- All handler functions under 50 lines

## Self-Check: PASSED

- [x] BulletDiffView.tsx exists
- [x] ATSPanel.tsx exists (modified)
- [x] EditorPage.tsx exists (modified)
- [x] 09-03-SUMMARY.md exists
- [x] Commit 1baf45b verified
- [x] Commit 06db0ae verified
