# Phase 7: Skills Categorization - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-categorize skills into ATS-friendly groups at import time. LinkedIn imports (currently one flat bucket "Competences cles") get categorized via a client-side dictionary. AI imports keep their existing categorization. Templates render skills in grouped format with ATS-compatible plain text in ATS mode.

</domain>

<decisions>
## Implementation Decisions

### Categorization Strategy
- Client-side dictionary (~200 terms FR/EN) mapping skill keywords to categories — no API call, instant
- 4 standard categories: Technique, Soft Skills, Outils, Methodologies (matches ROADMAP success criteria)
- Unrecognized skills fall into "Autres" category — user can reassign manually
- AI imports keep their existing categorization — no re-normalization (AI already does good work)

### Display Format
- Category sub-headers + inline badges (existing pattern) — each category has a lightweight header then skill pills
- ATS mode: plain text format "Technique: skill1, skill2, skill3" — one line per category, all parsers can read
- Category order: Technique -> Outils -> Methodologies -> Soft Skills (hard skills first, recruiter/ATS expectation)
- Compact display mode: 3 items per category (consistent with existing displayMode compact behavior)

### Integration & Editing
- Category names are fixed (not user-renamable) — standard names are essential for ATS parsing
- Users can move skills between categories via drag-drop or context menu — manual correction when dictionary is wrong
- Categorization runs at import only — manually added skills stay in their chosen category
- Category names are bilingual via getSectionTitle pattern from Phase 3 — FR: "Competences techniques", EN: "Technical Skills"

### Claude's Discretion
- Dictionary structure and organization (single file vs config in atsRules.ts)
- Exact matching strategy (case-insensitive substring, exact match, or fuzzy)
- How to handle compound skills ("Project Management" vs "project" + "management")
- Drag-drop vs simple select dropdown for skill reassignment UX

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SkillCategory` type already exists: `{ category: string; items: string[]; displayMode?: SkillDisplayMode }`
- `SkillDisplayMode`: `'hidden' | 'compact' | 'normal'`
- `getVisibleSkills()` in displayModes.ts filters skills by displayMode
- `getSectionTitle()` from Phase 3 for bilingual section/category names
- Templates already render categories with badges pattern

### Established Patterns
- LinkedIn parser returns `[{ category: 'Competences cles', items: [...] }]` — single bucket to split
- AI import already categorizes into 2-4 categories with 3-6 items each
- Display modes per category (hidden/compact/normal) — existing UX
- EditorPage skills section: expand/collapse, add/delete categories and items

### Integration Points
- `src/lib/linkedinParser.ts` — add categorization after skill extraction (lines 455-471)
- `src/features/editor/templates/shared.tsx` — update skills rendering for ATS mode
- `src/features/editor/templates/Template[A-F].tsx` — category sub-headers in skills section
- `src/features/editor/lib/atsRules.ts` — add SKILL_CATEGORIES config with bilingual names
- `src/shared/types/index.ts` — may need SkillCategoryKey type
- `src/pages/EditorPage.tsx` — skill reassignment UI

</code_context>

<specifics>
## Specific Ideas

- The dictionary should cover common tech stack terms (React, Python, Docker, etc.), soft skills (Leadership, Communication), tools (Jira, Figma, Excel), and methodologies (Agile, Scrum, Lean)
- ATS mode rendering should use semantic HTML (no decorative elements) — plain text with comma separation
- Category order in ATS mode matters: technical skills first as they are most scanned by ATS parsers

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-skills-categorization*
*Context gathered: 2026-04-09 via smart discuss (autonomous)*
