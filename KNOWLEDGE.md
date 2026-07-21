# KNOWLEDGE — Calibre CV Builder

Append-only register of project-specific rules, patterns, and lessons learned.

---

### K001 — LinkedIn PDF font sizes are stable (2025 format)
All 4 tested profiles share identical font-size hierarchy: 26/15.75/13/12/11.5/11/10.5/9. Parser relies on this. If LinkedIn changes their PDF export, these values need updating in `linkedinParser.ts` `FONT_ROLES`.

### K002 — LinkedIn URLs can span 2+ lines
The LinkedIn URL in sidebar (fs=11) may split across lines ending with `-` or `/`. The parser concatenates consecutive same-role lines. Don't assume single-line URLs.

### K003 — react-dropzone file inputs are hidden
`browser_upload_file` on the visible `input[type=file]` may not trigger react-dropzone's `onDrop`. The dropzone creates its own hidden input. For testing, dispatch a synthetic `change` event or use the app's own UI flow.

### K004 — Gemini free tier hits 429/503 frequently; Anthropic is the reliable fallback
`tailorCV` on a large CV (>15k JSON chars) regularly triggers Gemini 429/503. Anthropic (claude-sonnet-4-5) is the fallback. With `max_tokens: 30000` Anthropic requires streaming — use `client.messages.stream().finalMessage()`, not `client.messages.create()`, otherwise the SDK throws "Streaming is required for operations that may take longer than 10 minutes". Estimated duration displayed in Dashboard CTA: ~30s (<3k chars) to ~240s (>15k chars).

### K007 — chatJSON/chatText take a speed level, not a model name
`chatJSON(prompt, "fast")` and `chatText(prompt, "fast")` accept `"default" | "fast"`. Each provider resolves its own model via `getModel(speed, provider)`. Never pass `getModel("fast")` as a string argument — it returns the first provider's model name (e.g. `gemini-2.5-flash`) which causes a 404 on Anthropic.

### K008 — Cover letter prompt must forbid markdown and section title mirroring
The model (Gemini and Claude) tends to mirror the job description's section titles as bold headers in the letter. The prompt must explicitly forbid `**`, `*`, `#`, bullet lists, and reuse of job ad section titles. Require 3–4 paragraphs of plain prose. See `convex/_ai/prompts/coverLetter.ts`.

### K009 — Cover letter tailored CV detection
`isTailored` is computed in EditorPage by comparing `userData.lastJobDescription` (saved on Convex after `tailorCV`) with the current `jobDescription`. If they don't match, the CoverLetterDrawer shows an amber warning. Correct workflow: Dashboard → Optimize → Editor → Cover Letter.

### K005 — Access code modal is client-side only
`REQUIRE_ACCESS_CODE` env var is not set on Convex. The modal triggers purely based on `localStorage('calibre_access_code')` being empty. `verifyAccessCode()` in ai.ts is a no-op when the env var is missing.

### K006 — ATS analysis removed from dashboard, planned for editor
The `getATSAnalysis` action still exists in `convex/ai.ts` but has no UI. Plan: run it automatically after optimization completes, display results in a sidebar panel on the editor page.

### K010 — SDK internal retries were the hidden slowness; withRetry owns all retry logic (2026-07-21)
Both the OpenAI and Anthropic SDKs default to 2 internal retries with exponential backoff. A Gemini 429 burned ~30-60s inside the SDK before our fallback loop even saw the error — this was the main "spinner infini" cause. Fix: `maxRetries: 0` on both clients + per-call timeouts (Gemini 90s, Claude 300s). Policy in `convex/_ai/chat.ts`: non-last provider = zero retry, immediate fall-through; last provider = 1 retry, retry-after aware (capped 20s). Never re-add SDK-level retries.

### K011 — Zod validation lives INSIDE the retry loop via chatJSONSchema
`chatJSONSchema(prompt, schema, speed)` validates the schema inside `withRetry`: a schema-invalid response counts as a provider failure and falls through to the next provider instead of surfacing "format invalide, réessayez". All 9 schema-validated actions in `convex/ai.ts` use it. Don't reintroduce the old `chatJSON` + `safeParse` + throw pattern at call-sites.
