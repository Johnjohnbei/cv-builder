# KNOWLEDGE — Calibre CV Builder

Append-only register of project-specific rules, patterns, and lessons learned.

---

### K001 — LinkedIn PDF font sizes are stable (2025 format)
All 4 tested profiles share identical font-size hierarchy: 26/15.75/13/12/11.5/11/10.5/9. Parser relies on this. If LinkedIn changes their PDF export, these values need updating in `linkedin-parser.ts` `FONT_ROLES`.

### K002 — LinkedIn URLs can span 2+ lines
The LinkedIn URL in sidebar (fs=11) may split across lines ending with `-` or `/`. The parser concatenates consecutive same-role lines. Don't assume single-line URLs.

### K003 — react-dropzone file inputs are hidden
`browser_upload_file` on the visible `input[type=file]` may not trigger react-dropzone's `onDrop`. The dropzone creates its own hidden input. For testing, dispatch a synthetic `change` event or use the app's own UI flow.

### K004 — Claude on large CVs: streaming is mandatory
Claude (claude-sonnet-4-5) is the only provider since 2026-08-16; Gemini was removed after its free tier kept failing with 429/503. With `max_tokens: 30000` Anthropic requires streaming — use `client.messages.stream().finalMessage()`, not `client.messages.create()`, otherwise the SDK throws "Streaming is required for operations that may take longer than 10 minutes". Estimated duration displayed in Dashboard CTA: ~30s (<3k chars) to ~240s (>15k chars).

### K007 — chatJSON/chatText take a speed level, not a model name
`chatJSONThen`, `chatJSONSchema` and `chatText` accept a speed `"default" | "fast"`. The provider resolves its own model via `getModel(speed, provider)`. Never pass a model name as the speed argument.

### K008 — Cover letter prompt must forbid markdown and section title mirroring
The model tends to mirror the job description's section titles as bold headers in the letter. The prompt must explicitly forbid `**`, `*`, `#`, bullet lists, and reuse of job ad section titles. Require 3–4 paragraphs of plain prose. See `convex/_ai/prompts/coverLetter.ts`.

### K009 — Cover letter tailored CV detection
`isTailored` is computed in EditorPage by comparing `userData.lastJobDescription` (saved on Convex after `tailorCV`) with the current `jobDescription`. If they don't match, the CoverLetterDrawer shows an amber warning. Correct workflow: Dashboard → Optimize → Editor → Cover Letter.

### K005 — AI actions: a signed-in account OR a valid access code (2026-09-15)
`verifyAccessCode()` (`convex/_ai/auth.ts`) lets any signed-in Clerk identity through and requires a valid code from guests, checked and counted in one mutation (`accessCodes.consumeInternal`). The former `REQUIRE_ACCESS_CODE` switch was never set in production, which left every paid action open to anonymous callers. The dashboard modal (`requireAccessCode`) mirrors the rule and forgets a code the server refuses.

### K006 — No server-side ATS analysis
`getATSAnalysis` was deleted on 2026-09-15: a public, billable action with no caller. The ATS score is computed client-side (`scoring.ts`, `useATSAnalysis`).

### K010 — SDK internal retries were the hidden slowness; withRetry owns all retry logic (2026-07-21)
The SDKs default to 2 internal retries with exponential backoff: a 429 burned ~30-60s inside the SDK before our loop even saw the error, the main "spinner infini" cause. Fix: `maxRetries: 0` + a per-call timeout (Claude 270s, so timeout + capped retry-after + timeout stays under the 10-minute Convex action limit). Policy in `convex/_ai/chat.ts`: non-last provider = zero retry, immediate fall-through; last provider = 1 retry, retry-after aware (capped 20s). Never re-add SDK-level retries.

### K011 — Zod validation lives INSIDE the retry loop via chatJSONSchema
`chatJSONSchema(prompt, schema, speed)` validates the schema inside `withRetry`: a schema-invalid response counts as a provider failure and falls through to the next provider instead of surfacing "format invalide, réessayez". All 9 schema-validated actions in `convex/ai.ts` use it. Don't reintroduce the old `chatJSON` + `safeParse` + throw pattern at call-sites.

### K012 — Language mixing had 4 root causes; fixed 2026-07-21
The app produced FR/EN mixed CVs. Causes: (1) adapt/rewrite/distribute prompts were French-instructed with French few-shot examples while asking for English output → the model leaked French. Fix: KPI_RULES_EN + LANGUAGE_LOCK(isEn) at prompt end, thread language through bullet/distribute actions+hooks. (2) backend normalizeProficiency froze to French ("Courant (C1)") — a value the render map couldn't re-localize. Fix: backend stores RAW proficiency, render owner (formatting.ts) localizes both ways + migration aliases; translateCV leaves proficiency raw. (3) toggle used franc on mixed content and flipped the flag without translating. Fix: cache-hit=instant swap, else translate; never franc-flip. (4) no eager bilingual. Fix: attachBilingualCache() translates the other language right after generation. There are TWO normalizeProficiency functions: backend (convex/_ai/normalizers.ts, now passthrough) and render (src/features/editor/lib/formatting.ts, the bilingual owner). Don't re-add French freezing in the backend one.
