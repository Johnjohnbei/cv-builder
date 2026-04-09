# Phase 2: Language Detection - Research

**Researched:** 2026-04-09
**Domain:** Client-side natural language detection (FR/EN), CVData type extension, Convex schema migration
**Confidence:** HIGH

## Summary

Phase 2 adds automatic FR/EN language detection to the CV builder using franc-min (v6.2.0), a lightweight ESM-only library that returns ISO 639-3 codes. The implementation requires extending CVData with two new fields (`detectedLanguage` and `languageOverride`), updating the Convex schema, creating a `detectCVLanguage()` detection function and a `getCVLanguage()` utility, wiring detection into the import pipeline, and adding a manual FR/EN selector in the editor UI.

The technical surface is small and well-defined: franc-min's API is a single function call, the CVData type extension is two optional fields, and the downstream API is a pure function. The main integration points are the DashboardPage (import-time detection) and EditorPage (re-detection trigger + manual override selector).

**Primary recommendation:** Use franc-min v6.2.0 with `only: ['fra', 'eng']` to restrict detection to the two supported languages, concatenate all CV text for maximum accuracy, and expose everything through a single `getCVLanguage(cvData)` utility that downstream systems consume.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Detect language at import (LinkedIn PDF, non-LinkedIn PDF, AI extraction) -- not on every keystroke
- D-02: Provide on-demand re-detection (button/trigger) for when user changes language after import
- D-03: No debounced auto-recalculation during editing
- D-04: Concatenate all CV text content for detection: title + summary + experience descriptions + skills
- D-05: Use franc-min library (v6.x, ~27KB) for client-side detection, zero API calls
- D-06: Add `detectedLanguage: 'fr' | 'en'` field to CVData type in `src/shared/types/index.ts` -- persisted in database
- D-07: This requires updating the Convex schema to include the new field
- D-08: Majority language wins -- franc-min returns the dominant language
- D-09: No special warning for low confidence scores
- D-10: Add a small FR/EN selector in the editor settings/header for manual override
- D-11: Manual override takes precedence over auto-detection
- D-12: Override is stored in CVData alongside detectedLanguage (e.g., `languageOverride?: 'fr' | 'en'`)
- D-13: Expose a utility function `getCVLanguage(cvData)` that returns the effective language (override > detected > default 'fr')
- D-14: Downstream systems call getCVLanguage() instead of checking detectedLanguage directly

### Claude's Discretion
- Exact placement of the FR/EN selector in the UI (header, sidebar, settings panel)
- How to trigger re-detection (button label, placement)
- Whether to lazy-load franc-min to avoid initial bundle impact

### Deferred Ideas (OUT OF SCOPE)
None -- Phase 2 scope is well-defined.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LANG-01 | System auto-detects CV language (French vs English) from content | franc-min v6.2.0 with `only: ['fra', 'eng']` option; `detectCVLanguage()` function concatenates CV text fields and calls `franc()` |
| LANG-02 | ATS rules, section names, suggestions, and scoring adapt based on detected language | `getCVLanguage(cvData)` utility returns effective language; SECTION_NAMES in atsRules.ts already has fr/en variants; WEAK_VERBS already has fr/en variants |
| LANG-03 | Language detection uses franc-min library (lightweight, client-side) | franc-min 6.2.0 is ESM-only, ~27KB, supports 82 languages, returns ISO 639-3 codes |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| franc-min | 6.2.0 | Client-side language detection | Lightweight (82 langs, 8M+ speakers), ESM-only, zero dependencies, used by wooorm ecosystem |

### Supporting
No additional libraries needed. All other dependencies (React, Convex, Lucide icons) are already in the project.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| franc-min | franc (187 langs) | Larger bundle, unnecessary -- only FR/EN needed |
| franc-min | franc-all (414 langs) | Much larger bundle, completely unnecessary |
| franc-min | Browser Intl API | No language detection capability in Intl |
| franc-min | Server-side detection | Requires API call, contradicts D-05 |

**Installation:**
```bash
npm install franc-min
```

**Version verification:** franc-min 6.2.0 is the latest version (verified via npm registry, last published 2024-01-11).

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    languageDetection.ts      # detectCVLanguage() + getCVLanguage() + text concatenation
  shared/
    types/
      index.ts                # CVData extended with detectedLanguage + languageOverride
  features/
    editor/
      components/
        LanguageSelector.tsx   # Small FR/EN toggle component
        EditorHeader.tsx       # Modified to include LanguageSelector
      lib/
        atsRules.ts            # Already has SECTION_NAMES.fr / SECTION_NAMES.en
```

### Pattern 1: Detection Function
**What:** Pure function that concatenates CV text and calls franc-min
**When to use:** At import time and on-demand re-detection
**Example:**
```typescript
// src/lib/languageDetection.ts
import { franc } from 'franc-min';
import type { CVData } from '../shared/types';

type SupportedLanguage = 'fr' | 'en';

const ISO_TO_LANG: Record<string, SupportedLanguage> = {
  fra: 'fr',
  eng: 'en',
};

/**
 * Concatenate all CV text content for language detection.
 * More text = better accuracy from franc-min.
 */
function extractCVText(cvData: CVData): string {
  const parts: string[] = [];
  
  if (cvData.personal_info.title) parts.push(cvData.personal_info.title);
  if (cvData.personal_info.summary) parts.push(cvData.personal_info.summary);
  
  for (const exp of cvData.experience) {
    if (exp.position) parts.push(exp.position);
    if (exp.intro) parts.push(exp.intro);
    parts.push(...exp.description);
  }
  
  for (const cat of cvData.skills) {
    parts.push(...cat.items);
  }
  
  return parts.join(' ');
}

/**
 * Detect the language of CV content using franc-min.
 * Returns 'fr' or 'en', defaults to 'fr' if undetermined.
 */
export function detectCVLanguage(cvData: CVData): SupportedLanguage {
  const text = extractCVText(cvData);
  if (text.length < 20) return 'fr'; // Not enough text, default to French
  
  const detected = franc(text, { only: ['fra', 'eng'] });
  return ISO_TO_LANG[detected] ?? 'fr';
}
```

### Pattern 2: Effective Language Utility
**What:** Pure function that resolves the effective language (override > detected > default)
**When to use:** All downstream systems call this instead of reading fields directly
**Example:**
```typescript
/**
 * Get the effective CV language: manual override > auto-detected > default 'fr'.
 * This is the ONLY function downstream systems should call.
 */
export function getCVLanguage(cvData: CVData): SupportedLanguage {
  return cvData.languageOverride ?? cvData.detectedLanguage ?? 'fr';
}
```

### Pattern 3: CVData Type Extension
**What:** Two optional fields added to CVData interface
**Example:**
```typescript
// In src/shared/types/index.ts
export interface CVData {
  // ... existing fields ...
  detectedLanguage?: 'fr' | 'en';
  languageOverride?: 'fr' | 'en';
}
```

### Pattern 4: Convex Schema Extension
**What:** Two optional string fields on the cvs table
**Example:**
```typescript
// In convex/schema.ts, inside the cvs defineTable:
detectedLanguage: v.optional(v.string()),
languageOverride: v.optional(v.string()),
```

### Pattern 5: Language Selector Component
**What:** Small toggle in EditorHeader for manual FR/EN override
**Recommendation:** Place in EditorHeader next to the "Format: A4_ISO" indicator. It fits naturally in the center toolbar area.
**Example:**
```typescript
// Minimal FR/EN toggle -- two buttons, active state highlighted
function LanguageSelector({ 
  value, 
  onChange 
}: { 
  value: 'fr' | 'en'; 
  onChange: (lang: 'fr' | 'en') => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] stitch-mono text-gray-400 uppercase">Lang:</span>
      <button
        onClick={() => onChange('fr')}
        className={cn(
          "text-[10px] stitch-mono font-bold px-1.5 py-0.5 rounded",
          value === 'fr' ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-gray-600"
        )}
      >FR</button>
      <button
        onClick={() => onChange('en')}
        className={cn(
          "text-[10px] stitch-mono font-bold px-1.5 py-0.5 rounded",
          value === 'en' ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-gray-600"
        )}
      >EN</button>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Calling franc() on every render:** Detection should only happen at import and on explicit re-detection trigger. Never in a useEffect that watches cvData.
- **Reading detectedLanguage directly in downstream code:** Always use `getCVLanguage()` so override logic stays centralized.
- **Storing ISO 639-3 codes in CVData:** Convert to 'fr'/'en' at detection time. Downstream code should never deal with 'fra'/'eng'.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Language detection | Custom heuristics (word frequency, character patterns) | franc-min | Trigram-based detection is well-studied; franc-min handles edge cases (mixed scripts, short text) |
| ISO code mapping | Manual lookup table for 82 languages | franc-min `only` option | Restricting to `['fra', 'eng']` means franc only returns those two codes, simplifying mapping |

**Key insight:** The `only: ['fra', 'eng']` option is critical -- it forces franc-min to choose between French and English only, eliminating false positives from similar Romance languages (Portuguese, Spanish, Italian).

## Common Pitfalls

### Pitfall 1: Too Little Text for Detection
**What goes wrong:** franc-min returns 'und' (undetermined) when text is too short
**Why it happens:** franc-min has a default minLength of 10 characters; very short CVs or empty sections produce unreliable results
**How to avoid:** Check text length before calling franc(). If text < 20 chars, default to 'fr'. The `only` option helps because with only 2 choices, even short text has a 50/50 shot.
**Warning signs:** franc() returning 'und'

### Pitfall 2: franc-min is ESM-Only
**What goes wrong:** CommonJS require() fails; build errors if module resolution is wrong
**Why it happens:** franc-min v6.x dropped CJS support entirely
**How to avoid:** The project already uses `"type": "module"` and Vite, so ESM imports work natively. No special configuration needed.
**Warning signs:** "require is not defined" or "ERR_REQUIRE_ESM"

### Pitfall 3: ISO 639-3 Codes vs App Language Codes
**What goes wrong:** franc returns 'fra' and 'eng', but the app uses 'fr' and 'en' everywhere (SECTION_NAMES, WEAK_VERBS)
**Why it happens:** franc uses ISO 639-3 (3-letter), the app uses ISO 639-1 (2-letter)
**How to avoid:** Map immediately in detectCVLanguage(). Never let 3-letter codes leak into CVData or downstream.

### Pitfall 4: Convex Schema Migration
**What goes wrong:** Adding required fields to Convex schema breaks existing documents
**Why it happens:** Existing CVs in the database don't have detectedLanguage or languageOverride
**How to avoid:** Both fields MUST be `v.optional()`. getCVLanguage() already handles undefined with default 'fr'.
**Warning signs:** Convex deployment errors about missing required fields

### Pitfall 5: Forgetting Guest Mode
**What goes wrong:** Language detection works for authenticated users but not guests
**Why it happens:** Guest CVs are stored in localStorage, not Convex. Detection must run client-side regardless.
**How to avoid:** detectCVLanguage() is a pure function on CVData -- it works identically for both flows. The detection result is stored on the CVData object before saving to either Convex or localStorage.

## Code Examples

### Integration: DashboardPage Import Flow
```typescript
// In DashboardPage.tsx onDrop callback, after CV data is obtained:
import { detectCVLanguage } from '../lib/languageDetection';

// After line: setBaseCV(data);
const detectedLang = detectCVLanguage(data);
const dataWithLang = { ...data, detectedLanguage: detectedLang };
setBaseCV(dataWithLang);
```

### Integration: EditorPage Re-Detection
```typescript
// Button in editor that re-detects language
const handleRedetectLanguage = () => {
  if (!cvData) return;
  const detected = detectCVLanguage(cvData);
  setCvData(prev => prev ? { ...prev, detectedLanguage: detected } : prev);
};
```

### Integration: EditorPage Manual Override
```typescript
// When user clicks FR or EN in the selector
const handleLanguageOverride = (lang: 'fr' | 'en') => {
  setCvData(prev => prev ? { ...prev, languageOverride: lang } : prev);
};
```

### Integration: Downstream Consumption (atsRules)
```typescript
// In any downstream module that needs the language:
import { getCVLanguage } from '../lib/languageDetection';
import { SECTION_NAMES } from './atsRules';

const lang = getCVLanguage(cvData);
const sectionNames = SECTION_NAMES[lang];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| franc v5 (CJS + ESM) | franc-min v6 (ESM only) | 2023 | Must use import, not require |
| franc without `only` | franc with `only` option | Always available | Dramatically improves accuracy for 2-language detection |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vite.config.ts (inline test config) |
| Quick run command | `npx vitest run src/lib/languageDetection.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LANG-01 | detectCVLanguage() returns 'fr' for French CV text | unit | `npx vitest run src/lib/languageDetection.test.ts -x` | Wave 0 |
| LANG-01 | detectCVLanguage() returns 'en' for English CV text | unit | `npx vitest run src/lib/languageDetection.test.ts -x` | Wave 0 |
| LANG-01 | detectCVLanguage() returns 'fr' for short/empty text | unit | `npx vitest run src/lib/languageDetection.test.ts -x` | Wave 0 |
| LANG-02 | getCVLanguage() returns override when set | unit | `npx vitest run src/lib/languageDetection.test.ts -x` | Wave 0 |
| LANG-02 | getCVLanguage() returns detected when no override | unit | `npx vitest run src/lib/languageDetection.test.ts -x` | Wave 0 |
| LANG-02 | getCVLanguage() returns 'fr' default when both undefined | unit | `npx vitest run src/lib/languageDetection.test.ts -x` | Wave 0 |
| LANG-03 | Detection uses franc-min (import verification) | unit | `npx vitest run src/lib/languageDetection.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/languageDetection.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/languageDetection.test.ts` -- covers LANG-01, LANG-02, LANG-03
- [ ] Framework install: `npm install franc-min` -- dependency not yet installed

## Sources

### Primary (HIGH confidence)
- [franc GitHub repository](https://github.com/wooorm/franc) -- API docs, options, return values
- [franc-min npm](https://www.npmjs.com/package/franc-min) -- version 6.2.0 confirmed
- Project source files -- CVData type, Convex schema, import pipeline, atsRules.ts

### Secondary (MEDIUM confidence)
- [franc-min GitHub sub-package](https://github.com/wooorm/franc/tree/main/packages/franc-min) -- 82 language list, ESM-only status

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- franc-min is the locked decision, version verified on npm
- Architecture: HIGH -- pattern is straightforward pure functions + type extension
- Pitfalls: HIGH -- ESM compatibility confirmed, Convex optional fields are standard pattern

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable library, no expected breaking changes)
