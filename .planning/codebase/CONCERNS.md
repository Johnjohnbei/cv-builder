# Codebase Concerns

**Analysis Date:** 2026-04-09

## Tech Debt

**NVIDIA NIM Slow Performance on Large CVs (K004):**
- Issue: `tailorCV` action with 23 experiences takes ~3 minutes on NIM llama-3.1-70b free tier
- Files: `convex/ai.ts` (lines 265-299), `src/pages/EditorPage.tsx` (line 136)
- Impact: Primary UX pain point. Users cannot efficiently optimize CVs with extensive experience history. The JSON payload is massive (full CV + full job description in, full CV out).
- Fix approach: Switch `tailorCV` to Gemini 2.5 Flash (already configured at lines 32-38) for faster inference, OR implement experience truncation (keep top 8-10 experiences, pass remainder unchanged) to reduce prompt size. Consider splitting the action into batch operations for large CVs.

**Access Code Verification is Client-Side Only (K005):**
- Issue: `REQUIRE_ACCESS_CODE` env var is not set on Convex. Modal triggers based on `localStorage('calibre_access_code')` being empty. `verifyAccessCode()` in `ai.ts` becomes a no-op when env var is missing.
- Files: `convex/ai.ts` (lines 61-73), `src/pages/DashboardPage.tsx` (lines 260-275), `src/features/editor/hooks/useCVLoader.ts`
- Impact: Security bypass when `REQUIRE_ACCESS_CODE` is not set. Malicious actors can directly call backend actions without valid codes. Guest access is not truly restricted.
- Fix approach: Ensure `REQUIRE_ACCESS_CODE=true` is always set in Convex environment variables. Add server-side validation that returns errors for unauthenticated requests when enabled.

**LinkedIn Parser Brittleness (K001 + K002):**
- Issue: Parser relies on specific font-size hierarchy (26/15.75/13/12/11.5/11/10.5/9) that may change if LinkedIn updates PDF export format. URLs can span 2+ lines with hyphens/slashes.
- Files: `src/lib/linkedinParser.ts` (lines 1-100, FONT_ROLES enum, lines 162-200 tokensToLines logic)
- Impact: Parser fails silently and falls back to slower AI extraction (line 555). If LinkedIn changes PDF format, users experience degraded performance until parser is manually updated.
- Fix approach: (1) Add telemetry to log parser failures with triggering font sizes. (2) Implement fallback font-size ranges (±10% tolerance). (3) Document the K001/K002 assumptions in parser header and create automated alerts if LinkedIn PDFs fail parsing.

**ATS Analysis Feature Orphaned (K006):**
- Issue: `getATSAnalysis` action exists in `convex/ai.ts` (lines 301-329) but has no UI. Was removed from dashboard, never implemented in editor.
- Files: `convex/ai.ts` (lines 301-329), `src/pages/DashboardPage.tsx`, `src/pages/EditorPage.tsx`
- Impact: Dead code in production. Wasted API calls if accidentally invoked. Creates confusion for future developers.
- Fix approach: Either (1) implement the planned editor sidebar panel showing ATS score/keywords/improvements after optimization, or (2) remove the action entirely and archive the spec for future consideration.

## Error Handling Gaps

**Insufficient Error Context:**
- Issue: Generic error handling with minimal context. Example: `console.error('Error optimizing CV:', error)` at `src/pages/EditorPage.tsx:136` logs raw error objects.
- Files: `src/pages/EditorPage.tsx` (lines 136, 178), `src/pages/DashboardPage.tsx` (lines 164, 190, 217, 240), `src/features/cover-letter/components/CoverLetterPage.tsx` (line 58)
- Impact: Difficult to diagnose issues in production. Vague error messages ("Erreur lors de...") don't help users understand what failed. API errors from NIM/Gemini are not distinguished from system errors.
- Fix approach: Wrap API calls in typed error handlers. Parse AI provider error codes. Log error type, provider, action name, input size, and user ID. Return different user messages based on error category (rate limit → "Trop de requêtes", timeout → "Serveur surchargé", JSON parse → "Réponse invalide").

**PDF Text Extraction Failure Path:**
- Issue: `extractTextFromPDF` failures are caught at multiple callsites (lines 164, 190, 217) but error handling is duplicated and inconsistent.
- Files: `src/pages/DashboardPage.tsx` (lines 163-171, 185-198, 206-219), `src/lib/pdfTextExtract.ts`
- Impact: Similar errors in different contexts produce different user messages. Hard to maintain consistent UX.
- Fix approach: Create a centralized error classification function that maps extraction errors to user messages. Use a custom error class: `class PDFExtractionError extends Error { constructor(public code: 'NO_TEXT' | 'CORRUPTED' | 'TIMEOUT') }`

## Security Concerns

**Hardcoded Admin Email:**
- Issue: Admin email `joaudran@gmail.com` is hardcoded as access check
- Files: `convex/accessCodes.ts` (lines 74, 97, 121)
- Impact: Cannot rotate admin credentials without code changes. Email is visible in source control. Becomes a fixed target for attacks.
- Fix approach: Use Clerk's built-in admin/role system or store admin ID in Convex environment variable. Consider using `ctx.auth.getUserIdentity()` + a database lookup for role.

**Placeholder Convex URL Fallback:**
- Issue: When `VITE_CONVEX_URL` is missing, falls back to placeholder `https://placeholder.convex.cloud` instead of erroring
- Files: `src/main.tsx` (lines 30-35)
- Impact: Application silently fails with confusing behavior. No clear error message guides developer to fix configuration.
- Fix approach: Throw error on missing URL (like `CLERK_PUBLISHABLE_KEY` check). Display same `MissingConfig` component for both missing variables.

**Weak Guest ID Generation:**
- Issue: Guest IDs use `Date.now()` for uniqueness
- Files: `src/pages/EditorPage.tsx` (line 170), `src/pages/DashboardPage.tsx`
- Impact: Guest CVs with the same timestamp (within 1ms) collide. Not cryptographically secure.
- Fix approach: Use `crypto.randomUUID()` or concatenate `Date.now() + crypto.getRandomValues()`.

**localStorage Direct Access:**
- Issue: 21 instances of direct `localStorage` calls without encryption or access control
- Files: `src/pages/DashboardPage.tsx` (lines 109, 118, 161, 236, 513, 653, 704, 789, 791), `src/pages/EditorPage.tsx` (lines 170, 171, 234-236, 512-513, 653, 704), `src/features/auth/components/AuthPage.tsx`
- Impact: Sensitive CV data stored in plaintext. User data in guest mode is exposed if device is compromised. No data integrity checks (could be tampered with).
- Fix approach: (1) Encrypt sensitive fields (personal_info.email, phone) using Web Crypto API. (2) Store hash of CV data to detect tampering. (3) Consider moving guest data to IndexedDB with quota limits instead of unbounded localStorage.

## Performance Bottlenecks

**EditorPage Component Size:**
- Issue: `src/pages/EditorPage.tsx` is 1637 lines. Contains 15+ useState hooks, multiple nested callbacks, real-time DOM updates, and AI interactions in single component.
- Files: `src/pages/EditorPage.tsx` (full file)
- Impact: Large re-render cycles. Slow on low-end devices. Difficult to test individual features. State management is implicit (hard to track data flow).
- Fix approach: Split into smaller components: `<ExperienceSection>`, `<SkillsSection>`, `<DesignControls>`. Move state to context or custom hook. Use `useCallback` + `memo` to prevent unnecessary re-renders. Implement virtualization for long experience lists.

**AI Action Payload Size:**
- Issue: `tailorCV` sends full CV object + full job description in single prompt. No truncation or streaming.
- Files: `convex/ai.ts` (lines 274-295)
- Impact: Network latency for large CVs. AI provider processes redundant data. Slow response times (3 minutes observed).
- Fix approach: (1) Implement streaming for long outputs. (2) Pre-process: extract only relevant experience + skills based on job keywords. (3) Implement caching: if same job description is processed twice, reuse previous result.

**PDF Rendering with Tailwind v4 Color Variables:**
- Issue: Runtime stylesheet injection to override oklch variables during PDF export (line 185-186 comment in EditorPage)
- Files: `src/pages/EditorPage.tsx` (lines 185-188), `src/features/editor/lib/pdfExport.ts`
- Impact: Adds latency to PDF generation. Fragile approach to color compatibility. Breaks if Tailwind v4 changes color system.
- Fix approach: Pre-compute hex equivalents for all oklch colors in design system. Store in `src/shared/tokens/colors.ts`. Update templates to use computed values directly instead of runtime conversion.

**LinkedIn Parser Font-Size Classification:**
- Issue: Linear if-chain for 9 different font sizes (lines 48-58). Called per text item in PDF (potentially thousands of times).
- Files: `src/lib/linkedinParser.ts` (lines 48-58, 166-177)
- Impact: Acceptable performance now but O(n) per token. Could be O(1) with lookup.
- Fix approach: Use Map or binary search for font size ranges. Cache role classifications for repeated font sizes.

## Missing Features

**ATS Analysis Sidebar (K006):**
- Problem: `getATSAnalysis` is implemented but unused. Plan was to show results in editor sidebar after optimization.
- Files: `convex/ai.ts` (lines 301-329), `src/pages/EditorPage.tsx` (no implementation)
- Blocks: Users can't see ATS compatibility score before job application. Can't identify missing keywords.
- Priority: Medium — valuable for ATS-focused job seekers

**Historical CV Versions:**
- Problem: No way to track or restore previous CV versions. Destructive edits are permanent.
- Files: `convex/cvs.ts`, `src/pages/DashboardPage.tsx`
- Blocks: Users cannot A/B test different CV versions. Accidental deletions cannot be recovered.
- Priority: Low — could be added as feature but not critical

**Bulk CV Operations:**
- Problem: No batch processing for multiple CVs. Must optimize each CV individually.
- Files: `src/pages/DashboardPage.tsx`
- Blocks: Users with 5+ CVs spend significant time doing repetitive work.
- Priority: Low

## Test Coverage Gaps

**Critical Untested Areas:**

**EditorPage.tsx (1637 lines):**
- What's not tested: State mutations (cvData updates), error handlers (e.g., console.error at line 136), display mode assignments, PDF export, bullet point improvements, template switching
- Files: `src/pages/EditorPage.tsx`
- Risk: Regressions in optimization logic, display modes not applied correctly, export failures silent
- Priority: High

**DashboardPage.tsx (812 lines):**
- What's not tested: PDF extraction flow, job description parsing, access code verification, localStorage fallback, guest mode operations
- Files: `src/pages/DashboardPage.tsx`
- Risk: Extraction failures, security bypass (K005), guest data corruption
- Priority: High

**linkedinParser.ts (558 lines):**
- What's not tested: Font-size classification edge cases (e.g., sizes between thresholds), multi-line URL concatenation, French/English section matching, education date parsing, language proficiency mapping
- Files: `src/lib/linkedinParser.ts` (no test file present)
- Risk: Parser returns null → falls back to slow AI. Silent failures. Incorrect data extraction.
- Priority: Critical — 558 lines of complex logic with 0 tests

**AI Actions (convex/ai.ts):**
- What's not tested: JSON parsing fallback logic, safeParseJSON error handling, access code verification, provider switching, markdown-wrapped JSON handling
- Files: `convex/ai.ts` (lines 75-116)
- Risk: AI responses with markdown ` ```json ... ``` ` wrappers fail to parse. Access codes not validated. Provider errors not handled.
- Priority: High

Current test count: Only 3 test files in codebase. Coverage unknown.
- `src/features/editor/lib/autoFit.test.ts` (109 lines)
- `src/features/editor/lib/displayModes.test.ts` (137 lines)
- `src/features/editor/lib/scoring.test.ts` (179 lines)

**Recommendation:** Add tests for linkedinParser first (highest risk), then EditorPage state mutations, then DashboardPage extraction flow.

## Fragile Areas

**LinkedIn Parser Determinism:**
- Files: `src/lib/linkedinParser.ts` (lines 140-208, font classification logic)
- Why fragile: Depends on exact font sizes (26, 15.75, 13, 12, 11.5, 11, 10.5, 9). Thresholds are hardcoded. Single pixel change in LinkedIn PDF breaks parser.
- Safe modification: (1) Add input validation — log all unique font sizes seen in PDFs. (2) Extract thresholds to constants at top with comments referencing K001. (3) Add unit tests with real LinkedIn PDFs showing expected font sizes.
- Test coverage: None. Should test with 5+ real LinkedIn profiles.

**Guest Mode Data Persistence:**
- Files: `src/pages/DashboardPage.tsx` (localStorage calls), `src/pages/EditorPage.tsx` (localStorage calls)
- Why fragile: localStorage is global, unencrypted, and quota-limited (5-10MB). Multiple tabs can corrupt data simultaneously. Browser clear-all deletes everything. No versioning.
- Safe modification: (1) Wrap all localStorage access in a typed manager class. (2) Add migration function for format changes. (3) Test in private browsing (no persistence). (4) Add quota checking before writes.
- Test coverage: No tests for guest mode data flows.

**displayMode Assignment Logic:**
- Files: `src/features/editor/lib/scoring.ts` (lines 115-133), `src/pages/EditorPage.tsx` (lines 363-370, UI assignment)
- Why fragile: Two separate code paths assign displayModes (AI optimization vs. user UI). Can diverge. Example: if AI assigns "extended" but user changes to "normal", subsequent optimization might override.
- Safe modification: (1) Single source of truth: displayMode should only be set by AI or user explicitly (not auto-updated). (2) Add invariant check: after optimization, displayMode must match a valid mode. (3) Test round-trip: optimize → user edits → re-optimize, verify mode consistency.
- Test coverage: `autoFit.test.ts` covers hiding logic, but not mode assignment conflict scenarios.

**Error Recovery in PDF Export:**
- Files: `src/features/editor/lib/pdfExport.ts`, `src/pages/EditorPage.tsx` (lines 186-189)
- Why fragile: PDF generation injects dynamic CSS and renders to canvas. If Tailwind classes change or template breaks, PDF silently fails with no fallback.
- Safe modification: (1) Add try-catch with recovery: render to PDF with stripped styles, no colors. (2) Log which template + styles caused failure. (3) Implement timeout (5s) to prevent hangs.
- Test coverage: No tests for PDF export. Manual testing only.

## Scaling Limits

**Convex Database Query Limits:**
- Current capacity: Queries return up to 100 records (accessCodes.list, line 98; accessRequests.listRequests, line 123)
- Limit: When >100 codes/requests exist, pagination is missing. Admin dashboard shows truncated list.
- Scaling path: Implement cursor-based pagination in `accessCodes.list()` and `accessRequests.listRequests()`. Add `limit` and `cursor` args.

**localStorage for Guest CVs:**
- Current capacity: ~5-10MB per browser
- Limit: Users with 50+ guest CVs will exceed quota. New CVs fail to save silently.
- Scaling path: Switch to IndexedDB (much larger quota). Implement LRU cache — keep last 20 CVs in memory, archive older ones.

**AI API Rate Limits:**
- Current: NVIDIA NIM free tier is 40 req/min. Observed: tailorCV takes 3 minutes → 1 concurrent user max.
- Limit: Multiple simultaneous users hit rate limit, receive "Too many requests" errors.
- Scaling path: Implement queue system in Convex. Users join queue, process optimizations serially. Add estimated wait time to UI.

**LinkedIn Parser Memory:**
- Current: Loads entire PDF into memory (extractTokens uses pdfjs). Processes all text items.
- Limit: Large PDFs (20+ pages) consume 100MB+ RAM per instance.
- Scaling path: Stream PDF processing page-by-page. Stop after finding all major sections (first 10 pages likely sufficient).

## Dependencies at Risk

**NVIDIA NIM OpenAI Compatibility:**
- Risk: NIM exposes OpenAI-compatible API, but compatibility is partial. Example: `response_format: { type: "json_object" }` not supported by all NIM models (lines 100-105 shows fallback).
- Impact: Fallback logic works but is slower. Future NIM updates could break compatibility.
- Migration plan: (1) Keep Gemini 2.5 Flash as fallback (already configured). (2) Add unit tests for both providers' JSON response handling. (3) Monitor NIM release notes monthly.

**pdfjs-dist Type Compatibility:**
- Risk: pdfjs-dist is heavy (6MB), slow PDF parsing, and TypeScript types are minimal.
- Impact: No types for PDF items. Code uses implicit `any` types. Slow parsing on large files.
- Migration plan: Consider pdfjs-rust or PDFKit for faster parsing. Evaluate if LinkedIn parser complexity justifies keeping pdfjs-dist.

**Clerk Auth Provider Lock-in:**
- Risk: Entire auth system depends on Clerk. Migration to another provider requires rewriting `src/features/auth/`, convex auth handlers.
- Impact: Locked into Clerk pricing. Cannot easily switch if they change terms.
- Migration plan: (1) Create auth abstraction layer (interface with login/logout/getCurrentUser). (2) Implement for both Clerk and Auth0. (3) Switch via env var.

## Known Bugs

**Console Warnings on Missing Config:**
- Symptom: Browser console shows "VITE_CONVEX_URL is not defined" warning at startup even if .env.local is configured correctly
- Files: `src/main.tsx` (line 33)
- Trigger: Always on dev startup if VITE_CONVEX_URL env var is not passed to Vite process
- Workaround: Ensure `.env.local` is loaded by `npm run dev`. Check if vite-plugin-dotenv is configured.

**PDF Color Export Regression:**
- Symptom: Exported PDFs show incorrect colors (oklch variables not converted to hex)
- Files: `src/pages/EditorPage.tsx` (line 185-188), templates
- Trigger: Happens on PDF export, especially with custom color selections
- Workaround: Use template default colors instead of custom colors for PDF export
- Root cause: Tailwind v4 oklch variables are not baked into hex until runtime CSS injection (fragile)

**Bullet Point Improvements May Lose Original:**
- Symptom: When user accepts a suggestion from `improveBulletPoint`, original bullet is replaced but never shown again
- Files: `src/pages/EditorPage.tsx` (lines 765-800, suggestion UI)
- Trigger: User clicks suggestion without selecting original first
- Workaround: Use Undo or refresh page to recover original
- Root cause: Suggestion modal doesn't save previous value before accepting change

---

*Concerns audit: 2026-04-09*
