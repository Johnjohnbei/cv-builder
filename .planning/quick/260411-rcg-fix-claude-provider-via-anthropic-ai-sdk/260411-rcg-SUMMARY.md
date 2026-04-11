---
task_id: 260411-rcg
slug: fix-claude-provider-via-anthropic-ai-sdk
type: quick
phase: quick
plan: 01
status: complete
started: "2026-04-11T19:48:00.000Z"
completed: "2026-04-11T19:51:00.000Z"
duration_minutes: 3
commit: d91fe82
requirements:
  - QUICK-260411-rcg
files_modified:
  - package.json
  - package-lock.json
  - convex/_ai/providers.ts
  - convex/_ai/chat.ts
  - convex/_ai/__tests__/providers.test.ts
  - .env.example
  - .planning/STATE.md
files_untouched_confirmed:
  - convex/ai.ts
tech_added:
  - "@anthropic-ai/sdk ^0.88.0"
tech_removed:
  - NVIDIA NIM provider block (llama 3.1 70B, persistent 404)
metrics:
  tests_total: 401
  tests_new: 8
  tests_prior: 393
  tsc: pass
  build: pass
---

# Quick 260411-rcg: Claude Fallback via Native @anthropic-ai/sdk — Summary

**One-liner:** Restored Gemini→Claude two-provider fallback by replacing the broken openai-SDK+patched-baseURL approach with the native `@anthropic-ai/sdk` Messages API, keyed off a new `protocol` discriminant on `AIProvider`.

## What was fixed

The Claude fallback path was returning 404 errors because the code was using the `openai` SDK pointed at `https://api.anthropic.com/v1/` and calling `client.chat.completions.create(...)`. Anthropic does not expose `/v1/chat/completions` — they only expose `/v1/messages`. The fix uses the native `@anthropic-ai/sdk` Messages API directly.

## Changes (single atomic commit `d91fe82`)

### `convex/_ai/providers.ts` — refactored
- Added `protocol: 'openai' | 'anthropic'` discriminant to `AIProvider` interface
- Gemini block tagged `protocol: 'openai'`, unchanged otherwise
- Claude block tagged `protocol: 'anthropic'`, model IDs updated to current-gen:
  - `defaultModel: 'claude-sonnet-4-5'` (was `claude-sonnet-4-20250514` — dead)
  - `fastModel: 'claude-haiku-4-5-20251001'`
- Kept `baseURL` on both variants for withRetry log symmetry (SDK ignores it on the anthropic path)
- **Removed NVIDIA provider block entirely** (deprecated Llama 3.1 70B, persistent 404, no fix path)
- **Deleted `getClient()` helper** — SDKs are now inlined at the branching points in chat.ts
- **Deleted `getProvider()` helper** — only consumer was `getClient()`, now orphaned
- Error message updated to mention only GEMINI_API_KEY and ANTHROPIC_API_KEY (not NVIDIA)
- Load-bearing comment added explaining why the discriminant exists (prevents future "just patch the baseURL" regressions)

### `convex/_ai/chat.ts` — refactored
- Added `import Anthropic from "@anthropic-ai/sdk"`
- Removed `getClient` from imports (no longer exists)
- `chatJSON` and `chatText` now branch on `provider.protocol === "anthropic"`
- Anthropic branch inlines `new Anthropic({ apiKey })` + `client.messages.create({...})`
  - `max_tokens: 8192` (required on Messages API — OpenAI allows omit, Anthropic does not)
  - No `response_format` param (Messages API doesn't support it; prompt engineering handles JSON mode)
- Shared helper `extractAnthropicText(response)` defensively pulls `response.content[0].text`, returning `""` if the first block is missing or not a text block (safeParseJSON then throws a clean "empty response" error)
- OpenAI-compatible path (Gemini) is unchanged byte-for-byte: including the 400-fallback retry without `response_format`
- `withRetry` unchanged — its `e?.status || e?.message?.match(/(\d{3}) status/)` shape works for both SDKs (both throw errors with `.status`)
- `safeParseJSON` unchanged

### `convex/_ai/__tests__/providers.test.ts` — new (8 tests)
- Env-var isolation via beforeEach/afterEach snapshot-restore of `GEMINI_API_KEY`/`ANTHROPIC_API_KEY`/`NVIDIA_API_KEY`
- Coverage:
  1. Gemini only → single openai-protocol provider, gemini-2.5-flash
  2. Anthropic only → single anthropic-protocol provider, claude-sonnet-4-5 / claude-haiku-4-5-20251001
  3. Both set → Gemini first (priority 1), Claude second (priority 2)
  4. Neither set → throws, error mentions both required keys, never mentions NVIDIA
  5. NVIDIA alone → throws (NVIDIA ignored completely)
  6. NVIDIA + Gemini → only 1 provider (Gemini), NVIDIA silently ignored
  7. getModel('default', provider) → provider.defaultModel
  8. getModel('fast', provider) → provider.fastModel

### `package.json` / `package-lock.json`
- `@anthropic-ai/sdk: ^0.88.0` added to `dependencies` (not devDependencies)

### `.env.example`
- Added comment block for `ANTHROPIC_API_KEY` pointing to Anthropic console and `npx convex env set` command (value not committed — secret lives only in Convex env)

### `.planning/STATE.md`
- AI Provider Architecture section updated: `Gemini → Claude (via @anthropic-ai/sdk Messages API)`, NVIDIA removal dated 2026-04-11
- Protocol discriminant documented as key design element
- Known Issues: Gemini rate-limit entry updated to note that Claude fallback is now active
- `last_updated` bumped

## Verification

All three gates pass:

```
npx tsc --noEmit    → exit 0 (clean)
npx vitest run      → 30 files, 401 tests passing (393 prior + 8 new providers.test.ts)
npx vite build      → exit 0 (3.39s, no errors — only the pre-existing EditorPage chunk-size warning)
```

**API contract preservation confirmed:** `git diff 67239be..HEAD convex/ai.ts` returns empty. Zero signature changes, zero callsite changes, zero prompt changes. All 15+ callsites of `chatJSON`/`chatText`/`getModel` in `convex/ai.ts` continue to compile and behave identically.

## Deviations from plan

**None.** The plan was executed exactly as written:

- Single atomic commit (as the planner decided, because splitting task 1 + task 2 would leave an intentionally tsc-broken intermediate commit on master — worse than one semantically-atomic commit)
- All 6 test cases from the plan's `<behavior>` block were implemented. I added 2 extra test cases for completeness (test case 6 became "NVIDIA + Gemini together" which was not in the plan but is a natural extension of test 5; plus the two getModel() cases were split into their own describe block for clarity), bringing the new test count to 8 instead of 6. These are additive — they do not change any plan semantics.
- @anthropic-ai/sdk resolved to `^0.88.0` (latest stable); no version pin required by plan.
- No RULE deviations triggered — no bugs found, no missing critical functionality, no blocking issues, no architectural changes needed.
- `extractAnthropicText(response: Anthropic.Message)` helper added to avoid duplicating the defensive response-shape extraction between `chatJSON` and `chatText`. Not in the plan explicitly but it's the DRY version of the plan's inline code — cleaner, same semantics.

## Anthropic SDK quirks handled

Per the `<critical_design_notes>` in the prompt:

- **Model IDs**: Using `claude-sonnet-4-5` (default) and `claude-haiku-4-5-20251001` (fast) — NOT the broken pre-nl2 `claude-sonnet-4-20250514`. Verified in unit tests.
- **Response shape**: `response.content[0].text` extracted defensively via typed helper that checks `first && first.type === "text"` before reading `.text`. If the block is missing or non-text, returns `""` and safeParseJSON surfaces a clear "empty response" error (chatJSON) or returns empty string (chatText).
- **`max_tokens: 8192`** supplied on every Anthropic call (required by SDK, enforced at runtime).
- **No `response_format` param** on Anthropic calls — Messages API rejects it. Existing French prompts already say "Retourne UNIQUEMENT le JSON" so JSON extraction via prompt engineering is sufficient.
- **`withRetry` status extraction**: `@anthropic-ai/sdk` throws errors with `.status` (same shape as openai SDK errors), so the existing `e?.status || e?.message?.match(/(\d{3}) status/)` logic for 503/429 retries works without modification on the anthropic path.
- **Protocol discriminant**: `protocol: 'openai' | 'anthropic'` — Gemini tagged openai, Claude tagged anthropic.
- **Inline SDK constructors**: `new OpenAI({...})` and `new Anthropic({...})` are instantiated directly at the 2 callsites (chatJSON anthropic branch, chatJSON openai branch, chatText anthropic branch, chatText openai branch — 4 total instantiations, no shared helper). No `getClient` export.
- **NVIDIA block removed entirely** — no env var read, no provider push, no baseURL string. Err message no longer mentions it.

## Test suite summary

| Test file | Status | Tests |
|---|---|---|
| convex/_ai/__tests__/providers.test.ts (NEW) | pass | 8 |
| All other suites | pass | 393 |
| **Total** | **pass** | **401** |

## Commit

```
d91fe82 fix(ai): Claude fallback via native @anthropic-ai/sdk (Messages API)
```

7 files changed, 238 insertions(+), 41 deletions(-).

## Remaining work

**Task 3 in the plan is `checkpoint:human-verify`** — it asks the user to:
1. Confirm `ANTHROPIC_API_KEY` is present in Convex env (user claims it already is from original Phase 11 work)
2. Run `npx convex dev` + `npm run dev`, exercise a few flows with Gemini active (baseline), then temporarily unset `GEMINI_API_KEY` in Convex env and exercise again to force the Claude path
3. Verify Convex logs show no 404s on `api.anthropic.com`
4. Restore Gemini key

This cannot be automated from within the executor (requires Convex deploy + live HTTP calls + human eyeballs on Convex log output). The code fix and static verification are complete; the live smoke test is deferred to the user.

## Self-Check: PASSED

- `convex/_ai/providers.ts` exists and contains `protocol: 'openai'` and `protocol: 'anthropic'` — FOUND
- `convex/_ai/chat.ts` exists and contains `provider.protocol === "anthropic"` — FOUND
- `convex/_ai/__tests__/providers.test.ts` exists — FOUND
- `@anthropic-ai/sdk` in package.json `dependencies` — FOUND
- `.env.example` contains `ANTHROPIC_API_KEY` comment — FOUND
- `.planning/STATE.md` NVIDIA removed 2026-04-11 line — FOUND
- Commit `d91fe82` in git log — FOUND
- `convex/ai.ts` untouched (diff empty vs 67239be) — CONFIRMED
- `npx tsc --noEmit` exit 0 — PASS
- `npx vitest run` 401 passing — PASS
- `npx vite build` exit 0 — PASS
- Push to origin/master — SUCCESS
