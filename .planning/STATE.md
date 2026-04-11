---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Milestone complete
last_updated: "2026-04-11T15:10:00.000Z"
progress:
  total_phases: 11
  completed_phases: 10
  total_plans: 18
  completed_plans: 18
  percent: 91
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** Les CV generes par Calibre doivent passer les filtres ATS avec le meilleur score possible tout en restant visuellement professionnels
**Current focus:** Phase 11 — PDF Export Engine

## Current Position

Phase: 11
Plan: Not started
All 10 phases complete. Post-milestone work in progress:

- AI provider architecture (multi-provider with fallback)
- Prompt quality improvements
- PDF page break fixes
- Job description flow (dashboard → editor)

## Milestone v1.0 — ATS Conformity (COMPLETE)

| Phase | Name | Status |
|-------|------|--------|
| 1 | Refactoring Foundation | Complete |
| 2 | Language Detection | Complete |
| 3 | Section Standards | Complete |
| 4 | ATS Scoring Engine | Complete |
| 5 | Keywords & Matching | Complete |
| 6 | Template ATS Mode | Complete |
| 7 | Skills Categorization | Complete |
| 8 | ATS Panel UI | Complete |
| 9 | AI Content Optimization | Complete |
| 10 | PDF Validation | Complete |

## Post-Milestone Changes (2026-04-09)

### AI Provider Architecture

- Multi-provider with automatic fallback: OpenRouter (priority 1) → Gemini direct (fallback)
- Retry logic for 503/429 errors with exponential backoff
- Provider priority: OpenRouter (unified OpenAI-compat gateway to Claude/GPT/Gemini/Llama) > Gemini direct (free-tier emergency)
- Claude direct and NVIDIA NIM retired 2026-04-11 (260411-nl2): Anthropic native API is
  not OpenAI-compatible (uses /v1/messages, not /chat/completions — protocol mismatch
  causes 404), and NVIDIA NIM endpoint returned persistent 404 for the configured model.
  OpenRouter provides access to both Claude and Llama via a single OpenAI-compatible
  endpoint, so the legacy direct configs were removed rather than fixed.

### Prompt Improvements

- Language-aware prompts (FR/EN detection from JD or CV)
- Stronger verb guidance with concrete examples
- Fabrication guard on all AI outputs
- Reduced prompt size ~50% by stripping non-content fields

### UX Fixes

- Job description transmitted from dashboard to editor automatically
- JD displayed as read-only in editor when imported
- ATS tab auto-opens when JD is loaded
- Accessibility audit: 14 fixes across 8 files

### PDF Layout

- Removed overflow:hidden on print clone
- break-inside:avoid only on individual blocks (not sections)
- Section headers protected from orphaning

## Quick Tasks Completed

| ID | Date | Description | Commits |
|----|------|-------------|---------|
| 260411-m24 | 2026-04-11 | Inline cover letter generation in editor (drawer + cvId linking) | 74b4c1e, d782b69, 12a3fc6 |
| 260411-mij | 2026-04-11 | Auto-extract company name from JD and pre-fill cover letter drawer (Phase A logo roadmap) | d90e5b0, e5392a0 |
| 260411-nl2 | 2026-04-11 | Replace broken Claude/NVIDIA providers with OpenRouter priority 1 + Gemini fallback | 6a7123f, 43bcbc7 |

## Known Issues

- PDF multi-column layout imperfect on fallback path (window.print used only when serverless Puppeteer fails)
- EditorPage.tsx is ~1740 lines (above 400-line guideline — known, accepted scope)
- AI features require `OPENROUTER_API_KEY` set in Convex env (`npx convex env set OPENROUTER_API_KEY <key>`); `GEMINI_API_KEY` remains as fallback

## Accumulated Context

### Roadmap Evolution

- Phase 11 added: AI Layer Refactor — couche par couche, schemas Zod, normalizers unifiés, tests exhaustifs
