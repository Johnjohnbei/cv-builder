---
phase: 1
slug: refactoring-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vite.config.ts` (test section embedded) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | REFAC-05 | unit | `npx vitest run src/features/editor/lib/formatting.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | REFAC-05 | unit | `npx vitest run src/features/editor/lib/scoring.test.ts` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 2 | REFAC-02 | unit | `npx vitest run src/features/editor/lib/atsRules.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | REFAC-01 | unit | `npx vitest run src/features/editor/lib/scoring.test.ts -t "keyword"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/editor/lib/formatting.test.ts` — move formatDateShort and normalizeProficiency tests from scoring.test.ts
- [ ] `src/features/editor/lib/atsRules.test.ts` — smoke test that all exports exist and have expected shapes
- [ ] `src/features/editor/lib/scoring.test.ts` — add tests for word-boundary matching (Java vs JavaScript), add tests for exported helpers

*These are created as part of Plan 01-01 Task 1 and Plan 01-02 Task 1.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-09
