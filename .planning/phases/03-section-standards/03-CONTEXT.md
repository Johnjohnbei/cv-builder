# Phase 3: Section Standards - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace hardcoded French section names in all 6 templates with dynamic, language-aware section titles using getSectionTitle() utility that reads from atsRules.ts SECTION_NAMES. Section names adapt automatically based on getCVLanguage() from Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Approach
- **D-01:** Create a `getSectionTitle(key: SectionKey, language: 'fr' | 'en'): string` utility function
- **D-02:** This function reads from SECTION_NAMES in atsRules.ts (already exists from Phase 1)
- **D-03:** All 6 templates replace hardcoded section name strings with getSectionTitle() calls
- **D-04:** Section names are NOT in CVData — they are rendering logic in templates, not user data

### Section Keys
- **D-05:** Standard section keys: 'experience', 'education', 'skills', 'languages', 'contact', 'summary'
- **D-06:** Current hardcoded names to replace:
  - "Compétences" → getSectionTitle('skills', lang)
  - "Formation" → getSectionTitle('education', lang)
  - "Langues" → getSectionTitle('languages', lang)
  - "Expérience" / "Expérience professionnelle" → getSectionTitle('experience', lang)
  - "Coordonnées" / "Contact" → getSectionTitle('contact', lang)
  - "Profil" / "Résumé" → getSectionTitle('summary', lang)

### Language Integration
- **D-07:** Templates receive the CV language via props (from getCVLanguage() in EditorPage)
- **D-08:** Language is passed through TemplateProps → each template uses it for getSectionTitle() calls

### Claude's Discretion
- Where to place getSectionTitle() (in atsRules.ts next to SECTION_NAMES, or in a separate utility)
- Whether to extend TemplateProps with a `language` prop or derive it inside the template from cvData
- Any additional section name variations found during implementation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ATS Rules (Phase 1)
- `src/features/editor/lib/atsRules.ts` — SECTION_NAMES already defined with FR/EN variants

### Language Detection (Phase 2)
- `src/lib/languageDetection.ts` — getCVLanguage() returns effective language
- `src/shared/types/index.ts` — CVData with detectedLanguage field

### Templates (all 6 must be updated)
- `src/features/editor/templates/TemplateA.tsx` — hardcoded "Compétences", "Formation"
- `src/features/editor/templates/TemplateB.tsx` — hardcoded section names
- `src/features/editor/templates/TemplateC.tsx` — hardcoded section names
- `src/features/editor/templates/TemplateD.tsx` — hardcoded section names
- `src/features/editor/templates/TemplateE.tsx` — hardcoded section names
- `src/features/editor/templates/TemplateF.tsx` — hardcoded section names
- `src/features/editor/templates/shared.tsx` — shared helpers, may need getSectionTitle
- `src/features/editor/templates/CVRenderer.tsx` — template props dispatcher

### Editor Integration
- `src/pages/EditorPage.tsx` — passes props to CVRenderer

</canonical_refs>

<specifics>
## Specific Ideas

- This is a pure find-and-replace refactoring in 6 template files — low risk
- atsRules.ts SECTION_NAMES already has all the data, just needs a getter function
- The language prop flow: EditorPage → CVRenderer → TemplateX → getSectionTitle(key, lang)

</specifics>

<deferred>
## Deferred Ideas

None — Phase 3 scope is well-defined.

</deferred>

---

*Phase: 03-section-standards*
*Context gathered: 2026-04-09 via discuss-phase*
