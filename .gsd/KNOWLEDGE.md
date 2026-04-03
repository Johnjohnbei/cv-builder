# KNOWLEDGE — CV Builder (Calibre)

## Architecture

- **Frontend** : React + Vite + Tailwind v4 (utilise oklch par défaut)
- **Auth** : Clerk (instance dev `improved-mayfly-32`, JWT template "convex" configuré)
- **Backend** : Convex (dev: `necessary-bobcat-348`, prod: `cautious-mule-560`)
- **IA** : Google Gemini via `@google/genai` (Pro pour extraction/optimisation, Flash pour analyse ATS)
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

### Couche 3 — Orchestration (`src/pages/EditorPage.tsx`)

Contrôles sidebar, auto-fit loop, overflow detection, état React.

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
- Fetch HTTP direct de la page avec User-Agent navigateur
- Strip HTML tags/scripts/styles, garde le texte
- Envoie à Gemini pour extraction structurée
- Fallback : Gemini `urlContext` + `googleSearch` si fetch échoue

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

- `html2canvas` / `html2canvas-pro` ne gèrent PAS correctement les CSS transforms (`scale`). Utiliser `window.print()` pour l'export PDF.
- Tailwind v4 utilise oklch par défaut — les classes comme `text-white`, `bg-white/10` ne marchent pas dans html2canvas. Utiliser des styles inline (`color: '#fff'`) pour les éléments critiques.
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

## Prochaines étapes

- Migrer Clerk en production (clés `pk_live_*`, domaine custom requis)
- Extraire les compétences en composant shared (comme `renderExperienceContent`)
- Tester l'export PDF sur tous les templates avec données réelles
- Ajouter la détection de langue (FR/EN) pour adapter le contenu IA
- Code splitting pour réduire la taille des chunks
