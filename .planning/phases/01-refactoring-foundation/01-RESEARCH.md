# Phase 1: Refactoring Foundation - Research

**Researched:** 2026-04-09
**Domain:** TypeScript module refactoring, regex word-boundary matching, file deduplication
**Confidence:** HIGH

## Summary

Phase 1 is a pure refactoring phase with no UI changes. The work involves five distinct operations: (1) extracting `formatDateShort` and `normalizeProficiency` out of `scoring.ts` into a new formatting module, (2) creating `atsRules.ts` with four data categories, (3) fixing the keyword matching bug in `computeKeywordMatch` from substring to word-boundary, (4) merging the duplicate `cn()` function, and (5) cleaning barrel exports.

The codebase is well-structured with existing tests (50 passing, 3 test files) and a clear feature-based organization. The main risk is import path breakage when moving functions -- 6 template files + 1 test file import `formatDateShort`/`normalizeProficiency` from `scoring.ts`. The `cn()` merge is trivial since `src/lib/utils.ts` has zero consumers.

**Primary recommendation:** Extract formatting functions to `src/features/editor/lib/formatting.ts` (co-located with consumers), create `atsRules.ts` in the same directory, fix the regex bug with `\b` word boundaries, delete unused `src/lib/utils.ts`, and update all import paths. Run `npx vitest run` and `npx tsc --noEmit` after every change.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-03:** atsRules.ts must contain ALL of these: template compatibility map, section names FR/EN, ATS-safe fonts & styles, weak verb patterns
- **D-04:** Template compatibility map uses placeholder classifications now, will be updated in Phase 6
- **D-05:** Add clear section separators (// --- ATS Scoring ---) to organize scoring.ts
- **D-06:** Export currently-private helpers (computeKeywordMatch, computeRecency, computeDuration)
- **D-07:** Fix keyword matching bug NOW (Phase 1, not Phase 4) -- substring to word-boundary
- **D-08:** Merge duplicate cn() functions
- **D-09:** Clean up barrel exports
- **D-10:** Claude's Discretion on additional simplifications

### Claude's Discretion
- D-01: File placement for formatDateShort/normalizeProficiency (formatting.ts location)
- D-02: File placement for atsRules.ts
- D-10: Additional simplifications discovered during refactoring

### Deferred Ideas (OUT OF SCOPE)
None -- Phase 1 scope is well-defined refactoring work.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFAC-01 | scoring.ts extended with ATS scoring (not a separate module), kept within file size limits | Section separators + exporting private helpers prepares scoring.ts for Phase 4 ATS functions. File is 202 lines, well within 300-line service limit. |
| REFAC-02 | New atsRules.ts config module (~60 lines) for template compatibility map and section standards | Pure data/config module with 4 categories. No external dependencies needed. |
| REFAC-05 | formatDateShort and normalizeProficiency moved out of scoring.ts into shared utilities | 6 template files + 1 test file need import updates. Functions + data maps total ~80 lines to extract. |
</phase_requirements>

## Standard Stack

No new libraries needed. This phase uses only existing project dependencies.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.2 | Test runner | Already configured in vite.config.ts |
| typescript | 5.8.2 | Type checking | `npm run lint` = `tsc --noEmit` |
| clsx | 2.1.1 | Class name utility | Used by cn() |
| tailwind-merge | 3.5.0 | Tailwind class merge | Used by cn() |

**No installation needed.** All dependencies are already present.

## Architecture Patterns

### File Placement Decision (D-01): formatting.ts

**Recommendation: `src/features/editor/lib/formatting.ts`**

Rationale based on consumer analysis:
- All 6 consumers are in `src/features/editor/templates/` (TemplateA-F)
- No consumer outside the editor feature imports these functions
- Project convention: "Feature-specific: `src/features/editor/lib/newHelper.ts`" (STRUCTURE.md)
- `src/shared/lib/` would be wrong -- these are editor-internal utilities

### File Placement Decision (D-02): atsRules.ts

**Recommendation: `src/features/editor/lib/atsRules.ts`**

Rationale:
- Primary consumers will be scoring.ts (Phase 4), template components (Phase 6), and ATS panel (Phase 8) -- all within editor feature
- Section names used by templates (editor feature)
- Font rules used by templates (editor feature)
- If a shared consumer emerges later, moving is trivial

### Recommended Changes to scoring.ts

After extracting formatting functions, scoring.ts drops from 202 to ~120 lines. Add section separators and export private helpers:

```
scoring.ts (~140 lines after changes)
├── // --- Keyword Extraction ---
│   └── extractKeywords() + STOP_WORDS
├── // --- Relevance Scoring ---
│   └── scoreExperience() (public)
│   └── computeKeywordMatch() (now exported)
│   └── computeRecency() (now exported)
│   └── computeDuration() (now exported)
│   └── parseYear() (internal)
├── // --- Auto-Assign Display Modes ---
│   └── autoAssignModes()
└── // --- ATS Scoring --- (empty, ready for Phase 4)
```

### New File: formatting.ts (~80 lines)

```
formatting.ts
├── MONTH_MAP_FR (const)
├── formatDateShort() (exported)
├── PROFICIENCY_MAP (const)
└── normalizeProficiency() (exported)
```

### New File: atsRules.ts (~60 lines)

```
atsRules.ts
├── TEMPLATE_ATS_COMPAT (Record<string, 'full' | 'limited'>)
├── SECTION_NAMES (Record<'fr' | 'en', Record<string, string>>)
├── ATS_SAFE_FONTS (string[])
├── ATS_COLOR_CONSTRAINTS (object)
└── WEAK_VERBS (Record<'fr' | 'en', { weak: string[], strong: string[] }>)
```

### Import Update Map

Files that need import path changes when formatting functions move:

| File | Current Import | New Import |
|------|---------------|------------|
| `src/features/editor/templates/TemplateA.tsx` | `from '../lib/scoring'` | `from '../lib/formatting'` |
| `src/features/editor/templates/TemplateB.tsx` | `from '../lib/scoring'` | `from '../lib/formatting'` |
| `src/features/editor/templates/TemplateC.tsx` | `from '../lib/scoring'` | `from '../lib/formatting'` |
| `src/features/editor/templates/TemplateD.tsx` | `from '../lib/scoring'` | `from '../lib/formatting'` |
| `src/features/editor/templates/TemplateE.tsx` | `from '../lib/scoring'` | `from '../lib/formatting'` |
| `src/features/editor/templates/TemplateF.tsx` | `from '../lib/scoring'` | `from '../lib/formatting'` |
| `src/features/editor/lib/scoring.test.ts` | `from './scoring'` | Split: scoring functions from `'./scoring'`, formatting from `'./formatting'` |

### cn() Merge Plan

| File | Action |
|------|--------|
| `src/lib/utils.ts` | **DELETE** -- zero consumers found (grep confirmed) |
| `src/shared/lib/cn.ts` | **KEEP** -- 11 files import from here |
| `src/shared/lib/index.ts` | Already exports cn from './cn' -- no change needed |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Word-boundary matching | Custom tokenizer or split-and-compare | RegExp `\b` word boundaries | Standard regex feature, handles Unicode when combined with proper escaping |
| Class name merging | Manual string concatenation | clsx + tailwind-merge (cn()) | Already in project, handles deduplication and conflicts |

## Common Pitfalls

### Pitfall 1: RegExp Word Boundary with Special Characters
**What goes wrong:** `\b` does not work correctly with keywords containing special chars like `C++`, `C#`, `.NET`, or `Node.js`.
**Why it happens:** `\b` matches at word boundary (between `\w` and `\W`). Characters like `+`, `#`, `.` are `\W`, so `\bC++\b` fails.
**How to avoid:** Escape regex special characters in keywords before building the RegExp. Use `keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` for escaping. For keywords with special chars, fall back to a broader match pattern.
**Warning signs:** Tests pass with simple words but fail with technical terms.

### Pitfall 2: Case Sensitivity in Word-Boundary Matching
**What goes wrong:** `\b` matching is case-sensitive by default.
**Why it happens:** Forgetting the `i` flag on the RegExp.
**How to avoid:** The current code already lowercases both text and keywords. Keep this pattern -- lowercase both sides, no `i` flag needed.

### Pitfall 3: Circular Imports When Extracting Modules
**What goes wrong:** Creating circular dependencies when new modules import from each other.
**Why it happens:** `scoring.ts` and `formatting.ts` could accidentally cross-import.
**How to avoid:** `formatting.ts` should have ZERO imports from `scoring.ts`. It is a leaf module (only imports types from shared/types if needed, but current functions don't even need types).

### Pitfall 4: Breaking Test Imports
**What goes wrong:** Tests fail because import paths changed but test file wasn't updated.
**Why it happens:** `scoring.test.ts` currently imports `formatDateShort` and `normalizeProficiency` from `./scoring`.
**How to avoid:** Update test imports immediately when moving functions. Consider splitting into `formatting.test.ts` for the moved functions.

### Pitfall 5: French Accented Characters in Regex
**What goes wrong:** `\b` word boundary may not work correctly with accented French characters (e, e with accent are different `\w` classes).
**Why it happens:** JavaScript `\b` only considers ASCII word characters (`[a-zA-Z0-9_]`). French accented characters (a-z with accents) are treated as non-word characters.
**How to avoid:** For the keyword matching fix, since both text and keywords are already lowercased and the current `extractKeywords` strips non-alphanumeric (keeping accented chars via the regex range `a-z\u00e0-\u00ff`), use a pattern that handles this: wrap keyword in `(?:^|\\s|[^a-z\u00e0-\u00ff])` and `(?:$|\\s|[^a-z\u00e0-\u00ff])` lookarounds instead of bare `\b`.

## Code Examples

### Word-Boundary Fix for computeKeywordMatch

Current buggy code (line 153):
```typescript
// BUG: "java" matches "javascript" via substring
if (text.includes(kw)) hits++;
```

Fixed code:
```typescript
function computeKeywordMatch(exp: Experience, keywords: string[]): number {
  const text = [exp.position, exp.company, ...(exp.description || [])].join(' ').toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    // Escape regex special chars, then use word boundaries
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use \b for ASCII words, lookaround for accented chars
    const re = new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, 'i');
    if (re.test(text)) hits++;
  }
  return Math.min(100, Math.round((hits / Math.max(1, keywords.length)) * 100));
}
```

**Note:** Since `extractKeywords` already lowercases and the text is lowercased, a simpler approach using `\b` may suffice for most keywords. The accented character edge case should be tested with French keywords like "developpeur" vs "developper".

### atsRules.ts Template

```typescript
// ─── Template ATS Compatibility ───

/** Placeholder classifications -- refined in Phase 6 after per-template analysis */
export const TEMPLATE_ATS_COMPAT: Record<string, 'full' | 'limited'> = {
  TEMPLATE_A: 'limited',  // Two-column layout
  TEMPLATE_B: 'full',     // Header-focused, adaptable
  TEMPLATE_C: 'full',     // Minimal single-column
  TEMPLATE_D: 'limited',  // Creative colored sidebar
  TEMPLATE_E: 'full',     // Elegant single-column
  TEMPLATE_F: 'limited',  // Sidebar variant
};

// ─── ATS Section Names ───

export const SECTION_NAMES = {
  fr: {
    experience: 'Experience professionnelle',
    education: 'Formation',
    skills: 'Competences',
    languages: 'Langues',
    contact: 'Coordonnees',
    summary: 'Profil professionnel',
  },
  en: {
    experience: 'Work Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    contact: 'Contact Information',
    summary: 'Professional Summary',
  },
} as const;

// ─── ATS-Safe Fonts & Styles ───

export const ATS_SAFE_FONTS = ['Arial', 'Calibri', 'Helvetica', 'Times New Roman', 'Georgia'] as const;

export const ATS_COLOR_CONSTRAINTS = {
  minContrast: 4.5,        // WCAG AA minimum
  maxColors: 2,            // primary + text only
  forcedTextColor: '#000', // Black text for ATS
} as const;

// ─── Weak Verb Patterns ───

export const WEAK_VERBS = {
  fr: {
    weak: ['responsable de', 'charge de', 'participe a', 'aide a', 'fait', 'gere'],
    strong: ['dirige', 'optimise', 'deploye', 'implemente', 'augmente', 'reduit'],
  },
  en: {
    weak: ['responsible for', 'helped', 'worked on', 'assisted', 'participated in', 'managed'],
    strong: ['led', 'optimized', 'deployed', 'implemented', 'increased', 'reduced'],
  },
} as const;
```

### formatting.ts Extract

```typescript
// ─── Date formatting ───

const MONTH_MAP_FR: Record<string, string> = {
  // ... (move entire map from scoring.ts)
};

/**
 * Shorten a date string for CV display.
 * "Septembre 2021" -> "Sept. 2021"
 */
export function formatDateShort(date?: string): string {
  // ... (move entire function from scoring.ts)
}

// ─── Language proficiency normalization ───

const PROFICIENCY_MAP: Record<string, string> = {
  // ... (move entire map from scoring.ts)
};

/** Normalize language proficiency to French labels */
export function normalizeProficiency(proficiency: string): string {
  return PROFICIENCY_MAP[proficiency.toLowerCase().trim()] || proficiency;
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vite.config.ts` (test section embedded) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Current Test State
- 3 test files, 50 tests, all passing
- `scoring.test.ts` -- 19 tests (formatDateShort, extractKeywords, scoreExperience, autoAssignModes, normalizeProficiency)
- `displayModes.test.ts` -- 23 tests
- `autoFit.test.ts` -- 8 tests (estimated)

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFAC-01 | scoring.ts exports computeKeywordMatch, computeRecency, computeDuration | unit | `npx vitest run src/features/editor/lib/scoring.test.ts -t "export"` | Needs new tests |
| REFAC-01 | Word-boundary matching prevents false positives | unit | `npx vitest run src/features/editor/lib/scoring.test.ts -t "keyword"` | Needs new tests |
| REFAC-02 | atsRules.ts exports all 4 data categories | unit | `npx vitest run src/features/editor/lib/atsRules.test.ts` | Needs Wave 0 |
| REFAC-05 | formatDateShort works from new location | unit | `npx vitest run src/features/editor/lib/formatting.test.ts` | Needs Wave 0 (move from scoring.test.ts) |
| REFAC-05 | normalizeProficiency works from new location | unit | `npx vitest run src/features/editor/lib/formatting.test.ts` | Needs Wave 0 (move from scoring.test.ts) |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite green + `npx vite build` before verify

### Wave 0 Gaps
- [ ] `src/features/editor/lib/formatting.test.ts` -- move formatDateShort and normalizeProficiency tests from scoring.test.ts
- [ ] `src/features/editor/lib/scoring.test.ts` -- add tests for word-boundary matching (Java vs JavaScript), add tests for exported helpers
- [ ] `src/features/editor/lib/atsRules.test.ts` -- smoke test that all exports exist and have expected shapes

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed in canonical references
- `npx vitest run` output -- 50 tests passing, 3 files
- `grep` results -- complete consumer mapping for all affected functions

### Secondary (MEDIUM confidence)
- MDN RegExp word boundaries -- standard JavaScript regex behavior for `\b`
- Project CONVENTIONS.md and STRUCTURE.md -- file placement guidelines

**No external research needed.** This phase is purely internal refactoring using existing project patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing
- Architecture: HIGH -- consumer analysis done via grep, all import paths mapped
- Pitfalls: HIGH -- regex edge cases well-documented, French accent issue identified
- File placement: HIGH -- consumer analysis clearly shows editor-internal usage

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable -- internal refactoring, no external dependencies)
