# Phase 4: ATS Scoring Engine - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Implement the ATS scoring engine as an extension of scoring.ts. Computes a global ATS score (0-100) with 3 sub-scores (Format, Content, Relevance). Format and Content are client-side real-time. Relevance requires a job description and uses NLP keyword extraction via compromise.

</domain>

<decisions>
## Implementation Decisions

### Architecture
- **D-01:** Extend scoring.ts with ATS scoring functions (not a separate module) — per PROJECT.md and Phase 1 CONTEXT.md
- **D-02:** Install `compromise` (v14.x, ~200KB) for NLP keyword extraction with bigrams/trigrams
- **D-03:** All scoring functions are pure functions (no side effects, no API calls)

### Sub-Score: Format (30% weight)
- **D-04:** Format sub-score checks:
  - Template ATS compatibility (from TEMPLATE_ATS_COMPAT in atsRules.ts)
  - Standard section names present (from SECTION_NAMES in atsRules.ts)
  - ATS-safe fonts in use (from ATS_SAFE_FONTS in atsRules.ts)
  - No SVG icons in template (detectable via atsMode flag when implemented in Phase 6)
  - Contact info present (email, phone)
- **D-05:** Before Phase 6 (template ATS mode), format score uses placeholder values for icon/font checks

### Sub-Score: Content (30% weight)
- **D-06:** Content sub-score checks:
  - Metrics/numbers present in bullet points (regex: detect digits, %, $, etc.)
  - Strong action verbs at bullet start (from WEAK_VERBS in atsRules.ts — invert to check for strong verbs)
  - Bullet point length appropriate (1-2 lines, not too short or too long)
  - All essential sections present (experience, education, skills, contact, summary)
  - Skills section not empty

### Sub-Score: Relevance (40% weight)
- **D-07:** Relevance sub-score uses enhanced keyword extraction:
  - compromise NLP for bigram/trigram extraction (e.g., "project management" as one term)
  - TF-IDF weighting (~50 lines inline, textbook algorithm for 2-document comparison)
  - Word-boundary matching (already fixed in Phase 1)
  - Both acronyms and expanded forms matched
- **D-08:** Without a job description, Relevance = N/A, global score = (Format + Content) / 2
- **D-09:** With a job description, global score = Format * 0.3 + Content * 0.3 + Relevance * 0.4

### Score Display
- **D-10:** Score computed client-side, debounced (recalc after 500ms of inactivity)
- **D-11:** Score result type: `{ overall: number, format: number, content: number, relevance: number | null, suggestions: string[] }`
- **D-12:** The UI display of the score is NOT in this phase — Phase 8 (ATS Panel) handles the UI. This phase creates the computation engine only.

### Claude's Discretion
- Internal organization of scoring functions within scoring.ts
- Exact TF-IDF implementation details
- How to detect contact info presence (regex patterns)
- Whether to lazy-load compromise

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scoring (Phase 1 output)
- `src/features/editor/lib/scoring.ts` — Extend with ATS scoring, use exported helpers
- `src/features/editor/lib/scoring.test.ts` — Extend with ATS scoring tests

### ATS Rules (Phase 1 output)
- `src/features/editor/lib/atsRules.ts` — TEMPLATE_ATS_COMPAT, SECTION_NAMES, ATS_SAFE_FONTS, WEAK_VERBS

### Language Detection (Phase 2 output)
- `src/lib/languageDetection.ts` — getCVLanguage() for language-aware checks

### Types
- `src/shared/types/index.ts` — CVData, DesignSettings, Experience types

### Research
- `.planning/research/STACK.md` — compromise recommendation, TF-IDF approach
- `.planning/research/ARCHITECTURE.md` — Where scoring logic should live

</canonical_refs>

<specifics>
## Specific Ideas

- The research found that compromise is English-optimized; for French CVs, noun phrase extraction may be less accurate. Consider a simple French stemmer fallback if needed.
- TF-IDF is a textbook algorithm: term frequency in CV / inverse document frequency across (CV, job desc). ~50 lines inline.
- Format score will be partially placeholder until Phase 6 (template ATS mode) — some checks can't run until templates are ATS-adapted.

</specifics>

<deferred>
## Deferred Ideas

None — Phase 4 scope is well-defined.

</deferred>

---

*Phase: 04-ats-scoring-engine*
*Context gathered: 2026-04-09 via smart-discuss (autonomous)*
