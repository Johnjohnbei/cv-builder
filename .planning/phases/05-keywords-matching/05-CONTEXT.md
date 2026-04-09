# Phase 5: Keywords & Matching - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss, autonomous)

<domain>
## Phase Boundary

Create the keyword analysis data structure and utility that compares job description keywords against CV content. Produces a color-coded list of matched/missing keywords. Reuses extractNLPKeywords from Phase 4's atsHelpers.ts.

Note: The UI display of this keyword list is handled in Phase 8 (ATS Panel UI). This phase creates the computation and data model only.

</domain>

<decisions>
## Implementation Decisions

### Architecture
- **D-01:** Create a `computeKeywordAnalysis()` function that returns a list of keywords with their match status
- **D-02:** Reuse `extractNLPKeywords()` from atsHelpers.ts for keyword extraction from job description
- **D-03:** Use the word-boundary matching from scoring.ts (computeKeywordMatch already fixed in Phase 1)

### Data Model
- **D-04:** Return type: `KeywordMatch { keyword: string, found: boolean, locations: string[] }` where locations indicates which CV sections contain the keyword
- **D-05:** Include both acronym and expanded forms as separate entries (e.g., "PMP" and "Project Management Professional" are both listed)

### Matching Logic
- **D-06:** Word-boundary matching (already implemented in Phase 1, reuse the pattern)
- **D-07:** Case-insensitive matching
- **D-08:** Match against all CV text: summary + experience descriptions + skills + education

### Acronym Detection
- **D-09:** Detect acronyms via uppercase pattern (2-5 consecutive uppercase letters)
- **D-10:** When an acronym is found in JD, also search for its expanded form and vice versa — but only for common patterns, not a full dictionary

### Claude's Discretion
- Where to place computeKeywordAnalysis (atsHelpers.ts extension or scoring.ts)
- Whether to extract acronym/expansion pairs from the job description text itself
- Internal implementation details

</decisions>

<canonical_refs>
## Canonical References

### Phase 4 Output (keyword extraction)
- `src/features/editor/lib/atsHelpers.ts` — extractNLPKeywords, computeTFIDF
- `src/features/editor/lib/scoring.ts` — computeKeywordMatch with word-boundary fix

### Types
- `src/shared/types/index.ts` — CVData, ATSScoreResult

### ATS Rules
- `src/features/editor/lib/atsRules.ts` — SECTION_NAMES, WEAK_VERBS

</canonical_refs>

<specifics>
## Specific Ideas

- Phase 4 already has extractNLPKeywords that handles bigrams/trigrams via compromise — this phase wraps it with match status tracking
- The keyword list will be consumed by Phase 8 (ATS Panel UI) for color-coded display

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 05-keywords-matching*
*Context gathered: 2026-04-09 via smart-discuss (autonomous)*
