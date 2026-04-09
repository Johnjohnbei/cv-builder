# Architecture Patterns

**Domain:** ATS scoring/optimization integration into existing CV Builder
**Researched:** 2026-04-09

## Recommended Architecture

### High-Level Integration Map

```
EditorPage.tsx (orchestrator)
  |
  +-- activeTab: 'content' | 'design' | 'ats'     <-- NEW tab value
  +-- atsMode: boolean (on DesignSettings)          <-- NEW field
  |
  +-- [Left Sidebar]
  |     +-- Content tab (existing)
  |     +-- Design tab (existing)
  |     +-- ATS tab (NEW: ATSPanel component)
  |           +-- ATSScoreCard (format + content + relevance sub-scores)
  |           +-- MissingKeywords list
  |           +-- BulletSuggestions (weak verbs, missing metrics)
  |           +-- ATS mode toggle (controls DesignSettings.atsMode)
  |
  +-- [Preview Area]
  |     +-- CVRenderer (existing, unchanged interface)
  |           +-- TemplateProps now includes atsMode from DesignSettings
  |           +-- Each template reads designSettings.atsMode to switch layout
  |
  +-- [Business Logic]
        +-- scoring.ts (EXTENDED: add computeATSScore, computeFormatScore, computeContentScore)
        +-- displayModes.ts (UNCHANGED)
        +-- atsRules.ts (NEW: ATS formatting rules, template compatibility map)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `EditorPage.tsx` | Orchestrates tabs, passes atsMode via designSettings | ATSPanel, CVRenderer, scoring.ts |
| `ATSPanel.tsx` (NEW) | Renders ATS sidebar tab content: scores, keywords, suggestions | EditorPage (via props/callbacks), scoring.ts |
| `scoring.ts` (EXTENDED) | Computes all scores: experience relevance (existing) + ATS format/content/relevance | ATSPanel, EditorPage |
| `atsRules.ts` (NEW) | Template compatibility map, ATS formatting constraints, section name standards | scoring.ts (format score), templates (atsMode rendering) |
| `shared.tsx` (EXTENDED) | Add `getATSOverrides()` helper for template rendering in ATS mode | All templates |
| Templates A-F | Read `designSettings.atsMode` to switch to ATS-safe rendering | shared.tsx, displayModes.ts |
| `convex/ai.ts` | `getATSAnalysis` (exists, no UI yet) + `rewriteBullets` (extend) | ATSPanel via useAction |

### Data Flow

**ATS Score Computation (real-time, no AI):**

```
jobDescription (state)
  --> extractKeywords() [scoring.ts, existing]
  --> computeATSScore(cvData, jobKeywords, designSettings) [scoring.ts, NEW]
        |
        +-- computeFormatScore(cvData, designSettings)
        |     reads: atsMode, template, fontFamily, includedSections
        |     checks: single-column?, standard fonts?, no icons?, required sections present?
        |
        +-- computeContentScore(cvData)
        |     checks: bullet count per experience, action verbs, metrics presence, summary exists
        |
        +-- computeRelevanceScore(cvData, jobKeywords) [wraps existing computeKeywordMatch]
        |     checks: keyword coverage across all sections
        |
        --> returns { total: 0-100, format: 0-100, content: 0-100, relevance: 0-100 }
```

**ATS Mode Toggle Flow:**

```
User toggles ATS mode ON in ATSPanel
  --> setDesignSettings(prev => ({ ...prev, atsMode: true }))
  --> CVRenderer re-renders (atsMode now in designSettings)
  --> Each template checks designSettings.atsMode:
        IF atsMode:
          - Force single-column layout (override grid-cols for TemplateF)
          - Hide icons (lucide icons replaced with text)
          - Use standard font (override fontFamily to 'sans')
          - Force standard section names (via atsRules.ts mapping)
          - Remove decorative elements (colored backgrounds, borders)
        ELSE:
          - Render as normal (existing behavior)
  --> computeATSScore recalculates (format score jumps because atsMode = true)
  --> ATSPanel updates scores in real-time
```

**ATS Mode Toggle on incompatible template:**

```
User on TemplateD (Creative) toggles ATS ON
  --> atsRules.ts: TEMPLATE_COMPATIBILITY_MAP['TEMPLATE_D'] = 'limited'
  --> ATSPanel shows warning: "Ce template a une compatibilite ATS limitee"
  --> Suggest switch to TemplateC (Minimal) or TemplateA (Classic)
  --> User confirms or dismisses
  --> No forced auto-switch (user retains control, but score reflects reality)
```

**AI-powered ATS analysis (on-demand, not real-time):**

```
User clicks "Analyse complete" button in ATSPanel
  --> calls getATSAnalysis action (convex/ai.ts, already exists)
  --> returns ATSResult { score, missingKeywords, strengths, improvements, ats_compatibility }
  --> ATSPanel displays AI insights alongside real-time basic score
  --> Missing keywords highlighted with "Rewrite" button per keyword
```

## Where New Logic Lives

### Extend: `scoring.ts` (add ~80 lines)

Add three new exported functions. This file already owns keyword extraction and scoring -- ATS scoring is a natural extension.

```typescript
// NEW: Top-level ATS score aggregator
export function computeATSScore(
  cvData: CVData,
  jobKeywords: string[],
  designSettings: DesignSettings,
): ATSScoreBreakdown {
  const format = computeFormatScore(cvData, designSettings);
  const content = computeContentScore(cvData);
  const relevance = jobKeywords.length > 0
    ? computeRelevanceScore(cvData, jobKeywords)
    : null; // null = no job description provided
  
  const total = relevance !== null
    ? Math.round(format * 0.3 + content * 0.3 + relevance * 0.4)
    : Math.round(format * 0.5 + content * 0.5);
  
  return { total, format, content, relevance };
}

// NEW: Format compliance score (no AI needed)
function computeFormatScore(cvData: CVData, settings: DesignSettings): number { ... }

// NEW: Content quality score (no AI needed)  
function computeContentScore(cvData: CVData): number { ... }

// NEW: Keyword relevance score (wraps existing computeKeywordMatch)
function computeRelevanceScore(cvData: CVData, jobKeywords: string[]): number { ... }
```

**Rationale for extending scoring.ts rather than new module:**
- `extractKeywords` and `computeKeywordMatch` already live here
- ATS scoring is conceptually the same domain as experience scoring
- Avoids import chains between two scoring modules
- File stays under 300 lines (current 202 + ~80 new = ~282)

### New: `atsRules.ts` (~60 lines)

Separate from scoring because these are static configuration/rules, not computation.

```typescript
// Template ATS compatibility classification
export const TEMPLATE_ATS_MAP: Record<string, 'full' | 'limited' | 'incompatible'> = {
  TEMPLATE_A: 'full',      // Classic: already mostly single-column
  TEMPLATE_B: 'full',      // Modern: header-focused, single-column body
  TEMPLATE_C: 'full',      // Minimal: single-column, ideal for ATS
  TEMPLATE_D: 'limited',   // Creative: heavy styling, colored backgrounds
  TEMPLATE_E: 'full',      // Elegant: serif-based but single-column
  TEMPLATE_F: 'limited',   // Sidebar: two-column grid layout
};

// Standard ATS section names (bilingual)
export const ATS_SECTION_NAMES: Record<string, { fr: string; en: string }> = {
  summary: { fr: 'Profil', en: 'Summary' },
  experience: { fr: 'Experience Professionnelle', en: 'Work Experience' },
  education: { fr: 'Formation', en: 'Education' },
  skills: { fr: 'Competences', en: 'Skills' },
  languages: { fr: 'Langues', en: 'Languages' },
};

// ATS-safe font override
export const ATS_SAFE_FONTS = ['sans', 'serif'] as const;

// Format checks used by computeFormatScore
export function getFormatIssues(cvData: CVData, settings: DesignSettings): FormatIssue[] { ... }
```

### New: `ATSPanel.tsx` (~200 lines)

Lives in `src/features/editor/components/ATSPanel.tsx` alongside existing editor components.

```typescript
interface ATSPanelProps {
  cvData: CVData;
  designSettings: DesignSettings;
  jobDescription: string;
  jobKeywords: string[];
  onToggleATSMode: (enabled: boolean) => void;
  onRequestAIAnalysis: () => void;
  isAnalyzing: boolean;
  aiResult: ATSResult | null;
}
```

**Sections within ATSPanel:**
1. Score card (3 gauges: Format, Content, Relevance) + total
2. ATS mode toggle with template compatibility warning
3. Format issues checklist (from atsRules.ts)
4. Missing keywords (from real-time scoring or AI analysis)
5. "Analyse complete" button (triggers AI via convex/ai.ts)
6. Job description prompt if none provided ("Importez une offre pour un score complet")

### Extend: `DesignSettings` type (add 1 field)

```typescript
export interface DesignSettings {
  // ... existing fields ...
  atsMode?: boolean;  // NEW: toggles ATS-safe rendering in templates
}
```

**Why on DesignSettings, not separate state:**
- atsMode affects rendering (same as fontFamily, showPhoto, etc.)
- Persists with saved CVs (user doesn't lose their toggle)
- Passes through existing TemplateProps pipeline (no interface changes needed)
- CVRenderer memo already watches designSettings for changes

### Extend: `TemplateProps` (NO change needed)

`TemplateProps` already includes `designSettings: DesignSettings`. Since `atsMode` is added to `DesignSettings`, all templates automatically receive it. Zero interface changes.

### Extend: `shared.tsx` (add ~30 lines)

```typescript
// NEW: Get ATS overrides for template rendering
export function getATSOverrides(settings: DesignSettings) {
  if (!settings.atsMode) return null;
  return {
    fontClass: 'font-sans',
    hideIcons: true,
    forceSingleColumn: true,
    hidePhoto: true,
    hideDecorations: true,
  };
}
```

### Extend: Each template (add ~10-15 lines each)

Each template adds an early check:

```typescript
export function TemplateF({ cvData, designSettings }: TemplateProps) {
  const atsOverrides = getATSOverrides(designSettings);
  const fontClass = atsOverrides?.fontClass ?? getFontClass(designSettings.fontFamily);
  const showPhoto = atsOverrides ? false : designSettings.showPhoto;
  
  // For TemplateF specifically: override grid layout
  const layoutClass = atsOverrides?.forceSingleColumn
    ? "w-full h-full bg-white px-16 pt-16 pb-20 space-y-8 pdf-safe"
    : cn("w-full h-full bg-white grid grid-cols-[260px_1fr] pdf-safe", fontClass);
  
  return <div className={layoutClass}>...</div>;
}
```

### Extend: `EditorPage.tsx` (add ~30 lines)

Add `'ats'` to the `activeTab` union type. Add one more tab button. Render `ATSPanel` when `activeTab === 'ats'`. Add AI analysis state and handler.

```typescript
const [activeTab, setActiveTab] = useState<'content' | 'design' | 'ats'>('content');
const [atsAIResult, setAtsAIResult] = useState<ATSResult | null>(null);
const [isAnalyzingATS, setIsAnalyzingATS] = useState(false);
const getATSAnalysisAction = useAction(api.ai.getATSAnalysis);

// Auto-open ATS tab when job description is imported
useEffect(() => {
  if (jobDescription && activeTab === 'content') setActiveTab('ats');
}, [jobDescription]);
```

**EditorPage is already 1637 lines.** The ATSPanel component is extracted, so EditorPage only adds ~30 lines of state/wiring. The panel component itself lives separately.

## Patterns to Follow

### Pattern 1: Score Computation as Pure Functions (existing pattern)
**What:** All scoring in scoring.ts is pure (no side effects, no React, no API calls)
**When:** Always for real-time scoring
**Why:** Enables memoization via `useMemo`, testable, predictable
```typescript
const atsScore = useMemo(
  () => computeATSScore(cvData, jobKeywords, designSettings),
  [cvData, jobKeywords, designSettings]
);
```

### Pattern 2: DesignSettings as Rendering Configuration (existing pattern)
**What:** All visual changes flow through DesignSettings
**When:** Anything that affects how the CV looks
**Why:** Single source of truth, persists with CV, memo-friendly

### Pattern 3: Tab-based Sidebar Panels (existing pattern)
**What:** EditorPage sidebar uses tabs to switch between content panels
**When:** Adding new sidebar functionality
**Why:** Consistent UX, no layout changes, just a new tab value

### Pattern 4: Convex Actions for AI (existing pattern)
**What:** AI calls go through Convex actions (server-side)
**When:** Any LLM call (getATSAnalysis, rewriteBullets)
**Why:** API keys stay server-side, access code verification, rate limiting possible

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate ATS State Object
**What:** Creating a parallel state object for ATS data alongside designSettings
**Why bad:** Splits rendering config into two sources of truth; templates need both; memo breaks
**Instead:** Put `atsMode` on DesignSettings. Put ATS AI results in component state (they're transient).

### Anti-Pattern 2: ATS-specific Template Components
**What:** Creating TemplateA_ATS.tsx, TemplateF_ATS.tsx variants
**Why bad:** Doubles template count (6 -> 12), duplicates rendering logic, maintenance nightmare
**Instead:** Each template reads `designSettings.atsMode` and conditionally adjusts its layout. The adjustment is ~10-15 lines per template using the `getATSOverrides()` helper.

### Anti-Pattern 3: Real-time AI Scoring
**What:** Calling getATSAnalysis on every cvData change
**Why bad:** LLM calls cost money, take 2-5 seconds, would create janky UX
**Instead:** Real-time score is pure computation (scoring.ts). AI analysis is on-demand button click.

### Anti-Pattern 4: New Scoring Module
**What:** Creating `atsScoring.ts` separate from `scoring.ts`
**Why bad:** Duplicates keyword extraction, forces cross-imports, two files doing the same conceptual thing
**Instead:** Extend scoring.ts. It goes from 202 to ~282 lines, well within limits.

### Anti-Pattern 5: Putting ATS Rules Inside scoring.ts
**What:** Mixing static configuration (template compatibility map, section name standards) with computation
**Why bad:** scoring.ts becomes a kitchen sink; rules are consumed by templates too, not just scoring
**Instead:** atsRules.ts for static config/rules, scoring.ts for computation that uses those rules.

## Simplification Opportunities

### Merge 1: formatDateShort + normalizeProficiency OUT of scoring.ts
**Current:** scoring.ts contains date formatting and proficiency normalization (lines 1-54, 186-201) mixed with scoring logic.
**Proposal:** Move `formatDateShort`, `MONTH_MAP_FR`, `normalizeProficiency`, `PROFICIENCY_MAP` to a new `formatting.ts` or into `shared.tsx` (templates already import shared.tsx). This makes scoring.ts purely about scoring and keeps it clean when ATS scoring is added.
**Impact:** ~55 lines moved out, ~80 lines added = scoring.ts stays at ~230 lines. Templates update one import path.

### Merge 2: ATSResult type already exists
**Current:** `ATSResult` interface exists in `src/shared/types/index.ts` (lines 76-82). `getATSAnalysis` exists in `convex/ai.ts` (lines 301-329). No UI consumes them yet.
**Proposal:** Reuse the existing `ATSResult` type. Add `ATSScoreBreakdown` type alongside it for the real-time computed score.
**Impact:** Zero duplication.

### Simplification 3: EditorPage state reduction
**Current:** EditorPage has 15+ useState calls. Adding ATS state would add 2-3 more.
**Proposal:** Group ATS-related state into a custom hook `useATSAnalysis()` that encapsulates the AI call state, caching, and provides { atsAIResult, isAnalyzing, requestAnalysis }.
**Impact:** EditorPage stays manageable; ATS state logic is testable in isolation.

## Suggested Build Order

Dependencies flow top-down; each step depends on the one above.

### Step 1: Types + Rules (no UI, no dependencies)
- Add `atsMode?: boolean` to `DesignSettings`
- Add `ATSScoreBreakdown` type to `shared/types`
- Create `atsRules.ts` (template compatibility map, section standards, format checks)
- **Why first:** Everything else depends on these definitions

### Step 2: Scoring Extension (pure logic, testable)
- Add `computeATSScore`, `computeFormatScore`, `computeContentScore`, `computeRelevanceScore` to `scoring.ts`
- Write tests for all new scoring functions
- Optionally: move formatting functions out of scoring.ts (Merge 1)
- **Why second:** ATSPanel needs scores to display; can be fully tested without UI

### Step 3: Template ATS Mode (rendering changes)
- Add `getATSOverrides()` to `shared.tsx`
- Update each template (A-F) to read atsMode and apply overrides
- TemplateF: override grid to single-column
- TemplateD: strip colored backgrounds, force standard layout
- **Why third:** Templates must respond to atsMode before the toggle exists in UI

### Step 4: ATSPanel Component (UI)
- Create `ATSPanel.tsx` in `src/features/editor/components/`
- Score display (3 sub-scores + total)
- ATS mode toggle with template compatibility warning
- Format issues checklist
- Missing keywords display
- "Analyse complete" button (wired to existing `getATSAnalysis` action)
- Job description prompt when none provided
- **Why fourth:** Needs scoring (step 2) and template support (step 3)

### Step 5: EditorPage Integration (wiring)
- Add `'ats'` tab to activeTab
- Wire ATSPanel into sidebar
- Auto-open ATS tab when job description imported
- Add `useATSAnalysis` hook for AI state management
- **Why last:** Pure integration; all pieces are built and tested

## File Impact Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `src/shared/types/index.ts` | Extend | +10 (ATSScoreBreakdown type, atsMode field) |
| `src/features/editor/lib/atsRules.ts` | NEW | ~60 |
| `src/features/editor/lib/scoring.ts` | Extend | +80 (ATS scoring functions) |
| `src/features/editor/templates/shared.tsx` | Extend | +30 (getATSOverrides) |
| `src/features/editor/templates/TemplateA-F.tsx` | Extend | +10-15 each (~70 total) |
| `src/features/editor/components/ATSPanel.tsx` | NEW | ~200 |
| `src/features/editor/hooks/useATSAnalysis.ts` | NEW | ~40 |
| `src/pages/EditorPage.tsx` | Extend | +30 (tab, wiring) |
| `convex/ai.ts` | Unchanged | 0 (getATSAnalysis already exists) |

**Total new code:** ~490 lines across 3 new files + extensions
**No new dependencies required**

## Sources

- Codebase analysis of existing architecture (all files read directly)
- Existing `getATSAnalysis` action in `convex/ai.ts` (lines 301-329)
- Existing `ATSResult` type in `src/shared/types/index.ts` (lines 76-82)
- Template rendering patterns from TemplateA-F source code
- EditorPage tab/sidebar pattern from source (lines 40, 267-310)

---

*Architecture analysis: 2026-04-09*
