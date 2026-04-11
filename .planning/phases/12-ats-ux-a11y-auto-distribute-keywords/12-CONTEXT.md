# Phase 12: ATS Workflow UX + A11y + Auto-Distribute Keywords — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** `--auto`

<domain>
## Phase Boundary

Three concrete improvements to the ATS workflow, all driven by live-test feedback from Phase 11:

1. **A11y on the `Button` atom** — focus-visible ring missing, no `aria-busy`, forced `font-mono uppercase tracking-wider` by default, no explicit `aria-label` on loading states. Affects every CTA in the app since `Button` is THE primary atom.

2. **False-negative keyword matching** — the current `matchKeyword` in `keywordAnalysis.ts:75-79` is a strict word-boundary regex. It fails on plural/singular, accented vs non-accented, simple conjugations, and common stems. Result: users see missing keywords that are actually already in the CV under a slightly different form.

3. **Manual per-keyword integration is expensive** — with 11 missing keywords, users face 11 clicks × 1 AI call × 1 picker choice = 33 interactions. No one-click "distribute all" flow exists.

Out of scope:
- Rewriting the ATS scoring engine
- Changing the CV template rendering
- Touching the Phase 11 AI layer internals beyond adding one new action + builder
- The mystery "APPLIQUER_5_REFORMULATIONS" yellow button the user claims to see — not findable in master, left to HMR/cache troubleshooting on the user side
</domain>

<decisions>
## Implementation Decisions

### D-01 — Button atom a11y fixes (minimal, additive)

**Changes to `src/shared/ui/Button.tsx` only.** No consumers touched.

- Add `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[--google-blue] focus-visible:outline-none` to the base className
- Add `aria-busy={loading}` and `aria-disabled={disabled || loading}` props
- Wrap the `Spinner` in a `<span className="sr-only">Chargement</span>` for screen readers
- **Flip the `mono` default from `true` to `false`** — the aggressive mono-uppercase styling is a **visual choice**, not an atom default. Keeps existing mono consumers working by opting in explicitly.

**Why flipping `mono` default**: the current default forces uppercase via `font-mono uppercase tracking-wider`. WCAG 3.1 (Understanding SC — Presentation) discourages permanent uppercase for readability. Consumers that WANT the stitch look will set `mono={true}` explicitly.

**Risk**: any existing consumer of `Button` without explicit `mono` prop will visually change (no more uppercase mono). We verify by grepping all `<Button` usages and confirming any that rely on the default mono should be updated, or we keep the default `true` and only fix a11y.

**Fallback**: if too many consumers rely on the default, keep `mono` default = `true` and only add a11y fixes. Decision at execution time after grep count.

### D-02 — Keyword matcher fuzziness strategy

**Add a stem/variant matcher alongside the existing exact matcher.** Never replace — the current `matchKeyword` is known-correct for exact matches and must still be the first pass.

New function `matchKeywordFuzzy(keyword, text)` in `keywordAnalysis.ts`:
1. Exact match (current behavior) — fast path
2. Lowercase + accent strip + plural normalization (`-s`, `-es`, `-x` FR; `-s`, `-es` EN)
3. Simple suffix-strip stemming: FR `-er/-é/-ée/-ation/-eur/-ment`, EN `-ing/-ed/-er/-tion`
4. If ANY variant matches → `found = true`

The matcher is pure, deterministic, no new dependencies (compromise-stats is already available but adds runtime cost for little gain at this scale).

**Why no dep**: the keyword lists are small (max 40 per JD). A 20-line hand-rolled stemmer covering the 90th percentile of cases beats pulling in `natural` or `franc`. Fixture-based unit tests lock behavior against regressions.

### D-03 — `autoDistributeMissingKeywords` AI action

**New Convex action** + new prompt builder + new Zod schema. Follows the Phase 11 pattern exactly.

Files:
- `convex/_ai/prompts/distribute.ts` — `buildKeywordDistributionPrompt(ctx)`
- `convex/_ai/schemas.ts` — add `KeywordDistributionSchema`
- `convex/ai.ts` — new `autoDistributeMissingKeywords` action (thin wrapper)
- Tests: fragment tests for the builder + schema parse tests

**Input contract**:
```ts
{
  cvData: CVData (client sends content-only, no design),
  missingKeywords: string[],
  jobDescription: string,
  accessCode?: string,
}
```

**Output contract** (validated by `KeywordDistributionSchema`):
```ts
{
  assignments: Array<{
    keyword: string,
    expIndex: number | null,  // null = unassigned (no credible fit)
    bulletIndex: number | null,  // which bullet gets rewritten
    originalBullet: string | null,
    rewrittenBullet: string | null,
    reason: string,  // brief explanation for UI tooltip
  }>
}
```

**Prompt strategy**:
- Send the full experience list (compact: position + company + description bullets + kpi)
- Send the missing keywords list
- Ask the model: for each keyword, pick the ONE experience where it fits most credibly, pick ONE specific bullet to rewrite, and produce the rewritten bullet. If no credible fit, return `expIndex: null`.
- Apply `FABRICATION_GUARD` + `ACTION_VERBS_FR/EN` + intro preservation.
- Force JSON output + schema validation on return.

**Why single-shot vs per-keyword**: single AI call handles all assignments with full context, preserving cross-keyword coherence (same bullet won't get 2 keywords forced on it). Also 1 API call instead of N.

### D-04 — UI integration — the "Répartir automatiquement" flow

**Location**: `ATSPanel.tsx`, just above or below the existing "Optimiser pour cette offre" button.

**Visibility**: the CTA appears only when `missingKeywords.length >= 2` (below that, manual integration per keyword is fine).

**Interaction**:
1. User clicks "Répartir automatiquement (N mots-clés)" → loading state
2. Action returns assignments → stored in `distributionProposals` state (new Map)
3. A dedicated **panel appears** below the CTA showing each assignment as a card: keyword badge, target experience label, before/after bullet diff, per-item Accept/Reject + footer Accept-all/Reject-all
4. On Accept: the `cvData.experience[expIndex].description[bulletIndex]` is replaced. The keyword disappears from the "missing" list on next render.

**State**: `distributionProposals: Map<string, Assignment>` keyed by keyword in `EditorPage.tsx`. Separate from `pendingRewrites` (the per-bullet optimizer flow) because they're distinct feature surfaces.

**Accessibility**: the new CTA uses the Button atom with the Phase 12-01 a11y fixes; the preview panel uses `role="region" aria-labelledby` and `aria-live="polite"` to announce the new proposals.

### D-05 — Test strategy

- **12-01 Button a11y**: no new unit tests (Button is a simple atom); visual verification via tsc + build; grep that all `<Button` usages still compile
- **12-02 Keyword matcher**: ~15 unit tests on the new `matchKeywordFuzzy` covering plural, accent, stemming, negative cases (avoid over-matching)
- **12-03 Distribute action**: ~8 tests — 4 on the builder (context embedding, keyword loop, fragment inclusion, JSON instruction), 4 on the schema (valid, null expIndex, missing required, nested rewrites)
- **12-04 UI integration**: no new unit tests (React integration tested via existing e2e if any); tsc + build + live behavior check

### D-06 — Commit atomicity

4 atomic commits, each green on tsc + vitest + build:

1. `feat(ui): button atom a11y + focus-visible + aria-busy (plan 12-01)`
2. `fix(ats): fuzzy keyword matcher eliminating false negatives (plan 12-02)`
3. `feat(ai): autoDistributeMissingKeywords action + builder + schema (plan 12-03)`
4. `feat(editor): auto-distribute CTA + assignments preview in ATSPanel (plan 12-04)`
</decisions>

<canonical_refs>
## Canonical References

### Files being modified
- `src/shared/ui/Button.tsx` — the atom, ~50 lines
- `src/features/editor/lib/keywordAnalysis.ts` — matcher lives in `matchKeyword()` line 75
- `src/features/editor/lib/atsHelpers.ts` — for context on how keywords are scored
- `src/features/editor/components/ATSPanel.tsx` — sidebar rendering
- `src/pages/EditorPage.tsx` — state + handlers
- `convex/_ai/schemas.ts` — add new schema
- `convex/ai.ts` — add new action

### Files being created
- `convex/_ai/prompts/distribute.ts`
- `convex/_ai/__tests__/prompts/distribute.test.ts`
- `src/features/editor/lib/__tests__/fuzzyMatch.test.ts` (or co-located with keywordAnalysis)

### Phase 11 artifacts to preserve
- Schemas (`convex/_ai/schemas.ts`) — only ADD, never remove
- Normalizers — untouched
- Fragments — untouched
- Prompt builders — untouched except for adding one new file alongside

### Callers that must NOT change
- `DashboardPage.tsx`
- `EditorPage.tsx` (the AI calls already there — `tailorCV`, `optimizeCVForPage`, etc. — signatures stable)
- `CoverLetterPage.tsx`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`FABRICATION_GUARD`**, **`ACTION_VERBS_FR/EN`**, **`INTRO_PRESERVATION_FR`** in `fragments.ts` — reused by the distribute prompt
- **`normalizeCVData`** — not used for the distribute action (returns assignments, not a full CV)
- **`KeywordAnalysisResult.keywords[].placement`** — already provides a `findBestPlacement()` heuristic client-side. This is the lexical fallback; the new AI action provides the smart fallback.
- **`BulletDiffView`** component — can be reused visually for the assignments preview panel, or a new `AssignmentCard` can be built

### Patterns
- All Convex actions in `convex/ai.ts` are thin wrappers: `auth → buildPrompt → chat → safeParse → return`
- Schema file appends `.passthrough()` on every object for forward-compat
- Unit tests use fixture JSONs when dealing with AI outputs

### Integration Points
- The new action is called from `EditorPage.handleAutoDistribute` (new)
- Results flow into a new `distributionProposals` state (new)
- Preview panel is a new subcomponent of `ATSPanel`, optionally rendered
</code_context>

<deferred>
## Deferred Ideas

- **Full fuzzy matching via Levenshtein** — out of scope. 90% of false negatives are plural/accent/stem, not typos. Revisit if fuzziness alone doesn't cut the false-negative rate enough.
- **French stemmer via a real library (`franc-fr`, `natural`, etc.)** — out of scope. Hand-rolled suffix-strip covers the 90% case. Escalate only if tests show holes.
- **Auto-apply all distributions without preview** — tempting but dangerous. Always show proposals first.
- **Merge `autoDistributeMissingKeywords` into `rewriteBulletsForJob`** — no. Different input shapes, different call sites, different UIs. Share helpers via fragments, keep actions separate (per Phase 11 D-04).
- **Integrating into `tailorCV`** — tempting but `tailorCV` rewrites the whole CV in one shot. Adding per-keyword logic would bloat the prompt and reduce success rate. Keep them separate.
- **E2E test with Playwright for the CTA** — deferred unless user requests. Unit tests + tsc + build covers most of the risk.
</deferred>

---

*Phase: 12-ats-ux-a11y-auto-distribute-keywords*
*Context gathered: 2026-04-11 (auto mode)*
