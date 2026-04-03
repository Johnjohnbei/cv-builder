# KNOWLEDGE — CV Builder (Calibre)

## Architecture

- **Frontend** : React + Vite + Tailwind v4 (utilise oklch par défaut)
- **Auth** : Clerk (instance dev `improved-mayfly-32`, JWT template "convex" configuré)
- **Backend** : Convex (dev: `necessary-bobcat-348`, prod: `cautious-mule-560`)
- **IA** : Google Gemini via `@google/genai` (Pro pour extraction/optimisation, Flash pour analyse ATS et pagination)
- **PDF** : `html2canvas-pro` + `jspdf` (html2canvas-pro = fork supportant oklch)
- **Deploy** : Vercel (https://cv-builder-indol-three.vercel.app)

## Architecture éditeur (couches)

### Couche 1 — Logique pure (`src/features/editor/lib/`)
- `displayModes.ts` : `getVisibleBullets()`, `isHidden()`, `isCompact()`, `shouldShowKPI()`, `DISPLAY_MODES[]`
- `pdfExport.ts` : export PDF avec page breaks aux frontières de blocs DOM

### Couche 2 — Templates (`src/features/editor/templates/`)
- `shared.tsx` : `TemplateProps`, helpers communs (fonts, sections, photo)
- `TemplateA.tsx` : Template Classic — layout conditionnel 1-page (grid) / multi-page (grid + full-width)
- `CVRenderer.tsx` : routeur qui sélectionne le bon template
- Templates B-F : encore inline dans `EditorPage.tsx` (legacy), à extraire progressivement

### Couche 3 — Page éditeur (`src/pages/EditorPage.tsx`)
- Sidebar avec contrôles de mode (hidden/compact/normal/extended), réordonnement, KPI
- Détection de débordement en temps réel (`scrollHeight > clientHeight`)
- Sélecteur de pages 1-4

### Règle d'architecture
- **Le rendu/layout/pagination = logique pure, zéro IA.** L'IA ne touche que le contenu textuel.
- Chaque template gère son propre layout conditionnel (1-page vs multi-page).
- `displayModes.ts` est la source unique de vérité pour les modes d'affichage.

## Système de blocs modulables

Chaque expérience a un `displayMode` :
| Mode | Bullets | KPI | Rendu |
|------|---------|-----|-------|
| `hidden` | 0 | Non | Masqué du CV, visible barré dans la sidebar |
| `compact` | 1 | Non | Titre + entreprise + 1 ligne |
| `normal` | 2 | Non | Titre + entreprise + 2 bullets |
| `extended` | 5 | Oui | Titre + entreprise + 5 bullets + KPI chiffré |

Chaque catégorie de compétences a un `displayMode` :
| Mode | Items | Rendu |
|------|-------|-------|
| `hidden` | 0 | Masquée du CV |
| `compact` | Top 3 | Catégorie + 3 premiers items |
| `normal` | Tous | Catégorie + tous les items |

## Règles apprises

- `html2canvas` ne supporte PAS oklch (Tailwind v4 default). Utiliser `html2canvas-pro` à la place.
- Convex `npx convex logs` hang indéfiniment sur Windows — ne jamais l'utiliser.
- Les env vars Convex doivent être configurées séparément pour dev ET prod.
- Les prompts IA doivent explicitement interdire la suppression de données ("NE SUPPRIME JAMAIS").
- Le conteneur CV doit avoir `overflow: hidden` + hauteur fixe (`pageLimit × 297mm`) pour simuler les feuilles A4.
- Pour l'export PDF, déverrouiller temporairement le conteneur avant html2canvas puis restaurer.
- Le layout grid 2 colonnes ne fonctionne bien que sur 1 page. Pour multi-page, les expériences passent en full-width.
- Template A : layout conditionnel — `pageLimit === 1` → grid classique, `pageLimit > 1` → sidebar en haut + expériences full-width.

## Déploiements

| Service | Dev | Prod |
|---------|-----|------|
| Convex | `necessary-bobcat-348` | `cautious-mule-560` |
| Vercel | — | `cv-builder-indol-three.vercel.app` |
| Clerk | `improved-mayfly-32` (dev keys) | À migrer |

## Prochaines étapes

- Extraire Templates B-F dans des fichiers séparés (même pattern que TemplateA.tsx)
- Ajouter displayMode sur les compétences (skill categories)
- Scoring de pertinence par rapport à une offre d'emploi (logique pure côté client)
- Ajouter un champ "offre d'emploi" dans l'éditeur pour alimenter le scoring
