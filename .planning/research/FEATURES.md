# Feature Landscape: ATS-Optimized CV Builder

**Domain:** ATS resume optimization for bilingual (FR/EN) CV builder
**Researched:** 2026-04-09
**Confidence:** MEDIUM-HIGH (multiple competitor products analyzed, market patterns clear)

## Table Stakes

Features users expect from any ATS-focused CV tool. Missing any of these makes the product feel incomplete compared to Jobscan, Teal, Rezi, Enhancv.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Global ATS Score (0-100)** | Every competitor shows a single headline number. Users need one metric to know "am I ready?" | Low | Weighted aggregate of sub-scores. Display as circular gauge or progress ring. 80+ = green, 60-79 = yellow, <60 = red. Already partially exists in `scoring.ts`. |
| **Sub-score Breakdown (Format / Content / Relevance)** | Jobscan, Enhancv, Rezi all break scores into categories. Users need to know WHERE to improve, not just IF. | Medium | 3 sub-scores as decided in PROJECT.md. Format = layout/parsing safety. Content = bullet quality, section completeness. Relevance = keyword match to job desc. |
| **Missing Keywords List** | The #1 feature users look for. Jobscan built its entire business on this. Shows exact terms from job description absent from resume. | Medium | Requires `extractKeywords` enhancement to support bigrams/trigrams (e.g., "project management"), not just unigrams. Must categorize: hard skills vs soft skills vs other. |
| **ATS-Safe Template Mode (Toggle)** | Users expect to switch between "beautiful" and "ATS-safe" versions. Single-column, standard fonts, no icons. | High | Must adapt 6 existing templates. Each needs evaluation: which can be toggled (e.g., Classic, Modern, Minimal) vs which are design-only (Sidebar, Creative). Toggle forces single-column, removes SVG icons, switches to Arial/Calibri, removes decorative elements. |
| **Standard Section Names** | ATS parsers rely on exact headings. Creative names like "My Journey" break parsing. | Low | Force bilingual standard names: "Experience / Experience professionnelle", "Education / Formation", "Skills / Competences". No user override in ATS mode. |
| **Score Without Job Description (Partial)** | Users often check their CV before having a specific job posting. Block them = lost users. | Low | Score Format + Content sub-scores only. Relevance shows "--" or "N/A" with CTA: "Import a job description for full analysis." |
| **Bullet Point Weakness Detection** | Rezi, Enhancv, LockedIn AI all flag weak bullets. Users expect to see which bullets need work. | Medium | Flag: passive voice ("responsible for"), missing metrics, vague verbs ("helped", "assisted"), too short (<5 words), too long (>25 words). Visual indicator per bullet (red/yellow/green dot). |
| **AI Bullet Point Rewrite** | Wobo, Rezi, Enhancv all offer one-click rewrite. Table stakes in 2026 for any AI-powered builder. | Medium | Two modes: (1) Global rewrite targeted to job description, (2) Per-bullet rewrite on hover/click. Use NVIDIA NIM with STAR-method prompt. Already has AI optimization infrastructure. |
| **Language Auto-Detection** | Bilingual product must know if CV is FR or EN to adapt rules, suggestions, section names. | Low | Simple heuristic: count FR vs EN stop words in content. Already has `STOP_WORDS` in scoring.ts as starting point. |

## Differentiators

Features that set Calibre apart. Not universally expected, but create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Real-Time Basic Scoring** | Most tools require "scan" button click. Calibre can score format/sections in real-time as user edits, no API call needed. Only full analysis (AI-powered) needs explicit trigger. | Medium | Split scoring: client-side (format checks, section presence, bullet length) runs on every change. Server-side (keyword extraction, AI analysis) runs on demand. Feels magical. |
| **Skills Auto-Categorization at Import** | Most builders dump all skills in one list. Auto-sorting into Technical / Soft / Tools / Methodology at import time saves significant user effort. | Medium | Use AI at import time to classify skills. Categories: Technical (languages, frameworks), Tools (software, platforms), Methodology (Agile, Scrum), Soft/Transversal (leadership, communication). Display in grouped sections. |
| **Per-Bullet Relevance Scoring** | Competitors score at experience level. Scoring individual bullets shows exactly which lines matter and which are filler. | Medium | Extend existing `scoreExperience` to score each description bullet against job keywords. Show small relevance badge per bullet. Enables smart hiding: low-relevance bullets can be auto-collapsed. |
| **Automatic Template Switch on ATS Toggle** | If user enables ATS mode on Sidebar (multi-column) template, auto-suggest or auto-switch to closest ATS-compatible template instead of just warning. | Low | Map each template to its ATS-compatible fallback. Sidebar -> Classic. Creative -> Modern (ATS mode). Show brief toast: "Switched to Classic for ATS compatibility." |
| **Bilingual Rules Engine** | FR and EN have different ATS conventions. French CVs expect "Formation" not "Education", different date formats, different action verbs. No competitor handles this well for FR market. | Medium | Dual rule sets: FR action verbs (dirige, optimise, developpe) vs EN (led, optimized, developed). FR section names vs EN. FR date format (Sept. 2021) vs EN (Sep 2021). Already has `MONTH_MAP_FR` in scoring.ts. |
| **Inline Keyword Insertion Suggestions** | Beyond listing missing keywords, suggest WHERE in the resume to naturally insert them. "Add 'project management' to your experience at Company X." | High | Requires AI to analyze context of each experience and suggest natural insertion points. More useful than a raw keyword list. Defer to later phase if time-constrained. |
| **ATS Compatibility Matrix per Template** | Show users a visual comparison of which templates are ATS-safe vs design-focused. Transparent about tradeoffs. | Low | Simple info panel in template picker. Green check / yellow warning / red X per template for ATS features (single-column, standard fonts, no icons). Builds trust. |

## Anti-Features

Features to deliberately NOT build. Each has been considered and rejected for good reasons.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **ATS Platform Detection** (Workday, Greenhouse, Taleo) | Requires maintaining a database of company-to-ATS mappings. Extremely fragile, always outdated. Only Jobscan does this and they have a dedicated team. | Optimize for universal ATS compatibility. If the CV passes the strictest parser, it passes all of them. |
| **ATS Parsing Simulation** | Building an actual ATS parser is a massive engineering effort (essentially building a competing product). Results would be inaccurate without real ATS engines. | Score based on known ATS rules (formatting, keywords, sections) rather than simulating parsing. Honest about what we check. |
| **ESCO/O*NET Taxonomy Integration** | Heavy data dependency (thousands of occupation codes). Maintenance burden. Overkill for keyword matching. | Use AI-powered keyword extraction from job descriptions. More flexible, no taxonomy maintenance. |
| **Semantic Matching via Embeddings** | Requires embedding model infrastructure, vector DB, significant compute. Diminishing returns vs keyword matching for ATS (most ATS still use exact match). | Stick to keyword matching with basic synonym handling. ATS themselves mostly do exact match, so our scoring should mirror that reality. |
| **New Dedicated ATS Template** | Adding a 7th template increases maintenance. Adapting existing templates is simpler and preserves user choice. | Toggle ATS mode on existing templates. Classify each as adaptable or design-only. |
| **DOCX Export** | Different milestone scope. PDF with selectable text is sufficient for most modern ATS (Workday, Greenhouse, Lever all parse PDF well). | Keep window.print() PDF export. Note: some older ATS prefer DOCX -- flag for future milestone. |
| **Gamification of ATS Score** | Badges, streaks, leaderboards around ATS scores trivialize the job search. Users are stressed, not playing a game. | Clean, professional scoring UI. Celebrate improvements subtly (score went up indicator) without gamifying anxiety. |
| **Auto-Apply / Job Board Integration** | Scope creep. Calibre is a builder, not a job search platform. Teal does this but it's a different product category. | Focus on making the best possible CV. Let users apply wherever they want. |

## Feature Dependencies

```
Language Auto-Detection
  --> Standard Section Names (need language to pick FR vs EN names)
  --> Bilingual Rules Engine (need language to select rule set)
  --> AI Bullet Rewrite (need language for prompt selection)

extractKeywords Enhancement (bigrams/trigrams)
  --> Missing Keywords List (needs better extraction)
  --> Per-Bullet Relevance Scoring (needs keyword matching)
  --> Global ATS Score - Relevance sub-score (needs keyword data)

ATS Template Evaluation (classify 6 templates)
  --> ATS-Safe Template Mode Toggle (need to know what to change per template)
  --> Automatic Template Switch (need compatibility mapping)
  --> ATS Compatibility Matrix (need evaluation data)

Bullet Point Weakness Detection (client-side rules)
  --> AI Bullet Point Rewrite (detection identifies WHAT to rewrite)
  --> Global ATS Score - Content sub-score (feeds into scoring)

Score Without Job Description
  --> Requires Format + Content sub-scores to work independently
  --> CTA drives users to import job description for full Relevance score

Skills Auto-Categorization
  --> Requires AI call at import time (already has import infrastructure)
  --> Independent of scoring system
```

## MVP Recommendation

### Must ship (Phase 1 -- Core ATS Scoring):
1. **Global ATS Score (0-100) with 3 sub-scores** -- the headline feature
2. **Standard Section Names** -- low complexity, high ATS impact
3. **Language Auto-Detection** -- prerequisite for bilingual support
4. **Score Without Job Description** -- don't block users without a job posting
5. **Missing Keywords List** -- the feature users associate most with ATS tools

### Ship next (Phase 2 -- Template Adaptation + AI Rewriting):
6. **ATS-Safe Template Mode Toggle** -- high complexity but core promise
7. **Bullet Point Weakness Detection** -- enables AI rewrite
8. **AI Bullet Point Rewrite** -- leverages existing NIM infrastructure
9. **Automatic Template Switch** -- small addition once toggle exists

### Ship after (Phase 3 -- Polish + Differentiators):
10. **Real-Time Basic Scoring** -- split client/server scoring
11. **Skills Auto-Categorization** -- import-time enhancement
12. **Per-Bullet Relevance Scoring** -- granular feedback
13. **ATS Compatibility Matrix** -- trust-building UI element
14. **Bilingual Rules Engine** -- FR-specific verb/date rules

### Defer:
- **Inline Keyword Insertion Suggestions** -- high complexity, diminishing returns vs simple keyword list. Evaluate after Phase 3 based on user feedback.

## Competitive Positioning

| Competitor | Strength | Calibre's Edge |
|------------|----------|---------------|
| Jobscan ($49.95/mo) | Deepest keyword analysis, ATS platform detection | Free/cheaper, integrated builder (not just scanner), bilingual FR/EN |
| Teal ($13/week) | Job tracking ecosystem, Chrome extension | Focused builder experience, better AI rewrite, not a bloated platform |
| Rezi | Real-time scoring, AI writing | Bilingual support, template adaptation toggle, open architecture |
| Enhancv | Beautiful templates, AI tailoring | ATS mode toggle preserves design choice, per-bullet scoring |
| Resume.io | Large template library | Deeper ATS analysis, AI-powered optimization, not just templates |

## Sources

- [ResumeAdapter ATS Optimization Guide](https://www.resumeadapter.com/blog/optimize-resume-for-ats)
- [Resume Optimizer Pro -- 8 Best ATS Checkers 2026](https://resumeoptimizerpro.com/blog/best-ats-resume-checker)
- [NeurACV -- ATS Resume Score Benchmarks](https://neuracv.com/blog/ats-resume-score)
- [Jobscan ATS Resume Checker](https://www.jobscan.co/)
- [Scale.jobs -- ATS Resume Format 2026](https://scale.jobs/blog/ats-resume-format-2026-design-guide)
- [Jobscan ATS-Friendly Resume Format Checklist](https://www.jobscan.co/blog/20-ats-friendly-resume-templates/)
- [Uppl.ai -- ATS Resume Keywords Guide 2026](https://uppl.ai/ats-resume-keywords/)
- [Kickresume -- Resume Skills Section Guide](https://www.kickresume.com/en/help-center/how-write-skills-resume/)
- [ResuFit -- Best AI Resume Builders 2026 Comparison](https://resufit.com/blog/best-ai-resume-builders-2026-pricing-features-ats-comparison/)
