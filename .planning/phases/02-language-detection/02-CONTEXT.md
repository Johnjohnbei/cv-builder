# Phase 2: Language Detection - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-detect whether the CV content is in French or English, store the result in CVData, and make it available to downstream systems (scoring, section names, ATS suggestions). Add a manual FR/EN override selector for edge cases.

</domain>

<decisions>
## Implementation Decisions

### Detection Timing
- **D-01:** Detect language at import (LinkedIn PDF, non-LinkedIn PDF, AI extraction) — not on every keystroke
- **D-02:** Provide on-demand re-detection (button/trigger) for when user changes language after import
- **D-03:** No debounced auto-recalculation during editing

### Detection Input
- **D-04:** Concatenate all CV text content for detection: title + summary + experience descriptions + skills — more text = better accuracy
- **D-05:** Use franc-min library (v6.x, ~27KB) for client-side detection, zero API calls

### Storage
- **D-06:** Add `detectedLanguage: 'fr' | 'en'` field to CVData type in `src/shared/types/index.ts` — persisted in database
- **D-07:** This requires updating the Convex schema to include the new field

### Bilingual Handling
- **D-08:** Majority language wins — franc-min returns the dominant language, acceptable since ATS are mono-language per country
- **D-09:** No special warning for low confidence scores — keep it simple

### Manual Override
- **D-10:** Add a small FR/EN selector in the editor settings/header for manual override
- **D-11:** Manual override takes precedence over auto-detection
- **D-12:** Override is stored in CVData alongside detectedLanguage (e.g., `languageOverride?: 'fr' | 'en'`)

### Downstream API
- **D-13:** Expose a utility function `getCVLanguage(cvData)` that returns the effective language (override > detected > default 'fr')
- **D-14:** Downstream systems (scoring, sections, suggestions) call this function instead of checking detectedLanguage directly

### Claude's Discretion
- Exact placement of the FR/EN selector in the UI (header, sidebar, settings panel)
- How to trigger re-detection (button label, placement)
- Whether to lazy-load franc-min to avoid initial bundle impact

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Types & Schema
- `src/shared/types/index.ts` — CVData type to extend with detectedLanguage
- `convex/schema.ts` — Database schema to update

### ATS Rules (Phase 1 output)
- `src/features/editor/lib/atsRules.ts` — Contains SECTION_NAMES with FR/EN variants, consumed by language detection
- `src/features/editor/lib/scoring.ts` — Will use detected language for keyword extraction

### Editor Integration
- `src/pages/EditorPage.tsx` — Where the FR/EN selector and re-detect trigger would live
- `src/features/editor/components/EditorHeader.tsx` — Potential location for language selector

### Import Pipeline
- `src/lib/linkedinParser.ts` — LinkedIn PDF import, detection should happen after import
- `src/pages/DashboardPage.tsx` — Non-LinkedIn import flow

### Research
- `.planning/research/STACK.md` — franc-min recommendation with version

</canonical_refs>

<specifics>
## Specific Ideas

- franc-min is only ~27KB — can be loaded eagerly without significant bundle impact, but lazy-loading is acceptable if Claude prefers
- The `getCVLanguage()` utility function pattern ensures downstream systems never need to know about override vs detection logic
- Detection should happen AFTER the full CVData is populated (post-import), not during parsing

</specifics>

<deferred>
## Deferred Ideas

None — Phase 2 scope is well-defined.

</deferred>

---

*Phase: 02-language-detection*
*Context gathered: 2026-04-09 via discuss-phase*
