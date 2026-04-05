# KNOWLEDGE — CV Builder (Calibre)

## Architecture

- **Frontend** : React + Vite + Tailwind v4 (utilise oklch par défaut)
- **Auth** : Clerk (instance dev `improved-mayfly-32`, JWT template "convex" configuré)
- **Backend** : Convex (dev: `necessary-bobcat-348`, prod: `cautious-mule-560`)
- **IA** : NVIDIA NIM (Llama 3.1 70B) via OpenAI-compatible SDK, fallback Gemini
- **PDF** : Export via iframe + `window.print()` (navigateur natif, WYSIWYG garanti)
- **Deploy** : Vercel (https://cv-builder-indol-three.vercel.app) + Convex auto-deploy via `CONVEX_DEPLOY_KEY`

## Architecture éditeur (3 couches)

### Couche 1 — Logique pure (`src/features/editor/lib/`)

Zéro React, zéro DOM, zéro IA. Fonctions pures testables unitairement.

| Fichier | Responsabilité |
|---------|---------------|
| `displayModes.ts` | `getIntro()`, `getActionBullets()`, `isHidden()`, `isCompact()`, `shouldShowKPI()`, `getVisibleSkills()`, `isSkillHidden()`, `DISPLAY_MODES[]`, `SKILL_DISPLAY_MODES[]` |
| `scoring.ts` | `scoreExperience()`, `autoAssignModes()`, `extractKeywords()`, `formatDateShort()`, `normalizeProficiency()` |
| `autoFit.ts` | `condenseOneStep()` — condense le bloc le moins prioritaire d'un cran |
| `pdfExport.ts` | `renderPDF()` — iframe + window.print() pour export WYSIWYG |

### Couche 2 — Templates (`src/features/editor/templates/`)

Chaque template = un fichier autonome. Consomme la couche 1 via imports.

| Fichier | Template | Layout |
|---------|----------|--------|
| `shared.tsx` | — | `TemplateProps`, `renderPhoto()`, `renderExperienceContent()`, helpers |
| `CVRenderer.tsx` | — | Routeur → sélectionne le bon template par nom |
| `TemplateA.tsx` | Classic | Grid 2/3 + 1/3, sidebar droite |
| `TemplateB.tsx` | Modern | Sidebar colorée gauche 1/3, contenu droit 2/3 |
| `TemplateC.tsx` | Minimal | Centré, serif, dates à gauche |
| `TemplateD.tsx` | Creative | Playfair italic, header coloré, grid inversé |
| `TemplateE.tsx` | Elegant | Outfit font, timeline dots, lignes décoratives |
| `TemplateF.tsx` | Sidebar | Sidebar fixe 260px gauche, contenu droit |

### Couche 2.5 — Hooks & Composants éditeur (`src/features/editor/hooks/`, `src/features/editor/components/`)

| Fichier | Responsabilité |
|---------|---------------|
| `hooks/useCVLoader.ts` | Chargement initial depuis Convex/localStorage, auto-assign des displayModes |
| `hooks/useAutoZoom.ts` | Zoom automatique du preview pour remplir le container |
| `hooks/useOverflowDetection.ts` | Détection overflow + boucle auto-fit |
| `components/EditorHeader.tsx` | Header avec breadcrumb, zoom controls, save/export |
| `components/EditorNotification.tsx` | Toast notifications éditeur |
| `components/OverflowIndicator.tsx` | Indicateur vert/rouge de taille page |
| `components/TemplateConfirmModal.tsx` | Modale de confirmation changement template |

### Couche 3 — Orchestration (`src/pages/EditorPage.tsx`)

Contrôles sidebar, état React, utilise les hooks de la couche 2.5.

## Système de blocs modulables

### Expériences (`displayMode`)

| Mode | Intro | Bullets | KPI | Rendu |
|------|-------|---------|-----|-------|
| `hidden` | — | — | — | Masqué du CV, visible barré dans la sidebar |
| `compact` | ✅ | 0 | — | Titre + entreprise + intro seule |
| `normal` | ✅ | 2 | — | Titre + entreprise + intro + 2 bullet points |
| `extended` | ✅ | 4 | ✅ | Titre + entreprise + intro + 4 bullets + KPI chiffré |

### Compétences (`displayMode`)

| Mode | Items | Rendu |
|------|-------|-------|
| `hidden` | 0 | Masquée du CV |
| `compact` | Top 3 | Catégorie + 3 premiers items |
| `normal` | Tous | Catégorie + tous les items |

### Structure Experience

```typescript
interface Experience {
  company: string;
  position: string;
  start_date: string;
  end_date?: string;
  current: boolean;
  intro?: string;           // Description du rôle (toujours visible sauf hidden)
  description: string[];    // Bullet points d'action (selon displayMode)
  kpi?: string;             // Résultat chiffré (extended uniquement)
  displayMode?: 'hidden' | 'compact' | 'normal' | 'extended';
}
```

## Auto-fit — Boucle d'ajustement automatique

Quand le contenu déborde de la page :

1. **Auto-assign initial** : `autoAssignModes()` assigne les modes par budget pages
   - 1 page : max 4 visibles (1 extended + 1 normal + 2 compact)
   - 2 pages : max 8 visibles
   - 3-4 pages : max 12 visibles
2. **Auto-fit loop** : mesure `scrollHeight > clientHeight` → `condenseOneStep()` → itère
   - Alterne entre condensation expériences et compétences
   - Ne masque jamais la dernière expérience visible
   - Ne masque jamais la dernière catégorie de compétences visible
   - Max 50 itérations (safety limit)
3. **Re-assign on page change** : 1→2 pages = relance auto-assign avec budget élargi

## Scoring de pertinence

Logique pure (pas d'IA) dans `scoring.ts` :

- **Récence** : poste actuel = 100, < 1 an = 95, < 3 ans = 80, etc.
- **Pertinence** : keyword matching avec l'offre d'emploi (si fournie)
- **Durée** : ≥ 5 ans = 90, ≥ 3 ans = 70, etc.
- **Score final** : avec offre = 50% pertinence + 35% récence + 15% durée, sans offre = 60% récence + 40% durée

## Export PDF

Méthode : `iframe` + `window.print()` (navigateur natif)

1. Crée un iframe caché avec le clone du CV + tous les stylesheets
2. Clone à `transform: none`, `width: 210mm`, `height: N×297mm`
3. `@page { size: A4; margin: 0 }` pour pages exactes
4. `break-inside: avoid` sur `[data-cv-block]` et `[data-cv-section]`
5. Appelle `iframe.contentWindow.print()` → dialogue d'impression native
6. L'utilisateur choisit "Enregistrer en PDF"

Avantage : rendu CSS parfait (même moteur que la preview), pas de html2canvas.

## Extraction IA (Convex)

### `extractCVDataFromPDF`
- Prompt structuré : dates "Mois YYYY", intro + bullets séparés, skills en catégories
- Post-traitement : split paragraphes longs, normalise `current`, cap 5 bullets, titre court, summary 300 chars
- Normalise les proficiencies LinkedIn (EN → FR)

### `optimizeCVForPage`
- Reçoit `cvData` + `pageLimit` + `jobDescription` (optionnel)
- Assigne `displayMode` + `kpi` à chaque expérience
- Réordonne par pertinence
- Reformule les bullets par mode

### `extractJobDescriptionFromURL`
- Jina Reader (`r.jina.ai`) en premier (rend le JS, gère les SPAs)
- Fallback : fetch HTTP direct avec User-Agent navigateur
- Strip HTML tags/scripts/styles, garde le texte
- Envoie à l'IA pour extraction structurée

## Système de codes d'accès

### Tables Convex
- `accessCodes` : code, maxUses, usedCount, expiresAt, label
- `accessRequests` : email, message, createdAt

### Flow utilisateur
1. Première action IA → modale "Code d'accès requis"
2. Saisie du code → sauvé dans localStorage → action pendante se lance
3. Si pas de code → saisie email → demande d'accès stockée en DB
4. Admin (joaudran@gmail.com) bypass le code

### Flow admin
- Bouton "Admin" visible uniquement pour l'email admin dans la sidebar dashboard
- Modale : générer codes (durée + max uses + label), voir codes actifs, voir demandes d'accès
- Fonctions Convex : `accessCodes.generate`, `accessCodes.list`, `accessCodes.listRequests`

## Règles apprises

- `html2canvas` / `html2canvas-pro` ont été retirés du projet — ne gèrent pas les CSS transforms. Utiliser `window.print()` pour l'export PDF.
- `jspdf` et `html2pdf.js` également retirés — dead code après migration vers window.print().
- `lucide-react` 1.x a supprimé les icônes de marques (Chrome, Linkedin). Utiliser `Globe` ou des SVG inline custom (`LinkedinIcon` dans `shared.tsx`).
- Convex `npx convex logs` hang indéfiniment sur Windows — ne jamais l'utiliser.
- Les env vars Convex doivent être configurées séparément pour dev ET prod.
- Les prompts IA doivent explicitement interdire la suppression de données ("NE SUPPRIME JAMAIS").
- Le conteneur CV doit avoir `overflow: hidden` + hauteur fixe (`pageLimit × 297mm`) pour simuler les feuilles A4.
- Ne JAMAIS modifier le DOM de l'élément CV pendant l'export — ça re-trigger l'auto-fit.
- L'auto-fit doit être bloqué (`isExporting = true`) pendant l'export.
- Le chargement des données depuis Convex (`useQuery`) doit être fait une seule fois (`dataLoaded` ref) pour éviter que le save re-trigger le chargement et écrase les displayModes.
- `convex/_generated/` doit être commité (pas dans .gitignore) sinon le build Vercel échoue.
- Vercel `buildCommand` : `npx convex deploy --cmd "npx vite build" --cmd-url-env-var-name VITE_CONVEX_URL`
- `CONVEX_DEPLOY_KEY` requis dans les env vars Vercel pour le déploiement automatique.

## Déploiements

| Service | Dev | Prod |
|---------|-----|------|
| Convex | `necessary-bobcat-348` | `cautious-mule-560` |
| Vercel | localhost:3000 | `cv-builder-indol-three.vercel.app` |
| Clerk | `improved-mayfly-32` (dev keys) | À migrer |

## Sécurité backend

- Les queries/mutations admin (`accessCodes.list`, `accessCodes.listRequests`, `accessCodes.generate`) vérifient l'email admin côté serveur via `ctx.auth.getUserIdentity()`.
- `verifyAccessCode` dans `ai.ts` vérifie le code en DB via `internalQuery` et incrémente l'usage via `internalMutation`.
- Les `internalQuery`/`internalMutation` ne sont pas exposées au client — seules les actions serveur peuvent les appeler.

## Prochaines étapes

- Migrer Clerk en production (clés `pk_live_*`, domaine custom requis)
- Extraire la sidebar de l'éditeur en composants séparés (content tab / design tab) — nécessite un EditorContext React
- Ajouter la détection de langue (FR/EN) pour adapter le contenu IA
- Migrer vers TypeScript 6 + Vite 8 quand les breaking changes seront stabilisés
