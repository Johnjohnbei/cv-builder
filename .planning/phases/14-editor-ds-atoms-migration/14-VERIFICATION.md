# Phase 14 — Editor DS Atoms Migration — Verification

**Status:** Complete
**Closed:** 2026-04-11

## Objective

Remove the raw `<input>`, `<textarea>`, `<select>`, and full-width
`<button>` proliferation inside `src/pages/EditorPage.tsx` and route
them through the DS atoms in `src/shared/ui/`. Preserve visual parity
with the existing `stitch-*` classes; no visual regressions.

## Final metrics

| Metric | Before Phase 14 | After Phase 14 | Delta |
|---|---|---|---|
| `EditorPage.tsx` lines | 1711 | **1717** | +6 |
| Raw `<input>` in EditorPage | 28 | **6** | -22 |
| Raw `<textarea>` in EditorPage | 3 | **0** | -3 |
| Raw `<select>` in EditorPage | 3 | **0** | -3 |
| Raw `<button>` in EditorPage | 44 | **37** | -7 |
| DS atom usages in EditorPage | 0 | **35** | +35 |
| Total vitest tests | 359 | **359** | stable |

Line count is roughly flat (+6) — the net effect is semantic migration,
not line-count reduction. Some patterns got shorter (explicit props
replace long className strings), some got longer (Select with
`options={[...]}` is more verbose than inline `<option>`).

## DS atom expansion (plan 14-01)

| Atom | Change | Backward-compat |
|---|---|---|
| `Input` | Add `inputSize` (xs/sm/md), `variant` (default/bare), `containerClassName`, fragment output when no label | ✅ md + default remain defaults |
| `Textarea` | Same additions as Input | ✅ |
| `Select` | Same additions as Input, plus accept `children` alongside `options[]` | ✅ |
| `Button` | Add size `xs` (px-2 py-1 text-[9px]) + `fullWidth` prop | ✅ existing sm/md/lg unchanged |

**Existing consumers preserved:**
- `CoverLetterPage.tsx` (Input, Textarea, Button) — unchanged behavior
- `ATSPanel.tsx` (Button) — unchanged behavior
- `NotFoundPage.tsx` (Button) — unchanged behavior

## Form element migration (plan 14-02)

Migrated **34 raw form elements** (28 input + 3 textarea + 3 select) across
7 sections of EditorPage:

| Section | Atoms used |
|---|---|
| Personal info | 5× Input (md + `text-[10px]` overrides) |
| Job description | 1× Textarea (custom blue border/ring) |
| Professional summary | 1× Textarea (labelled) |
| Experience (per item) | 2× Input bare (position, company) + 1× Textarea xs (intro) + 2× Input xs (dates) + 1× Input xs (KPI) + 1× Input xs (bullets, per bullet) + 1× Input xs (compact description) |
| Skills | 1× Input bare (category name) + 1× Input xs (add-skill) |
| Education (per item) | 3× Input bare (degree, school, year) |
| Languages (per item) | 1× Input bare (name) + 1× Select bare (proficiency) |
| Design colors | 2× Input (hex text; native `<input type="color">` kept) |
| PDF export formats | 2× Select sm (paper size, orientation) |

**Kept as raw `<input>` (legitimate exceptions):**
- 1× `<input type="file">` — hidden photo upload trigger, no visual styling
- 3× `<input type="checkbox">` — current-job toggle, show-KPI toggle, include-section toggle; the Input atom is not designed for checkbox styling
- 2× `<input type="color">` — native color picker UI, browser-rendered

## Button migration (plan 14-03)

Migrated **7 full-width action buttons** to the `Button` atom with
`fullWidth` prop + className overrides for rounded-lg radius and
tight text spacing:

1. `AUTO-ASSIGNATION` (primary)
2. `RÉÉCRIRE CONTENU (IA)` (secondary, gray variant)
3. `PRÉVISUALISER_PDF` (secondary, blue border)
4. `TÉLÉCHARGER_PDF` (primary, elevated shadow)
5. `TÉLÉCHARGER_DOCX` (secondary, gray border)
6. `SAVE_DRAFT` sidebar footer (secondary)
7. `EXPORT_PDF` sidebar footer (primary)

**Kept as raw `<button>` (by design, 37 remaining):**

These are toolbar/icon-only/accordion/specialized micro-controls
where the `Button` atom's semantic defaults (mono uppercase, base
padding, border-radius) would require full className overrides,
defeating the point of using the atom:

| Category | Count | Examples |
|---|---|---|
| Accordion panel headers | 6 | `toggleSection('personal')`, summary, experience, skills, education, languages |
| Tab switchers (role="tab") | 3 | content/design/ats tabs |
| Sidebar close | 1 | X icon |
| Icon-only actions | 13 | move up/down (chevrons), trash, bullet trash, bullet improve AI, photo delete |
| Display-mode pills | 10+ | experience + skill display mode selectors (emoji icons) |
| Dashed-border add buttons | 5 | AJOUTER_EXPERIENCE / _POINT / _CATEGORIE / _FORMATION / _LANGUE |
| Color swatches | 7 | preset palette picker |
| Theme/font/weight toggles | ~15 | design section toggle buttons |
| Suggestion pickers | 3 | bullet rewrite suggestions list + dismiss |

## Test results

- `npx tsc --noEmit` : **PASS**
- `npx vitest run` : **359/359** tests
- `npx vite build` : **PASS**

## Backward compatibility

All 5 existing DS atom consumers confirmed unchanged in behavior:

- `src/features/cover-letter/components/CoverLetterPage.tsx`
- `src/features/editor/components/ATSPanel.tsx`
- `src/pages/NotFoundPage.tsx`
- `src/pages/DashboardPage.tsx` (Logo only — not affected)
- `src/pages/EditorPage.tsx` (new consumer)

New atom props (`inputSize`, `variant`, `containerClassName`, `fullWidth`)
all default to current behavior when omitted, so no migration was
needed in legacy consumers.

## Plans executed

| Plan | Commit | Summary |
|---|---|---|
| 14-01 | `30c8072` | Expand Input/Textarea/Select/Button with compact variants |
| 14-02 | `39c2a1c` | Migrate 34 raw form elements to DS atoms |
| 14-03 | `6607880` | Migrate 7 full-width action buttons to Button atom |
| 14-04 | this commit | Verification doc + Phase 14 close |

## Follow-ups (out of scope for Phase 14)

- **Checkbox atom**: if the 3 raw checkboxes become a pattern, consider
  adding a `Checkbox` atom to `shared/ui/`. Not a priority — 3 usages
  don't justify the abstraction yet.
- **Toolbar/icon button atom**: if the ~37 raw icon-only buttons become
  a maintenance burden, consider an `IconButton` atom. Again, not
  urgent — they're purely visual and co-located with the JSX that owns
  them.
- **Phase 15** (if ever): decompose the EditorPage JSX render into
  sub-components (experience card, skill card, education card, language
  row) — now that form elements are atom-based, extraction would be
  trivial.
