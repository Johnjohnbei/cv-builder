# Phase 7: Skills Categorization - Research

**Researched:** 2026-04-09
**Domain:** Client-side skill classification, ATS-compatible skills rendering, bilingual dictionary design
**Confidence:** HIGH

## Summary

This phase adds automatic skill categorization at import time using a client-side dictionary (~200 terms FR/EN), maps skills to 4 standard categories (Technique, Soft Skills, Outils, Methodologies) plus an "Autres" fallback, and updates template rendering to display grouped skills in both visual and ATS-compatible formats.

The existing codebase is well-structured for this change. The `SkillCategory` type already supports `{ category: string; items: string[] }`, templates already render categories with sub-headers, and the LinkedIn parser has a clear single point (`parseSkills` at lines 455-471) where categorization can be injected post-extraction. The AI import path already categorizes skills and should be left untouched.

**Primary recommendation:** Build a single `skillDictionary.ts` file with a `Record<string, SkillCategoryKey>` mapping normalized skill names to category keys. Use case-insensitive exact matching first, then compound phrase matching (longest match wins), with "Autres" as fallback. Extend `atsRules.ts` with `SKILL_CATEGORY_NAMES` following the existing `SECTION_NAMES` bilingual pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Client-side dictionary (~200 terms FR/EN) mapping skill keywords to categories -- no API call, instant
- 4 standard categories: Technique, Soft Skills, Outils, Methodologies (matches ROADMAP success criteria)
- Unrecognized skills fall into "Autres" category -- user can reassign manually
- AI imports keep their existing categorization -- no re-normalization
- Category sub-headers + inline badges (existing pattern)
- ATS mode: plain text format "Technique: skill1, skill2, skill3" -- one line per category
- Category order: Technique -> Outils -> Methodologies -> Soft Skills (hard skills first)
- Compact display mode: 3 items per category
- Category names are fixed (not user-renamable) -- standard names essential for ATS parsing
- Users can move skills between categories via drag-drop or context menu
- Categorization runs at import only -- manually added skills stay in their chosen category
- Category names bilingual via getSectionTitle pattern from Phase 3

### Claude's Discretion
- Dictionary structure and organization (single file vs config in atsRules.ts)
- Exact matching strategy (case-insensitive substring, exact match, or fuzzy)
- How to handle compound skills ("Project Management" vs "project" + "management")
- Drag-drop vs simple select dropdown for skill reassignment UX

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKIL-01 | Skills are auto-categorized at import (Technical, Soft Skills, Tools, Methodologies) | Dictionary-based categorization function `categorizeSkills()` applied in LinkedIn parser post-extraction; compound matching strategy documented |
| SKIL-02 | Categorized skills display in grouped format in the CV (not flat list) | Templates already render `SkillCategory[]` with sub-headers; update needed for bilingual category names and ATS plain text mode |
| SKIL-03 | Skills categories are ATS-compatible section format | ATS research confirms plain text comma-separated format with standard category headers is optimal; avoid skill bars/graphics |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.8.2 | Dictionary types, `SkillCategoryKey` union | Already in project |
| Vitest | 4.1.2 | Unit tests for categorization logic | Already configured |

### Supporting
No new dependencies required. This is a pure logic + rendering feature using existing stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static dictionary | NLP library (compromise, natural) | Overkill for 200 terms, adds bundle size, compromise already in project for keyword extraction but skill categorization is a classification problem not extraction |
| Exact match | Fuzzy matching (fuse.js) | Unnecessary complexity -- skills are well-known terms with standard spellings |
| Client-side dict | AI categorization API call | Violates locked decision (instant, no API call) |

## Architecture Patterns

### Recommended Project Structure
```
src/
  features/
    editor/
      lib/
        skillDictionary.ts    # ~200-entry dictionary + categorizeSkills() function
        atsRules.ts           # Add SKILL_CATEGORY_NAMES (bilingual) + SKILL_CATEGORY_ORDER
        displayModes.ts       # No changes needed (getVisibleSkills already works per-category)
      templates/
        shared.tsx            # Add renderSkillsATS() helper for ATS plain text rendering
        Template[A-F].tsx     # Update skills section to use bilingual category names
  lib/
    linkedinParser.ts         # Call categorizeSkills() after parseSkills()
```

### Pattern 1: Skill Dictionary Design
**What:** A flat `Record<string, SkillCategoryKey>` mapping normalized (lowercased) skill names to category keys.
**When to use:** At LinkedIn import time, when skills arrive as a flat array.
**Example:**
```typescript
// src/features/editor/lib/skillDictionary.ts

export type SkillCategoryKey = 'technical' | 'tools' | 'methodologies' | 'soft_skills' | 'other';

// Order matters for rendering: hard skills first (ATS/recruiter expectation)
export const SKILL_CATEGORY_ORDER: SkillCategoryKey[] = [
  'technical', 'tools', 'methodologies', 'soft_skills', 'other',
];

// Dictionary: normalized (lowercase) skill name -> category key
const SKILL_DICTIONARY: Record<string, SkillCategoryKey> = {
  // Technical Skills (~80 entries)
  'javascript': 'technical',
  'typescript': 'technical',
  'python': 'technical',
  'java': 'technical',
  'react': 'technical',
  'angular': 'technical',
  'vue': 'technical',
  'node.js': 'technical',
  'sql': 'technical',
  'html': 'technical',
  'css': 'technical',
  'machine learning': 'technical',
  'deep learning': 'technical',
  'data analysis': 'technical',
  'api development': 'technical',
  'cloud computing': 'technical',
  'devops': 'technical',
  'cybersecurity': 'technical',
  // ... ~60 more

  // Tools (~50 entries)
  'jira': 'tools',
  'figma': 'tools',
  'docker': 'tools',
  'kubernetes': 'tools',
  'git': 'tools',
  'excel': 'tools',
  'tableau': 'tools',
  'power bi': 'tools',
  'slack': 'tools',
  'notion': 'tools',
  'aws': 'tools',
  'azure': 'tools',
  'gcp': 'tools',
  'jenkins': 'tools',
  'terraform': 'tools',
  'postman': 'tools',
  'vs code': 'tools',
  'salesforce': 'tools',
  // ... ~30 more

  // Methodologies (~30 entries)
  'agile': 'methodologies',
  'scrum': 'methodologies',
  'kanban': 'methodologies',
  'lean': 'methodologies',
  'six sigma': 'methodologies',
  'design thinking': 'methodologies',
  'tdd': 'methodologies',
  'ci/cd': 'methodologies',
  'project management': 'methodologies',
  'product management': 'methodologies',
  'ux research': 'methodologies',
  'a/b testing': 'methodologies',
  // ... ~18 more

  // Soft Skills (~40 entries)
  'leadership': 'soft_skills',
  'communication': 'soft_skills',
  'teamwork': 'soft_skills',
  'problem solving': 'soft_skills',
  'critical thinking': 'soft_skills',
  'adaptability': 'soft_skills',
  'creativity': 'soft_skills',
  'time management': 'soft_skills',
  'negotiation': 'soft_skills',
  'mentoring': 'soft_skills',
  // ... ~30 more (include FR equivalents)

  // French equivalents map to same categories
  'gestion de projet': 'methodologies',
  'travail en equipe': 'soft_skills',
  'resolution de problemes': 'soft_skills',
  'analyse de donnees': 'technical',
  // ... ~40 FR terms
};
```

### Pattern 2: Compound Skill Matching (Longest Match First)
**What:** When matching skills, try the full phrase first before individual words. "Project Management" should match as methodologies, not as two separate words.
**When to use:** Always -- skills frequently contain 2-3 word phrases.
**Example:**
```typescript
/**
 * Categorize a single skill string.
 * Strategy: normalize -> exact match -> done. No fuzzy, no substring.
 * Compound skills like "Project Management" are matched as full phrases.
 */
function categorizeSkill(skill: string): SkillCategoryKey {
  const normalized = skill.toLowerCase().trim()
    .replace(/[éèê]/g, 'e')
    .replace(/[àâ]/g, 'a')
    .replace(/[ùû]/g, 'u')
    .replace(/[ôö]/g, 'o')
    .replace(/[ïî]/g, 'i')
    .replace(/[ç]/g, 'c');

  // Exact match on full phrase (handles "Machine Learning", "Project Management")
  if (SKILL_DICTIONARY[normalized]) {
    return SKILL_DICTIONARY[normalized];
  }

  // Try without common suffixes/prefixes (e.g., "React.js" -> "react")
  const stripped = normalized.replace(/\.(js|ts|py)$/i, '').replace(/^(apache |microsoft |google )/i, '');
  if (SKILL_DICTIONARY[stripped]) {
    return SKILL_DICTIONARY[stripped];
  }

  return 'other';
}

/**
 * Categorize an array of skill strings into SkillCategory groups.
 * Preserves original casing. Empty categories are omitted.
 */
export function categorizeSkills(skills: string[]): SkillCategory[] {
  const grouped: Record<SkillCategoryKey, string[]> = {
    technical: [], tools: [], methodologies: [], soft_skills: [], other: [],
  };

  for (const skill of skills) {
    const category = categorizeSkill(skill);
    grouped[category].push(skill);
  }

  return SKILL_CATEGORY_ORDER
    .filter(key => grouped[key].length > 0)
    .map(key => ({
      category: key,
      items: grouped[key],
    }));
}
```

### Pattern 3: Bilingual Category Names (extends atsRules.ts)
**What:** Add skill category display names following the existing `SECTION_NAMES` pattern.
**When to use:** Template rendering and ATS mode output.
**Example:**
```typescript
// Add to src/features/editor/lib/atsRules.ts

export const SKILL_CATEGORY_NAMES = {
  fr: {
    technical: 'Competences techniques',
    tools: 'Outils',
    methodologies: 'Methodologies',
    soft_skills: 'Soft Skills',
    other: 'Autres',
  },
  en: {
    technical: 'Technical Skills',
    tools: 'Tools',
    methodologies: 'Methodologies',
    soft_skills: 'Soft Skills',
    other: 'Other',
  },
} as const;

export type SkillCategoryKey = keyof typeof SKILL_CATEGORY_NAMES.fr;

export function getSkillCategoryTitle(key: SkillCategoryKey, language: 'fr' | 'en'): string {
  return SKILL_CATEGORY_NAMES[language][key];
}
```

### Pattern 4: ATS Mode Skills Rendering
**What:** Plain text comma-separated format for ATS parsers.
**When to use:** When `designSettings.atsMode === true`.
**Example:**
```typescript
// In shared.tsx -- new helper

export function renderSkillsATS(
  skills: SkillCategory[],
  language: SupportedLanguage,
) {
  return (
    <div className="space-y-1">
      {skills.filter(cat => !isSkillHidden(cat)).map((cat, idx) => {
        const visibleItems = getVisibleSkills(cat);
        if (visibleItems.length === 0) return null;
        const title = getSkillCategoryTitle(cat.category as SkillCategoryKey, language);
        return (
          <p key={idx} className="text-sm">
            <span className="font-semibold">{title}:</span>{' '}
            {visibleItems.join(', ')}
          </p>
        );
      })}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Substring matching:** Do NOT match "Java" inside "JavaScript" -- use exact match on normalized full phrase only
- **Re-categorizing AI imports:** AI already produces good categories; running the dictionary over AI output would destroy its work
- **User-editable category names:** Fixed standard names are essential for ATS recognition
- **Skill bars or percentage graphics:** ATS parsers cannot read these; use text only
- **Over-engineering fuzzy matching:** With ~200 dictionary entries and well-known skill names, Levenshtein/fuzzy matching adds complexity without meaningful benefit

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accent normalization | Custom regex chain | Simple normalize function (5-line helper) | Only need FR accent stripping, not full Unicode normalization |
| Skill taxonomy | Full ontology/knowledge graph | Flat dictionary `Record<string, SkillCategoryKey>` | 200 entries is small; a flat map is O(1) lookup, trivial to maintain |
| NLP skill extraction | Token classification model | Already have skills extracted; this is classification not extraction | Skills are already parsed from LinkedIn PDF; we just need to sort them into buckets |

**Key insight:** This is a classification problem (given a known skill string, assign a category), not an extraction problem (find skills in free text). A static dictionary is the right tool -- fast, deterministic, no API dependency.

## Common Pitfalls

### Pitfall 1: Case and Accent Sensitivity
**What goes wrong:** "React" vs "react", "Competences" vs "Competences" fail to match.
**Why it happens:** Dictionary keys are lowercase but input may have mixed case or accented characters.
**How to avoid:** Always normalize to lowercase and strip FR accents before lookup.
**Warning signs:** Skills appearing in "Autres" that should be categorized.

### Pitfall 2: Compound Skill Fragmentation
**What goes wrong:** "Project Management" gets split into "project" (no match) and "management" (no match) instead of matching as a whole phrase.
**Why it happens:** Tokenizing skills before lookup.
**How to avoid:** Match the FULL skill string first. Never split multi-word skills.
**Warning signs:** Common compound skills (Machine Learning, Data Analysis) ending up in "Autres".

### Pitfall 3: AI Import Re-categorization
**What goes wrong:** Running categorizeSkills() on AI-imported CVs overwrites the AI's categorization.
**Why it happens:** Applying categorization globally instead of only at LinkedIn import.
**How to avoid:** Only call `categorizeSkills()` in the LinkedIn parser path. AI imports bypass this entirely.
**Warning signs:** AI-imported CVs losing their original category structure after save/load.

### Pitfall 4: Category Key vs Display Name Confusion
**What goes wrong:** Storing display names ("Competences techniques") as the category key, breaking bilingual support.
**Why it happens:** Using `cat.category` as both internal key and display label.
**How to avoid:** Store the key (`'technical'`) in `SkillCategory.category`, resolve to display name at render time via `getSkillCategoryTitle()`.
**Warning signs:** Category names not switching when language changes; duplicate categories after language switch.

### Pitfall 5: ATS Mode Rendering with Decorative Elements
**What goes wrong:** Skill pills/badges with background colors persist in ATS mode, confusing parsers.
**Why it happens:** Not conditionally rendering based on atsMode.
**How to avoid:** Use the `renderSkillsATS()` helper that outputs plain `<p>` tags with comma-separated text.
**Warning signs:** ATS score not improving after enabling ATS mode.

## Code Examples

### LinkedIn Parser Integration
```typescript
// src/lib/linkedinParser.ts -- modify parseSkills return
// Current: returns [{ category: 'Competences cles', items: [...] }]
// New: returns categorized SkillCategory[]

import { categorizeSkills } from '@/src/features/editor/lib/skillDictionary';

function parseSkills(left: Line[]): CVData['skills'] {
  const idx = left.findIndex(l =>
    l.role === FontRole.SIDEBAR_HEADER && /principales competences|top skills?/i.test(l.text),
  );
  if (idx === -1) return [];

  const items: string[] = [];
  for (let i = idx + 1; i < left.length; i++) {
    if (left[i].role === FontRole.SIDEBAR_HEADER) break;
    if (left[i].role === FontRole.BODY && left[i].text.trim().length > 1) {
      items.push(left[i].text.trim());
    }
  }

  // Instead of single bucket, categorize into groups
  return items.length > 0 ? categorizeSkills(items) : [];
}
```

### Template Skills Section (ATS-aware)
```typescript
// In any Template[A-F].tsx skills section
{includedSections.includes('skills') && cvData.skills?.some(cat => !isSkillHidden(cat)) && (
  <section data-cv-section="skills">
    <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)}
        style={{ color: atsMode ? '#000' : primaryColor }}>
      {getSectionTitle('skills', language)}
    </h2>
    {atsMode ? (
      renderSkillsATS(cvData.skills, language)
    ) : (
      <div className="space-y-4">
        {cvData.skills.filter(cat => !isSkillHidden(cat)).map((cat, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: secondaryColor }}>
              {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
            </h3>
            <div className="flex flex-wrap gap-2">
              {getVisibleSkills(cat).map(skill => (
                <span key={skill} className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded uppercase tracking-wider">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat skill list on resume | Grouped by category (Technical, Tools, etc.) | 2024-2025 ATS evolution | 60%+ of companies now filter by skills before reviewing history |
| Skill bars/percentages | Plain text listings | 2023+ | All major ATS (Workday, Greenhouse, Lever) cannot parse graphical skill representations |
| Custom section headers | Standard ATS headers ("Skills", "Technical Skills") | Always | Workday is strictest -- custom headers don't parse |

**Deprecated/outdated:**
- Skill proficiency bars/charts: ATS cannot parse these; purely decorative
- Single "Skills" bucket: Grouping into categories is now the standard practice

## Open Questions

1. **SkillCategoryKey type location**
   - What we know: Both `skillDictionary.ts` and `atsRules.ts` need this type
   - What's unclear: Whether to define it in `shared/types/index.ts` (globally) or `atsRules.ts` (feature-local)
   - Recommendation: Define in `atsRules.ts` alongside `SKILL_CATEGORY_NAMES` since it's ATS-specific. Export for use by `skillDictionary.ts`.

2. **Skill reassignment UX (drag-drop vs dropdown)**
   - What we know: Users need to move skills between categories when dictionary is wrong
   - What's unclear: Implementation complexity of drag-drop in skill pills
   - Recommendation: Use a simple dropdown/select per skill for reassignment. Drag-drop adds significant complexity (drag library, drop zones, visual feedback) for a rarely-used correction feature. A right-click context menu or small dropdown is sufficient.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run src/features/editor/lib/skillDictionary.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIL-01 | categorizeSkills() maps flat array to categorized SkillCategory[] | unit | `npx vitest run src/features/editor/lib/skillDictionary.test.ts -x` | Wave 0 |
| SKIL-01 | Accent-insensitive matching (FR terms) | unit | `npx vitest run src/features/editor/lib/skillDictionary.test.ts -x` | Wave 0 |
| SKIL-01 | Compound skills matched as full phrases | unit | `npx vitest run src/features/editor/lib/skillDictionary.test.ts -x` | Wave 0 |
| SKIL-01 | Unrecognized skills fall into "other" category | unit | `npx vitest run src/features/editor/lib/skillDictionary.test.ts -x` | Wave 0 |
| SKIL-02 | getSkillCategoryTitle returns bilingual names | unit | `npx vitest run src/features/editor/lib/atsRules.test.ts -x` | Wave 0 |
| SKIL-03 | ATS rendering outputs plain text comma-separated format | unit | `npx vitest run src/features/editor/lib/skillDictionary.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/editor/lib/skillDictionary.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/editor/lib/skillDictionary.test.ts` -- covers SKIL-01, SKIL-03
- [ ] Update `src/features/editor/lib/atsRules.test.ts` -- covers SKIL-02 (bilingual names) -- file may not exist yet in main branch

## Sources

### Primary (HIGH confidence)
- Project source code: `src/shared/types/index.ts`, `src/features/editor/lib/atsRules.ts`, `src/features/editor/lib/displayModes.ts`, `src/lib/linkedinParser.ts`, `src/features/editor/templates/shared.tsx`, `convex/ai.ts`
- Existing test patterns: `src/features/editor/lib/displayModes.test.ts`

### Secondary (MEDIUM confidence)
- [Jobscan ATS Resume Format Checklist 2026](https://www.jobscan.co/blog/20-ats-friendly-resume-templates/) -- ATS formatting best practices, section header requirements
- [Resume Optimizer Pro ATS Templates](https://resumeoptimizerpro.com/blog/best-ats-friendly-resume-templates-2026) -- Workday/Taleo parsing specifics
- [The Ladders Technical Skills Section](https://www.theladders.com/career-advice/resume-technical-skills-section-examples-that-pass-ats-and-impress-recruiters) -- Skills grouping patterns
- [CandyCV Skills ATS Guide](https://www.candycv.com/how-to/how-to-highlight-your-skills-on-a-resume-with-ats-friendly-templates-and-examples-33) -- ATS keyword scanning behavior

### Tertiary (LOW confidence)
- [Reed Talent Solutions Skills Taxonomy](https://www.reedtalentsolutions.com/articles/demystifying-skills-taxonomy-and-skills-ontology) -- Taxonomy vs ontology concepts (not directly applicable to our dictionary approach)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, pure TypeScript logic
- Architecture: HIGH - follows existing codebase patterns (atsRules, displayModes, getSectionTitle)
- Pitfalls: HIGH - well-understood domain (string matching, bilingual rendering)
- Dictionary design: MEDIUM - the ~200 term list needs manual curation; coverage will need iteration

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable domain, no rapidly changing dependencies)
