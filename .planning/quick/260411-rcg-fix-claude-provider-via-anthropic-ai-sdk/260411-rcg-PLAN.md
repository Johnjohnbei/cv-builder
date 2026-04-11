---
task_id: 260411-rcg
slug: fix-claude-provider-via-anthropic-ai-sdk
type: quick
mode: execute
created: 2026-04-11
phase: quick
plan: 01
wave: 1
depends_on: []
autonomous: false
files_modified:
  - package.json
  - package-lock.json
  - convex/_ai/providers.ts
  - convex/_ai/chat.ts
  - convex/_ai/__tests__/providers.test.ts
  - .env.example
  - .planning/STATE.md
requirements:
  - QUICK-260411-rcg
user_setup:
  - service: anthropic
    why: "Priority 2 fallback provider — native Messages API"
    env_vars:
      - name: ANTHROPIC_API_KEY
        source: "https://console.anthropic.com/settings/keys (user already has it set in Convex env per session pushback)"
    dashboard_config:
      - task: "Verify key exists: npx convex env list | grep ANTHROPIC"
        location: "Convex dashboard → Settings → Environment Variables"

must_haves:
  truths:
    - "Claude fallback works end-to-end when Gemini fails (503/429) — returns valid JSON from Messages API, not a 404 from chat/completions"
    - "The openai SDK is used ONLY for Gemini; the @anthropic-ai/sdk is used ONLY for Claude — no more baseURL-patched OpenAI client pointing at api.anthropic.com"
    - "All existing convex/ai.ts actions continue to work byte-identically — zero signature changes, zero prompt changes, zero callsite changes"
    - "NVIDIA provider block is gone — getProviders() never returns a NVIDIA entry, env var is ignored"
    - "tsc --noEmit passes, vitest run passes (including new providers.test.ts), vite build passes"
    - "getProviders() returns correctly-tagged protocol: 'openai' | 'anthropic' discriminants, enforced by unit tests"
  artifacts:
    - path: "convex/_ai/providers.ts"
      provides: "AIProvider interface with protocol discriminant, getProviders() returning Gemini+Claude only, getModel() unchanged"
      contains: "protocol: 'openai' | 'anthropic'"
    - path: "convex/_ai/chat.ts"
      provides: "chatJSON/chatText with provider.protocol branching — openai path unchanged, anthropic path uses new Anthropic({apiKey}).messages.create()"
      contains: "provider.protocol === 'anthropic'"
    - path: "convex/_ai/__tests__/providers.test.ts"
      provides: "Unit tests for env-var → provider list mapping"
      min_lines: 40
    - path: "package.json"
      provides: "@anthropic-ai/sdk as runtime dependency"
      contains: "@anthropic-ai/sdk"
  key_links:
    - from: "convex/ai.ts actions"
      to: "chat.ts::chatJSON"
      via: "existing imports, unchanged signatures"
      pattern: "chatJSON\\(prompt"
    - from: "convex/_ai/chat.ts::chatJSON"
      to: "@anthropic-ai/sdk Anthropic.messages.create"
      via: "protocol === 'anthropic' branch"
      pattern: "messages\\.create"
    - from: "convex/_ai/providers.ts::getProviders"
      to: "process.env.GEMINI_API_KEY and ANTHROPIC_API_KEY"
      via: "ordered push (Gemini first, Claude second)"
      pattern: "ANTHROPIC_API_KEY"
---

<objective>
Fix the broken Claude fallback (404 on api.anthropic.com/v1/chat/completions) by using the native
@anthropic-ai/sdk (Messages API) instead of the openai SDK with a patched baseURL. Introduce a
`protocol` discriminant on AIProvider so chat.ts can branch cleanly without vendor lock-in or middleman
(OpenRouter was already reverted in 67239be — do NOT reintroduce it). Remove the dead NVIDIA block.

Purpose: Restore the two-provider fallback chain (Gemini → Claude) that Phase 11 always intended, so
that when Gemini's free tier rate-limits or errors, Claude takes over without the user noticing.

Output: Working multi-provider chain with native SDK per vendor, tests proving the env→provider mapping,
zero changes to action API contracts in convex/ai.ts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@convex/_ai/providers.ts
@convex/_ai/chat.ts
@convex/ai.ts
@package.json
@.env.example

<interfaces>
<!-- Current state of providers.ts (BROKEN — what we're fixing) -->

```typescript
// convex/_ai/providers.ts (CURRENT — broken)
export interface AIProvider {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  fastModel: string;
}

export function getProviders(): AIProvider[]
export function getProvider(): AIProvider
export function getClient(provider?: AIProvider): OpenAI  // <-- returns openai for EVERYTHING, broken for Claude
export function getModel(speed, provider?): string
```

<!-- Current state of chat.ts signatures (callers depend on these — must remain identical) -->

```typescript
// convex/_ai/chat.ts
export function safeParseJSON(text: string | undefined | null, _fallback?: any): any
export async function withRetry<T>(fn: (provider: AIProvider) => Promise<T>): Promise<T>
export async function chatJSON(prompt: string, model?: string): Promise<any>
export async function chatText(prompt: string, model?: string): Promise<string>
```

<!-- convex/ai.ts callsites (MUST remain byte-identical — 15+ usages) -->

```typescript
await chatJSON(prompt);
await chatJSON(prompt, getModel("fast"));
await chatText(prompt);
await chatText(prompt, getModel("fast"));
import { getModel } from "./_ai/providers";
import { chatJSON, chatText } from "./_ai/chat";
```

<!-- Anthropic Messages API shape we're targeting -->

```typescript
// @anthropic-ai/sdk (native)
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey });
const response = await client.messages.create({
  model: "claude-sonnet-4-5",         // CURRENT-GEN (not claude-sonnet-4-20250514 which is broken)
  max_tokens: 8192,                    // REQUIRED (OpenAI makes it optional — Anthropic does not)
  messages: [{ role: "user", content: prompt }],
  temperature: 0.3,
});
// response.content is an array: [{ type: "text", text: "..." }]
// Extract: const text = response.content[0]?.type === "text" ? response.content[0].text : "";
// Errors thrown by SDK carry .status (e.g. 429, 503) — compatible with existing withRetry logic
```
</interfaces>
</context>

<preflight_findings>

**Read the actual current state — deviations from task boundary:**

1. **`getProvider()` (singular) also exists** and is called by `getClient()` as a default. The task boundary
   only mentions `getClient()`. Planner decision: keep `getProvider()` (returns `getProviders()[0]`) — it's used
   nowhere else in the codebase (grep shows only providers.ts uses it internally), but it's cheap to keep for
   symmetry with `getModel()`. Actually — since `getClient()` is being removed/refactored, `getProvider()`
   becomes orphaned. **Decision: remove `getProvider()` too** since its only consumer was `getClient()`.

2. **`chatText()` exists and is used by** `convex/ai.ts` for `extractJobDescriptionFromURL` and
   `extractJobDescriptionFromPDF`. The task boundary says "chatJSON (and chat if it exists)" — confirmed
   `chat` is actually `chatText`. Both need the same protocol branching treatment.

3. **`chatJSON` has a 400 fallback path** that retries without `response_format: { type: "json_object" }`.
   This path is OpenAI-specific (Gemini sometimes rejects the response_format param). For the anthropic
   branch, there is no `response_format` at all (Messages API doesn't support it), so the fallback is
   unnecessary — prompt engineering handles JSON mode. The anthropic branch stays simple: single call, no
   400 retry.

4. **`withRetry` logs `provider.baseURL`** for error messages. The anthropic provider entry needs a `baseURL`
   field (or the log will say `undefined`) — keep `baseURL: "https://api.anthropic.com"` on the Anthropic
   entry for log symmetry, even though the SDK doesn't use it.

5. **`getClient()` signature**: currently `getClient(provider?: AIProvider): OpenAI`. Task boundary says
   "REMOVE getClient() entirely OR make it openai-only". Decision: **keep it, but narrow its contract** —
   rename internally to make it obvious it's openai-only. Actually simpler: **delete `getClient()` and
   inline `new OpenAI({...})` into the openai branch of `chatJSON`/`chatText`**. Only 2 callsites, both
   inside chat.ts. Cleaner than exporting two client factories.

6. **`max_tokens`**: task boundary suggests 4096 standard / 8192 long-form. The current openai path already
   uses 8192 uniformly. Decision: **use 8192 uniformly for Anthropic too** — matches existing behavior,
   no need to differentiate, well under Claude Sonnet 4.5's 64K output limit.

7. **Model IDs per constraint**: use `claude-sonnet-4-5` for defaultModel and `claude-haiku-4-5-20251001`
   for fastModel. Current broken state has `claude-sonnet-4-20250514` which is the pre-nl2 incorrect ID
   (confirmed dead). NOT using `claude-opus-4-6` — Sonnet 4.5 is the right quality/cost/speed tradeoff for
   a fallback path.

8. **`NVIDIA_API_KEY` env var**: after removing the block, if a user still has NVIDIA_API_KEY set in their
   Convex env, it will simply be ignored (no warning, no error). That's correct behavior.

9. **`package-lock.json`**: `npm install @anthropic-ai/sdk` will touch it. Must be in `files_modified`.

10. **No RESEARCH.md or CONTEXT.md** in the quick dir — task boundary is rich enough, no prior artifacts to
    honor. Proceeding directly to execution.

11. **Test scope deviation**: task boundary explicitly says NOT to test chat.ts protocol branching directly
    (SDK mocking out of scope). Planner agrees — providers.test.ts is sufficient regression coverage for
    the mapping logic. The chat.ts branching will be verified manually by the user in a Convex dev run
    post-deploy.

</preflight_findings>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Install @anthropic-ai/sdk + refactor providers.ts with protocol discriminant (TDD)</name>
  <files>
    package.json,
    package-lock.json,
    convex/_ai/providers.ts,
    convex/_ai/__tests__/providers.test.ts,
    .env.example
  </files>
  <behavior>
    Test file `convex/_ai/__tests__/providers.test.ts` (NEW) must assert:
    - Test 1: With only `GEMINI_API_KEY` set → `getProviders()` returns exactly 1 entry, `protocol === 'openai'`, `defaultModel === 'gemini-2.5-flash'`, `fastModel === 'gemini-2.5-flash'`, `baseURL` contains `generativelanguage.googleapis.com`
    - Test 2: With only `ANTHROPIC_API_KEY` set → `getProviders()` returns exactly 1 entry, `protocol === 'anthropic'`, `defaultModel === 'claude-sonnet-4-5'`, `fastModel === 'claude-haiku-4-5-20251001'`, `apiKey` matches the env value
    - Test 3: With both set → `getProviders()` returns 2 entries in order `[gemini, anthropic]` (Gemini first = priority 1)
    - Test 4: With neither set → `getProviders()` throws with message mentioning `GEMINI_API_KEY` AND `ANTHROPIC_API_KEY` (and NOT mentioning NVIDIA)
    - Test 5: With `NVIDIA_API_KEY` set alone (no Gemini, no Anthropic) → throws (NVIDIA ignored completely, no provider created)
    - Test 6: `getModel('fast', provider)` returns `provider.fastModel`, `getModel('default', provider)` returns `provider.defaultModel`
    - Setup/teardown: save/restore `process.env.GEMINI_API_KEY`, `process.env.ANTHROPIC_API_KEY`, `process.env.NVIDIA_API_KEY` in beforeEach/afterEach to avoid leakage between tests
  </behavior>
  <action>
    **Step 1 — Install dependency (NOT dev):**
    ```
    npm install @anthropic-ai/sdk
    ```
    Confirm `@anthropic-ai/sdk` appears in `dependencies` (not `devDependencies`) in package.json. npm picks the latest stable version (no pinned version — let semver ^ handle it).

    **Step 2 — Write RED test first** at `convex/_ai/__tests__/providers.test.ts`:
    - Import `{ describe, it, expect, beforeEach, afterEach }` from `vitest`
    - Import `{ getProviders, getModel }` from `../providers`
    - Use a `savedEnv` object to snapshot `{ GEMINI_API_KEY, ANTHROPIC_API_KEY, NVIDIA_API_KEY }` in beforeEach, restore in afterEach, and `delete` all three at the start of each test
    - Implement the 6 tests above
    - Run `npx vitest run convex/_ai/__tests__/providers.test.ts` → confirm RED (current providers.ts has no `protocol` field, test 1–2 fail on `.protocol` assertion, test 5 fails because NVIDIA still creates a provider)

    **Step 3 — GREEN: refactor `convex/_ai/providers.ts`:**
    - Remove `import OpenAI from "openai";` (no longer needed here)
    - Update `AIProvider` interface:
      ```typescript
      export interface AIProvider {
        protocol: 'openai' | 'anthropic';
        baseURL: string;        // kept for logging symmetry in withRetry
        apiKey: string;
        defaultModel: string;
        fastModel: string;
      }
      ```
    - Add a load-bearing comment above `getProviders()` explaining: "The `protocol` discriminant exists because Anthropic's native API uses the Messages API (`/v1/messages`) with a different request/response shape than OpenAI's chat-completions. chat.ts branches on this field to pick the right SDK. Do NOT attempt to unify under one baseURL-patched OpenAI client — that was attempted and returns 404 on api.anthropic.com/v1/chat/completions."
    - `getProviders()` body:
      - Gemini block: unchanged except add `protocol: 'openai'`
      - Claude block: set `protocol: 'anthropic'`, `baseURL: 'https://api.anthropic.com'` (for logs), `defaultModel: 'claude-sonnet-4-5'`, `fastModel: 'claude-haiku-4-5-20251001'`
      - **DELETE the entire NVIDIA block** (both the env read and the provider push)
      - Update empty-providers error message to: `"No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in Convex env vars (npx convex env set ...)."`
    - **DELETE `getProvider()` function** (unused after getClient removal — confirmed via grep earlier, only getClient used it)
    - **DELETE `getClient()` function** entirely — chat.ts will instantiate SDKs inline in the protocol branches
    - Keep `getModel()` unchanged (signature and body)
    - Run `npx vitest run convex/_ai/__tests__/providers.test.ts` → confirm GREEN (all 6 tests pass)

    **Step 4 — Update `.env.example`:**
    Append after the Gemini comment block:
    ```
    # Anthropic — Priority 2 fallback (Claude via native @anthropic-ai/sdk Messages API)
    # Get key at https://console.anthropic.com/settings/keys
    # npx convex env set ANTHROPIC_API_KEY <your-key>
    ```

    **Step 5 — Verify types:**
    ```
    npx tsc --noEmit
    ```
    Expected error: `chat.ts` will reference `getClient` which no longer exists. This is INTENTIONAL — task 2 fixes chat.ts. Do NOT fix it here, do NOT commit yet if the user wants atomic commits. Planner decision: **squash Task 1 + Task 2 into a single commit** at the end of Task 2 (they're mechanically atomic — providers.ts contract change requires matching chat.ts change). Leave providers.ts + tests + package.json + .env.example staged but uncommitted.
  </action>
  <verify>
    <automated>npx vitest run convex/_ai/__tests__/providers.test.ts</automated>
  </verify>
  <done>
    - `@anthropic-ai/sdk` in package.json `dependencies`
    - `convex/_ai/providers.ts` has `AIProvider.protocol` field, no NVIDIA block, no `getClient`, no `getProvider`
    - Claude models are `claude-sonnet-4-5` / `claude-haiku-4-5-20251001`
    - `providers.test.ts` passes all 6 tests (GREEN)
    - `.env.example` has Anthropic key comment
    - `npx tsc --noEmit` fails ONLY in chat.ts (expected — unblocks task 2)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Protocol-aware chat.ts + STATE.md update + atomic commit</name>
  <files>
    convex/_ai/chat.ts,
    .planning/STATE.md
  </files>
  <action>
    **Step 1 — Refactor `convex/_ai/chat.ts`:**

    Replace imports:
    ```typescript
    "use node";
    import OpenAI from "openai";
    import Anthropic from "@anthropic-ai/sdk";
    import { getProviders, getModel, type AIProvider } from "./providers";
    ```
    (Remove `getClient` from the import list — it no longer exists.)

    Keep `safeParseJSON` and `withRetry` unchanged — their signatures and logic are fine. `withRetry` will continue to log `provider.baseURL`, which is still present on both Gemini and Anthropic entries.

    **Replace `chatJSON`** with protocol-branched version:
    ```typescript
    export async function chatJSON(prompt: string, model?: string): Promise<any> {
      return withRetry(async (provider) => {
        const m = model || getModel("default", provider);

        if (provider.protocol === "anthropic") {
          // Anthropic Messages API: /v1/messages, different shape than OpenAI chat-completions.
          // - max_tokens is REQUIRED (not optional like OpenAI)
          // - response shape is { content: [{ type: "text", text: "..." }] } — extract [0].text
          // - JSON mode achieved via prompt engineering (existing prompts already say "Retourne UNIQUEMENT le JSON")
          // - No response_format param — Messages API doesn't support it
          const client = new Anthropic({ apiKey: provider.apiKey });
          const response = await client.messages.create({
            model: m,
            max_tokens: 8192,
            temperature: 0.3,
            messages: [{ role: "user", content: prompt }],
          });
          const first = response.content[0];
          const text = first && first.type === "text" ? first.text : "";
          return safeParseJSON(text);
        }

        // OpenAI-compatible path (Gemini). Unchanged behavior: try response_format first,
        // fall back on 400 (some Gemini models reject json_object format).
        const client = new OpenAI({ baseURL: provider.baseURL, apiKey: provider.apiKey });
        try {
          const response = await client.chat.completions.create({
            model: m,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 8192,
            response_format: { type: "json_object" },
          });
          return safeParseJSON(response.choices[0]?.message?.content);
        } catch (e: any) {
          if (e?.status === 400 || e?.message?.includes("400")) {
            const response = await client.chat.completions.create({
              model: m,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3,
              max_tokens: 8192,
            });
            return safeParseJSON(response.choices[0]?.message?.content);
          }
          throw e;
        }
      });
    }
    ```

    **Replace `chatText`** with protocol-branched version:
    ```typescript
    export async function chatText(prompt: string, model?: string): Promise<string> {
      return withRetry(async (provider) => {
        const m = model || getModel("default", provider);

        if (provider.protocol === "anthropic") {
          const client = new Anthropic({ apiKey: provider.apiKey });
          const response = await client.messages.create({
            model: m,
            max_tokens: 8192,
            temperature: 0.3,
            messages: [{ role: "user", content: prompt }],
          });
          const first = response.content[0];
          return first && first.type === "text" ? first.text : "";
        }

        const client = new OpenAI({ baseURL: provider.baseURL, apiKey: provider.apiKey });
        const response = await client.chat.completions.create({
          model: m,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 8192,
        });
        return response.choices[0]?.message?.content || "";
      });
    }
    ```

    **CRITICAL sanity check**: DO NOT change the exported signatures of `chatJSON` or `chatText`. DO NOT add any new exports. DO NOT touch `convex/ai.ts`. Grep to verify:
    ```
    grep -rn "chatJSON\|chatText" convex/ai.ts | wc -l
    ```
    Expected: same count before and after. Run before and after for comparison.

    **Step 2 — Update `.planning/STATE.md`:**

    In the "AI Provider Architecture" section (~line 52–56), replace:
    ```
    - Multi-provider with automatic fallback: Gemini → Claude → NVIDIA
    - Retry logic for 503/429 errors with exponential backoff
    - Provider priority: Gemini (free) > Claude (quality) > NVIDIA (fallback)
    ```
    with:
    ```
    - Multi-provider with automatic fallback: Gemini → Claude (via @anthropic-ai/sdk Messages API)
    - Retry logic for 503/429 errors with exponential backoff
    - Provider priority: Gemini (free tier) > Claude (native Anthropic SDK, Messages API)
    - NVIDIA removed 2026-04-11 (persistent 404, deprecated Llama 3.1 70B model, no fix path)
    - Protocol discriminant (`openai` | `anthropic`) on AIProvider enables per-vendor SDK without baseURL hacks
    ```

    In "Known Issues" (~line 87–89), update the Gemini line from:
    ```
    - Gemini free tier has strict rate limits from Convex servers
    ```
    to:
    ```
    - Gemini free tier has strict rate limits from Convex servers — Claude fallback now active via native SDK (quick 260411-rcg)
    ```

    Bump `last_updated` frontmatter to `"2026-04-11T<current-time>.000Z"` (use today's date).

    **Step 3 — Full verification suite:**
    ```
    npx tsc --noEmit
    npx vitest run
    npx vite build
    ```
    All three must pass. tsc should now pass (chat.ts fix resolved the task-1 break). vitest should run all tests including the new providers.test.ts (GREEN). vite build must succeed.

    **Step 4 — Atomic commit (squashes task 1 + task 2 changes):**

    The user wants "each task independently commitable" but task 1 left the repo in a type-broken state
    intentionally (providers.ts changed without chat.ts). The CLEANEST atomic commit is a single one that
    includes both provider refactor and chat.ts branching, since they're coupled by the removal of
    `getClient()`. Planner decision: **one commit for the whole fix**.

    ```
    git add package.json package-lock.json convex/_ai/providers.ts convex/_ai/chat.ts convex/_ai/__tests__/providers.test.ts .env.example .planning/STATE.md
    git status   # sanity check — no stray files
    git commit -m "$(cat <<'EOF'
    fix(ai): Claude fallback via native @anthropic-ai/sdk (Messages API)

    Replace broken openai-SDK-with-patched-baseURL approach (returned 404 on
    api.anthropic.com/v1/chat/completions) with the native @anthropic-ai/sdk
    Messages API. Add `protocol` discriminant to AIProvider so chat.ts branches
    per-vendor without vendor lock-in (OpenRouter middleman was already reverted
    in 67239be — this is the correct fix).

    Changes:
    - Add @anthropic-ai/sdk dependency
    - AIProvider.protocol: 'openai' | 'anthropic'
    - chatJSON/chatText branch on provider.protocol
    - Anthropic branch uses client.messages.create() with required max_tokens=8192
    - Map Messages API response shape (content[0].text) back to JSON parser
    - Update Claude model IDs to current-gen: claude-sonnet-4-5 / claude-haiku-4-5-20251001
    - Remove NVIDIA provider block (dead, deprecated Llama 3.1 70B, persistent 404)
    - Remove getClient() and getProvider() helpers (inlined in chat.ts)
    - New unit tests: convex/_ai/__tests__/providers.test.ts (env→provider mapping)
    - .env.example: document ANTHROPIC_API_KEY
    - STATE.md: reflect new two-provider chain

    Zero changes to convex/ai.ts — all action signatures and callsites remain
    byte-identical.

    Quick task: 260411-rcg
    EOF
    )"
    ```
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run && npx vite build</automated>
  </verify>
  <done>
    - `convex/_ai/chat.ts` has `provider.protocol === "anthropic"` branches in both chatJSON and chatText
    - `convex/ai.ts` is UNTOUCHED (`git diff HEAD~1 convex/ai.ts` shows no changes)
    - STATE.md reflects new two-provider chain, NVIDIA removal noted
    - `npx tsc --noEmit` passes (exit 0)
    - `npx vitest run` passes (all tests, including new providers.test.ts)
    - `npx vite build` passes
    - Single atomic commit created on master
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human verification — end-to-end Claude fallback via Convex dev</name>
  <what-built>
    - Claude provider now uses @anthropic-ai/sdk (Messages API) natively
    - Gemini remains primary, Claude is fallback on 503/429
    - NVIDIA removed from the chain
  </what-built>
  <how-to-verify>
    **Step A — Verify ANTHROPIC_API_KEY is set in Convex env (user already has it):**
    ```
    npx convex env list | grep -E "ANTHROPIC|GEMINI|NVIDIA"
    ```
    Expected: `ANTHROPIC_API_KEY` present (value hidden), `GEMINI_API_KEY` present. NVIDIA_API_KEY may or may not be present — it is now ignored regardless.

    If `ANTHROPIC_API_KEY` is missing (contrary to expectation), set it:
    ```
    npx convex env set ANTHROPIC_API_KEY sk-ant-...
    ```

    **Step B — Deploy Convex dev and exercise Claude path:**
    ```
    npx convex dev
    ```
    In a second terminal, run the app:
    ```
    npm run dev
    ```
    Open http://localhost:3000 and:
    1. Sign in (Clerk)
    2. Import a CV PDF or paste a LinkedIn export → should call `extractCVDataFromPDF` action → should succeed via Gemini (primary, no fallback triggered)
    3. To force the Claude path, temporarily unset Gemini in a third terminal:
       ```
       npx convex env set GEMINI_API_KEY "" --prod=false
       ```
       (Or just rename the key temporarily.) Then try importing again — it should now succeed via Claude (Messages API).
    4. Check Convex logs (`npx convex logs`) — should see no 404 errors on api.anthropic.com. Should see a JSON response from Claude.
    5. Restore Gemini key:
       ```
       npx convex env set GEMINI_API_KEY <original-value>
       ```

    **Step C — Smoke test cover letter (uses getModel("fast") → claude-haiku-4-5-20251001 on fallback):**
    With Gemini temporarily unset, open the editor, paste a job description, click "Generate cover letter". Should return a valid letter from Claude Haiku via Messages API.

    **Step D — Confirm no regressions:**
    With Gemini restored, all existing flows (extract, tailor, ATS analysis, bullet rewrite, keyword distribution) should behave identically to pre-fix.

    **Step E — Expected log lines (success criteria):**
    - No `404 status code` errors
    - No `api.anthropic.com/v1/chat/completions` URLs anywhere in logs
    - When fallback triggers, expect log: `AI provider https://generativelanguage.googleapis.com/v1beta/openai/ failed (...), trying next provider...`
    - Followed by successful Anthropic response
  </how-to-verify>
  <resume-signal>
    Reply "approved" if all steps pass. Reply with specific failure (command output + log excerpt) if anything breaks — planner will diagnose.
  </resume-signal>
</task>

</tasks>

<risks>

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| R1 | `@anthropic-ai/sdk` latest version has a breaking change vs. Messages API shape we expect | Low | SDK is stable since 2024; `messages.create` shape hasn't changed. If `response.content[0].type !== "text"` we return empty string which `safeParseJSON` catches with a clear error. Unit tests don't cover this (SDK not mocked) — task 3 manual verification catches it. |
| R2 | `max_tokens: 8192` exceeds Claude Haiku 4.5 limit or is too small for long-form cover letter | Very Low | Claude Haiku 4.5 supports 8192+ output tokens; Sonnet 4.5 supports 64K. 8192 is safe and matches existing openai path (no behavior regression). |
| R3 | Convex `"use node"` environment doesn't bundle `@anthropic-ai/sdk` correctly (ESM/CJS issue) | Low | Convex bundles node modules fine; @anthropic-ai/sdk ships both ESM and CJS. `npx vite build` + `npx convex dev` in task 3 will catch bundling issues immediately. Fallback: downgrade to `@anthropic-ai/sdk@0.30.x` if latest breaks. |
| R4 | `claude-sonnet-4-5` model ID is wrong (Anthropic rejected name) | Medium | Task boundary asserts these are current-gen IDs as of 2026-04. Task 3 manual verification detects immediately — if model 404s, planner swaps to `claude-sonnet-4-5-20250929` or whatever the dated variant is. Low blast radius: single string change. |
| R5 | `claude-haiku-4-5-20251001` doesn't exist (wrong date suffix) | Medium | Same as R4 — caught in task 3. Fallback to `claude-haiku-4-5` (undated) if dated form fails. |
| R6 | Removing `getClient` breaks a callsite we missed via grep | Very Low | Only chat.ts imports it (verified). tsc in task 2 verification step catches any other consumer. |
| R7 | `providers.test.ts` env var manipulation leaks into other test files running in the same vitest process | Low | beforeEach/afterEach save-restore pattern handles this. Vitest isolates test files by default but not suites within a file — our save-restore covers both cases. |
| R8 | User's Convex env actually does NOT have ANTHROPIC_API_KEY set (planner trusted user's assertion) | Low | Task 3 Step A verifies. If missing, user sets it — single command. Doesn't block the code change. |
| R9 | Gemini 400 fallback path in chat.ts gets dead-coded if Gemini starts accepting `response_format` consistently | Trivial | Not a regression — it's existing behavior preserved. Can be cleaned up in a future pass. |
| R10 | NVIDIA removal surprises a future contributor who assumes it's still available | Low | STATE.md explicitly notes the removal with date and rationale. Commit message is clear. |

</risks>

<rollback>

**If task 3 verification fails and the fix can't be quickly patched:**

Single-commit fix means single-commit rollback:
```
git revert HEAD
npm install   # restores package-lock.json to pre-install state
```

This restores the broken-but-known state (pre-260411-rcg). NVIDIA comes back, Claude fallback returns to 404. Then:
1. Diagnose the actual failure (likely a model ID issue — see R4/R5)
2. Re-plan with corrected model IDs
3. Re-apply

**Partial rollback (keep everything except one field):**
If only the model IDs are wrong, don't revert — just `git commit --fixup` a single-line change to providers.ts with the corrected ID. Tests still pass (they assert the string we set, not a network call).

</rollback>

<commit_plan>

**Single atomic commit** at end of task 2:

```
fix(ai): Claude fallback via native @anthropic-ai/sdk (Messages API)
```

Rationale for single commit (deviation from "each task independently commitable"):
- Task 1 (providers.ts refactor + tests) leaves the repo in a tsc-broken state intentionally (chat.ts still imports `getClient` which no longer exists).
- Task 2 (chat.ts refactor) fixes the break.
- Splitting them would require either (a) leaving a broken commit on master or (b) keeping dead `getClient` stub in task 1 just for the commit, then removing it in task 2 — both are worse than one atomic commit.

The commit is still atomic in the semantic sense: one logical change = one commit. Task 3 is human verification, no commit.

Files in the commit:
- package.json, package-lock.json
- convex/_ai/providers.ts
- convex/_ai/chat.ts
- convex/_ai/__tests__/providers.test.ts
- .env.example
- .planning/STATE.md

</commit_plan>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Convex action → Anthropic API | New outbound HTTPS call; API key from env crosses here |
| Convex action → Gemini API | Existing outbound HTTPS call; unchanged |
| User prompt → LLM | Existing user-controlled text flows into provider |

## STRIDE Register

| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|------------|
| T-rcg-01 | Information Disclosure | ANTHROPIC_API_KEY in process.env | mitigate | Key stored in Convex env vars (never in repo, never in .env.example value). `.env.example` only has the comment, not the key. `git ls-files \| grep env` audit. |
| T-rcg-02 | Information Disclosure | API key in client bundle | mitigate | `"use node"` directive ensures providers.ts runs server-side only. Vite cannot accidentally inline `process.env.ANTHROPIC_API_KEY` into client bundle because the file is not imported from any client module (verified: grep `providers.ts` usage → only convex/ files). |
| T-rcg-03 | Tampering | withRetry log injection via provider.baseURL | accept | `baseURL` is a hardcoded string in providers.ts, not user-controlled. No injection vector. |
| T-rcg-04 | Denial of Service | Retry storm against Anthropic | accept | withRetry attempts max 2 retries per provider, then fails. No exponential amplification. Anthropic rate-limits at their edge. |
| T-rcg-05 | Spoofing | Malicious prompt injection via user CV/JD | transfer | Existing issue, not introduced by this fix. Anthropic's content filters are at least as strong as Gemini's. Prompt engineering in existing `buildExtractPrompt` etc. unchanged. |
| T-rcg-06 | Elevation of Privilege | @anthropic-ai/sdk supply chain | mitigate | Official Anthropic package, well-maintained, signed npm publishes. `npm install` resolves to latest semver ^. Accept transitive risk (same model as openai SDK). `package-lock.json` locks the exact resolved version. |
| T-rcg-07 | Information Disclosure | Error messages leaking API key | mitigate | SDK errors include status codes and messages but NOT the Authorization header. withRetry only logs `provider.baseURL` (public URL). No `provider.apiKey` in any log statement. |

</threat_model>

<success_criteria>

All of the following must be true:

1. **Type check**: `npx tsc --noEmit` exits 0
2. **Tests**: `npx vitest run` passes, including all 6 new `providers.test.ts` tests
3. **Build**: `npx vite build` exits 0
4. **Code changes**:
   - `@anthropic-ai/sdk` is in `dependencies` of package.json (not devDependencies)
   - `convex/_ai/providers.ts` exports `AIProvider` with `protocol: 'openai' | 'anthropic'` field
   - NVIDIA block is deleted (no `NVIDIA_API_KEY` read, no `integrate.api.nvidia.com` string)
   - Claude models are `claude-sonnet-4-5` (default) and `claude-haiku-4-5-20251001` (fast)
   - `getClient()` and `getProvider()` are deleted from providers.ts
   - `convex/_ai/chat.ts` branches on `provider.protocol === 'anthropic'` in both `chatJSON` and `chatText`
   - `convex/ai.ts` is untouched (`git diff HEAD~1 convex/ai.ts` empty)
5. **STATE.md** reflects the new two-provider chain with NVIDIA removal dated
6. **.env.example** documents `ANTHROPIC_API_KEY`
7. **Commit**: single atomic commit with descriptive message, all files included
8. **Human verification (task 3)**: user confirms end-to-end Claude fallback works via Convex dev, no 404s in logs

</success_criteria>

<output>
After task 2 completes, no SUMMARY.md needed for quick tasks. Task 3 human verification closes the quick task. If task 3 surfaces a fix, planner re-engages with a patch commit on top.
</output>
