# Phase 9: AI Content Optimization - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add AI-powered bullet point rewriting targeted to job descriptions. Global rewrite from ATS panel, individual rewrite via existing sparkles icon. Client-side weak bullet detection. Diff view for approval. Fabrication guard in prompts.

</domain>

<decisions>
## Implementation Decisions

### Trigger & Flow
- Global rewrite: "Optimiser pour cette offre" button replaces disabled "Analyse IA complete" in ATSPanel
- Diff view: inline diff — old text struck-through red + new text green — simple, readable
- Acceptance: per-bullet Accept/Reject buttons on each modified bullet — fine-grained user control
- Individual rewrite: enhance existing improveBulletPoint sparkles icon with JD-targeted prompt

### Weak Bullet Detection & AI Prompts
- Client-side regex analysis: detect weak verbs (responsible for, managed, helped), missing metrics (no numbers), passive voice
- Signal weak bullets with orange badge + tooltip explaining the issue — non-intrusive
- Fabrication guard: explicit system prompt instruction "Never invent numbers/metrics. If original has none, don't add any"
- Missing keywords: pass list of missing keywords in prompt — "Integrate naturally if relevant: [keyword1, keyword2]"

### Architecture & UX
- New Convex action `rewriteBulletsForJob` — separate from improveBulletPoint (different prompt, different format)
- State: local Map `pendingRewrites: Map<string, {original, rewritten}>` in EditorPage — temporary state, no new hook
- Loading: spinner overlay on ATS panel + "Optimisation en cours..." — user can keep editing CV
- Limit: all visible bullets (non-hidden) — max ~20, model handles well

### Claude's Discretion
- Exact weak verb list and detection regex patterns
- Diff view component implementation details
- How to batch bullets for the AI call (one call with all bullets vs multiple calls)
- Loading animation style

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `improveBulletPoint` action in convex/ai.ts — returns { suggestions: [str, str, str] }
- Provider abstraction: getProvider(), getClient(), getModel(), chatJSON(), safeParseJSON()
- ATSPanel component with onRequestAIAnalysis callback (currently placeholder)
- Sparkles icon on each bullet in EditorPage (~line 825-882)
- computeKeywordAnalysis() for extracting missing keywords

### Established Patterns
- Convex action: mutation trigger -> loading state -> call action -> parse JSON -> update UI
- JSON-only outputs with "Retourne UNIQUEMENT le JSON"
- System prompts in French
- Temperature 0.3 for consistency

### Integration Points
- `convex/ai.ts` — add rewriteBulletsForJob action
- `src/features/editor/components/ATSPanel.tsx` — wire "Optimiser" button (replace disabled placeholder)
- `src/pages/EditorPage.tsx` — add pendingRewrites state, diff view rendering, accept/reject handlers
- `src/features/editor/lib/` — add weak bullet detection utility

</code_context>

<specifics>
## Specific Ideas

- The diff view should be inline in the experience section — each modified bullet shows old+new below itself
- Weak bullet detection runs on initial load and on each edit — results cached in useMemo
- The rewriteBulletsForJob action should receive all bullets + job description + missing keywords in a single call
- Response format: { rewrites: [{ index: number, original: string, rewritten: string }] }

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-ai-content-optimization*
*Context gathered: 2026-04-09 via smart discuss (autonomous)*
