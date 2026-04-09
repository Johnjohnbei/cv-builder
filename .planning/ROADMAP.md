# Roadmap: Calibre ATS Conformity Milestone

## Overview

This milestone transforms Calibre from a visually-focused CV builder into an ATS-optimized tool. The journey starts with foundational refactoring and language detection, builds up scoring and template adaptation capabilities, adds a UI panel to surface insights, and culminates with AI-powered content optimization and PDF validation. Each phase delivers a complete, testable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Refactoring Foundation** - Extract utilities, create atsRules config, prepare scoring.ts for extension
- [x] **Phase 2: Language Detection** - Auto-detect CV language and adapt all ATS rules accordingly (completed 2026-04-09)
- [ ] **Phase 3: Section Standards** - Force ATS-recognized section names based on detected language
- [ ] **Phase 4: ATS Scoring Engine** - Compute Format, Content, and Relevance sub-scores with global ATS score
- [ ] **Phase 5: Keywords & Matching** - Extract, match, and display job description keywords with accuracy
- [x] **Phase 6: Template ATS Mode** - Toggle ATS mode on templates with DOM restructuring and visual simplification (completed 2026-04-09)
- [ ] **Phase 7: Skills Categorization** - Auto-categorize skills at import and display in grouped ATS format
- [ ] **Phase 8: ATS Panel UI** - Sidebar panel showing scores, keywords, suggestions with action buttons
- [ ] **Phase 9: AI Content Optimization** - AI-powered bullet rewriting, weak bullet detection, keyword integration
- [ ] **Phase 10: PDF Validation** - Validate exported PDF text extractability and warn on degradation

## Phase Details

### Phase 1: Refactoring Foundation
**Goal**: Codebase is prepared for ATS features with clean module boundaries and no scoring.ts bloat
**Depends on**: Nothing (first phase)
**Requirements**: REFAC-01, REFAC-02, REFAC-05
**Success Criteria** (what must be TRUE):
  1. scoring.ts has a clear extension point for ATS scoring functions without exceeding file size limits
  2. atsRules.ts exists with template compatibility map and section standard definitions
  3. formatDateShort and normalizeProficiency live in shared utilities and all imports updated
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Extract formatting utilities, merge duplicate cn(), clean barrel exports
- [x] 01-02-PLAN.md — Create atsRules.ts config, fix word-boundary matching, add section separators to scoring.ts

### Phase 2: Language Detection
**Goal**: System knows whether the CV is in French or English and adapts behavior accordingly
**Depends on**: Phase 1
**Requirements**: LANG-01, LANG-02, LANG-03
**Success Criteria** (what must be TRUE):
  1. When a user imports or edits a CV, the system correctly identifies whether content is French or English
  2. Language detection runs client-side using franc-min with no perceptible delay
  3. Detected language is available to downstream systems (scoring, sections, suggestions)
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md — Install franc-min, detect CV language, add FR/EN selector, wire into import pipeline

### Phase 3: Section Standards
**Goal**: CV section names conform to ATS-recognized standards automatically
**Depends on**: Phase 2
**Requirements**: SECT-01, SECT-02, SECT-03, SECT-04
**Success Criteria** (what must be TRUE):
  1. Section names in the CV are forced to standard labels and cannot be edited to non-standard values
  2. French CVs use the exact standard names (Experience professionnelle, Formation, Competences, Langues, Coordonnees, Profil professionnel)
  3. English CVs use the exact standard names (Work Experience, Education, Skills, Languages, Contact Information, Professional Summary)
  4. Section language matches the auto-detected CV language from Phase 2
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md — Add getSectionTitle() utility, thread language prop, replace 32 hardcoded section names in 6 templates

### Phase 4: ATS Scoring Engine
**Goal**: Users get a real-time ATS score (0-100) with meaningful sub-score breakdown
**Depends on**: Phase 1, Phase 2
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06
**Success Criteria** (what must be TRUE):
  1. User sees a global ATS score (0-100) that updates in real-time as they edit the CV
  2. Score breaks down into Format, Content, and Relevance sub-scores visible to the user
  3. Without a job description, user sees Format + Content scores with a clear prompt to import an offer
  4. With a job description, Relevance sub-score uses word-boundary keyword matching with no substring false positives
  5. Keyword extraction handles bigrams/trigrams and applies TF-IDF weighting via compromise NLP
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- ATSScoreResult type, scoreFormat, scoreContent, no-JD orchestrator
- [x] 04-02-PLAN.md -- Install compromise NLP, extractNLPKeywords, TF-IDF, scoreRelevance, full orchestrator

### Phase 5: Keywords & Matching
**Goal**: Users can see which job description keywords are present or missing in their CV
**Depends on**: Phase 4
**Requirements**: KEYW-01, KEYW-02, KEYW-03
**Success Criteria** (what must be TRUE):
  1. User sees a color-coded keyword list (green = present in CV, red = missing) from the job description
  2. Keywords include both acronym and expanded forms (e.g., "PMP" and "Project Management Professional")
  3. Matching is word-boundary accurate -- "Java" does not falsely match "JavaScript"
**Plans**: 1 plan

Plans:
- [x] 05-01-PLAN.md — KeywordMatch type, computeKeywordAnalysis with acronym detection and word-boundary matching, tests

### Phase 6: Template ATS Mode
**Goal**: Users can toggle ATS mode on templates to make them ATS-parser-friendly
**Depends on**: Phase 1
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06, TMPL-07, TMPL-08
**Success Criteria** (what must be TRUE):
  1. Each template in the template picker shows a visible ATS-adaptable or design-only indicator
  2. Toggling ATS mode on an adaptable template converts multi-column to single-column via DOM restructuring (not CSS hiding)
  3. ATS mode replaces SVG icons with text labels, forces web-safe fonts, and simplifies decorative elements
  4. Activating ATS mode on a design-only template auto-switches to the nearest compatible template
  5. Deactivating ATS mode restores the original template and shows a warning about losing ATS compatibility
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md — Add atsMode to DesignSettings, update classifications, add toggle to editor, implement auto-switch logic
- [x] 06-02-PLAN.md — Implement ATS rendering in TemplateA/B/C/E: icon replacement, font override, style simplification
- [x] 06-03-PLAN.md — Add ATS compatibility badges to template picker, end-to-end verification checkpoint

### Phase 7: Skills Categorization
**Goal**: Skills are automatically organized into ATS-friendly categories
**Depends on**: Phase 2, Phase 3
**Requirements**: SKIL-01, SKIL-02, SKIL-03
**Success Criteria** (what must be TRUE):
  1. When a CV is imported, skills are auto-categorized into Technical, Soft Skills, Tools, and Methodologies
  2. Skills display in grouped format in the CV (not a flat comma-separated list)
  3. Skills section uses ATS-compatible formatting that parsers can extract
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 07-01: TBD

### Phase 8: ATS Panel UI
**Goal**: Users have a dedicated ATS analysis sidebar with scores, keywords, and actionable suggestions
**Depends on**: Phase 4, Phase 5
**Requirements**: PANL-01, PANL-02, PANL-03, PANL-04, PANL-05, REFAC-03, REFAC-04
**Success Criteria** (what must be TRUE):
  1. ATS panel is accessible as a sidebar tab in the editor
  2. Panel auto-opens when a job description is imported and stays closed by default otherwise
  3. Panel displays score gauge, sub-scores, keyword list, and actionable improvement suggestions
  4. Suggestions have action buttons that trigger improvements (e.g., "Improve this bullet", "Add missing skill")
  5. Full AI analysis is available on-demand via a button (not automatic)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: AI Content Optimization
**Goal**: Users can improve their CV content with AI-powered rewrites targeted to specific job descriptions
**Depends on**: Phase 5, Phase 8
**Requirements**: AICV-01, AICV-02, AICV-03, AICV-04, AICV-05, AICV-06
**Success Criteria** (what must be TRUE):
  1. User can trigger a global AI rewrite of all bullet points optimized for the imported job description
  2. User can rewrite individual bullet points one at a time
  3. AI flags weak bullet points (passive voice, no metrics, vague verbs) before rewriting
  4. AI naturally integrates missing keywords from the job description into rewritten content
  5. Rewritten content shows a diff view for user approval and never fabricates metrics
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD
- [ ] 09-03: TBD

### Phase 10: PDF Validation
**Goal**: Users are confident their exported PDF will be readable by ATS parsers
**Depends on**: Phase 6
**Requirements**: PDFV-01, PDFV-02
**Success Criteria** (what must be TRUE):
  1. After exporting a PDF, the system automatically validates that text content is extractable using pdfjs-dist
  2. If text extraction fails or is significantly degraded, user receives a clear warning explaining the issue
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Refactoring Foundation | 0/2 | Not started | - |
| 2. Language Detection | 1/1 | Complete   | 2026-04-09 |
| 3. Section Standards | 0/1 | Not started | - |
| 4. ATS Scoring Engine | 1/2 | In Progress|  |
| 5. Keywords & Matching | 0/1 | Not started | - |
| 6. Template ATS Mode | 3/3 | Complete   | 2026-04-09 |
| 7. Skills Categorization | 0/1 | Not started | - |
| 8. ATS Panel UI | 0/3 | Not started | - |
| 9. AI Content Optimization | 0/3 | Not started | - |
| 10. PDF Validation | 0/1 | Not started | - |
