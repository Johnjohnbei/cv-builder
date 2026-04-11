---
mode: quick
task_id: 260411-nl2
slug: replace-broken-claude-and-nvidia-provide
type: execute
wave: 1
status: complete
commits:
  - sha: 6a7123f
    subject: "refactor(ai): replace broken Claude/NVIDIA with OpenRouter primary"
  - sha: 43bcbc7
    subject: "docs(ai): document OpenRouter + Gemini fallback chain"
files_modified:
  - convex/_ai/providers.ts
  - convex/_ai/__tests__/providers.test.ts
  - .env.example
  - .planning/STATE.md
tests:
  before: 393
  after: 398
  delta: +5
requirements:
  - QUICK-260411-nl2
completed_at: "2026-04-11T17:06:00Z"
---

# 260411-nl2 — Replace broken Claude & NVIDIA providers with OpenRouter

## One-liner

Retired Claude direct (404 protocol mismatch) and NVIDIA NIM (404 model routing) provider configs; OpenRouter is now priority 1, Gemini direct remains as priority 2 fallback.

## What changed

### `convex/_ai/providers.ts` (refactor)

- **Removed:** Claude direct block (`api.anthropic.com/v1/`) + NVIDIA NIM block (`integrate.api.nvidia.com/v1`).
- **Removed:** Anthropic-specific header injection (`if (p.baseURL.includes("anthropic.com"))...`) inside `getClient()`. It was dead code the moment Claude direct was retired.
- **Added:** OpenRouter block as priority 1 — `https://openrouter.ai/api/v1/` with models `anthropic/claude-sonnet-4.5` (default) / `anthropic/claude-haiku-4.5` (fast).
- **Reordered:** Gemini direct from priority 1 → priority 2 (fallback, unchanged config).
- **Added:** 20-line doc comment above `getProviders()` explaining WHY Anthropic native API is not OpenAI-compatible and WHY NVIDIA was retired. Load-bearing documentation — prevents future devs from re-adding direct Claude/NVIDIA and reintroducing the 404 bug.
- **Updated:** Error message when no provider is set references `OPENROUTER_API_KEY` + `GEMINI_API_KEY` (legacy keys no longer mentioned).
- **Public API:** `AIProvider`, `getProviders`, `getProvider`, `getClient`, `getModel` signatures are byte-identical. No consumer edit required.

### `convex/_ai/__tests__/providers.test.ts` (new)

5 unit tests, all TDD-first:

1. OpenRouter-only → returns 1 provider with the OpenRouter baseURL and Claude 4.5 models.
2. Gemini-only → returns 1 provider with the Gemini baseURL and gemini-2.5-flash model.
3. Both keys set → returns 2 providers in order [OpenRouter, Gemini].
4. Neither key set → throws an Error referencing both `OPENROUTER_API_KEY` and `GEMINI_API_KEY`.
5. Regression guard: legacy `ANTHROPIC_API_KEY` + `NVIDIA_API_KEY` set → still throws (legacy keys no longer honored).

Env isolation via `beforeEach` snapshot + `afterEach` restore using `delete process.env.X` (not `= undefined`).

### `.env.example`

Added documentation block for `OPENROUTER_API_KEY` (with https://openrouter.ai/keys source URL) and clarified that both vars go in Convex env, not local .env.

### `.planning/STATE.md`

Updated the "Post-Milestone Changes (2026-04-09) > AI Provider Architecture" section to reflect the new OpenRouter → Gemini chain and document the 260411-nl2 retirement of Claude/NVIDIA direct with full rationale. (Not committed by executor — orchestrator owns planning files.)

## Commits

| # | SHA | Subject |
|---|-----|---------|
| 1 | `6a7123f` | refactor(ai): replace broken Claude/NVIDIA with OpenRouter primary |
| 2 | `43bcbc7` | docs(ai): document OpenRouter + Gemini fallback chain |

Both commits pushed to `origin/master`. Independently revertable per plan's rollback section.

## Verification (per commit)

After each commit, ran `npx tsc --noEmit && npx vitest run && npx vite build` — all three passed.

- **tsc:** 0 errors (zero consumer breakage in `convex/ai.ts` — confirming the byte-identical API contract held).
- **vitest:** 30 files / 398 tests passing (previously 393 — +5 from new providers.test.ts).
- **vite build:** clean build in ~4.8s, no new warnings (the 500kB EditorPage warning is pre-existing and unrelated).

## Deviations from plan

**None.** Plan executed exactly as written. Notably:

- **Risk #1 (`"use node";` + vitest) did NOT trigger.** Vitest happily imported `providers.ts` with the directive at the top — the directive is parsed as an inert string expression. No need for the `providers-config.ts` sibling extraction mitigation. Used `// @vitest-environment node` as a belt-and-braces hint at the top of the test file, which was sufficient.
- **Preflight finding confirmed:** `.env.example` had no legacy `ANTHROPIC_API_KEY` / `NVIDIA_API_KEY` lines to remove; the update was purely additive.
- **Orchestrator ownership of planning files:** Per the executor constraints (not plan text), STATE.md was edited but NOT committed by the executor. The orchestrator will handle committing `.planning/` file changes.

## Success criteria check

- [x] `convex/_ai/providers.ts` contains exactly 2 provider blocks: OpenRouter (priority 1) + Gemini (priority 2)
- [x] `grep` for `ANTHROPIC_API_KEY|NVIDIA_API_KEY|anthropic.com|nvidia.com` in `convex/_ai/` → 0 matches
- [x] `npx vitest run convex/_ai/__tests__/providers.test.ts` → 5/5 passing
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npx vite build` → passes
- [x] `.env.example` documents `OPENROUTER_API_KEY` with key-source URL
- [x] `.planning/STATE.md` AI Provider Architecture section updated with retirement rationale
- [x] Public API of `providers.ts` byte-identical (no consumer edits)
- [x] Two independent commits in the order specified

## MANUAL POST-COMMIT STEP (user must do this before IA features work in prod)

The code change alone is not enough — OpenRouter needs an API key set in Convex env vars. Run this in the project root:

```bash
npx convex env set OPENROUTER_API_KEY <your-key>
```

Get a key at https://openrouter.ai/keys (funded account recommended — free-tier OpenRouter is limited).

Optional: keep `GEMINI_API_KEY` set in Convex env as the priority-2 fallback. If only Gemini is set, the app still works but loses the OpenRouter resilience layer.

After setting the key, smoke-test with a cover letter generation or company extraction in the editor to confirm the chain works end-to-end.

## Self-Check: PASSED

- Files created/modified (all verified present):
  - `convex/_ai/providers.ts` — FOUND
  - `convex/_ai/__tests__/providers.test.ts` — FOUND
  - `.env.example` — FOUND (contains `OPENROUTER_API_KEY`)
  - `.planning/STATE.md` — FOUND (contains `OpenRouter (priority 1)`)
- Commits present in `git log`:
  - `6a7123f` — FOUND
  - `43bcbc7` — FOUND
- Both commits pushed to `origin/master` (verified via `git push` output).
