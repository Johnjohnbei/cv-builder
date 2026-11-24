# Graph Report - cv-builder  (2026-11-24)

## Corpus Check
- 378 files · ~308,682 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 2815 nodes · 6089 edges · 174 communities (157 shown, 17 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 346 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `64cf25a8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Experience
- convex
- chat.ts
- job-requirements-cache.ts
- CLAUDE.md
- Phase 11: PDF Export Engine - Research
- Phase 4: ATS Scoring Engine - Research
- tailor.ts
- publicUrl.ts
- types/index.ts
- cn
- ai.ts
- truthGuard.ts
- Phase 2: Language Detection - Research
- Phase 3: Section Standards - Research
- Phase 1: Refactoring Foundation - Research
- EditorSidebar.tsx
- keyword-analysis.ts
- DashboardPage.tsx
- types.ts
- pdf-validation.ts
- display-modes.ts
- Architecture Patterns
- Pattern Overview
- Phase 7: Skills Categorization - Research
- react
- dismissed-requirements.ts
- template-e.tsx
- Button.tsx
- normalizers.ts
- KNOWLEDGE — Calibre CV Builder
- PaginatedCV.tsx
- fit-to-pages.ts
- schemas.ts
- EditorPage.tsx
- dependencies
- package.json
- export-docx.ts
- linkedin-parser.ts
- fragments.ts
- storage.ts
- allocate-pages.ts
- ats-rules.ts
- Implementation Decisions
- Critical Pitfalls
- Calibre : CV Builder avec IA
- generate-pdf.ts
- Implementation Decisions
- categorizeSkills
- v1 Requirements
- useCoverLetter.ts
- linkedin-experience.ts
- jobDescription.ts
- CVData
- Implementation Decisions
- Phase Details
- export-letter.ts
- compilerOptions
- pdf-text-extract.ts
- scoring.ts
- Implementation Decisions
- Implementation Decisions
- template-layouts.ts
- Phase 3: Section Standards - Context
- Implementation Decisions
- Recommended Additions for ATS Milestone
- file-naming-scan.mjs
- useCVLoader.ts
- Plan 11-06 — SUMMARY — CRITICAL FIX LANDED
- Phase 8: ATS Panel UI - Context
- Phase 9: AI Content Optimization - Context
- useCVPersistence.ts
- Quick Task 260411-mij — Auto-extract company name from JD
- Quick Task 260418-hce: Career-Ops Integration — Keyword Injection Hierarchy + ATS Enrichment Summary
- Project State
- Plan 11-05 — SUMMARY
- 260411-m24-PLAN.md
- fit-to-pages.spec.ts
- Phase 01 Plan 02: ATS Rules Config + Scoring Fixes Summary
- Phase 04 Plan 02: NLP Keyword Extraction and Relevance Scoring Summary
- Phase 7: Skills Categorization - Context
- Feature Landscape: ATS-Optimized CV Builder
- anti-vibe-scan.mjs
- compilerOptions
- scripts
- Codebase Concerns
- Testing Patterns
- Phase 4 Plan 1: ATS Scoring Engine - Format + Content Sub-scores Summary
- Plan 11-07 — SUMMARY
- Plan 11-08 — SUMMARY
- Plan 11-09 — SUMMARY
- Implementation Decisions
- Phase 12 — ATS Workflow UX + A11y + Auto-Distribute — Verification
- Calibre — CV Builder avec IA
- CoverLetterData
- text.ts
- Plan 11-01 — SUMMARY
- long-cv.ts
- Phase 06 Plan 02: ATS Template Rendering Summary
- Phase 06 Plan 03: ATS Compatibility Badges Summary
- Phase 8 Plan 3: EditorPage ATS Integration Summary
- Plan 11-02 — SUMMARY
- Plan 11-04 — SUMMARY
- Phase 11 — AI Layer Refactor — Verification
- Phase 14 — Editor DS Atoms Migration — Verification
- Plan — Auto-extract company name from JD (Phase A logo roadmap)
- CoverLetterWorkspace.tsx
- getBrowser
- prompts/coverLetter.ts
- Coding Conventions
- External Integrations
- Phase 06 Plan 01: ATS Mode Toggle & Auto-Switch Summary
- Phase 8 Plan 1: ScoreGauge + useATSAnalysis Summary
- Phase 8 Plan 2: ATSPanel Component Summary
- Phase 9 Plan 02: AI Bullet Rewriting Actions Summary
- Phase 10: PDF Validation - Context
- Plan 11-03 — SUMMARY
- Phase 11 Plan 01: Serverless PDF Generation Endpoint Summary
- Phase 11 Plan 02: Client-Side PDF Export Flow Summary
- Implementation Decisions
- text.test.ts
- Phase 01 Plan 01: Extract Formatting Utilities Summary
- Phase 03 Plan 01: Section Standards Summary
- Phase 05 Plan 01: Keyword Analysis Computation Summary
- Phase 9 Plan 1: Weak Bullet Detection Summary
- Phase 10 Plan 01: PDF Text Extractability Validation Summary
- 11-VERIFICATION.md
- Phase 11: AI Layer Refactor — Context
- Plan 12-02 — SUMMARY
- Plan 12-03 — SUMMARY
- Phase 13 — Editor Hooks Extraction — Verification
- Where New Logic Lives
- distribute.ts
- Technology Stack
- Codebase Structure
- Phase 1 — Validation Strategy
- Phase 3 — Validation Strategy
- Plan 11-10 — SUMMARY
- Phase 11: PDF Export Engine - Discussion Log
- linkedin-parser.test.ts
- server.d.ts
- Phase 02 Plan 01: Language Detection Summary
- Plan 12-01 — SUMMARY
- Implementation Decisions
- Phase 12: ATS Workflow UX + A11y + Auto-Distribute Keywords — Context
- Plan 13-01 — SUMMARY
- buildCoverLetterText
- Plan 13-02 — SUMMARY
- Plan 13-04 — SUMMARY
- vercel.json
- convex.json
- vitest
- @playwright/test
- Validation Architecture
- Canonical References
- Canonical References
- Plan 13-03 — SUMMARY
- graphify-sync.sh
- 11-11-PLAN.md
- vite-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `CVData` - 90 edges
2. `cn()` - 56 edges
3. `vitest` - 55 edges
4. `react` - 52 edges
5. `DesignSettings` - 42 edges
6. `EditorPage()` - 40 edges
7. `lucide-react` - 37 edges
8. `Button` - 37 edges
9. `JobRequirement` - 36 edges
10. `userError()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `K005 — AI actions: a signed-in account OR a valid access code (2026-09-15)` --references--> `verifyAccessCode()`  [INFERRED]
  KNOWLEDGE.md → convex/_ai/auth.ts
- `Tech Debt` --references--> `verifyAccessCode()`  [INFERRED]
  .planning/codebase/CONCERNS.md → convex/_ai/auth.ts
- `Authentication & Identity` --references--> `verifyAccessCode()`  [INFERRED]
  .planning/codebase/INTEGRATIONS.md → convex/_ai/auth.ts
- `Data Storage` --references--> `verifyAccessCode()`  [INFERRED]
  .planning/codebase/INTEGRATIONS.md → convex/_ai/auth.ts
- `Known stubs / threat flags` --references--> `verifyAccessCode()`  [INFERRED]
  .planning/quick/260411-mij-auto-extract-company-name-from-jd-and-pr/260411-mij-SUMMARY.md → convex/_ai/auth.ts

## Import Cycles
- None detected.

## Communities (174 total, 17 thin omitted)

### Community 0 - "Experience"
Cohesion: 0.07
Nodes (50): ATSPanel Updates (200 lines total), BulletDiffView Component (32 lines), Commits, Deviations from Plan, EditorPage Integration (1810 lines total, +82 lines added), Known Stubs, Phase 9 Plan 03: EditorPage AI Content Optimization Integration Summary, Self-Check: PASSED (+42 more)

### Community 1 - "convex"
Cohesion: 0.07
Nodes (44): consumeInternal, findCode(), generate, list, listRequests, randomCode(), rejectionReason(), requestAccess (+36 more)

### Community 2 - "chat.ts"
Cohesion: 0.08
Nodes (45): ACTION_DEADLINE_MS, AI_CALL_WORST_CASE_MS, chatJSONSchema(), chatJSONThen(), chatText(), errorStatus(), extractAnthropicText(), isRetryable() (+37 more)

### Community 3 - "job-requirements-cache.ts"
Cohesion: 0.10
Nodes (42): Limites du score et de la génération, par priorité, useOfferTailoring(), ATSPanel(), ATSPanelProps, CHECK_LABELS, SECTION_LABELS, JobRequirementsState, useJobRequirements() (+34 more)

### Community 4 - "CLAUDE.md"
Cohesion: 0.06
Nodes (44): Architecture, Code Style, Comments, Component Patterns, Configuration, Constraints, Conventions, Data Flow (+36 more)

### Community 5 - "Phase 11: PDF Export Engine - Research"
Cohesion: 0.04
Nodes (47): Alternatives Considered, Anti-Patterns to Avoid, Applicable ASVS Categories, Architecture Patterns, Assumptions Log, Claude's Discretion, Code Examples, Common Pitfalls (+39 more)

### Community 6 - "Phase 4: ATS Scoring Engine - Research"
Cohesion: 0.04
Nodes (45): Alternatives Considered, Anti-Patterns to Avoid, Architecture Patterns, Bullet Length Check, Claude's Discretion, Code Examples, Common Pitfalls, Contact Info Detection (+37 more)

### Community 7 - "tailor.ts"
Cohesion: 0.08
Nodes (34): offerLanguageOf(), resolveAdaptLanguage(), companyNamed(), AI_MODELS, analysisFor(), applyRepair(), EXTRACTION_DEADLINE_MS, extractRequirements() (+26 more)

### Community 8 - "publicUrl.ts"
Cohesion: 0.08
Nodes (28): checkSources, CONTENT, decodeEntities(), htmlToText(), isRawText(), MAX_PAGE_TEXT_CHARS, NAMED_ENTITIES, PAGE_CHROME (+20 more)

### Community 9 - "types/index.ts"
Cohesion: 0.10
Nodes (35): Accomplishments, Task 1: Language detection utility with TDD (2040e74), Task 2: Import wiring and LanguageSelector UI (34ffb46), Summary, Notify, useLanguageSwitch(), UseLanguageSwitchResult, attachBilingualCache() (+27 more)

### Community 10 - "cn"
Cohesion: 0.11
Nodes (27): lucide-react, react-dropzone, CvImportPanel(), extracted(), Props, DashboardView, Props, JobOfferPanel() (+19 more)

### Community 11 - "ai.ts"
Cohesion: 0.12
Nodes (33): verifyAccessCode(), extractCompanyMeta, extractCVDataFromPDF, extractJobDescriptionFromPDF, extractJobDescriptionFromURL, extractJobRequirements, generateCoverLetter, assertBoundedPrompt() (+25 more)

### Community 12 - "truthGuard.ts"
Cohesion: 0.10
Nodes (37): CoverLetter, coverLetterOf(), LetterRevision, validateLetter(), APPROXIMATE, COMPOUND_VALUES, FIGURE, hasUnbackedNumber() (+29 more)

### Community 13 - "Phase 2: Language Detection - Research"
Cohesion: 0.05
Nodes (40): Alternatives Considered, Anti-Patterns to Avoid, Architecture Patterns, Claude's Discretion, Code Examples, Common Pitfalls, Core, Deferred Ideas (OUT OF SCOPE) (+32 more)

### Community 14 - "Phase 3: Section Standards - Research"
Cohesion: 0.05
Nodes (39): Additional Hardcoded French Strings (OUT OF SCOPE), Architecture Patterns, Claude's Discretion, Code Examples, Common Pitfalls, Data Flow, Deferred Ideas (OUT OF SCOPE), Don't Hand-Roll (+31 more)

### Community 15 - "Phase 1: Refactoring Foundation - Research"
Cohesion: 0.05
Nodes (38): Architecture Patterns, atsRules.ts Template, Claude's Discretion, cn() Merge Plan, Code Examples, Common Pitfalls, Core (already installed), Current Test State (+30 more)

### Community 16 - "EditorSidebar.tsx"
Cohesion: 0.10
Nodes (30): EditorSidebar(), EditorTab, TABS, COLOR_PRESETS, COLOR_THEMES, DesignTab, FONT_OPTIONS, FontFamily (+22 more)

### Community 17 - "keyword-analysis.ts"
Cohesion: 0.12
Nodes (32): Cross-Cutting Concerns, experienceYearsHeadline(), experienceYearsIn(), experienceYearsLabel(), experienceYearsText(), hasHomogeneousDates(), hasReadableDates(), monthIndex() (+24 more)

### Community 18 - "DashboardPage.tsx"
Cohesion: 0.14
Nodes (25): api, components, AccessCodeDialog(), Props, AdminCodesDialog(), Props, DashboardMobileNav(), DashboardSidebar() (+17 more)

### Community 19 - "types.ts"
Cohesion: 0.12
Nodes (25): Props, usePaginationFit(), pageFreeMm(), blocksStable(), carryOver(), LiveMeasurements, readLiveDOM(), reconcileBlocks() (+17 more)

### Community 20 - "pdf-validation.ts"
Cohesion: 0.17
Nodes (22): STRIDE Threat Register, Trust Boundaries, Task 2: Wire serverlessPDF into EditorPage (6df14fc), D-07 — Commit atomicity, useExport(), UseExportResult, buildPdfFileName(), downloadPdfFromHtml() (+14 more)

### Community 21 - "display-modes.ts"
Cohesion: 0.19
Nodes (24): Function Design, Naming Patterns, Function Design, Naming Patterns, useAutoZoom(), getActionBullets(), getIntro(), getMode() (+16 more)

### Community 22 - "Architecture Patterns"
Cohesion: 0.07
Nodes (28): Anti-Pattern 1: Separate ATS State Object, Anti-Pattern 2: ATS-specific Template Components, Anti-Pattern 3: Real-time AI Scoring, Anti-Pattern 4: New Scoring Module, Anti-Pattern 5: Putting ATS Rules Inside scoring.ts, Anti-Patterns to Avoid, Architecture Patterns, Component Boundaries (+20 more)

### Community 23 - "Pattern Overview"
Cohesion: 0.15
Nodes (16): Pattern Overview, guardAICalls(), LETTER, GuestSeed, guardAICalls(), answerAIActions(), expectNoAICalls(), MOCK_REQUIREMENT_LABELS (+8 more)

### Community 24 - "Phase 7: Skills Categorization - Research"
Cohesion: 0.07
Nodes (27): Alternatives Considered, Anti-Patterns to Avoid, Architecture Patterns, Claude's Discretion, Code Examples, Core, Deferred Ideas (OUT OF SCOPE), Don't Hand-Roll (+19 more)

### Community 25 - "react"
Cohesion: 0.17
Nodes (17): @clerk/clerk-react, react, react-router-dom, App(), AuthPage, DashboardPage, EditorPage, HomePage (+9 more)

### Community 26 - "dismissed-requirements.ts"
Cohesion: 0.16
Nodes (21): TailorResult, ATSAnalysis, useATSAnalysis(), dismissedOf(), notRequirementIdsOf(), notRequirementsOf(), requirementsOfOffer(), storedRequirements() (+13 more)

### Community 27 - "template-e.tsx"
Cohesion: 0.16
Nodes (21): Existing codebase — files being refactored, getShortSectionTitle(), EducationBlock(), ExperienceBlock(), getSectionHeader(), HeaderBlock(), LanguagesBlock(), SkillCategoryBlock() (+13 more)

### Community 28 - "Button.tsx"
Cohesion: 0.12
Nodes (15): Props, Size, sizeStyles, Variant, variantStyles, ErrorBoundary, Props, State (+7 more)

### Community 29 - "normalizers.ts"
Cohesion: 0.18
Nodes (22): isNotARequirement(), normalizeCVData(), normalizeDescription(), normalizeDisplayMode(), normalizeExperience(), normalizeJobRequirements(), normalizeLanguages(), normalizeProficiency() (+14 more)

### Community 30 - "KNOWLEDGE — Calibre CV Builder"
Cohesion: 0.08
Nodes (24): Faire évoluer le système sans multiplier les couches, Fonctionnement réellement branché, Interface après génération : constats mesurés, K001 — LinkedIn PDF font sizes are stable (2025 format), K002 — LinkedIn URLs can span 2+ lines, K003 — react-dropzone file inputs are hidden, K004 — Claude on large CVs: streaming is mandatory, K005 — AI actions: a signed-in account OR a valid access code (2026-09-15) (+16 more)

### Community 31 - "PaginatedCV.tsx"
Cohesion: 0.17
Nodes (18): CVPage(), Props, PaginatedCV, Props, SectionTitle(), InPlaceEditingResult, Options, getContinuationMarker() (+10 more)

### Community 32 - "fit-to-pages.ts"
Cohesion: 0.14
Nodes (19): useFitToPages(), UseFitToPagesResult, Candidate, condenseOneStep(), expandToMax(), LADDER, lastMentionCheck(), maxCondenseSteps() (+11 more)

### Community 33 - "schemas.ts"
Cohesion: 0.11
Nodes (18): CoverLetterSchema, CVDataSchema, EducationSchema, ExperienceDisplayModeSchema, ExperienceSchema, GenerationSchema, JobRequirementSchema, JobRequirementsSchema (+10 more)

### Community 34 - "EditorPage.tsx"
Cohesion: 0.19
Nodes (21): mentions(), EditorPreview, useAutoSaveDraft(), useInPlaceEditing(), dismissedIdsOf(), withoutDismissed(), suggestedPageLimit(), writtenBy() (+13 more)

### Community 35 - "dependencies"
Cohesion: 0.08
Nodes (24): pdfItems(), dependencies, @anthropic-ai/sdk@^0.88.0, @clerk/clerk-react@^5.61.4, clsx@^2.1.1, convex@^1.34.1, docx@^9.6.1, file-saver@^2.0.5 (+16 more)

### Community 36 - "package.json"
Cohesion: 0.11
Nodes (23): devDependencies, autoprefixer@^10.4.27, @playwright/test@^1.59.1, tailwindcss@^4.2.2, tsx@^4.21.0, @types/node@^25.5.2, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+15 more)

### Community 37 - "export-docx.ts"
Cohesion: 0.15
Nodes (18): CEFR_LEVELS, DateLanguage, formatDateShort(), getCurrentLabel(), LANGUAGE_NAMES, localizeLanguageName(), MONTH_TO_INDEX, MONTHS_SHORT_EN (+10 more)

### Community 38 - "linkedin-parser.ts"
Cohesion: 0.18
Nodes (22): Summary, parseLanguages(), parsePersonalInfo(), parseSkills(), PersonalInfo, PROFICIENCY, readContacts(), readHeadline() (+14 more)

### Community 39 - "fragments.ts"
Cohesion: 0.21
Nodes (16): buildAdaptPrompt(), ACTION_VERBS_EN, ACTION_VERBS_FR, INTRO_PRESERVATION_EN, INTRO_PRESERVATION_FR, KPI_RULES(), KPI_RULES_EN, KPI_RULES_FR (+8 more)

### Community 40 - "storage.ts"
Cohesion: 0.21
Nodes (14): AuthPage(), DashboardImportsDeps, loadPdfTools(), useDashboardImports(), currentAccessCode(), storeAccessCode(), loadModule(), useAccessCode() (+6 more)

### Community 41 - "allocate-pages.ts"
Cohesion: 0.18
Nodes (16): AllocateOptions, allocateOverflowPages(), allocatePages(), fillPage(), getUsableHeight(), isPageOverfilled(), mmToPx(), ORDER (+8 more)

### Community 42 - "ats-rules.ts"
Cohesion: 0.17
Nodes (14): Summary, Reusable Assets, Props, getSectionTitle(), getSkillCategoryTitle(), SECTION_NAMES, SectionKey, SHORT_SECTION_NAMES (+6 more)

### Community 43 - "Implementation Decisions"
Cohesion: 0.10
Nodes (19): Canonical References, Claude's Discretion, Current PDF System, CV Rendering, Deferred Ideas, Established Patterns, Existing Code Insights, Font Handling (+11 more)

### Community 44 - "Critical Pitfalls"
Cohesion: 0.10
Nodes (19): Critical Pitfalls, Domain Pitfalls, Minor Pitfalls, Moderate Pitfalls, Phase-Specific Warnings, Pitfall 10: getATSAnalysis and tailorCV Produce Contradictory Recommendations, Pitfall 11: Contact Info in CSS Grid Sidebar Gets Dropped by ATS, Pitfall 12: Photo/Avatar Placeholder Wastes ATS-Visible Space (+11 more)

### Community 45 - "Calibre : CV Builder avec IA"
Cohesion: 0.10
Nodes (19): Administration, Architecture, Calibre : CV Builder avec IA, Développement, Entreprise de l’offre et années d’expérience (2026-11-19), Export, Fiabilité ATS et évolution des règles, Fonctionnalités (+11 more)

### Community 46 - "generate-pdf.ts"
Cohesion: 0.16
Nodes (11): ALLOWED_REQUEST_HOSTS, GeneratePDFRequest, hits, isAllowedOrigin(), isRateLimited(), POST(), validatePayload(), wrapHtml() (+3 more)

### Community 47 - "Implementation Decisions"
Cohesion: 0.11
Nodes (18): ATS Rules (Phase 1 output), Bilingual Handling, Canonical References, Claude's Discretion, Deferred Ideas, Detection Input, Detection Timing, Downstream API (+10 more)

### Community 48 - "categorizeSkills"
Cohesion: 0.11
Nodes (18): Deviations from Plan, Known Stubs, Phase 7 Plan 1: Skills Categorization Summary, Task 1: Skill Dictionary, Task 2: Integration Layer, Task 3: Template Updates, Tasks Completed, Verification Results (+10 more)

### Community 49 - "v1 Requirements"
Cohesion: 0.11
Nodes (18): Advanced Matching, AI Content Optimization, ATS Panel UI, ATS Scoring, Enhanced AI, Export, Keywords & Matching, Language Detection (+10 more)

### Community 50 - "useCoverLetter.ts"
Cohesion: 0.23
Nodes (15): emptyDraft(), LetterSelection, Notify, useCoverLetter(), asText(), COVER_LETTER_STORAGE_KEY, getLetterLanguage(), guestApplications() (+7 more)

### Community 51 - "linkedin-experience.ts"
Cohesion: 0.19
Nodes (17): buildExperience(), continuesParagraph(), ExpBuilder, MONTH, parseDate(), parseExperiences(), readBodyLine(), stripBullet() (+9 more)

### Community 52 - "jobDescription.ts"
Cohesion: 0.12
Nodes (15): buildJobRequirementsPrompt(), IMPORTANCE_GUIDE, JobDescriptionFromPDFContext, JobDescriptionFromURLContext, JobRequirementsContext, KIND_GUIDE, designValidator, dismissedRequirementValidator (+7 more)

### Community 53 - "CVData"
Cohesion: 0.16
Nodes (15): Generation, Props, Props, ColorTheme, Props, Props, UseATSAnalysisDeps, UseAutoSaveDraftDeps (+7 more)

### Community 54 - "Implementation Decisions"
Cohesion: 0.11
Nodes (17): Architecture, ATS Rules (Phase 1 output), Canonical References, Claude's Discretion, Deferred Ideas, Implementation Decisions, Language Detection (Phase 2 output), Phase 4: ATS Scoring Engine - Context (+9 more)

### Community 55 - "Phase Details"
Cohesion: 0.11
Nodes (17): Overview, Phase 10: PDF Validation, Phase 11: AI Layer Refactor — couche par couche, schemas Zod, normalizers unifiés, tests exhaustifs, Phase 12: ATS Workflow UX + A11y + Auto-Distribute Keywords, Phase 1: Refactoring Foundation, Phase 2: Language Detection, Phase 3: Section Standards, Phase 4: ATS Scoring Engine (+9 more)

### Community 56 - "export-letter.ts"
Cohesion: 0.23
Nodes (14): docx, buildLetterDateLine(), ExportLanguage, bodyParagraph(), buildLetterDocument(), buildLetterFilename(), buildLetterHtml(), escapeHtml() (+6 more)

### Community 57 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+8 more)

### Community 58 - "pdf-text-extract.ts"
Cohesion: 0.14
Nodes (13): Architecture, Cross-Cutting Concerns, Data Flow, Entry Points, Error Handling, Key Abstractions, Layers, Pattern Overview (+5 more)

### Community 59 - "scoring.ts"
Cohesion: 0.22
Nodes (12): Props, Deps, computeDuration(), computeRecency(), parseYear(), RELEVANCE_BAND_HIGH, RELEVANCE_BAND_MEDIUM, RelevanceBand (+4 more)

### Community 60 - "Implementation Decisions"
Cohesion: 0.12
Nodes (15): atsRules.ts Contents, Canonical References, Claude's Discretion, Codebase Analysis, Codebase Simplifications, Deferred Ideas, File Organization, Implementation Decisions (+7 more)

### Community 61 - "Implementation Decisions"
Cohesion: 0.12
Nodes (15): ATS Mode Rendering Changes, ATS Rules, Canonical References, Claude's Discretion, Deferred Ideas, Editor, Implementation Decisions, Phase 6: Template ATS Mode - Context (+7 more)

### Community 62 - "template-layouts.ts"
Cohesion: 0.17
Nodes (10): PAGE_PADDING_CLASS, knownTemplateId(), migratedDesign(), SINGLE_COLUMN, TEMPLATE_LAYOUTS, TemplateId, TEMPLATES, design (+2 more)

### Community 63 - "Phase 3: Section Standards - Context"
Cohesion: 0.13
Nodes (14): Approach, ATS Rules (Phase 1), Canonical References, Claude's Discretion, Deferred Ideas, Editor Integration, Implementation Decisions, Language Detection (Phase 2) (+6 more)

### Community 64 - "Implementation Decisions"
Cohesion: 0.13
Nodes (14): Acronym Detection, Architecture, ATS Rules, Canonical References, Claude's Discretion, Data Model, Deferred Ideas, Implementation Decisions (+6 more)

### Community 65 - "Recommended Additions for ATS Milestone"
Cohesion: 0.13
Nodes (14): 1. Client-Side NLP: `compromise` v14, 2. Language Detection: `franc-min` v6, 3. ATS Scoring Engine: Custom (No External Library), 4. TF-IDF Keyword Weighting: Custom (~50 lines), 5. Bullet Point Quality Analysis: LLM-Powered (Existing Infrastructure), 6. PDF Export: Keep `window.print()` (For Now), 7. Skill Categorization: LLM + Heuristic Hybrid, Architecture of New Scoring Module (+6 more)

### Community 66 - "file-naming-scan.mjs"
Cohesion: 0.25
Nodes (13): checkFile(), GENERIC, isHook(), isKebab(), isPascal(), isStory(), isTest(), listFiles() (+5 more)

### Community 67 - "useCVLoader.ts"
Cohesion: 0.22
Nodes (10): CVLoaderResult, CVSource, cvSourceOf(), EditorAccountData, useCVLoader(), ABBREVIATIONS, autoCorrect(), expandAbbreviations() (+2 more)

### Community 68 - "Plan 11-06 — SUMMARY — CRITICAL FIX LANDED"
Cohesion: 0.14
Nodes (12): AdaptContext, STRIDE Threat Register, Trust Boundaries, API surface, Commit, Critical-fix verification, File modified, Files created (+4 more)

### Community 69 - "Phase 8: ATS Panel UI - Context"
Cohesion: 0.14
Nodes (13): Claude's Discretion, Deferred Ideas, Established Patterns, Existing Code Insights, Implementation Decisions, Integration Points, Panel Structure, Phase 8: ATS Panel UI - Context (+5 more)

### Community 70 - "Phase 9: AI Content Optimization - Context"
Cohesion: 0.14
Nodes (13): Architecture & UX, Claude's Discretion, Deferred Ideas, Established Patterns, Existing Code Insights, Implementation Decisions, Integration Points, Phase 9: AI Content Optimization - Context (+5 more)

### Community 71 - "useCVPersistence.ts"
Cohesion: 0.27
Nodes (11): appendToGuestList(), buildPersistedCV(), cvsRecordOf(), GUEST_CVS_MAX, replacesDraft(), stripPersistenceArtifacts(), SAMPLE_CV, SAMPLE_DESIGN (+3 more)

### Community 72 - "Quick Task 260411-mij — Auto-extract company name from JD"
Cohesion: 0.14
Nodes (13): Backend (Task 1 — commit d90e5b0), Deviations from plan, Frontend (Task 2 — commit e5392a0), Known stubs / threat flags, Manual verification (for the user), One-liner, Quick Task 260411-mij — Auto-extract company name from JD, Rollback (+5 more)

### Community 73 - "Quick Task 260418-hce: Career-Ops Integration — Keyword Injection Hierarchy + ATS Enrichment Summary"
Cohesion: 0.14
Nodes (13): Analysis Prompt (convex/_ai/prompts/analysis.ts), Commits, Deviations from Plan, Distribute Prompt (convex/_ai/prompts/distribute.ts), Non-Goals (Explicitly Out of Scope), Quick Task 260418-hce: Career-Ops Integration — Keyword Injection Hierarchy + ATS Enrichment Summary, Schemas (convex/_ai/schemas.ts), Self-Check: PASSED (+5 more)

### Community 74 - "Project State"
Cohesion: 0.14
Nodes (13): Accumulated Context, AI Provider Architecture, Current Position, Known Issues, Milestone v1.0 — ATS Conformity (COMPLETE), PDF Layout, Post-Milestone Changes (2026-04-09), Project Reference (+5 more)

### Community 75 - "Plan 11-05 — SUMMARY"
Cohesion: 0.15
Nodes (11): ExtractContext, STRIDE Threat Register, Trust Boundaries, API surface, Commit, File modified, Files created, Metrics (+3 more)

### Community 76 - "260411-m24-PLAN.md"
Cohesion: 0.15
Nodes (11): DataModel, Doc, Id, TableNames, Commit Plan, Must-Haves, Pre-flight Findings, Risks (+3 more)

### Community 77 - "fit-to-pages.spec.ts"
Cohesion: 0.21
Nodes (9): setupGuestEditor(), setup(), readModes(), savedModes(), seedPortfolioSession(), setupLongCV(), TRIAGED_CV, requirementsOf() (+1 more)

### Community 78 - "Phase 01 Plan 02: ATS Rules Config + Scoring Fixes Summary"
Cohesion: 0.15
Nodes (12): Accomplishments, Decisions Made, Deviations from Plan, Files Created/Modified, Issues Encountered, Known Stubs, Next Phase Readiness, Performance (+4 more)

### Community 79 - "Phase 04 Plan 02: NLP Keyword Extraction and Relevance Scoring Summary"
Cohesion: 0.15
Nodes (12): Accomplishments, Auto-fixed Issues, Decisions Made, Deviations from Plan, Files Created/Modified, Issues Encountered, Known Stubs, Next Phase Readiness (+4 more)

### Community 80 - "Phase 7: Skills Categorization - Context"
Cohesion: 0.15
Nodes (12): Categorization Strategy, Claude's Discretion, Deferred Ideas, Display Format, Established Patterns, Existing Code Insights, Implementation Decisions, Integration & Editing (+4 more)

### Community 81 - "Feature Landscape: ATS-Optimized CV Builder"
Cohesion: 0.15
Nodes (12): Anti-Features, Competitive Positioning, Defer:, Differentiators, Feature Dependencies, Feature Landscape: ATS-Optimized CV Builder, Must ship (Phase 1 -- Core ATS Scoring):, MVP Recommendation (+4 more)

### Community 82 - "anti-vibe-scan.mjs"
Cohesion: 0.24
Nodes (12): EXT, isLog(), isTest(), main(), OPT_IN, PILL, RULES, scanText() (+4 more)

### Community 83 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 84 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, check:anti-vibe, check:file-naming, clean, dev, lint, prepare (+4 more)

### Community 85 - "Codebase Concerns"
Cohesion: 0.17
Nodes (11): Codebase Concerns, Dependencies at Risk, Fragile Areas, Known Bugs, Missing Features, Performance Bottlenecks, Scaling Limits, Security Concerns (+3 more)

### Community 86 - "Testing Patterns"
Cohesion: 0.17
Nodes (11): Common Patterns, Coverage, Fixtures and Factories, Mocking, Test File Organization, Test Framework, Test Structure, Test Types (+3 more)

### Community 87 - "Phase 4 Plan 1: ATS Scoring Engine - Format + Content Sub-scores Summary"
Cohesion: 0.17
Nodes (11): Accomplishments, Decisions Made, Deviations from Plan, Files Created/Modified, Issues Encountered, Known Stubs, Next Phase Readiness, Performance (+3 more)

### Community 88 - "Plan 11-07 — SUMMARY"
Cohesion: 0.17
Nodes (10): STRIDE Threat Register, Trust Boundaries, API surface, Commit, File modified, Metrics, Notes, Plan 11-07 — SUMMARY (+2 more)

### Community 89 - "Plan 11-08 — SUMMARY"
Cohesion: 0.17
Nodes (10): STRIDE Threat Register, Trust Boundaries, API surface, Commit, File modified, Files created, Metrics, Plan 11-08 — SUMMARY (+2 more)

### Community 90 - "Plan 11-09 — SUMMARY"
Cohesion: 0.17
Nodes (10): STRIDE Threat Register, Trust Boundaries, API surface, Commit, File modified, Files created, Metrics, Plan 11-09 — SUMMARY (+2 more)

### Community 91 - "Implementation Decisions"
Cohesion: 0.17
Nodes (12): Claude's Discretion, D-01 — File organization strategy, D-02 — Schema validation library, D-03 — Schema strategy (lenient, backward compatible), D-04 — Action consolidation, D-05 — Normalization contract, D-06 — Error handling, D-07 — Test strategy (+4 more)

### Community 92 - "Phase 12 — ATS Workflow UX + A11y + Auto-Distribute — Verification"
Cohesion: 0.17
Nodes (12): API surface check, Commit, Created, Critical fixes delivered, Deviations, File inventory, Follow-ups (deferred), Modified (+4 more)

### Community 93 - "Calibre — CV Builder avec IA"
Cohesion: 0.17
Nodes (11): Active, Calibre — CV Builder avec IA, Constraints, Context, Core Value, Evolution, Key Decisions, Out of Scope (+3 more)

### Community 94 - "CoverLetterData"
Cohesion: 0.18
Nodes (11): Key Decisions, Key Files, Quick m24: Inline Cover Letter Generation in Editor — Summary, Rollback, Self-Check: PASSED, Task 2 — `CoverLetterDrawer` component (commit `d782b69`), Task 3 — Wire drawer into EditorPage (commit `12a3fc6`), Task Breakdown (+3 more)

### Community 95 - "text.ts"
Cohesion: 0.21
Nodes (10): containsWords(), ENDS_WITH_WORD, escapeRegExp(), patternOf(), SEGMENTED, STARTS_WITH_WORD, stemPhrase(), stripSimpleSuffixes() (+2 more)

### Community 96 - "Plan 11-01 — SUMMARY"
Cohesion: 0.18
Nodes (11): CVDataParsed, API surface, Commit, Dependency, Design notes, Deviations, Files created, Plan 11-01 — SUMMARY (+3 more)

### Community 97 - "long-cv.ts"
Cohesion: 0.22
Nodes (6): BULLETS, CAREER, LONG_CV, LONG_CV_JOB_DESCRIPTION, ROLES, VERY_LONG_CV

### Community 98 - "Phase 06 Plan 02: ATS Template Rendering Summary"
Cohesion: 0.18
Nodes (10): Auto-fixed Issues, Changes Made, Deviations from Plan, Known Stubs, Phase 06 Plan 02: ATS Template Rendering Summary, Self-Check: PASSED, Task 1: ATS Helpers in shared.tsx, Task 2: Template ATS Rendering (+2 more)

### Community 99 - "Phase 06 Plan 03: ATS Compatibility Badges Summary"
Cohesion: 0.18
Nodes (10): Auto-fixed Issues, Changes Made, Deviations from Plan, Known Stubs, Phase 06 Plan 03: ATS Compatibility Badges Summary, Self-Check: PASSED, Task 1: ATS Badges on Template Picker, Task 2: End-to-End Verification (Auto-approved) (+2 more)

### Community 100 - "Phase 8 Plan 3: EditorPage ATS Integration Summary"
Cohesion: 0.18
Nodes (10): Auto-fixed Issues, Commits, Deviations from Plan, EditorPage Modifications (src/pages/EditorPage.tsx) - +53 lines, Import additions, Known Stubs, Phase 8 Plan 3: EditorPage ATS Integration Summary, Self-Check: PASSED (+2 more)

### Community 101 - "Plan 11-02 — SUMMARY"
Cohesion: 0.18
Nodes (9): STRIDE Threat Register, Trust Boundaries, API surface, Commit, Notes, Plan 11-02 — SUMMARY, Rules implemented (D-05), Test results (+1 more)

### Community 102 - "Plan 11-04 — SUMMARY"
Cohesion: 0.18
Nodes (9): STRIDE Threat Register, Trust Boundaries, Commit, File modified, Files created, Notes, Plan 11-04 — SUMMARY, Test results (+1 more)

### Community 103 - "Phase 11 — AI Layer Refactor — Verification"
Cohesion: 0.18
Nodes (11): API surface check, Commit, Critical fix validated, Deviations, Final file inventory, Follow-ups, Live verification — deferred, Phase 11 — AI Layer Refactor — Verification (+3 more)

### Community 104 - "Phase 14 — Editor DS Atoms Migration — Verification"
Cohesion: 0.18
Nodes (10): Backward compatibility, Button migration (plan 14-03), DS atom expansion (plan 14-01), Final metrics, Follow-ups (out of scope for Phase 14), Form element migration (plan 14-02), Objective, Phase 14 — Editor DS Atoms Migration — Verification (+2 more)

### Community 105 - "Plan — Auto-extract company name from JD (Phase A logo roadmap)"
Cohesion: 0.18
Nodes (10): Commit Plan, Must-Haves, Plan — Auto-extract company name from JD (Phase A logo roadmap), Risks, Rollback, Success Criteria, Task 1 — Backend: action + prompt + schema + tests, Task 2 — Frontend: hook wiring + pure helper + drawer placeholder (+2 more)

### Community 106 - "CoverLetterWorkspace.tsx"
Cohesion: 0.24
Nodes (9): CoverLetterWorkspace(), labels, LetterField(), Props, sizePadding, sizeText, Textarea, TextareaSize (+1 more)

### Community 107 - "getBrowser"
Cohesion: 0.20
Nodes (9): getBrowser(), puppeteer-core@^24.40.0, @sparticuz/chromium@^143.0.4, puppeteer@^24.40.0, STRIDE Threat Register, Trust Boundaries, puppeteer, puppeteer-core (+1 more)

### Community 108 - "prompts/coverLetter.ts"
Cohesion: 0.38
Nodes (9): buildCoverLetterPrompt(), buildEnglishPrompt(), buildFrenchPrompt(), candidateTitle(), CoverLetterContext, englishTone(), LETTER_WRITING_POLICY, fencedOffer() (+1 more)

### Community 109 - "Coding Conventions"
Cohesion: 0.20
Nodes (9): Code Style, Coding Conventions, Comments, Component Patterns, Error Handling, Import Organization, Logging, Module Design (+1 more)

### Community 110 - "External Integrations"
Cohesion: 0.20
Nodes (9): APIs & External Services, Authentication & Identity, CI/CD & Deployment, Data Storage, Environment Configuration, External Integrations, External Web Resources, Monitoring & Observability (+1 more)

### Community 111 - "Phase 06 Plan 01: ATS Mode Toggle & Auto-Switch Summary"
Cohesion: 0.20
Nodes (9): Changes Made, Deviations from Plan, Known Stubs, Phase 06 Plan 01: ATS Mode Toggle & Auto-Switch Summary, Self-Check: PASSED, Task 1: Types & atsRules, Task 2: Toggle UI & Auto-Switch Logic, Tasks Completed (+1 more)

### Community 112 - "Phase 8 Plan 1: ScoreGauge + useATSAnalysis Summary"
Cohesion: 0.20
Nodes (9): Commits, Deviations from Plan, Known Stubs, Phase 8 Plan 1: ScoreGauge + useATSAnalysis Summary, ScoreGauge (src/shared/ui/ScoreGauge.tsx) - 94 lines, Tests (src/features/editor/hooks/useATSAnalysis.test.ts) - 12 tests, useATSAnalysis (src/features/editor/hooks/useATSAnalysis.ts) - 46 lines, Verification Results (+1 more)

### Community 113 - "Phase 8 Plan 2: ATSPanel Component Summary"
Cohesion: 0.20
Nodes (9): ATSPanel (src/features/editor/components/ATSPanel.tsx) - 196 lines, Barrel Export (src/features/editor/components/index.ts), Commits, Deviations from Plan, Known Stubs, Phase 8 Plan 2: ATSPanel Component Summary, Self-Check: PASSED, Verification Results (+1 more)

### Community 114 - "Phase 9 Plan 02: AI Bullet Rewriting Actions Summary"
Cohesion: 0.20
Nodes (9): Decisions Made, Deviations from Plan, Known Stubs, Phase 9 Plan 02: AI Bullet Rewriting Actions Summary, Self-Check: PASSED, Task 1: Add rewriteBulletsForJob action, Task 2: Enhance improveBulletPoint with JD context, Verification (+1 more)

### Community 115 - "Phase 10: PDF Validation - Context"
Cohesion: 0.20
Nodes (9): Claude's Discretion, Deferred Ideas, Existing Code Insights, Implementation Decisions, Integration Points, Phase 10: PDF Validation - Context, Phase Boundary, Reusable Assets (+1 more)

### Community 116 - "Plan 11-03 — SUMMARY"
Cohesion: 0.20
Nodes (8): STRIDE Threat Register, Trust Boundaries, API surface, Commit, File modified, Plan 11-03 — SUMMARY, Test results, What shipped

### Community 117 - "Phase 11 Plan 01: Serverless PDF Generation Endpoint Summary"
Cohesion: 0.20
Nodes (9): api/generate-pdf.ts, Decisions Made, Deviations from Plan, Infrastructure, Phase 11 Plan 01: Serverless PDF Generation Endpoint Summary, Security Mitigations (Threat Model), Self-Check: PASSED, Task Results (+1 more)

### Community 118 - "Phase 11 Plan 02: Client-Side PDF Export Flow Summary"
Cohesion: 0.20
Nodes (9): Deviations from Plan, Known Stubs, Minor Adjustments, Phase 11 Plan 02: Client-Side PDF Export Flow Summary, Self-Check: PASSED, Task 1: Add serializeCV() and serverlessPDF() to pdfExport.ts (adae302), Task 3: Verification (auto-approved), Threat Flags (+1 more)

### Community 119 - "Implementation Decisions"
Cohesion: 0.20
Nodes (9): D-01 — 4 hooks, 4 plans, 4 commits, D-02 — Handler naming, D-03 — `useCallback` everywhere, D-04 — Pure helpers exported for tests, D-05 — Backward compat with existing children, D-06 — No behavior change, Implementation Decisions, Phase 13: Editor Hooks Extraction — Context (+1 more)

### Community 120 - "text.test.ts"
Cohesion: 0.25
Nodes (4): @tailwindcss/vite@^4.2.2, @vitejs/plugin-react@^5.0.4, @tailwindcss/vite, @vitejs/plugin-react

### Community 121 - "Phase 01 Plan 01: Extract Formatting Utilities Summary"
Cohesion: 0.22
Nodes (8): Deviations from Plan, Known Stubs, One-liner, Phase 01 Plan 01: Extract Formatting Utilities Summary, Task 1: Extract formatting functions to new module + move tests, Task 2: Update template imports + delete duplicate cn() + clean barrel, Verification Results, What Was Done

### Community 122 - "Phase 03 Plan 01: Section Standards Summary"
Cohesion: 0.22
Nodes (8): Deviations from Plan, Known Stubs, Phase 03 Plan 01: Section Standards Summary, Self-Check: PASSED, Task 1: Add getSectionTitle() and thread language prop (TDD), Task 2: Replace 32 hardcoded section names in all 6 templates, Verification Results, What Was Done

### Community 123 - "Phase 05 Plan 01: Keyword Analysis Computation Summary"
Cohesion: 0.22
Nodes (8): Commits, Decisions Made, Deviations from Plan, Key Implementation Details, Known Stubs, Phase 05 Plan 01: Keyword Analysis Computation Summary, Verification, What Was Built

### Community 124 - "Phase 9 Plan 1: Weak Bullet Detection Summary"
Cohesion: 0.22
Nodes (8): Auto-fixed Issues, Deviations from Plan, Known Stubs, Phase 9 Plan 1: Weak Bullet Detection Summary, Self-Check: PASSED, TDD Execution, Verification, What Was Built

### Community 125 - "Phase 10 Plan 01: PDF Text Extractability Validation Summary"
Cohesion: 0.22
Nodes (8): Deviations from Plan, Known Stubs, Phase 10 Plan 01: PDF Text Extractability Validation Summary, Self-Check: PASSED, Task 1: pdfValidation utility with tests (TDD), Task 2: Wire validation into pdfExport and EditorPage, Verification Results, What Was Done

### Community 126 - "11-VERIFICATION.md"
Cohesion: 0.22
Nodes (4): STRIDE Threat Register, Trust Boundaries, STRIDE Threat Register, Trust Boundaries

### Community 127 - "Phase 11: AI Layer Refactor — Context"
Cohesion: 0.22
Nodes (8): Creative Options Enabled, Deferred Ideas, Established Patterns, Existing Code Insights, Integration Points, Phase 11: AI Layer Refactor — Context, Phase Boundary, Specific Ideas

### Community 128 - "Plan 12-02 — SUMMARY"
Cohesion: 0.22
Nodes (7): Commit, Design notes, New exports, Plan 12-02 — SUMMARY, Rewired, Test results, What shipped

### Community 129 - "Plan 12-03 — SUMMARY"
Cohesion: 0.22
Nodes (9): API surface, Commit, Design highlights, Files created, Files modified, Metrics, Plan 12-03 — SUMMARY, Test results (+1 more)

### Community 130 - "Phase 13 — Editor Hooks Extraction — Verification"
Cohesion: 0.22
Nodes (8): API surface, Final metrics, Follow-ups (out of scope for Phase 13), Hooks created, Phase 13 — Editor Hooks Extraction — Verification, Plans executed, Test results, What EditorPage.tsx still contains

### Community 131 - "Where New Logic Lives"
Cohesion: 0.22
Nodes (9): Extend: `DesignSettings` type (add 1 field), Extend: Each template (add ~10-15 lines each), Extend: `EditorPage.tsx` (add ~30 lines), Extend: `scoring.ts` (add ~80 lines), Extend: `shared.tsx` (add ~30 lines), Extend: `TemplateProps` (NO change needed), New: `ATSPanel.tsx` (~200 lines), New: `atsRules.ts` (~60 lines) (+1 more)

### Community 132 - "distribute.ts"
Cohesion: 0.39
Nodes (6): asData(), buildRepairPrompt(), RepairContext, summarizeExperiences(), FABRICATION_GUARD, CTX

### Community 133 - "Technology Stack"
Cohesion: 0.25
Nodes (7): Configuration, Frameworks, Key Dependencies, Languages, Platform Requirements, Runtime, Technology Stack

### Community 134 - "Codebase Structure"
Cohesion: 0.25
Nodes (7): Codebase Structure, Directory Layout, Directory Purposes, Key File Locations, Naming Conventions, Special Directories, Where to Add New Code

### Community 135 - "Phase 1 — Validation Strategy"
Cohesion: 0.25
Nodes (7): Manual-Only Verifications, Per-Task Verification Map, Phase 1 — Validation Strategy, Sampling Rate, Test Infrastructure, Validation Sign-Off, Wave 0 Requirements

### Community 136 - "Phase 3 — Validation Strategy"
Cohesion: 0.25
Nodes (7): Manual-Only Verifications, Per-Task Verification Map, Phase 3 — Validation Strategy, Sampling Rate, Test Infrastructure, Validation Sign-Off, Wave 0 Requirements

### Community 137 - "Plan 11-10 — SUMMARY"
Cohesion: 0.25
Nodes (8): API surface, Commit, Deviation — TS inference pitfall, Files modified, Metrics, Plan 11-10 — SUMMARY, Test results, What shipped

### Community 138 - "Phase 11: PDF Export Engine - Discussion Log"
Cohesion: 0.25
Nodes (7): Architecture serveur, Claude's Discretion, Deferred Ideas, Gestion des polices, Phase 11: PDF Export Engine - Discussion Log, Serialisation HTML, UX d'export

### Community 139 - "linkedin-parser.test.ts"
Cohesion: 0.29
Nodes (7): body(), EXPERIENCE, HEADER, SUMMARY, SUMMARY_LINES, t(), tokens

### Community 140 - "server.d.ts"
Cohesion: 0.29
Nodes (5): ActionCtx, DatabaseReader, DatabaseWriter, MutationCtx, QueryCtx

### Community 141 - "Phase 02 Plan 01: Language Detection Summary"
Cohesion: 0.29
Nodes (6): Deviations from Plan, Known Stubs, Performance, Phase 02 Plan 01: Language Detection Summary, Self-Check: PASSED, Verification

### Community 142 - "Plan 12-01 — SUMMARY"
Cohesion: 0.29
Nodes (7): Changes, Commit, Consumers untouched, Decision deviation, Plan 12-01 — SUMMARY, Test results, What shipped

### Community 143 - "Implementation Decisions"
Cohesion: 0.29
Nodes (7): D-01 — Button atom a11y fixes (minimal, additive), D-02 — Keyword matcher fuzziness strategy, D-03 — `autoDistributeMissingKeywords` AI action, D-04 — UI integration — the "Répartir automatiquement" flow, D-05 — Test strategy, D-06 — Commit atomicity, Implementation Decisions

### Community 144 - "Phase 12: ATS Workflow UX + A11y + Auto-Distribute Keywords — Context"
Cohesion: 0.29
Nodes (7): Deferred Ideas, Existing Code Insights, Integration Points, Patterns, Phase 12: ATS Workflow UX + A11y + Auto-Distribute Keywords — Context, Phase Boundary, Reusable Assets

### Community 145 - "Plan 13-01 — SUMMARY"
Cohesion: 0.29
Nodes (6): Files, Hook API, Metrics, Plan 13-01 — SUMMARY, Pure helpers exported + tested, What shipped

### Community 146 - "buildCoverLetterText"
Cohesion: 0.48
Nodes (7): Tasks, Task 1 — `useCoverLetter` hook + helpers tests (commit `74b4c1e`), Pre-flight Findings, UseCoverLetterDeps, buildCoverLetterText(), buildFilename(), slug()

### Community 148 - "Plan 13-02 — SUMMARY"
Cohesion: 0.33
Nodes (5): Files, Metrics, Plan 13-02 — SUMMARY, Pure helpers exported for tests, Shipped

### Community 149 - "Plan 13-04 — SUMMARY"
Cohesion: 0.33
Nodes (5): Deviation, Files, Metrics, Plan 13-04 — SUMMARY, Shipped

### Community 150 - "vercel.json"
Cohesion: 0.33
Nodes (5): maxDuration, buildCommand, functions, api/generate-pdf.ts, rewrites

### Community 151 - "convex.json"
Cohesion: 0.40
Nodes (4): aiFiles, enabled, functions, $schema

### Community 152 - "vitest"
Cohesion: 0.40
Nodes (4): CoverLetterExcerptSchema, SAMPLE_CV, SAMPLE_CV_WITH_TITLE, vitest

### Community 154 - "Validation Architecture"
Cohesion: 0.40
Nodes (5): Phase Requirements -> Test Map, Sampling Rate, Test Framework, Validation Architecture, Wave 0 Gaps

### Community 155 - "Canonical References"
Cohesion: 0.40
Nodes (5): Canonical References, Codebase documentation, Existing codebase — callers (for API stability verification), Project specs, Related client-side logic (NOT refactored, but context)

### Community 156 - "Canonical References"
Cohesion: 0.40
Nodes (5): Callers that must NOT change, Canonical References, Files being created, Files being modified, Phase 11 artifacts to preserve

### Community 157 - "Plan 13-03 — SUMMARY"
Cohesion: 0.40
Nodes (4): Files, Metrics, Plan 13-03 — SUMMARY, Shipped

### Community 158 - "graphify-sync.sh"
Cohesion: 0.83
Nodes (3): build(), graphify-sync.sh script, stale_files()

## Knowledge Gaps
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CVData` connect `CVData` to `Experience`, `chat.ts`, `job-requirements-cache.ts`, `CLAUDE.md`, `tailor.ts`, `types/index.ts`, `cn`, `ai.ts`, `truthGuard.ts`, `EditorSidebar.tsx`, `keyword-analysis.ts`, `buildCoverLetterText`, `types.ts`, `pdf-validation.ts`, `display-modes.ts`, `DashboardPage.tsx`, `dismissed-requirements.ts`, `template-e.tsx`, `normalizers.ts`, `PaginatedCV.tsx`, `fit-to-pages.ts`, `EditorPage.tsx`, `export-docx.ts`, `linkedin-parser.ts`, `storage.ts`, `ats-rules.ts`, `useCoverLetter.ts`, `pdf-text-extract.ts`, `scoring.ts`, `useCVLoader.ts`, `Plan 11-06 — SUMMARY — CRITICAL FIX LANDED`, `useCVPersistence.ts`, `Implementation Decisions`, `Plan 11-02 — SUMMARY`, `Phase 11: AI Layer Refactor — Context`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `CVData` (e.g. with `Naming Patterns` and `AI Layer Structure (convex/_ai/)`) actually correct?**
  _`CVData` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Should `Experience` be split into smaller, more focused modules?**
  _Cohesion score 0.06547619047619048 - nodes in this community are weakly interconnected._
- **Why does `getCVLanguage()` connect `types/index.ts` to `fit-to-pages.ts`, `EditorPage.tsx`, `job-requirements-cache.ts`, `Phase 4: ATS Scoring Engine - Research`, `ats-rules.ts`, `Phase 2: Language Detection - Research`, `Implementation Decisions`, `keyword-analysis.ts`, `useCoverLetter.ts`, `types.ts`, `CVData`, `display-modes.ts`, `Pattern Overview`, `dismissed-requirements.ts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `cn()` (e.g. with `Summary` and `02-01-PLAN.md`) actually correct?**
  _`cn()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `convex` be split into smaller, more focused modules?**
  _Cohesion score 0.06830601092896176 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `Experience`, `convex`, `chat.ts`, `job-requirements-cache.ts`, `distribute.ts`, `CLAUDE.md`, `tailor.ts`, `publicUrl.ts`, `types/index.ts`, `ai.ts`, `truthGuard.ts`, `linkedin-parser.test.ts`, `keyword-analysis.ts`, `DashboardPage.tsx`, `types.ts`, `pdf-validation.ts`, `display-modes.ts`, `dismissed-requirements.ts`, `normalizers.ts`, `PaginatedCV.tsx`, `fit-to-pages.ts`, `schemas.ts`, `package.json`, `export-docx.ts`, `fragments.ts`, `storage.ts`, `allocate-pages.ts`, `ats-rules.ts`, `generate-pdf.ts`, `useCoverLetter.ts`, `jobDescription.ts`, `export-letter.ts`, `scoring.ts`, `template-layouts.ts`, `useCVLoader.ts`, `useCVPersistence.ts`, `text.test.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._