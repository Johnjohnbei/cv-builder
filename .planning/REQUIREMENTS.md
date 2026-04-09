# Requirements: Calibre — ATS Conformity Milestone

**Defined:** 2026-04-09
**Core Value:** Les CV generees par Calibre doivent passer les filtres ATS avec le meilleur score possible tout en restant visuellement professionnels

## v1 Requirements

Requirements for ATS conformity milestone. Each maps to roadmap phases.

### ATS Scoring

- [ ] **SCORE-01**: User can see a global ATS score (0-100) with circular gauge in the editor sidebar
- [ ] **SCORE-02**: Score is broken down into 3 sub-scores: Format, Content, Relevance
- [ ] **SCORE-03**: Format and Content sub-scores are computed client-side in real-time (no API call)
- [ ] **SCORE-04**: Relevance sub-score requires a job description and uses keyword matching with word-boundary accuracy (no substring false positives)
- [ ] **SCORE-05**: Without a job description, a partial score (Format + Content) is displayed with a prompt to import an offer for full analysis
- [ ] **SCORE-06**: Keyword extraction uses NLP (compromise) for bigrams/trigrams and TF-IDF weighting

### Keywords & Matching

- [ ] **KEYW-01**: User can see a color-coded list of keywords from the job description (green=present, red=missing)
- [ ] **KEYW-02**: Keywords include both acronyms and full terms (e.g., "PMP" + "Project Management Professional")
- [ ] **KEYW-03**: Keyword matching uses word boundaries to prevent false positives ("Java" must not match "JavaScript")

### Template ATS Mode

- [ ] **TMPL-01**: Each template is classified as ATS-adaptable or design-only with visible indicator
- [ ] **TMPL-02**: User can toggle "ATS mode" on adaptable templates (reversible)
- [ ] **TMPL-03**: ATS mode converts multi-column layouts to single-column via DOM restructuring (not CSS hiding)
- [ ] **TMPL-04**: ATS mode replaces all SVG icons (Mail, Phone, MapPin, LinkedIn) with text labels
- [ ] **TMPL-05**: ATS mode forces standard web-safe fonts (Arial, Calibri)
- [ ] **TMPL-06**: ATS mode simplifies decorative borders and colors
- [ ] **TMPL-07**: Activating ATS mode on a non-adaptable template auto-switches to the nearest compatible template
- [ ] **TMPL-08**: Deactivating ATS mode restores original template with a warning that CV won't be ATS-compatible

### Section Standards

- [ ] **SECT-01**: Section names are forced to ATS-recognized standards (not user-editable)
- [ ] **SECT-02**: French section names: "Experience professionnelle", "Formation", "Competences", "Langues", "Coordonnees", "Profil professionnel"
- [ ] **SECT-03**: English section names: "Work Experience", "Education", "Skills", "Languages", "Contact Information", "Professional Summary"
- [ ] **SECT-04**: Language of section names is auto-detected from CV content

### AI Content Optimization

- [ ] **AICV-01**: User can trigger global AI rewrite of all bullet points optimized for the target job
- [ ] **AICV-02**: User can trigger per-bullet AI rewrite individually
- [ ] **AICV-03**: AI detects weak bullet points (passive voice, no metrics, vague verbs like "responsible for")
- [ ] **AICV-04**: AI rewrite integrates missing keywords from job description naturally into content
- [ ] **AICV-05**: AI rewrite has fabrication guards — cannot invent metrics, shows diff view before/after
- [ ] **AICV-06**: AI rewrite uses NVIDIA NIM (existing provider)

### Skills Categorization

- [ ] **SKIL-01**: Skills are auto-categorized at import (Technical, Soft Skills, Tools, Methodologies)
- [ ] **SKIL-02**: Categorized skills display in grouped format in the CV (not flat list)
- [ ] **SKIL-03**: Skills categories are ATS-compatible section format

### Language Detection

- [ ] **LANG-01**: System auto-detects CV language (French vs English) from content
- [ ] **LANG-02**: ATS rules, section names, suggestions, and scoring adapt based on detected language
- [ ] **LANG-03**: Language detection uses franc-min library (lightweight, client-side)

### ATS Panel UI

- [ ] **PANL-01**: ATS analysis panel displayed as a sidebar tab in the editor
- [ ] **PANL-02**: Panel auto-opens when a job description is imported, closed by default otherwise
- [ ] **PANL-03**: Panel shows score gauge, sub-scores, keywords list, and actionable suggestions
- [ ] **PANL-04**: Suggestions include action buttons (e.g., "Improve this bullet", "Add missing skill")
- [ ] **PANL-05**: Full AI analysis (deep bullet analysis, keyword optimization) triggered on-demand via button

### PDF Validation

- [ ] **PDFV-01**: After PDF export, system validates that text is extractable using pdfjs-dist
- [ ] **PDFV-02**: If text extraction fails or is degraded, user receives a warning with explanation

### Refactoring

- [ ] **REFAC-01**: scoring.ts extended with ATS scoring (not a separate module), kept within file size limits
- [ ] **REFAC-02**: New atsRules.ts config module (~60 lines) for template compatibility map and section standards
- [ ] **REFAC-03**: ATSPanel extracted as a separate component (~200 lines)
- [ ] **REFAC-04**: ATS state extracted into useATSAnalysis hook to prevent EditorPage growth
- [ ] **REFAC-05**: formatDateShort and normalizeProficiency moved out of scoring.ts into shared utilities

## v2 Requirements

### Export

- **EXPO-01**: User can export CV in DOCX format (ATS-friendly alternative to PDF)
- **EXPO-02**: PDF export uses a programmatic solution (react-pdf or similar) instead of window.print

### Advanced Matching

- **MATCH-01**: Semantic keyword matching via embeddings (Resume2Vec approach)
- **MATCH-02**: Skills mapped to ESCO/O*NET taxonomies for standardized matching
- **MATCH-03**: Detection of target company's ATS platform (Workday, Greenhouse, etc.)

### Enhanced AI

- **ENAI-01**: AI-powered skills gap analysis with training suggestions
- **ENAI-02**: Cover letter keywords aligned with CV optimization
- **ENAI-03**: Rewrite intensity slider (conservative -> aggressive)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Export DOCX | Repousse a v2, focus PDF pour ce milestone |
| Detection plateforme ATS cible | Trop complexe, necessite scraping de job postings |
| Taxonomies ESCO/O*NET | Integration lourde, evaluer dans un futur milestone |
| Matching semantique embeddings | R&D, pas assez mature pour la production |
| Nouveau template ATS dedie (7eme) | On adapte les existants plutot qu'en ajouter |
| Keyword stuffing / invisible text | Anti-feature — les ATS modernes detectent et penalisent |
| ATS score comparison entre versions | Nice-to-have, pas prioritaire pour v1 |
| Server-side PDF generation | Complexite d'infrastructure trop elevee pour ce milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCORE-01 | Phase 4 | Pending |
| SCORE-02 | Phase 4 | Pending |
| SCORE-03 | Phase 4 | Pending |
| SCORE-04 | Phase 4 | Pending |
| SCORE-05 | Phase 4 | Pending |
| SCORE-06 | Phase 4 | Pending |
| KEYW-01 | Phase 5 | Pending |
| KEYW-02 | Phase 5 | Pending |
| KEYW-03 | Phase 5 | Pending |
| TMPL-01 | Phase 6 | Pending |
| TMPL-02 | Phase 6 | Pending |
| TMPL-03 | Phase 6 | Pending |
| TMPL-04 | Phase 6 | Pending |
| TMPL-05 | Phase 6 | Pending |
| TMPL-06 | Phase 6 | Pending |
| TMPL-07 | Phase 6 | Pending |
| TMPL-08 | Phase 6 | Pending |
| SECT-01 | Phase 3 | Pending |
| SECT-02 | Phase 3 | Pending |
| SECT-03 | Phase 3 | Pending |
| SECT-04 | Phase 3 | Pending |
| AICV-01 | Phase 9 | Pending |
| AICV-02 | Phase 9 | Pending |
| AICV-03 | Phase 9 | Pending |
| AICV-04 | Phase 9 | Pending |
| AICV-05 | Phase 9 | Pending |
| AICV-06 | Phase 9 | Pending |
| SKIL-01 | Phase 7 | Pending |
| SKIL-02 | Phase 7 | Pending |
| SKIL-03 | Phase 7 | Pending |
| LANG-01 | Phase 2 | Pending |
| LANG-02 | Phase 2 | Pending |
| LANG-03 | Phase 2 | Pending |
| PANL-01 | Phase 8 | Pending |
| PANL-02 | Phase 8 | Pending |
| PANL-03 | Phase 8 | Pending |
| PANL-04 | Phase 8 | Pending |
| PANL-05 | Phase 8 | Pending |
| PDFV-01 | Phase 10 | Pending |
| PDFV-02 | Phase 10 | Pending |
| REFAC-01 | Phase 1 | Pending |
| REFAC-02 | Phase 1 | Pending |
| REFAC-03 | Phase 8 | Pending |
| REFAC-04 | Phase 8 | Pending |
| REFAC-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 45 total (corrected from initial count of 37)
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after roadmap creation*
