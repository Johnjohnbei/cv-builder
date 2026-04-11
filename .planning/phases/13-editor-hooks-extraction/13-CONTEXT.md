# Phase 13: Editor Hooks Extraction — Context

**Gathered:** 2026-04-11
**Status:** Ready
**Mode:** `--auto`

<domain>
## Phase Boundary

`src/pages/EditorPage.tsx` is **1967 lines, 19 useState, 11 handlers, 3 useEffect** — 5× the CLAUDE.md 400-line limit for pages. Phase 12-clean extracted `useKeywordDistribution`. Phase 13 continues that work with 4 more hook extractions to slim the page down to its actual responsibility: orchestrating layout + composing child components.

After Phase 13 completes, EditorPage should own:
- Tab state + expanded-section state (pure UI)
- The JSX render tree
- Wiring between hooks (no business logic)

Everything else moves out.

Out of scope:
- Decomposing the JSX render (~1500 lines) into subcomponents — that's Phase 15 or later
- Touching `useCVLoader` / `useATSAnalysis` / `usePaginationFit` / `useKeywordDistribution` — already clean
- Any DS atom migration — Phase 14
</domain>

<decisions>
## Implementation Decisions

### D-01 — 4 hooks, 4 plans, 4 commits

1. **`useBulletOptimization`** — owns bullet rewrite flow (Optimiser pour cette offre button)
   - State: `pendingRewrites`, `isOptimizingBullets`, `integratingKeyword`, `improvingBullet`, `bulletSuggestions`
   - Handlers: `optimizeBullets`, `acceptRewrite`, `rejectRewrite`, `integrateKeyword`, `improveBullet`, `dismissSuggestions`
   - Deps: `cvData`, `setCvData`, `jobDescription`, `missingKeywords`, `notify`, `accessCode`
   - Replaces ~140 lines in EditorPage

2. **`useCVPersistence`** — owns save draft + guest localStorage + createCV dual-flow
   - State: `isSaving`
   - Handlers: `saveDraft`
   - Deps: `cvData`, `designSettings`, `selectedTemplate`, `user`, `isGuest`, `storeUser`, `createCV`, `notify`
   - Replaces ~45 lines

3. **`usePDFExport`** — owns PDF download + preview
   - State: `isExporting`, `isPreviewing`, `previewUrl`
   - Handlers: `downloadPDF`, `previewPDF`
   - Deps: `cvRef`, `cvData`, `designSettings`, `notify`
   - Replaces ~35 lines

4. **`useTemplateSelection`** — owns template + atsMode coordination
   - State: `pendingTemplate`, `showTemplateConfirm`, `preAtsTemplate`
   - Handlers: `setTemplate`, `confirmTemplateChange`, `cancelTemplateChange`, `setAtsMode`
   - Deps: `selectedTemplate`, `setSelectedTemplate`, `designSettings`, `setDesignSettings`, `notify`
   - Replaces ~70 lines

Total extraction: **~290 lines** out of EditorPage. Plus gains on `useState` declarations.

### D-02 — Handler naming

Drop the `handle` prefix inside hooks — they become methods on the returned object:

```ts
// Before (in EditorPage):
const handleOptimizeBullets = async () => { ... };
<Button onClick={handleOptimizeBullets} />

// After:
const bullets = useBulletOptimization({ ... });
<Button onClick={bullets.optimize} />
```

Rationale: inside a hook context, `handle*` is redundant — the hook IS the handler bag. Matches `useKeywordDistribution` pattern (`distribute`, `acceptOne`, `rejectOne`).

### D-03 — `useCallback` everywhere

Every exported handler uses `useCallback`. This is free because the hook extraction happens anyway. Benefit: any child component wrapped in `React.memo` won't re-render on unrelated state changes. `PaginatedCV` is already memoized; this propagates the optimization.

### D-04 — Pure helpers exported for tests

Where a hook does non-trivial work that's testable in isolation (e.g. flattening bullets for the AI call in `useBulletOptimization`), extract it as a named export and add unit tests. Matches Phase 12-clean pattern with `applyAssignments` / `stripNonContent`.

### D-05 — Backward compat with existing children

Hook return shapes are designed so existing children can be wired with minimal changes. The `ATSPanel` prop `onOptimizeBullets` receives `bullets.optimize` instead of `handleOptimizeBullets`. Prop names don't change.

### D-06 — No behavior change

Every extracted handler must preserve exact current behavior. Including quirks like:
- `isLoading` early return placement
- localStorage key naming (`guest_cvs`, `guest_last_optimized`)
- The `unused _d _dl _lo` pattern, which gets CLEANED in the extraction (same fix as plan 12-clean)

### D-07 — Commit atomicity

4 separate commits, each green on tsc + vitest + vite build:

```
feat(editor): useBulletOptimization hook (plan 13-01)
feat(editor): useCVPersistence hook (plan 13-02)
feat(editor): usePDFExport hook (plan 13-03)
feat(editor): useTemplateSelection hook (plan 13-04)
```

Plus a closing commit with verification + doc update.
</decisions>

<canonical_refs>
- `src/pages/EditorPage.tsx` — file being thinned
- `src/features/editor/hooks/useKeywordDistribution.ts` — reference pattern for new hooks
- `src/features/editor/hooks/useCVLoader.ts` — owns `cvData`, `setCvData`, `designSettings`, `setDesignSettings`, `selectedTemplate`, `setSelectedTemplate` (dependencies injected into new hooks)
- `src/features/editor/hooks/useATSAnalysis.ts` — owns `atsKeywords` consumed by `useBulletOptimization`
- `src/features/editor/lib/pdfExport.ts` — `serverlessPDF` + `renderPDF` + `extractExpectedText` used by `usePDFExport`
</canonical_refs>
