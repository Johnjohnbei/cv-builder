# Phase 4: ATS Scoring Engine - Research

**Researched:** 2026-04-09
**Domain:** NLP keyword extraction, TF-IDF scoring, ATS compatibility analysis
**Confidence:** HIGH

## Summary

Phase 4 implements a pure computation engine that produces ATS scores from CVData. The engine extends the existing `scoring.ts` with three sub-scores: Format (30%), Content (30%), and Relevance (40%). Format and Content are computed from CVData and DesignSettings alone. Relevance requires a job description and uses compromise NLP for bigram/trigram keyword extraction plus inline TF-IDF weighting.

The existing codebase provides strong foundations: `scoring.ts` already has keyword extraction and word-boundary matching, `atsRules.ts` has all config constants (TEMPLATE_ATS_COMPAT, SECTION_NAMES, ATS_SAFE_FONTS, WEAK_VERBS), and `languageDetection.ts` provides `getCVLanguage()` for bilingual rule selection. The main work is: (1) install compromise + compromise-stats, (2) build three sub-score functions, (3) build a top-level `computeATSScore()` orchestrator, (4) define the result type.

**Primary recommendation:** Build all scoring as pure functions in `scoring.ts`. Use compromise + compromise-stats for NLP noun-phrase and bigram extraction. Implement TF-IDF inline (~50 lines). No UI, no side effects, no lazy loading needed since this phase is computation-only.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Extend scoring.ts with ATS scoring functions (not a separate module) -- per PROJECT.md and Phase 1 CONTEXT.md
- **D-02:** Install `compromise` (v14.x, ~200KB) for NLP keyword extraction with bigrams/trigrams
- **D-03:** All scoring functions are pure functions (no side effects, no API calls)
- **D-04:** Format sub-score checks: Template ATS compatibility, standard section names, ATS-safe fonts, no SVG icons, contact info present
- **D-05:** Before Phase 6, format score uses placeholder values for icon/font checks
- **D-06:** Content sub-score checks: Metrics in bullets, strong action verbs, bullet length, essential sections, skills not empty
- **D-07:** Relevance uses compromise NLP bigrams/trigrams + TF-IDF weighting + word-boundary matching + acronym matching
- **D-08:** Without job description, Relevance = N/A, global = (Format + Content) / 2
- **D-09:** With job description, global = Format * 0.3 + Content * 0.3 + Relevance * 0.4
- **D-10:** Score computed client-side, debounced (500ms inactivity)
- **D-11:** Score result type: `{ overall: number, format: number, content: number, relevance: number | null, suggestions: string[] }`
- **D-12:** No UI in this phase -- computation engine only

### Claude's Discretion
- Internal organization of scoring functions within scoring.ts
- Exact TF-IDF implementation details
- How to detect contact info presence (regex patterns)
- Whether to lazy-load compromise

### Deferred Ideas (OUT OF SCOPE)
None -- Phase 4 scope is well-defined.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCORE-01 | User can see a global ATS score (0-100) with circular gauge | This phase computes the score; gauge UI is Phase 8 |
| SCORE-02 | Score broken into 3 sub-scores: Format, Content, Relevance | Three sub-score functions + orchestrator pattern documented below |
| SCORE-03 | Format and Content computed client-side in real-time | Pure functions, no API calls, all data from CVData/DesignSettings |
| SCORE-04 | Relevance requires job description, uses word-boundary matching | compromise NLP extraction + existing word-boundary regex from scoring.ts |
| SCORE-05 | Without job description, partial score displayed | D-08 formula: (Format + Content) / 2, relevance = null |
| SCORE-06 | Keyword extraction uses NLP (compromise) for bigrams/trigrams and TF-IDF | compromise v14 + compromise-stats plugin for ngrams + inline TF-IDF |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack:** React 19 + Vite 6 + Convex + Clerk -- no migration
- **Performance:** Score must be computed in real-time without lag
- **Simplicity:** Merge and simplify, do not add complexity
- **File size limits:** Hook max 150 lines, Service max 300 lines, Utility max 200 lines
- **Immutability:** Always return new objects, never mutate
- **Pure functions:** No side effects in scoring logic
- **Testing:** Vitest, minimum 80% coverage, TDD mandatory
- **No console.log** in production code
- **Named exports** for utilities
- **Section dividers** using em-dash pattern in scoring.ts

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| compromise | 14.15.0 | NLP text processing, noun phrase extraction | Lightweight (~250KB), browser-native, no server needed |
| compromise-stats | 0.1.1 | Bigram/trigram extraction via `.bigrams()`, `.trigrams()` | Official compromise plugin for ngram analysis |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.2 | Testing scoring functions | Already installed, test all scoring functions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| compromise | natural (npm) | natural is larger (~2MB), overkill for keyword extraction only |
| compromise-stats | Custom ngram code | 10-15 lines of custom code vs. a tested plugin; plugin is simpler |
| External TF-IDF lib | Inline TF-IDF (~50 lines) | For 2-document comparison, inline is simpler and avoids a dependency |

**Installation:**
```bash
npm install compromise compromise-stats
```

**Version verification:**
- compromise: 14.15.0 (verified via npm view, 2026-04-09)
- compromise-stats: 0.1.1 (verified via npm view, 2026-04-09)

## Architecture Patterns

### Where Code Lives
```
src/features/editor/lib/
  scoring.ts          # EXTEND with ATS scoring functions (~+150 lines)
  scoring.test.ts     # EXTEND with ATS scoring tests (~+200 lines)
  atsRules.ts         # READ ONLY -- config constants already exist
src/lib/
  languageDetection.ts # READ ONLY -- getCVLanguage() already exists
src/shared/types/
  index.ts            # UPDATE ATSResult type to match D-11
```

### Pattern 1: Sub-Score Function Signature
**What:** Each sub-score is a pure function returning 0-100 + suggestions
**When to use:** All three sub-scores follow this pattern
**Example:**
```typescript
// Each sub-score returns a normalized 0-100 score and suggestions
interface SubScoreResult {
  score: number;        // 0-100
  suggestions: string[];
}

function scoreFormat(cvData: CVData, design: DesignSettings, language: 'fr' | 'en'): SubScoreResult { ... }
function scoreContent(cvData: CVData, language: 'fr' | 'en'): SubScoreResult { ... }
function scoreRelevance(cvData: CVData, jobDescription: string, language: 'fr' | 'en'): SubScoreResult { ... }
```

### Pattern 2: Top-Level Orchestrator
**What:** Single entry point that calls all sub-scores and applies weights
**When to use:** Called by the UI layer (Phase 8)
**Example:**
```typescript
export interface ATSScoreResult {
  overall: number;
  format: number;
  content: number;
  relevance: number | null;
  suggestions: string[];
}

export function computeATSScore(
  cvData: CVData,
  design: DesignSettings,
  jobDescription?: string
): ATSScoreResult {
  const language = getCVLanguage(cvData);
  const fmt = scoreFormat(cvData, design, language);
  const cnt = scoreContent(cvData, language);

  if (!jobDescription?.trim()) {
    return {
      overall: Math.round((fmt.score + cnt.score) / 2),
      format: fmt.score,
      content: cnt.score,
      relevance: null,
      suggestions: [...fmt.suggestions, ...cnt.suggestions],
    };
  }

  const rel = scoreRelevance(cvData, jobDescription, language);
  return {
    overall: Math.round(fmt.score * 0.3 + cnt.score * 0.3 + rel.score * 0.4),
    format: fmt.score,
    content: cnt.score,
    relevance: rel.score,
    suggestions: [...fmt.suggestions, ...cnt.suggestions, ...rel.suggestions],
  };
}
```

### Pattern 3: Compromise NLP for Keyword Extraction
**What:** Use compromise + compromise-stats to extract meaningful multi-word terms
**When to use:** Relevance sub-score keyword extraction from job description
**Example:**
```typescript
import nlp from 'compromise';
import stats from 'compromise-stats';
nlp.plugin(stats);

function extractNLPKeywords(text: string): string[] {
  const doc = nlp(text);

  // Extract noun phrases (e.g., "project management", "data analysis")
  const nouns = doc.nouns().out('array') as string[];

  // Extract bigrams for multi-word terms
  const bigrams = (doc as any).bigrams()
    .map((b: any) => b.normal || b.text)
    .filter((t: string) => t.split(' ').length === 2);

  // Combine and deduplicate
  const all = [...new Set([...nouns, ...bigrams].map(t => t.toLowerCase()))];
  return all.filter(t => t.length >= 3);
}
```

### Pattern 4: Inline TF-IDF for 2-Document Comparison
**What:** Textbook TF-IDF comparing job description terms against CV content
**When to use:** Relevance sub-score weighting
**Example:**
```typescript
function computeTFIDF(
  cvTerms: string[],
  jobTerms: string[],
  cvText: string,
  jobText: string
): Map<string, number> {
  const scores = new Map<string, number>();
  const cvWords = cvText.toLowerCase().split(/\s+/);
  const jobWords = jobText.toLowerCase().split(/\s+/);

  for (const term of jobTerms) {
    // TF: frequency in job description
    const tf = jobWords.filter(w => w === term).length / jobWords.length;
    // IDF: log(total docs / docs containing term) -- 2 docs: CV + job
    const inCV = cvText.toLowerCase().includes(term) ? 1 : 0;
    const inJob = 1; // always in job desc
    const idf = Math.log((2 + 1) / (inCV + inJob + 1)) + 1; // smoothed
    scores.set(term, tf * idf);
  }
  return scores;
}
```

### Pattern 5: Font Family Mapping for ATS Check
**What:** Map abstract fontFamily values to actual font names for ATS comparison
**When to use:** Format sub-score font check
**Example:**
```typescript
// DesignSettings.fontFamily uses abstract names
const FONT_FAMILY_MAP: Record<string, string> = {
  sans: 'Arial',          // Maps to ATS-safe
  serif: 'Georgia',       // Maps to ATS-safe
  mono: 'Courier New',    // NOT ATS-safe
  playfair: 'Playfair Display', // NOT ATS-safe
  outfit: 'Outfit',       // NOT ATS-safe
};

function isFontATSSafe(fontFamily: string): boolean {
  const actual = FONT_FAMILY_MAP[fontFamily] ?? fontFamily;
  return ATS_SAFE_FONTS.some(f => f.toLowerCase() === actual.toLowerCase());
}
```

### Anti-Patterns to Avoid
- **Mutating CVData:** Never modify input -- all scoring reads data, returns new result objects
- **Side effects in scoring:** No DOM access, no localStorage, no API calls in scoring functions
- **Hardcoded strings:** Use atsRules.ts constants (WEAK_VERBS, SECTION_NAMES, etc.) not inline strings
- **Monster function:** Do not put all logic in one function; each check should be its own small helper
- **Ignoring language:** Every text check must use `getCVLanguage()` to select FR/EN rules

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Noun phrase extraction | Custom POS tagger | compromise `.nouns()` | POS tagging is complex, compromise handles English well |
| Bigram/trigram detection | Custom sliding window | compromise-stats `.bigrams()` | Tested, handles punctuation/normalization |
| Word-boundary matching | Simple `.includes()` | Existing regex from scoring.ts `computeKeywordMatch` | Prevents false positives (java/javascript) |
| Stop word filtering | Custom list only | Existing STOP_WORDS set in scoring.ts | Already maintained, extend if needed |

**Key insight:** The existing scoring.ts already has word-boundary matching and stop-word filtering. Reuse these helpers; do not duplicate them.

## Common Pitfalls

### Pitfall 1: Compromise is English-Optimized
**What goes wrong:** Noun phrase extraction produces poor results for French CVs
**Why it happens:** compromise's POS tagger is trained on English text
**How to avoid:** For French text, fall back to the existing simple `extractKeywords()` for unigrams and use a simple custom bigram extractor (sliding window on filtered words). Only use compromise NLP features when `language === 'en'`.
**Warning signs:** French bigrams containing articles/prepositions as keywords

### Pitfall 2: File Size Limit
**What goes wrong:** scoring.ts grows beyond 300-line utility limit
**Why it happens:** Adding 3 sub-scores + TF-IDF + helpers to an already 144-line file
**How to avoid:** Keep each sub-score function under 30 lines. Use small focused helpers. The file should stay under 300 lines total. If it grows past this, extract helpers into a private `atsScoring.ts` helper file (not exported from barrel).
**Warning signs:** Any function exceeding 50 lines

### Pitfall 3: Template ATS Compatibility Placeholders
**What goes wrong:** Format score gives misleading values before Phase 6
**Why it happens:** TEMPLATE_ATS_COMPAT values are placeholders; icon/font checks cannot fully run yet
**How to avoid:** Per D-05, use current placeholder values. Document in suggestions that accuracy improves after Phase 6. The format score is still useful for section names, contact info, and font checks.
**Warning signs:** Format score of 100 for clearly non-ATS templates

### Pitfall 4: Scoring.ts Import Bloat
**What goes wrong:** Importing compromise at module level causes bundle size increase for all pages
**Why it happens:** scoring.ts is imported by EditorPage; compromise is ~250KB
**How to avoid:** Since D-12 says this phase is computation-only and D-10 mentions debouncing, the scoring function will only be called from the editor. Consider dynamic `import()` for compromise inside `scoreRelevance` so it is only loaded when a job description is present. However, this makes the function async. Alternative: accept the 250KB since it only loads on the editor page which already loads heavy deps.
**Warning signs:** Main bundle size increase visible in `vite build` output

### Pitfall 5: Empty/Missing Data Edge Cases
**What goes wrong:** Score crashes or returns NaN on empty CVData
**Why it happens:** Division by zero, empty arrays, undefined fields
**How to avoid:** Every scoring function must handle: empty experience array, empty skills, missing personal_info fields, empty job description. Default to 0 for missing data, not NaN.
**Warning signs:** `NaN` or `undefined` in test output

### Pitfall 6: ATSResult Type Conflict
**What goes wrong:** Existing `ATSResult` interface in types/index.ts conflicts with D-11 spec
**Why it happens:** Phase 1 defined a different ATSResult shape (score, missingKeywords, strengths, improvements, ats_compatibility)
**How to avoid:** The existing ATSResult is used nowhere in production code (it was a placeholder). Replace it with the D-11 shape or create a new `ATSScoreResult` type alongside it. Check for consumers before modifying.
**Warning signs:** Type errors after changing ATSResult

## Code Examples

### Contact Info Detection
```typescript
function hasContactInfo(personalInfo: PersonalInfo): { email: boolean; phone: boolean } {
  return {
    email: Boolean(personalInfo.email && personalInfo.email.includes('@')),
    phone: Boolean(personalInfo.phone && personalInfo.phone.replace(/\D/g, '').length >= 7),
  };
}
```

### Metrics Detection in Bullet Points
```typescript
// Detect quantifiable metrics: digits, percentages, dollar/euro amounts
const METRICS_REGEX = /\d+%|\$[\d,.]+|[\d,.]+\s*(k|m|million|billion|users|clients|projects)|€[\d,.]+|\d{2,}/;

function bulletHasMetrics(bullet: string): boolean {
  return METRICS_REGEX.test(bullet);
}
```

### Weak Verb Detection
```typescript
function bulletStartsWithWeakVerb(bullet: string, language: 'fr' | 'en'): boolean {
  const weakList = WEAK_VERBS[language].weak;
  const lower = bullet.toLowerCase().trim();
  return weakList.some(verb => lower.startsWith(verb));
}
```

### Bullet Length Check
```typescript
function isBulletLengthOK(bullet: string): boolean {
  const words = bullet.trim().split(/\s+/).length;
  return words >= 5 && words <= 30; // 1-2 lines approximately
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple word count matching | NLP noun-phrase + TF-IDF | compromise v14 (2023+) | Better multi-word term extraction |
| `.includes()` for keywords | Word-boundary regex | Phase 1 (already done) | No false positives |
| Single ATS score number | 3-axis sub-scores | Phase 4 (this phase) | Actionable breakdown |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vite.config.ts` (inline test config) |
| Quick run command | `npx vitest run src/features/editor/lib/scoring.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-01 | computeATSScore returns 0-100 overall | unit | `npx vitest run src/features/editor/lib/scoring.test.ts -t "computeATSScore"` | Extend existing |
| SCORE-02 | Result has format, content, relevance fields | unit | same file | Extend existing |
| SCORE-03 | scoreFormat and scoreContent are pure, no API | unit | same file | Extend existing |
| SCORE-04 | scoreRelevance uses word-boundary matching | unit | same file | Extend existing |
| SCORE-05 | Without job desc, relevance=null, overall=(F+C)/2 | unit | same file | Extend existing |
| SCORE-06 | extractNLPKeywords extracts bigrams via compromise | unit | same file | Extend existing |

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/editor/lib/scoring.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Add ATS scoring test cases to `src/features/editor/lib/scoring.test.ts` -- covers SCORE-01 through SCORE-06
- [ ] No new test files needed -- extend existing test file

## Open Questions

1. **Async vs Sync for compromise import**
   - What we know: compromise is ~250KB. Dynamic import makes scoreRelevance async.
   - What's unclear: Whether making scoring async complicates Phase 8 UI integration
   - Recommendation: Keep synchronous (static import) for simplicity. The editor page already loads heavy dependencies. Can be optimized later if bundle analysis shows concern.

2. **French NLP quality with compromise**
   - What we know: compromise is English-optimized. French noun-phrase extraction may be inaccurate.
   - What's unclear: How bad French bigram extraction actually is
   - Recommendation: For French, use a simple sliding-window bigram approach on filtered words instead of compromise NLP. Test with French job descriptions.

3. **ATSResult type migration**
   - What we know: Existing `ATSResult` in types/index.ts has a different shape than D-11
   - What's unclear: Whether any code uses the existing ATSResult type
   - Recommendation: Search for usages. If none, replace with new `ATSScoreResult`. If used, keep both.

## Sources

### Primary (HIGH confidence)
- `src/features/editor/lib/scoring.ts` -- current scoring implementation (144 lines)
- `src/features/editor/lib/atsRules.ts` -- ATS config constants (63 lines)
- `src/shared/types/index.ts` -- CVData, DesignSettings, ATSResult types
- `src/lib/languageDetection.ts` -- getCVLanguage() function
- `package.json` -- current dependencies (no compromise yet)

### Secondary (MEDIUM confidence)
- [compromise GitHub](https://github.com/spencermountain/compromise) -- v14 API, ~250KB, ESM support
- [compromise-stats Observable notebook](https://observablehq.com/@spencermountain/compromise-ngram) -- `.bigrams()`, `.trigrams()` API
- npm registry: compromise 14.15.0, compromise-stats 0.1.1

### Tertiary (LOW confidence)
- French NLP quality with compromise -- needs validation with actual French job descriptions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- compromise v14 verified on npm, API documented
- Architecture: HIGH -- extends existing well-understood scoring.ts
- Pitfalls: HIGH -- based on direct code reading and type analysis
- TF-IDF: MEDIUM -- textbook algorithm, no exotic implementation needed
- French NLP: LOW -- compromise French support unverified

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable domain, 30 days)
