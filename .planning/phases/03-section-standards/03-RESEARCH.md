# Phase 3: Section Standards - Research

**Researched:** 2026-04-09
**Domain:** Template rendering, i18n section titles, TypeScript utility functions
**Confidence:** HIGH

## Summary

Phase 3 is a well-scoped find-and-replace refactoring across 6 template files. The data source (`SECTION_NAMES` in `atsRules.ts`) already exists with correct FR/EN values. The language detection infrastructure (`getCVLanguage()`) is already wired into `EditorPage.tsx` as `currentLanguage`. The only work is: (1) create a `getSectionTitle()` getter function, (2) thread the language prop through `TemplateProps` and `CVRenderer`, and (3) replace every hardcoded string literal in templates A-F with `getSectionTitle()` calls.

The codebase audit revealed one naming inconsistency: TemplateB uses "Expertise" for the skills section instead of "Competences". This will be normalized by the `getSectionTitle()` function. Additionally, TemplateA and TemplateB have hardcoded "Present" date labels that are out of scope for this phase (date labels are not section titles).

**Primary recommendation:** Add `getSectionTitle()` to `atsRules.ts` (co-located with `SECTION_NAMES`), extend `TemplateProps` with `language: SupportedLanguage`, thread it through `CVRenderer`, and replace all hardcoded section name strings in 6 templates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Create a `getSectionTitle(key: SectionKey, language: 'fr' | 'en'): string` utility function
- D-02: This function reads from SECTION_NAMES in atsRules.ts (already exists from Phase 1)
- D-03: All 6 templates replace hardcoded section name strings with getSectionTitle() calls
- D-04: Section names are NOT in CVData -- they are rendering logic in templates, not user data
- D-05: Standard section keys: 'experience', 'education', 'skills', 'languages', 'contact', 'summary'
- D-06: Current hardcoded names to replace:
  - "Competences" -> getSectionTitle('skills', lang)
  - "Formation" -> getSectionTitle('education', lang)
  - "Langues" -> getSectionTitle('languages', lang)
  - "Experience" / "Experience professionnelle" -> getSectionTitle('experience', lang)
  - "Coordonnees" / "Contact" -> getSectionTitle('contact', lang)
  - "Profil" / "Resume" -> getSectionTitle('summary', lang)
- D-07: Templates receive the CV language via props (from getCVLanguage() in EditorPage)
- D-08: Language is passed through TemplateProps -> each template uses it for getSectionTitle() calls

### Claude's Discretion
- Where to place getSectionTitle() (in atsRules.ts next to SECTION_NAMES, or in a separate utility)
- Whether to extend TemplateProps with a `language` prop or derive it inside the template from cvData
- Any additional section name variations found during implementation

### Deferred Ideas (OUT OF SCOPE)
None -- Phase 3 scope is well-defined.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SECT-01 | Section names are forced to ATS-recognized standards (not user-editable) | getSectionTitle() reads from SECTION_NAMES constant; templates use this exclusively, no user input |
| SECT-02 | French section names: "Experience professionnelle", "Formation", "Competences", "Langues", "Coordonnees", "Profil professionnel" | Already defined in SECTION_NAMES.fr in atsRules.ts |
| SECT-03 | English section names: "Work Experience", "Education", "Skills", "Languages", "Contact Information", "Professional Summary" | Already defined in SECTION_NAMES.en in atsRules.ts |
| SECT-04 | Language of section names is auto-detected from CV content | getCVLanguage() from Phase 2 already computes this; currentLanguage variable exists in EditorPage |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack**: React 18 + Vite + Convex + Clerk -- no migration
- **Simplicity**: Do not add complexity -- merge and simplify existing files
- **Naming**: camelCase for utility functions, PascalCase for types, UPPERCASE for immutable constants
- **Immutability**: Always return new objects, never mutate
- **File limits**: Utility files max 200 lines, hooks max 150 lines
- **Functions**: < 50 lines, nesting < 4 levels
- **No console.log in production**: Only console.error in catch blocks
- **Type checking**: `npx tsc --noEmit` must pass
- **Build check**: `npx vite build` must pass

## Architecture Patterns

### Recommended Approach: Co-locate getSectionTitle with SECTION_NAMES

**Rationale:** `atsRules.ts` is currently 56 lines. Adding `getSectionTitle()` (roughly 8 lines including type + function) keeps it under 70 lines -- well within the 200-line utility file limit. Co-location means the getter and its data are in the same file, making maintenance trivial.

### Data Flow

```
EditorPage.tsx
  const currentLanguage = getCVLanguage(cvData)    // already exists (line 79)
       |
       v
  renderCV() -> <CVRendererComponent language={currentLanguage} ... />
       |
       v
CVRenderer.tsx
  Props extends TemplateProps { language: SupportedLanguage }
  <Template language={language} ... />
       |
       v
TemplateX.tsx
  const { language } = props;
  getSectionTitle('experience', language)  // replaces hardcoded "Experience"
```

### Prop Threading Pattern

```typescript
// shared.tsx -- extend TemplateProps
export interface TemplateProps {
  cvData: CVData;
  designSettings: DesignSettings;
  language: SupportedLanguage;  // NEW
}
```

```typescript
// CVRenderer.tsx -- thread language through
interface Props extends TemplateProps {
  selectedTemplate: string;
}
// No other changes needed -- spread already passes all TemplateProps to Template
```

```typescript
// EditorPage.tsx -- pass language in renderCV()
return <CVRendererComponent
  selectedTemplate={selectedTemplate}
  cvData={cvData}
  designSettings={designSettings}
  language={currentLanguage}  // NEW -- currentLanguage already computed at line 79
/>;
```

## Hardcoded Section Names Inventory

Complete audit of every hardcoded section title across all 6 templates:

### TemplateA (5 replacements)
| Line | Current Value | Section Key | Notes |
|------|--------------|-------------|-------|
| 57 | "Experience Professionnelle" | experience | Full French with accent |
| 66 | "Profil" | summary | Short form |
| 75 | "Competences" | skills | With accent |
| 92 | "Formation" | education | Standard |
| 105 | "Langues" | languages | Standard |

### TemplateB (6 replacements)
| Line | Current Value | Section Key | Notes |
|------|--------------|-------------|-------|
| 41 | "Profil" | summary | Short form |
| 49 | "Contact" | contact | Standard |
| 61 | "Langues" | languages | Standard |
| 75 | "Expertise" | skills | NON-STANDARD -- must normalize |
| 101 | "Experience" | experience | Short form, no accent |
| 129 | "Formation" | education | Standard |

### TemplateC (5 replacements)
| Line | Current Value | Section Key | Notes |
|------|--------------|-------------|-------|
| 40 | "Profil" | summary | Short form |
| 47 | "Experience" | experience | Short form, with accent |
| 76 | "Competences" | skills | With accent |
| 93 | "Formation" | education | Standard |
| 108 | "Langues" | languages | Standard |

### TemplateD (5 replacements)
| Line | Current Value | Section Key | Notes |
|------|--------------|-------------|-------|
| 48 | "Profil" | summary | Standard |
| 58 | "Experience" | experience | With accent |
| 86 | "Competences" | skills | With accent |
| 106 | "Formation" | education | Standard |
| 121 | "Langues" | languages | Standard |

### TemplateE (5 replacements)
| Line | Current Value | Section Key | Notes |
|------|--------------|-------------|-------|
| 45 | "Profil" | summary | Standard |
| 55 | "Experience" | experience | With accent |
| 84 | "Competences" | skills | With accent |
| 105 | "Formation" | education | Standard |
| 123 | "Langues" | languages | Standard |

### TemplateF (6 replacements)
| Line | Current Value | Section Key | Notes |
|------|--------------|-------------|-------|
| 42 | "Contact" | contact | Standard |
| 54 | "Competences" | skills | With accent |
| 72 | "Formation" | education | Standard |
| 87 | "Langues" | languages | Standard |
| 104 | "Profil" | summary | Standard |
| 114 | "Experience" | experience | With accent |

**Total: 32 string replacements across 6 files.**

### Additional Hardcoded French Strings (OUT OF SCOPE)
- TemplateA line 29: `'Present'` (date label for current jobs)
- TemplateB line 109: `'Present'` (date label for current jobs)
- These are date-related, not section titles. Defer to a future phase if needed.

## Code Examples

### getSectionTitle utility (add to atsRules.ts)

```typescript
// src/features/editor/lib/atsRules.ts

export type SectionKey = keyof typeof SECTION_NAMES.fr;

/** Returns the ATS-standard section title for a given key and language. */
export function getSectionTitle(key: SectionKey, language: 'fr' | 'en'): string {
  return SECTION_NAMES[language][key];
}
```

### Template usage pattern

```typescript
// In any TemplateX.tsx
import { getSectionTitle } from '../lib/atsRules';

export function TemplateX({ cvData, designSettings, language }: TemplateProps) {
  // ...
  <h2 ...>{getSectionTitle('experience', language)}</h2>
  <h2 ...>{getSectionTitle('skills', language)}</h2>
  // etc.
}
```

### SupportedLanguage type import

```typescript
// SupportedLanguage is already exported from languageDetection.ts
// Import it in shared.tsx for TemplateProps
import type { SupportedLanguage } from '@/src/lib/languageDetection';
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section name mapping | Custom switch/case per template | SECTION_NAMES constant + getSectionTitle() | Single source of truth, already exists |
| Language detection | Per-template language guessing | getCVLanguage() from Phase 2 | Already implemented and tested |
| Type for section keys | Manual string union | `keyof typeof SECTION_NAMES.fr` | Auto-syncs if keys are added |

## Common Pitfalls

### Pitfall 1: Missing a hardcoded string
**What goes wrong:** One template still shows French when language is English
**Why it happens:** Grep misses strings with different casings or accented characters
**How to avoid:** Use the inventory above (32 replacements). After implementation, grep for remaining French section words: `grep -rn "Compet\|Formation\|Langues\|Profil\|Experience\|Contact\|Expertise\|Coordonn" src/features/editor/templates/`
**Warning signs:** Visual diff shows French text in English mode

### Pitfall 2: Forgetting to thread language through CVRenderer
**What goes wrong:** TypeScript error because CVRenderer Props doesn't include language
**Why it happens:** CVRenderer has its own Props interface that extends TemplateProps
**How to avoid:** CVRenderer Props already extends TemplateProps. Once TemplateProps includes `language`, CVRenderer Props inherits it automatically. Just spread it in the JSX.

### Pitfall 3: Breaking memo comparison in CVRenderer
**What goes wrong:** CVRenderer re-renders on every render because language is a new reference
**Why it happens:** Adding a prop to memoized component
**How to avoid:** `language` is a primitive string ('fr' | 'en'), so memo's shallow comparison works correctly. No issue here.

### Pitfall 4: TemplateB "Expertise" not matching SECTION_NAMES
**What goes wrong:** TemplateB currently uses "Expertise" for skills, which differs from SECTION_NAMES.fr.skills = "Competences"
**Why it happens:** Templates were designed independently with different naming choices
**How to avoid:** This is intentionally normalized by this phase -- all templates will use SECTION_NAMES values

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | Inferred from package.json (no vitest.config.* found) |
| Quick run command | `npx vitest run src/features/editor/lib/atsRules.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SECT-01 | getSectionTitle returns standard names, not user input | unit | `npx vitest run src/features/editor/lib/atsRules.test.ts -x` | Exists (extend) |
| SECT-02 | French section names match spec | unit | `npx vitest run src/features/editor/lib/atsRules.test.ts -x` | Exists (extend) |
| SECT-03 | English section names match spec | unit | `npx vitest run src/features/editor/lib/atsRules.test.ts -x` | Exists (extend) |
| SECT-04 | Language auto-detection drives section names | unit | `npx vitest run src/lib/languageDetection.test.ts -x` | Exists (already covered by Phase 2) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/editor/lib/atsRules.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npx tsc --noEmit` + `npx vite build`

### Wave 0 Gaps
- [ ] Add `getSectionTitle()` tests to `src/features/editor/lib/atsRules.test.ts` -- covers SECT-01, SECT-02, SECT-03

## Open Questions

1. **"Present" date label localization**
   - What we know: TemplateA (line 29) and TemplateB (line 109) use hardcoded "Present" for current job dates
   - What's unclear: Whether this should be localized in this phase
   - Recommendation: Out of scope for Phase 3 (section titles only). Note for a future phase.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all 6 template files, atsRules.ts, shared.tsx, CVRenderer.tsx, EditorPage.tsx, languageDetection.ts, types/index.ts
- All findings verified by reading actual source code

### Secondary (MEDIUM confidence)
- None needed -- this phase is entirely within the existing codebase with no external dependencies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, pure refactoring of existing code
- Architecture: HIGH - Data flow pattern is straightforward prop threading, already partially implemented
- Pitfalls: HIGH - Complete audit of all 32 hardcoded strings performed via source code reading

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable -- internal refactoring, no external dependencies)
