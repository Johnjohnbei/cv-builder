# Phase 6: Template ATS Mode - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Add an ATS mode toggle to templates. When enabled, templates restructure their DOM to single-column layout, replace SVG icons with text labels, force standard fonts, and simplify decorative elements. Non-adaptable templates auto-switch to a compatible alternative. Deactivation shows a warning.

</domain>

<decisions>
## Implementation Decisions

### Toggle Architecture
- **D-01:** Add `atsMode?: boolean` to DesignSettings in types/index.ts
- **D-02:** atsMode flows through DesignSettings → TemplateProps → each template (same pattern as language prop)
- **D-03:** Toggle UI is a simple on/off switch in the editor header or settings area
- **D-04:** atsMode does NOT mutate other DesignSettings — it's a rendering overlay

### Template Classification
- **D-05:** Use TEMPLATE_ATS_COMPAT from atsRules.ts (already has placeholder classifications from Phase 1)
- **D-06:** Update classifications based on actual template analysis:
  - TemplateA (Classic): 'full' — simple layout, easy to convert
  - TemplateB (Modern): 'full' — standard layout  
  - TemplateC (Minimal): 'full' — already minimal
  - TemplateD (Creative): 'limited' — complex decorative layout
  - TemplateE (Elegant): 'full' — standard layout
  - TemplateF (Sidebar): 'limited' — 2-column grid layout
- **D-07:** When atsMode is activated on a 'limited' template, auto-switch to TemplateA (safest option)

### ATS Mode Rendering Changes
- **D-08:** Single-column: templates with sidebars/multi-column restructure to stacked blocks
- **D-09:** Icons → text: replace Lucide SVG icons (Mail, Phone, MapPin, Linkedin) with text labels ("Email:", "Tél:", etc.)
- **D-10:** Fonts: override template fonts with ATS_SAFE_FONTS[0] (Arial/sans-serif)
- **D-11:** Simplify: reduce decorative borders, colored backgrounds, special styling to minimal
- **D-12:** These changes are CSS/JSX conditional rendering (not separate template files)

### User Experience
- **D-13:** Template picker shows ATS compatibility indicator (badge or icon) per template
- **D-14:** Deactivating atsMode restores original template + shows notification warning
- **D-15:** If user was auto-switched from a 'limited' template, deactivating atsMode returns to the original template choice

### Claude's Discretion
- Exact CSS overrides for each template in ATS mode
- How to implement the auto-switch (state management pattern)
- Template picker indicator design
- Warning notification implementation (reuse existing notification system)

</decisions>

<canonical_refs>
## Canonical References

### ATS Rules
- `src/features/editor/lib/atsRules.ts` — TEMPLATE_ATS_COMPAT, ATS_SAFE_FONTS, ATS_COLOR_CONSTRAINTS

### Templates
- `src/features/editor/templates/TemplateA.tsx` through `TemplateF.tsx`
- `src/features/editor/templates/shared.tsx` — TemplateProps, shared helpers
- `src/features/editor/templates/CVRenderer.tsx` — template dispatcher

### Types
- `src/shared/types/index.ts` — DesignSettings to extend

### Editor
- `src/pages/EditorPage.tsx` — DesignSettings state management
- `src/features/editor/components/EditorHeader.tsx` — toggle location

</canonical_refs>

<specifics>
## Specific Ideas

- Research identified TemplateD and TemplateF as the most complex to adapt — auto-switching to TemplateA is safer than trying to restructure complex layouts
- Icon replacement should use the same text as Section Standards (getSectionTitle pattern)
- The ATS mode toggle pairs naturally with the language selector already in EditorHeader

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 06-template-ats-mode*
*Context gathered: 2026-04-09 via smart-discuss (autonomous)*
