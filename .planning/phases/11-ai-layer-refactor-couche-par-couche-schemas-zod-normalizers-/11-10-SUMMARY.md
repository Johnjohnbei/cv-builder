# Plan 11-10 — SUMMARY

**Status:** Complete
**Plan:** [11-10-PLAN.md](./11-10-PLAN.md)

## What shipped

`generateCoverLetter` now uses `buildCoverLetterPrompt` and validates every
response against `CoverLetterSchema`. Last unvalidated AI action closed.

## Files created

- `convex/_ai/prompts/coverLetter.ts` — `buildCoverLetterPrompt` + `CoverLetterContext`
- `convex/_ai/__tests__/prompts/coverLetter.test.ts` — 6 specs

## Files modified

- `convex/ai.ts`:
  - Added imports for builder + `CoverLetterSchema`
  - `generateCoverLetter` handler reduced to ~20 lines, schema-validated
  - Explicit return-object construction to avoid Zod passthrough + inferred-optional pitfall (see deviation below)
  - Inline prompt deleted
- `convex/_ai/schemas.ts`:
  - `CoverLetterSchema` fields switched from `.string().default("")` to `.string()` — if AI omits a field it should fail loudly since cover letter text is user-facing

## Metrics

- `convex/ai.ts` line count: **360 → 349** (-11 lines)
- Schema-validated actions: **6/10** (all 6 JSON-returning actions now validated)
- Action exports preserved: **10**

## Test results

| Check | Before | After |
|---|---|---|
| Vitest tests | 277 | **283** (+6) |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vite build` | PASS | PASS |

## API surface

`CoverLetterPage.tsx` — untouched. `api.ai.generateCoverLetter` contract stable.

## Deviation — TS inference pitfall

Convex infers the action's return type from the handler. With Zod's
`.passthrough()` catchall, `z.infer<typeof CoverLetterSchema>` resolves to
`{...} & { [k: string]: unknown }`, and the TS checker then marked all four
fields as optional at the frontend call site, breaking
`CoverLetterPage.tsx:56`.

**Fix:** Instead of `return parsed.data`, explicitly reconstruct the return
object `{ subject, greeting, body, closing }`. This gives Convex a concrete,
non-passthrough shape matching the frontend's `CoverLetterData` interface.

**Side-fix in schemas.ts:** Switched from `.string().default("")` to plain
`z.string()` for the cover letter fields. The `.default` had made individual
fields optional in the inferred type; required strings are actually the right
contract here because an empty greeting/closing in a user-facing letter is a
data bug we want to throw on.

## Commit

(filled at commit time)
