# KNOWLEDGE — Calibre CV Builder

Append-only register of project-specific rules, patterns, and lessons learned.

---

### K001 — LinkedIn PDF font sizes are stable (2025 format)
All 4 tested profiles share identical font-size hierarchy: 26/15.75/13/12/11.5/11/10.5/9. Parser relies on this. If LinkedIn changes their PDF export, these values need updating in `linkedinParser.ts` `FONT_ROLES`.

### K002 — LinkedIn URLs can span 2+ lines
The LinkedIn URL in sidebar (fs=11) may split across lines ending with `-` or `/`. The parser concatenates consecutive same-role lines. Don't assume single-line URLs.

### K003 — react-dropzone file inputs are hidden
`browser_upload_file` on the visible `input[type=file]` may not trigger react-dropzone's `onDrop`. The dropzone creates its own hidden input. For testing, dispatch a synthetic `change` event or use the app's own UI flow.

### K004 — NVIDIA NIM free tier is very slow on large prompts
`tailorCV` with 23 experiences takes ~3 minutes on NIM llama-3.1-70b free tier. The JSON payload is massive (full CV + job description in, full CV out). **TODO: switch tailorCV to Gemini 2.5 Flash (already configured) or truncate to top 8-10 experiences and pass the rest through unchanged.** This is the #1 UX pain point.

### K005 — Access code modal is client-side only
`REQUIRE_ACCESS_CODE` env var is not set on Convex. The modal triggers purely based on `localStorage('calibre_access_code')` being empty. `verifyAccessCode()` in ai.ts is a no-op when the env var is missing.

### K006 — ATS analysis removed from dashboard, planned for editor
The `getATSAnalysis` action still exists in `convex/ai.ts` but has no UI. Plan: run it automatically after optimization completes, display results in a sidebar panel on the editor page.
