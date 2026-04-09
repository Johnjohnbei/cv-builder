# Domain Pitfalls

**Domain:** ATS-optimized CV Builder (adding ATS features to existing app)
**Researched:** 2026-04-09

## Critical Pitfalls

Mistakes that cause rewrites, broken user trust, or fundamentally flawed ATS output.

### Pitfall 1: Multi-Column Templates Produce Garbled ATS Output

**What goes wrong:** ATS parsers read PDF content as a linear text stream (top-to-bottom, left-to-right). Multi-column layouts cause the parser to merge content across columns in the wrong order. Skills from a sidebar get concatenated with job titles from the main column, producing garbled text. Some ATS systems ignore the second column entirely.

**Why it happens:** The app has 4 of 6 templates using multi-column grid layouts: TemplateA (`grid-cols-3`), TemplateB (`grid-cols-[1fr_2fr]`), TemplateD (`grid-cols-[2fr_1fr]`), TemplateF (`grid-cols-[260px_1fr]`). When "ATS mode" is toggled on, simply hiding a column is not enough -- the CSS grid structure still exists in the PDF DOM and the reading order remains broken.

**Consequences:** Users toggle ATS mode thinking they are safe, but the exported PDF still fails ATS parsing. The app gives a false sense of security. Users get rejected without knowing why.

**Prevention:**
- ATS mode must physically restructure the DOM to single-column flow, not just visually hide elements. Use CSS `display: block` with stacked sections, not `grid` with `display: none` on one column.
- Test the actual text extraction order from exported PDFs using `pdfjs-dist` or a free ATS checker. Build an automated test that extracts text from an ATS-mode PDF and verifies section order is correct.
- Classify each template upfront: TemplateC (single-column, centered) and TemplateE are likely adaptable with minor changes. TemplateA/B/D/F need full layout restructuring for ATS mode.

**Detection:** Copy-paste text from an exported PDF into a plain text editor. If sections appear jumbled or interleaved, the layout is not ATS-safe.

**Phase relevance:** Must be addressed in the first phase (template adaptation). This is the foundation -- scoring is meaningless if the PDF itself is unparseable.

---

### Pitfall 2: SVG Icons Invisible to ATS Parsers

**What goes wrong:** All 6 templates use Lucide React icons (Mail, Phone, MapPin, LinkedinIcon) for contact information. ATS parsers cannot read SVG elements. If the icon is the only visual cue and the label text is absent, the ATS drops the entire contact field.

**Why it happens:** Icons are rendered as inline SVGs in the DOM. The contact info is technically in adjacent text, but some ATS parsers associate icons as the "label" and skip the unlabeled text next to them. Worse, some parsers see the SVG path data as garbage text and corrupt the surrounding content.

**Consequences:** Contact information (email, phone, LinkedIn) is lost or corrupted in ATS parsing. The recruiter cannot contact the candidate even if the CV scores well on content.

**Prevention:**
- In ATS mode, replace all icons with plain text labels: "Email:", "Tel:", "LinkedIn:" before the value.
- Never rely on an icon as the sole indicator of a field's purpose.
- Add `aria-hidden="true"` to icons (already good practice) and ensure adjacent text is sufficient for ATS context.

**Detection:** Extract text from PDF. Search for email/phone values. If they appear without any preceding label or appear corrupted, icons are interfering.

**Phase relevance:** Template adaptation phase. Can be implemented alongside multi-column fixes.

---

### Pitfall 3: ATS Score Creates False Confidence

**What goes wrong:** The app shows a score of 85/100 based on keyword matching and formatting checks. The user submits confidently. The actual ATS rejects them because: (a) the scoring algorithm checks different things than real ATS systems, (b) keyword matching is substring-based (matching "Angular" inside "AngularJS" -- completely different frameworks), or (c) the format score says "good" but the PDF itself is unparseable.

**Why it happens:** The existing `extractKeywords` function in `scoring.ts` does naive substring matching (`text.includes(kw)`). It splits on whitespace and filters words >= 3 chars. This means "manage" matches "management" and "manager", "data" matches "database", "Java" matches "JavaScript". The score inflates because partial matches count as full hits.

**Consequences:** Users trust the score and do not further optimize. The score becomes a vanity metric rather than a useful signal. Users blame the app when they get rejected despite "high scores".

**Prevention:**
- Use word-boundary matching instead of substring: `/\bkeyword\b/i` instead of `text.includes(keyword)`.
- Implement multi-word keyword extraction (e.g., "project management", "machine learning") -- single-word extraction misses compound skills.
- Weight exact matches higher than partial matches. "React" exact match > "Reactive" partial match.
- Show the score breakdown transparently: "5/12 exact keyword matches, 3/12 partial matches" rather than a single opaque number.
- Never claim "ATS-compatible" -- use language like "estimated compatibility" with clear caveats.
- Separate the format score (which the app can verify) from the content score (which is an estimate).

**Detection:** Test with known job descriptions where "Java" and "JavaScript" are different requirements. If the scorer conflates them, the matching logic is too loose.

**Phase relevance:** Scoring implementation phase. Must be fixed before the ATS score panel is shown to users.

---

### Pitfall 4: AI Rewriting Produces Unverifiable Claims and Keyword Stuffing

**What goes wrong:** The `tailorCV` prompt instructs the AI to "enrich descriptions, add job keywords, develop results." The AI fabricates metrics ("increased revenue by 35%"), invents responsibilities the user never had, or stuffs keywords into bullet points unnaturally. Modern ATS systems can detect keyword stuffing and flag it. Recruiters who read past ATS immediately spot inauthentic content.

**Why it happens:** The current prompt gives the AI carte blanche to rewrite everything. There are no guardrails against fabrication. The prompt says "reformulations quantifiables" which encourages the AI to invent numbers. The user sees the optimized version and may not realize claims are fabricated before submitting.

**Consequences:** User submits a CV with fabricated metrics. Gets caught in interview ("You said you increased revenue 35% -- can you elaborate?"). Candidate is blacklisted. In worst case, employer flags the resume as fraudulent.

**Prevention:**
- Constrain the AI prompt: "Rephrase existing achievements using stronger action verbs and the job's terminology. Do NOT invent metrics, responsibilities, or achievements that are not present in the original."
- Show a diff view after AI rewriting: highlight what changed so the user can verify each modification.
- Flag any new numbers/metrics added by AI with a warning: "This metric was added by AI -- please verify."
- Implement a "rewrite intensity" control: conservative (rephrase only), moderate (rephrase + reorder), aggressive (full rewrite). Default to conservative.
- Rate-limit keyword density: if a keyword appears more than 3 times in the CV, flag it as potential stuffing.

**Detection:** Compare the AI output with the original input. If new numbers appear that were not in the source, the AI is fabricating. If any keyword appears in more than 3 bullet points, it is likely stuffed.

**Phase relevance:** AI rewriting phase. The prompt engineering must be right before shipping rewriting features.

---

### Pitfall 5: window.print() PDF Export May Produce Non-Selectable Text

**What goes wrong:** The current `pdfExport.ts` uses an iframe + `window.print()` approach. Depending on the browser (Chrome vs Firefox vs Edge) and OS, the "Save as PDF" option may render text as vector paths instead of actual text characters. The PDF looks perfect visually but contains zero selectable text. ATS parsers see an empty document.

**Why it happens:** Chrome's print-to-PDF engine sometimes converts text to curves, especially when: (a) custom/web fonts are used that cannot be embedded, (b) text rendering involves complex CSS (gradients, transforms, oklch colors), (c) the browser decides to "flatten" the rendering for fidelity. The app already has a known bug with oklch color variables (CONCERNS.md: "PDF Color Export Regression").

**Consequences:** The exported PDF passes all visual checks but is completely invisible to ATS. This is the most dangerous pitfall because everything looks correct to the user.

**Prevention:**
- Add a post-export validation step: after PDF generation, extract text from the PDF using `pdfjs-dist` (already a dependency). If extracted text length is less than 50% of expected content, warn the user: "Your PDF may not be readable by ATS systems."
- Prefer system fonts (Arial, Helvetica, Georgia, Times New Roman) in ATS mode. Web fonts are the primary cause of text-to-curves conversion.
- For ATS mode, consider generating the PDF server-side using a library like `@react-pdf/renderer` or `puppeteer` which produce guaranteed text-based PDFs. This is a bigger lift but eliminates the browser-dependency problem.
- Strip oklch colors in ATS mode. Use only hex/rgb values. This also fixes the existing color export bug.

**Detection:** Open the exported PDF in a text editor (not a PDF viewer). If you see readable strings like the candidate's name and job titles, text is preserved. If you see only binary data with no readable text, it has been converted to paths.

**Phase relevance:** PDF export phase. Should be addressed early since it undermines all other ATS features. A broken PDF makes scoring, keywords, and formatting irrelevant.

## Moderate Pitfalls

### Pitfall 6: Section Headings Use Non-Standard French Names

**What goes wrong:** Current templates use French headings: "Profil", "Expertise", "Compétences", "Formation", "Langues", "Expérience". Some ATS systems trained primarily on English headings may not recognize these. Even French-language ATS systems expect standard terms. "Expertise" (TemplateB) is non-standard -- the standard French ATS heading is "Compétences".

**Prevention:**
- Define a canonical set of bilingual section headings. FR: "Profil Professionnel", "Expérience Professionnelle", "Formation", "Compétences", "Langues", "Contact". EN: "Professional Summary", "Work Experience", "Education", "Skills", "Languages", "Contact".
- In ATS mode, force these standard headings regardless of template. The current plan for "sections forcees aux standards ATS bilingues" (PROJECT.md) is correct -- implement it strictly.
- Detect CV language automatically (already planned) and apply the matching heading set.
- Store both display-heading and ats-heading. Normal mode shows the template's creative heading; ATS mode shows the standard heading.

**Phase relevance:** Template adaptation phase. Simple string replacement, low risk.

### Pitfall 7: Real-Time Scoring Causes UI Lag on Every Keystroke

**What goes wrong:** Computing ATS score on every keystroke in the editor triggers `extractKeywords` + `computeKeywordMatch` across all experiences. With 20+ experiences and a 2000-word job description, this becomes expensive. The editor stutters, especially on mobile or low-end devices.

**Prevention:**
- Debounce score recalculation with 500ms delay after last keystroke.
- Split scoring into "fast" (format checks -- section presence, heading names, column layout: < 5ms) and "deep" (keyword matching, content analysis: may need 50-200ms). Run fast checks on every change; run deep checks on debounce or on-demand.
- Memoize keyword extraction from the job description -- it only changes when the user imports a new job. Do not re-extract on every CV edit.
- Use `useMemo` / `useCallback` properly. The existing EditorPage already has 15+ useState hooks (CONCERNS.md) -- adding real-time scoring without optimization will make the re-render problem worse.
- Consider a Web Worker for scoring computation to keep the main thread responsive.

**Phase relevance:** Scoring UI phase. Must be considered from the start of score panel implementation.

### Pitfall 8: ATS Mode Toggle Destroys User's Design Choices

**What goes wrong:** User spends 30 minutes customizing colors, fonts, and layout. Toggles ATS mode to check compatibility. Toggles back. All customizations are gone because ATS mode overwrote the design settings.

**Prevention:**
- Store ATS mode as a separate rendering flag, not a modification of design settings. Keep two "views": `designSettings` (user's choices) and `atsOverrides` (forced ATS settings). When ATS mode is on, merge them with ATS taking priority. When ATS mode is off, use pure `designSettings`.
- Never mutate the user's design settings object when toggling ATS mode.
- Implement preview-only ATS mode first: show what the CV would look like in ATS mode without committing the changes.

**Phase relevance:** ATS toggle implementation phase.

### Pitfall 9: Bilingual Detection Misclassifies Mixed-Language CVs

**What goes wrong:** User has a French CV with English technical terms ("Machine Learning", "Full Stack Developer", "Agile Scrum Master"). Language detection sees 40% English words and classifies as English. ATS rules and section headings switch to English. The CV becomes a franken-document.

**Prevention:**
- Detect language from structural elements (section headings, dates format "janvier" vs "January"), not from content words. Technical terms are language-agnostic.
- Use the majority language of non-technical text (summary, bullet point verbs, connecting words).
- Allow manual override. Auto-detection is a convenience, not a mandate.
- Default to the user's interface language as a tiebreaker.

**Phase relevance:** Language detection phase. Test with 5+ real bilingual CVs before shipping.

### Pitfall 10: getATSAnalysis and tailorCV Produce Contradictory Recommendations

**What goes wrong:** User runs `tailorCV` to optimize their CV. Then runs `getATSAnalysis` to check the score. The analysis says "missing keywords: React, TypeScript" even though `tailorCV` just added them. This happens because both actions use independent AI calls with no shared state. The analysis prompt does not know what the optimization prompt did.

**Prevention:**
- Run analysis on the actual optimized output, not on a separate AI call that re-reads the original.
- If both features exist, chain them: optimize first, then analyze the result. Do not let them run independently on different versions of the CV.
- Better yet, have `tailorCV` return both the optimized CV and a brief analysis (score, missing keywords) in a single AI call. This saves an API call and ensures consistency.

**Phase relevance:** Scoring + AI integration phase. Architecture decision needed early.

## Minor Pitfalls

### Pitfall 11: Contact Info in CSS Grid Sidebar Gets Dropped by ATS

**What goes wrong:** TemplateB and TemplateF put contact info (email, phone, LinkedIn) in a sidebar column. Some ATS systems parse the main column only and skip the sidebar entirely. The candidate's contact info disappears.

**Prevention:** In ATS mode, always place contact info at the top of the document in a single-column header section. Never relegate contact info to a sidebar in ATS mode.

### Pitfall 12: Photo/Avatar Placeholder Wastes ATS-Visible Space

**What goes wrong:** TemplateF renders a gray circle placeholder (`User` icon) even when no photo is uploaded. This takes up valuable space in the sidebar that could be used for content. Some ATS parsers get confused by the empty `<div>` with SVG content.

**Prevention:** In ATS mode, hide photos entirely. Photos are not ATS-relevant and some markets (US, UK) consider them inappropriate. Remove the placeholder div from the DOM, do not just hide it visually.

### Pitfall 13: 3-Minute AI Optimization Blocks ATS Score Refresh

**What goes wrong:** User clicks "Optimize" and waits 3 minutes (K004). During this time, the ATS score panel shows stale data. After optimization completes, the score does not automatically refresh. User thinks the old score is current.

**Prevention:** Show a "Score recalculating..." state during and immediately after AI optimization. Auto-trigger the basic format/keyword score recalculation when the CV data changes. For the full AI-based analysis, show a clear "Refresh score" button with loading state.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Template adaptation | Multi-column DOM order survives visual ATS mode (#1) | Extract text from rendered PDF, verify linear order |
| Template adaptation | Icons break contact parsing (#2) | Replace with text labels in ATS mode |
| Template adaptation | Section headings non-standard (#6) | Enforce bilingual canonical headings |
| ATS scoring | False confidence from loose keyword matching (#3) | Word-boundary matching, compound keywords |
| ATS scoring | Score contradicts optimization results (#10) | Chain optimize-then-analyze, single AI call |
| ATS scoring | Real-time scoring causes lag (#7) | Debounce 500ms, memoize job keywords, Web Worker |
| AI rewriting | Fabricated metrics and keyword stuffing (#4) | Constrain prompts, diff view, conservative default |
| AI rewriting | 3-min optimization blocks score (#13) | Loading states, auto-refresh on data change |
| PDF export | window.print produces non-selectable text (#5) | Post-export text extraction validation |
| ATS toggle | Design settings destroyed on toggle (#8) | Separate atsOverrides from designSettings |
| Language detection | Mixed-language misclassification (#9) | Detect from structure not content, allow override |

## Sources

- [ATS Resume Formatting Rules 2026 - ResumeAdapter](https://www.resumeadapter.com/blog/ats-resume-formatting-rules-2026)
- [Can ATS Read Two-Column Resumes? 2026 Guide - Yotru](https://yotru.com/blog/resume-columns-ats-single-vs-double-column)
- [Can ATS Read Tables & Columns? 8 Systems Tested 2026 - CVCraft](https://cvcraft.roynex.com/blog/can-ats-read-tables-columns-formatting-2026)
- [ATS Mistakes: How to Avoid Resume Screening Failures 2026 - Resume.co](https://resume.co/blog/ats-mistakes)
- [Should I Use AI to Write My Resume? 2026 Reality Check - AIApply](https://aiapply.co/blog/should-i-use-ai-to-write-my-resume)
- [Semantic Search Resume Optimization 2026 - ResumeFin](https://www.resumefin.com/post/semantic-search-resume-optimization-2026)
- [ATS Resume Format 2026 Design Guide - Scale.jobs](https://scale.jobs/blog/ats-resume-format-2026-design-guide)
- [8 Critical ATS CV Mistakes 2025 - CVAnywhere](https://cvanywhere.com/blog/ats-cv-mistakes)
- [Best Practices for PDF Resumes ATS Errors - Resumly](https://www.resumly.ai/blog/best-practices-for-formatting-pdf-resumes-to-avoid-ats-parsing-errors)
- Codebase analysis: `scoring.ts`, `pdfExport.ts`, `convex/ai.ts`, Templates A-F, CONCERNS.md, KNOWLEDGE.md
