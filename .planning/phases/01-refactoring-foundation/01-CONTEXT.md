# Phase 1: Refactoring Foundation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare the codebase for ATS features by extracting utilities from scoring.ts, creating a central atsRules.ts config module, fixing the keyword matching bug (substring -> word-boundary), and cleaning up file duplicates. No UI changes, no new features visible to users.

</domain>

<decisions>
## Implementation Decisions

### File Organization
- **D-01:** Claude's Discretion on where to place formatDateShort and normalizeProficiency (either src/shared/lib/formatting.ts or src/features/editor/lib/formatting.ts — choose based on project conventions)
- **D-02:** Claude's Discretion on where to place atsRules.ts (either src/features/editor/lib/ or src/shared/lib/ — choose based on which consumers need it)

### atsRules.ts Contents
- **D-03:** atsRules.ts must contain ALL of these:
  - Template compatibility map (classify each TemplateA-F as 'full' or 'limited' ATS support — placeholder values, refined in Phase 6)
  - Section names FR/EN (standard ATS-recognized section names per language)
  - ATS-safe fonts & styles (approved font list, color constraints for ATS mode)
  - Weak verb patterns (French and English weak verbs + strong verb alternatives)
- **D-04:** Template compatibility map uses placeholder classifications now, will be updated in Phase 6 after per-template analysis

### scoring.ts Extension
- **D-05:** Add clear section separators (// --- ATS Scoring ---) to organize the file for future ATS functions
- **D-06:** Export currently-private helpers (computeKeywordMatch, computeRecency, computeDuration) so ATS scoring functions can reuse them in Phase 4
- **D-07:** Fix the keyword matching bug NOW (Phase 1, not Phase 4) — text.includes(kw) must use word-boundary matching to prevent false positives ("Java" matching "JavaScript")

### Codebase Simplifications
- **D-08:** Merge duplicate cn() functions — src/lib/utils.ts and src/shared/lib/cn.ts are identical, keep one, update all imports
- **D-09:** Clean up barrel exports (index.ts files) — remove unnecessary re-exports
- **D-10:** Claude's Discretion on any additional simplifications discovered during refactoring (within Phase 1 scope — no new features)

### Claude's Discretion
- File placement decisions (D-01, D-02) — choose based on project conventions and consumer analysis
- Additional simplifications (D-10) — apply any cleanup opportunities found during the refactoring pass
- Internal code structure within new files — organize as makes sense

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scoring & Business Logic
- `src/features/editor/lib/scoring.ts` — Current scoring logic to extend (202 lines, contains formatDateShort + normalizeProficiency to extract)
- `src/features/editor/lib/displayModes.ts` — Display mode logic that consumes scoring output

### Shared Utilities
- `src/shared/lib/cn.ts` — cn() function (duplicate of src/lib/utils.ts)
- `src/lib/utils.ts` — cn() function (duplicate to merge)
- `src/shared/types/index.ts` — Domain types (CVData, DesignSettings, Experience, etc.)

### Codebase Analysis
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, import organization, code style
- `.planning/codebase/STRUCTURE.md` — Directory layout and file locations
- `.planning/research/ARCHITECTURE.md` — Where ATS logic should integrate

### Templates (for compatibility map)
- `src/features/editor/templates/TemplateA.tsx` through `TemplateF.tsx` — Need classification for ATS compatibility
- `src/features/editor/templates/shared.tsx` — Shared template helpers

</canonical_refs>

<specifics>
## Specific Ideas

- The user explicitly wants the substring matching bug fixed in Phase 1 (not deferred to Phase 4) because current scores are potentially inaccurate
- atsRules.ts should be comprehensive (~60 lines) with all 4 data categories ready for consumption by Phases 2-10
- Simplification is a core value — merge files, clean up duplicates, don't add complexity

</specifics>

<deferred>
## Deferred Ideas

None — Phase 1 scope is well-defined refactoring work.

</deferred>

---

*Phase: 01-refactoring-foundation*
*Context gathered: 2026-04-09 via discuss-phase*
