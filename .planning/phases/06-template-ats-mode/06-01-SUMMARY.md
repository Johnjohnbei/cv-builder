---
phase: 06-template-ats-mode
plan: 01
subsystem: editor
tags: [ats-mode, toggle, auto-switch, design-settings]
dependency_graph:
  requires: []
  provides: [atsMode-field, ats-toggle-ui, auto-switch-logic]
  affects: [templates, editor-header, editor-page]
tech_stack:
  added: []
  patterns: [state-callback-pattern, immutable-settings-update]
key_files:
  created: []
  modified:
    - src/shared/types/index.ts
    - src/features/editor/lib/atsRules.ts
    - src/features/editor/components/EditorHeader.tsx
    - src/pages/EditorPage.tsx
decisions:
  - TEMPLATE_A classified as 'full' (simple layout, easy ATS conversion)
  - preAtsTemplate state tracks original template for restoration on ATS deactivation
metrics:
  duration: 137s
  completed: 2026-04-09
---

# Phase 06 Plan 01: ATS Mode Toggle & Auto-Switch Summary

atsMode boolean on DesignSettings with EditorHeader toggle, auto-switching limited templates (D,F) to TemplateA and restoring on deactivation.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add atsMode to types and update atsRules classifications | bc1a201 | src/shared/types/index.ts, src/features/editor/lib/atsRules.ts |
| 2 | Add ATS toggle to EditorHeader and implement auto-switch + warning in EditorPage | 72007b9 | src/features/editor/components/EditorHeader.tsx, src/pages/EditorPage.tsx |

## Changes Made

### Task 1: Types & atsRules
- Added `atsMode?: boolean` field to `DesignSettings` interface after `includedSections`
- Updated `TEMPLATE_ATS_COMPAT` classifications: A,B,C,E = 'full', D,F = 'limited' (per D-06)
- Exported `ATS_FALLBACK_TEMPLATE = 'TEMPLATE_A'` constant (per D-07)

### Task 2: Toggle UI & Auto-Switch Logic
- Added `atsMode` and `onAtsModeChange` props to EditorHeader
- Added ATS ON/OFF toggle button in center toolbar after LanguageSelector
- Implemented `handleAtsModeChange` in EditorPage:
  - ON + limited template: saves current template, auto-switches to TemplateA, shows success notification
  - ON + full template: just sets atsMode to true
  - OFF + saved template: restores original template and shows warning
  - OFF + no saved template: just sets atsMode to false and warns

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes with no errors
- `npx vite build` succeeds

## Known Stubs

None - all data flows are wired and functional.

## Self-Check: PASSED
