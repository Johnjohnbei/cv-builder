# Technology Stack

**Project:** Calibre CV Builder -- ATS Conformity Milestone
**Researched:** 2026-04-09

## Current Stack (Do Not Change)

| Technology | Version | Purpose |
|------------|---------|---------|
| React | ^19.2.4 | UI framework |
| Vite | ^6.2.0 | Build tool |
| Convex | ^1.34.1 | Backend (actions, mutations, queries) |
| Tailwind CSS | ^4.2.2 | Styling |
| Clerk | ^5.61.4 | Auth |
| OpenAI SDK | ^6.33.0 | AI provider interface (NVIDIA NIM + Gemini) |
| pdfjs-dist | ^5.6.205 | PDF text extraction for imports |
| TypeScript | ~5.8.2 | Type safety |

## Recommended Additions for ATS Milestone

### 1. Client-Side NLP: `compromise` v14

| Attribute | Value |
|-----------|-------|
| **Package** | `compromise` |
| **Version** | ^14.15.0 |
| **Bundle size** | ~200KB gzipped |
| **Purpose** | Keyword extraction, POS tagging, noun phrase extraction, verb detection |
| **Confidence** | HIGH -- most downloaded browser NLP library, 12K+ GitHub stars, active maintenance |

**Why compromise:** The existing `extractKeywords` in scoring.ts is a naive split-and-filter. It misses multi-word terms ("project management", "machine learning"), treats all words equally, and cannot distinguish nouns/skills from verbs/adjectives. Compromise runs entirely client-side, has zero dependencies, and provides:

- Noun phrase extraction (`doc.nouns().out('array')`) for skill identification
- Verb detection for bullet point quality analysis
- Named entity recognition for company/tool names
- Lemmatization so "managing" and "management" match

**What NOT to use:**
- `natural` -- Node.js only, does not bundle for browser
- `wink-nlp` -- requires model download (~11MB), overkill for keyword extraction
- `nlp.js` -- designed for chatbot intents, wrong tool for resume analysis
- Server-side Python NLP (spaCy, NLTK) -- adds deployment complexity to a Convex stack for marginal gains

**How to extend scoring.ts:** Keep `extractKeywords` as the public API but replace the internals:

```typescript
// Current: naive word split
// New: compromise-powered extraction
import nlp from 'compromise';

export function extractKeywords(text: string): string[] {
  const doc = nlp(text);
  const nouns = doc.nouns().toSingular().out('array');     // "project managers" -> "project manager"
  const acronyms = doc.acronyms().out('array');            // "SQL", "AWS", "KPI"
  const values = doc.values().out('array');                 // years of experience numbers
  // Merge, deduplicate, filter stop words
  return [...new Set([...nouns, ...acronyms])].filter(w => w.length >= 2 && !STOP_WORDS.has(w.toLowerCase()));
}
```

### 2. Language Detection: `franc-min` v6

| Attribute | Value |
|-----------|-------|
| **Package** | `franc-min` |
| **Version** | ^6.2.0 |
| **Bundle size** | ~27KB gzipped (82 languages) |
| **Purpose** | Auto-detect CV language (FR vs EN) to adapt scoring rules and suggestions |
| **Confidence** | HIGH -- standard JS language detection, maintained by wooorm |

**Why franc-min over franc:** The full `franc` package supports 400+ languages (~540KB). Calibre only needs FR/EN detection. `franc-min` covers 82 languages at a fraction of the size. Returns ISO 639-3 codes ("fra", "eng").

**What NOT to use:**
- `franc` (full) -- unnecessary payload for 2-language detection
- `cld3` -- requires WASM compilation, complex build setup
- `@google-cloud/language` -- server-side, requires API key, overkill

**Integration point:** Call once when CV data loads or job description is imported. Cache the result. Use it to switch between FR and EN scoring rules, section name expectations, and suggestion language.

### 3. ATS Scoring Engine: Custom (No External Library)

| Attribute | Value |
|-----------|-------|
| **Approach** | Extend existing `scoring.ts` with 3 sub-scores |
| **Dependencies** | `compromise` (see above) |
| **Confidence** | HIGH -- no credible open-source ATS scoring library exists for JS |

**Why custom:** There is no standard open-source ATS scoring library. Every CV builder (Jobscan, Enhancv, Novoresume, Rezi) builds proprietary scoring. The good news: the algorithm is well-documented in industry literature. The scoring formula from multiple sources converges on:

```
ATS Score = Format Score (30%) + Content Score (30%) + Relevance Score (40%)
```

**Format Score (0-100)** -- computed entirely client-side, real-time:
| Check | Weight | Implementation |
|-------|--------|----------------|
| All required sections present (Experience, Education, Skills, Contact) | 25 | Check CV data fields for non-empty |
| Section names are standard (not creative names) | 20 | Regex match against known ATS section headers FR/EN |
| No multi-column layout active (when ATS mode on) | 15 | Check template config |
| Standard fonts used | 10 | Check designSettings |
| Dates in parseable format | 15 | Regex validation on all date fields |
| Contact info complete (email + phone + location) | 15 | Check personal_info fields |

**Content Score (0-100)** -- computed client-side, real-time:
| Check | Weight | Implementation |
|-------|--------|----------------|
| Bullet points start with action verbs | 25 | compromise POS tagging |
| Bullets contain metrics/numbers | 20 | Regex for digits, %, currency |
| Summary present and adequate length | 15 | Length check (50-300 chars) |
| Skills categorized properly | 15 | Check skills array structure |
| No bullet point too long (>200 chars) or too short (<30 chars) | 15 | String length checks |
| No spelling/grammar red flags | 10 | Basic pattern matching (not full spellcheck) |

**Relevance Score (0-100)** -- requires job description, heavier computation:
| Check | Weight | Implementation |
|-------|--------|----------------|
| Keyword match rate (hard skills) | 40 | compromise noun extraction + TF-IDF weighting |
| Job title alignment | 20 | Fuzzy match of CV title vs job title |
| Experience relevance (years in field) | 20 | Existing `computeKeywordMatch` logic, enhanced |
| Missing critical keywords identified | 20 | Set difference between job keywords and CV keywords |

**Partial score without job description:** When no job description is imported, show Format + Content scores only (combined as "Partial Score") and display an incitation to import a job description for the full Relevance score.

### 4. TF-IDF Keyword Weighting: Custom (~50 lines)

| Attribute | Value |
|-----------|-------|
| **Approach** | Inline implementation, no library |
| **Purpose** | Weight keywords by importance rather than treating all equally |
| **Confidence** | HIGH -- TF-IDF is a well-understood algorithm, trivial to implement |

**Why no library:** TF-IDF for two documents (resume vs job description) is ~50 lines of code. Adding a library for this is over-engineering. The implementation:

```typescript
// In scoring.ts
function computeTfIdf(doc: string[], corpus: string[][]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const term of doc) tf.set(term, (tf.get(term) || 0) + 1);
  
  const idf = new Map<string, number>();
  const N = corpus.length;
  for (const [term] of tf) {
    const docsWithTerm = corpus.filter(d => d.includes(term)).length;
    idf.set(term, Math.log(N / (1 + docsWithTerm)));
  }
  
  const tfidf = new Map<string, number>();
  for (const [term, freq] of tf) {
    tfidf.set(term, freq * (idf.get(term) || 0));
  }
  return tfidf;
}
```

This lets the scoring engine know that "React" appearing once in a job description among many skills is less important than "Kubernetes" appearing 5 times.

### 5. Bullet Point Quality Analysis: LLM-Powered (Existing Infrastructure)

| Attribute | Value |
|-----------|-------|
| **Approach** | Use existing `convex/ai.ts` chatJSON infrastructure |
| **Purpose** | Deep bullet point analysis, rewriting, missing keyword suggestions |
| **Confidence** | HIGH -- infrastructure already exists |

**Why use existing AI, not a new service:**
- `convex/ai.ts` already has `chatJSON`, `chatText`, multi-provider support, access code verification
- The `improveBulletPoint` action already exists and does single-bullet rewriting
- New actions needed: `analyzeBulletPoints` (batch weak bullet detection) and `rewriteWithKeywords` (targeted keyword insertion)
- NVIDIA NIM llama-3.1-70b handles this well at 40 req/min free tier

**What NOT to use:**
- OpenAI API directly -- would require a second API key and provider config
- Grammarly API -- expensive, English-only, overkill for bullet quality
- LanguageTool API -- good for grammar but does not do ATS-specific analysis

### 6. PDF Export: Keep `window.print()` (For Now)

| Attribute | Value |
|-----------|-------|
| **Recommendation** | Stay with current `pdfExport.ts` approach |
| **Confidence** | MEDIUM -- alternatives exist but each has significant tradeoffs |

**Why keep window.print():**
The current iframe-based approach produces selectable text, preserves CSS exactly, supports all 6 templates, and requires zero additional dependencies. This is critical for ATS -- rasterized PDFs (html2canvas/jsPDF) produce image-based PDFs that ATS systems cannot parse at all.

**Alternatives evaluated and rejected for this milestone:**

| Library | Why Not |
|---------|---------|
| `html2canvas` + `jsPDF` | Produces rasterized images, NOT searchable text. ATS incompatible. Fatal flaw for an ATS-focused milestone. |
| `@react-pdf/renderer` | Requires rewriting all 6 templates as `@react-pdf` components (View, Text, etc.) instead of HTML/CSS. Massive effort, different layout engine. Not worth it for this milestone. |
| `pdfmake` | JSON-based layout definition. Same problem: requires rewriting all templates in pdfmake's DSL. |
| `Puppeteer/Playwright` | Server-side headless browser rendering. Would require a separate server (not Convex-compatible). Best quality but wrong architecture. |
| `html2pdf.js` | Wrapper around html2canvas + jsPDF. Same rasterization problem. |

**Future milestone consideration:** If DOCX export or server-side PDF generation becomes a requirement, evaluate Puppeteer on a separate serverless function (Vercel Edge or standalone). But for this ATS milestone, `window.print()` produces the right output: selectable text in a properly styled PDF.

### 7. Skill Categorization: LLM + Heuristic Hybrid

| Attribute | Value |
|-----------|-------|
| **Approach** | Client-side heuristic with LLM fallback |
| **Purpose** | Auto-categorize skills into Technical, Tools, Soft Skills, Methodology |
| **Confidence** | MEDIUM -- heuristic covers 80% of cases, LLM handles edge cases |

**Implementation:** Maintain a curated dictionary of ~200 common skills mapped to categories. For unknown skills, batch them and send to the existing AI infrastructure for classification. Cache results in Convex for reuse.

## Installation

```bash
# New dependencies for ATS milestone
npm install compromise franc-min

# No other new dependencies needed -- existing stack covers everything
```

**Total new bundle impact:** ~230KB gzipped (compromise ~200KB + franc-min ~27KB). Acceptable for the value provided.

## What NOT to Install

| Package | Why Avoid |
|---------|-----------|
| `natural` | Node.js only, massive bundle, designed for server NLP |
| `wink-nlp` | Requires 11MB model download, overkill |
| `nlp.js` | Chatbot-focused, wrong abstraction |
| `html2canvas` | Rasterizes to images, ATS-incompatible PDFs |
| `puppeteer` | Requires server, incompatible with Convex architecture |
| `franc` (full) | 540KB for 400 languages when you need 2 |
| `compromise-sentences` / `compromise-paragraphs` | Plugin ecosystem nice but unnecessary overhead |
| Any "ATS scoring" npm package | None exist that are credible; the few that exist are abandoned wrappers around OpenAI |
| `textrank` / `keyword-extractor` | Outdated, last published 3+ years ago, compromise does it better |
| `docx` (for export) | Already installed but DOCX export is out of scope for this milestone |

## Architecture of New Scoring Module

```
scoring.ts (existing, extended)
  |
  +-- extractKeywords()        -- ENHANCED with compromise NLP
  +-- computeKeywordMatch()    -- ENHANCED with TF-IDF weighting
  +-- scoreExperience()        -- KEPT as-is (recency + relevance + duration)
  +-- autoAssignModes()        -- KEPT as-is
  |
  +-- NEW: computeFormatScore()     -- real-time, pure client-side
  +-- NEW: computeContentScore()    -- real-time, uses compromise for verb detection
  +-- NEW: computeRelevanceScore()  -- requires job desc, uses enhanced keyword match
  +-- NEW: computeATSScore()        -- orchestrator: combines 3 sub-scores
  +-- NEW: detectLanguage()         -- franc-min wrapper, cached
  +-- NEW: findMissingKeywords()    -- set difference with ranked importance
  +-- NEW: analyzeBulletQuality()   -- compromise-based verb/metric detection

convex/ai.ts (existing, extended)
  |
  +-- EXISTING: getATSAnalysis()       -- deep AI analysis (keep as "full analysis" button)
  +-- EXISTING: improveBulletPoint()   -- single bullet rewriting
  +-- EXISTING: tailorCV()             -- full CV optimization
  |
  +-- NEW: batchAnalyzeBullets()       -- identify weak bullets across all experiences
  +-- NEW: rewriteWithKeywords()       -- rewrite specific bullets to include target keywords
  +-- NEW: categorizeSk ills()         -- LLM fallback for unknown skill categorization
```

**Key design decision:** Real-time scoring (Format + Content) happens 100% client-side with zero API calls. Only Relevance analysis and AI rewriting trigger Convex actions. This keeps the UI responsive and avoids burning API credits on every keystroke.

## Sources

- [compromise.js GitHub](https://github.com/spencermountain/compromise) -- 12K+ stars, v14.15.0
- [franc GitHub](https://github.com/wooorm/franc) -- language detection
- [ATS Score Breakdown: What Each Component Measures](https://cvcraft.roynex.com/blog/how-to-check-resume-ats-score-free) -- scoring rubric reference
- [Understanding ATS Scoring Algorithms](https://scale.jobs/blog/understanding-ats-scoring-algorithms) -- algorithm deep dive
- [How ATS Filters Work in 2025](https://huru.ai/ats-resume-ranking-scoring-logic-guide/) -- filter mechanics
- [Resume Shortlisting and Grading using TF-IDF](https://www.jetir.org/papers/JETIR2305459.pdf) -- TF-IDF for resume matching
- [6 Open-Source PDF Libraries for React 2025](https://blog.react-pdf-kit.dev/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025/) -- PDF alternatives evaluated
- [franc vs langdetect vs cld3 comparison](https://www.pkgpulse.com/blog/franc-vs-langdetect-vs-cld3-language-detection-javascript-2026) -- language detection comparison
