# Phase 8: ATS Panel UI - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a dedicated ATS analysis sidebar tab in the editor showing score gauge, sub-scores, keyword matches, and actionable suggestions. Panel auto-opens on job description import. Extract ATS state into useATSAnalysis hook and ATSPanel component per REFAC-03/REFAC-04.

</domain>

<decisions>
## Implementation Decisions

### Panel Structure
- 3rd sidebar tab "ATS" added alongside existing Contenu/Design tabs
- Auto-open: setActiveTab('ats') when jobDescription transitions from null to non-null
- Without job description: show partial score (Format + Content) + CTA "Importez une offre pour le score complet"
- Layout: vertical flow — circular score gauge -> 3 horizontal sub-score bars -> keyword badges -> actionable suggestions

### Score & Keywords Display
- Score gauge: SVG circle with percentage center — green (75+), orange (50-74), red (<50)
- Sub-scores: 3 horizontal bars labeled Format/Contenu/Pertinence with numeric score on right
- Keywords: color-coded badges — green (found in CV) with location indicator (summary/experience/skills), red (missing)
- Suggestions: top 5 most impactful first, "Voir tout" button if more than 5

### Suggestions & Actions
- 4 suggestion types: "Ameliorer ce bullet" (AI rewrite), "Ajouter cette competence", "Activer mode ATS", "Ajouter des metriques"
- "Analyse IA complete" button: launches detailed per-bullet analysis — weak verbs, missing metrics, passive voice — results in panel
- useATSAnalysis hook: recalculate via useMemo on cvData + designSettings + jobDescription (no debounce, scoring is <5ms)
- Component structure: ATSPanel (~200 lines) + ScoreGauge atom (~80 lines) + useATSAnalysis hook (~100 lines) — satisfies REFAC-03 and REFAC-04

### Claude's Discretion
- Exact SVG gauge dimensions and animation
- Color palette for score tiers (exact hex values matching design system)
- Suggestion priority algorithm (which suggestions surface first)
- "Analyse IA complete" button placement and loading state UX
- Whether to show skill category breakdown in the panel

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeATSScore(cvData, design, jobDescription?)` -> ATSScoreResult with overall, format, content, relevance, suggestions
- `computeKeywordAnalysis()` -> KeywordMatch[] with keyword, found, locations
- Panel/PanelHeader/PanelBody components in src/shared/ui/
- Existing tab system in EditorPage (activeTab state)

### Established Patterns
- Sidebar tabs: activeTab state with conditional rendering
- expandedSection pattern for collapsible sidebar sections
- notify() for user-facing messages
- useMemo for derived computed state

### Integration Points
- `src/pages/EditorPage.tsx` — add 3rd tab, integrate useATSAnalysis hook, wire ATSPanel
- `src/features/editor/lib/scoring.ts` — computeATSScore already available
- `src/features/editor/lib/atsHelpers.ts` — extractNLPKeywords, keyword analysis
- `src/shared/ui/` — add ScoreGauge component
- `src/features/editor/components/` — add ATSPanel component
- `src/features/editor/hooks/` — add useATSAnalysis hook

</code_context>

<specifics>
## Specific Ideas

- The gauge should feel professional — think Lighthouse score gauge (circular, color-coded)
- Suggestions should be grouped by impact type, not randomly listed
- "Ajouter cette competence" buttons should directly add the missing skill to the CV skills array
- "Activer mode ATS" suggestion should only appear when atsMode is false and template supports it

</specifics>

<deferred>
## Deferred Ideas

- AI-powered bullet rewriting (suggestion buttons will be wired in Phase 9, not Phase 8)
- Deep AI analysis results display (Phase 9 handles the actual AI call)

</deferred>

---

*Phase: 08-ats-panel-ui*
*Context gathered: 2026-04-09 via smart discuss (autonomous)*
