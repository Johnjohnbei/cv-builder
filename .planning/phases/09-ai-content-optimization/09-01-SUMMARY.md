---
phase: 09-ai-content-optimization
plan: 01
subsystem: editor
tags: [weak-bullet, detection, regex, tdd, fr-en]

requires: []
provides:
  - "analyzeWeakBullets() pure function for detecting weak CV bullets"
  - "WeakBulletResult and WeakBulletIssue exported types"
affects: [09-03 EditorPage integration, UI badges for weak bullets]

tech-stack:
  added: []
  patterns: [regex-based text analysis with Unicode-safe word boundaries for French]

key-files:
  created:
    - src/features/editor/lib/weakBulletDetection.ts
    - src/features/editor/lib/weakBulletDetection.test.ts
  modified: []

key-decisions:
  - "Used (?:^|\\W) and (?:\\W|$) instead of \\b for French accented characters since JS regex \\b does not support Unicode word boundaries"
  - "Labels in French for tooltip display consistency with app language"
  - "Detection order: too-short, weak-verb, no-metrics, passive-voice, too-vague"

patterns-established:
  - "Unicode-safe regex boundaries: use (?:^|\\W) prefix and (?:\\W|$) suffix for patterns containing accented characters (e, a, etc.)"

requirements-completed: [AICV-03]

duration: 3min
completed: 2026-04-09
---

# Phase 9 Plan 1: Weak Bullet Detection Summary

**Pure client-side utility detecting 5 issue types (weak verbs, missing metrics, passive voice, too short, too vague) in FR/EN CV bullets with 18 passing tests**

## What Was Built

Created `weakBulletDetection.ts` (129 lines) — a pure function that analyzes CV experience bullets and flags weak patterns:

- **weak-verb**: Detects 17 weak verb patterns across FR and EN (responsable de, worked on, helped, managed, etc.)
- **no-metrics**: Flags bullets with no digits (quantified results expected)
- **passive-voice**: Detects FR passive markers (a ete, ont ete, etait) and EN (has been, was done, were made)
- **too-short**: Bullets under 20 characters
- **too-vague**: Vague terms (diverses taches, various tasks, etc., plusieurs projets, various projects)

Hidden experiences are skipped. Each result includes expIndex, bulletIndex, and issues array with French labels.

## TDD Execution

| Phase    | Commit   | Tests |
| -------- | -------- | ----- |
| RED      | fc057f9  | 18 failing (module not found) |
| GREEN    | 582567f  | 18 passing |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Unicode word boundary handling for French accented characters**
- **Found during:** GREEN phase
- **Issue:** JavaScript `\b` word boundary does not recognize accented characters (e, a, etc.) as word characters, causing patterns like `participé à`, `aidé`, `géré`, `a été` to fail matching
- **Fix:** Replaced `\b` with `(?:^|\W)` prefix and `(?:\W|$)` suffix for all French patterns containing accented characters
- **Files modified:** src/features/editor/lib/weakBulletDetection.ts
- **Commit:** 582567f

**2. [Rule 1 - Bug] Fixed etc. regex trailing word boundary**
- **Found during:** GREEN phase
- **Issue:** `\betc\.\b` failed because period is not a word character, so trailing `\b` never matches
- **Fix:** Changed to `\betc\./i` (dropped trailing `\b`)
- **Files modified:** src/features/editor/lib/weakBulletDetection.ts
- **Commit:** 582567f

## Verification

```
npx vitest run src/features/editor/lib/weakBulletDetection.test.ts -> 18 passed
npx tsc --noEmit -> clean (no errors)
File size: 129 lines (under 150 limit)
Test file: 174 lines (above 60 minimum)
```

## Known Stubs

None - all detection logic is fully implemented with no placeholders.

## Self-Check: PASSED

- [x] weakBulletDetection.ts exists
- [x] weakBulletDetection.test.ts exists
- [x] 09-01-SUMMARY.md exists
- [x] Commit fc057f9 (RED) verified
- [x] Commit 582567f (GREEN) verified
