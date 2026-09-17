<!-- GSD:project-start source:PROJECT.md -->
## Project

**Calibre : CV Builder avec IA**

Application web de création et d'optimisation de CV propulsée par l'IA (Claude, unique provider depuis le 2026-08-16). Calibre permet d'importer un CV LinkedIn ou PDF, de l'éditer avec 2 templates une colonne (C Minimal, E Elegant), et de l'adapter à une offre d'emploi. Le score ATS mesure la part des exigences de l'offre que le CV écrit, et l'adaptation n'écrit que ce que le CV source prouve (refonte ATS du 2026-09-15, décision Atelier `2026-09-15-un-score-ats-qui-ne-note-que-ce-que-le-cv-prouve`).

**Core Value:** Les CV générés par Calibre doivent passer les filtres ATS avec le meilleur score possible tout en restant visuellement professionnels : un CV non lu par un ATS est un CV perdu.

### Constraints

- **Tech stack**: React 18 + Vite + Convex + Clerk, stack existante, pas de migration
- **IA Provider**: Claude, seul provider depuis le 2026-08-16 (`claude-sonnet-4-5` en `default`, `claude-haiku-4-5` en `fast`). Gemini a été retiré sur mesure : quota gratuit journalier épuisé après quelques dizaines d'appels, puis 60 à 840 ms d'aller-retour perdu avant chaque bascule, et 4,4× plus lent que Claude quand il répondait (médiane 8 167 ms contre 1 847 ms sur 128 mesures). `maxRetries: 0` sur le SDK : la boucle `withRetry` de `convex/_ai/chat.ts` a le contrôle exclusif. **Un second provider, s'il revient un jour, se place APRÈS Claude** : `withRetry` ne réessaie que le dernier de la liste, donc le mettre devant retirerait son retry à Claude.
- **Performance**: Le score basique doit être calculé en temps réel sans lag perceptible
- **Simplicité**: Ne pas ajouter de complexité ; fusionner et simplifier les fichiers existants
- **Ordre du texte dans le PDF**: Chrome écrit le texte du PDF dans l'**ordre de peinture**, pas dans celui du document. Une boîte `position: relative`/`absolute` ou `opacity` est peinte après tous ses frères dans le flux, et son texte sort donc à la fin. Un ATS lisant le texte dans l'ordre attribuait les puces au mauvais employeur (mesuré le 2026-09-16). Règle : aucun élément **porteur de texte** d'un template n'est positionné ni transparent (une couleur, jamais `opacity`) ; chaque bloc de page est son propre contexte d'empilement (`relative z-0` dans `PaginatedCV.tsx`). Garde : `e2e/pdf-legibility.spec.ts` extrait le texte du vrai téléchargement avec `pdfjs-dist/legacy` pour C et E
- **PDF Export**: endpoint serverless Puppeteer (`api/generate-pdf.ts`, same-origin + rate limit + requêtes réseau interceptées) en chemin principal ; `window.print()` via iframe cachée en secours et pour la prévisualisation. CSS d'impression canonique : `src/features/editor/lib/pdfStyles.ts`, importée par l'API (ne pas la dupliquer). En dev, le plugin `apiDevServer` de `vite.config.ts` sert les fonctions `api/*.ts` (Vite ne répond qu'aux GET sinon, et le POST tombait en 404 → repli silencieux sur l'impression)
- **Tri auto sur N pages**: `src/features/editor/lib/fitToPages.ts` (pur) + `useFitToPages` (boucle pilotée par les mesures DOM réelles). Cible = `designSettings.pageLimit` (défaut 2), transmise à `tailorCV`. Le score de pertinence ordonne les dégradations, il ne fixe jamais un niveau absolu. Paliers (arbitrage du 2026-09-17) : le tiers le plus pertinent et tout poste en cours daté gardent leur détail pendant que les autres descendent jusqu'à compact, puis ce tiers passe en normal, les autres sont masqués, et ce tiers descend en dernier ; la dernière mention d'une exigence requise passe avant les paliers. La sauvegarde auto est suspendue pendant le tri, et le tri s'arrête seul sans mesure pendant 10 s
- **Nombre de pages mesuré**: `usePaginationFit` ne rend `stablePageCount` que pour les blocs exacts mesurés (`stableFor`). Un bloc d'expérience porte le rang de l'expérience parmi les **visibles** : masquer un rôle renomme les suivants, donc un changement d'estimation (`contentKey`) repart de zéro (`carryOver`, `lib/pagination/reconcile.ts`)
- **Import LinkedIn**: `src/lib/linkedinParser.ts` est pur (`profileFromTokens`, testé sur des tokens) ; la lecture pdf.js est dans `src/lib/pdfTextExtract.ts`. Tout le texte de l'export est gardé : paragraphes regroupés par écart vertical, puce continuée sur la ligne ou la page suivante, premier paragraphe en intro
- **Portfolio**: `PersonalInfo.portfolio_url` / `portfolio_label` / `portfolio_anon_url` sont génériques et open source. La sélection de version selon l'offre vient de `VITE_PORTFOLIO_VARIANTS` (JSON d'env, absent du dépôt) : sans la variable, aucune UI n'apparaît
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.8.2 - Full codebase (frontend + backend)
- JavaScript - Legacy config files (`convex/auth.config.js`)
- JSX/TSX - React component files
- CSS - Tailwind CSS styling
## Runtime
- Node.js (via npm, implicit version from `.node-version` or nvmrc)
- npm (lockfile: `package-lock.json` expected but not verified)
## Frameworks
- React 19.2.4 - UI framework
- React Router DOM 7.14.0 - Client-side routing (`src/App.tsx`)
- Convex 1.34.1 - Backend as a service (BaaS) with built-in database
- Vitest 4.1.2 - Unit/integration test runner (`convex/_ai/__tests__/`)
- Playwright 1.59.1 - E2E test runner (`e2e/`: smoke, ATS panel, lettre, tri auto + portfolio, mode guest)
- Vite 6.2.0 - Dev server and build tool
- @vitejs/plugin-react 5.0.4 - React fast refresh
- @tailwindcss/vite 4.2.2 - Tailwind CSS integration (v4)
- TypeScript 5.8.2 - Type checking (`npm run lint`)
- tsx 4.21.0 - TypeScript execution (dev dependency)
## Key Dependencies
- `@clerk/clerk-react` 5.61.4 - Authentication provider
- `convex/react` 1.34.1 - Convex client SDK (auto-subscriptions)
- `convex/react-clerk` 1.34.1 - Convex + Clerk integration layer
- `@anthropic-ai/sdk` - Claude, unique provider IA (Messages API, streaming)
- `pdfjs-dist` 5.6.205 - Client-side PDF text extraction
- `docx` 9.6.1 - Word document (.docx) generation for exports
- `file-saver` 2.0.5 - Browser file download API wrapper
- `lucide-react` 1.7.0 - Icon library (Linkedin, delete icons, etc.)
- `motion` 12.38.0 - Animation library (likely for page transitions)
- `clsx` 2.1.1 - Conditional class name utility
- `tailwind-merge` 3.5.0 - Merge Tailwind CSS classes
- `tailwindcss` 4.2.2 - CSS framework (dev dependency)
- `autoprefixer` 10.4.27 - PostCSS vendor prefixing
- `react-markdown` 10.1.0 - Render markdown to React components
- `react-dropzone` 15.0.0 - Drag-and-drop file upload
- `@types/node` 25.5.2 - TypeScript types for Node.js APIs
## Configuration
- Variables defined in `.env.example`:
- TypeScript config: `tsconfig.json`
- Vite config: `vite.config.ts`
- Vercel: `vercel.json` with custom build command
- Output: `dist/` (from `npm run build`)
- Clean: `npm run clean` (removes `dist/`)
## Platform Requirements
- Node.js (version not pinned in visible files)
- npm (or yarn/pnpm with package-lock.json)
- Vercel (deployment platform configured in `vercel.json`)
- Convex backend hosting (configured via `convex.json`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- PascalCase for React components: `Button.tsx`, `ErrorBoundary.tsx`, `EditorPage.tsx`
- camelCase for utility/hook files: `useAutoZoom.ts`, `useAccessCode.ts`, `linkedinParser.ts`
- index.ts for barrel exports: `src/shared/ui/index.ts`, `src/shared/hooks/index.ts`, `src/shared/types/index.ts`
- camelCase for all function/hook definitions: `useAutoZoom()`, `condenseOneStep()`, `formatDateShort()`, `computeATSReport()`
- Function names are descriptive and indicate purpose: `getVisibleBullets()`, `shouldShowKPI()`, `isHidden()`, `condenseOneStep()`
- camelCase for all variables and constants: `zoom`, `cvData`, `designSettings`, `requirements`, `expandedSection`
- UPPERCASE for constant values that are truly immutable: `CV_WIDTH_PX`, `PADDING`, `STORAGE_KEY`, `TEMPLATES`
- Ref variables suffixed with `.current`: `cvRef`, `previewContainerRef`, `dataLoaded`, `hasAutoAssigned`
- PascalCase for all type/interface names: `CVData`, `DesignSettings`, `Experience`, `PersonalInfo`, `ExperienceDisplayMode`
- Discriminated union types using `type`: `type ExperienceDisplayMode = 'hidden' | 'compact' | 'normal' | 'extended'`
- Props interfaces named `Props` in components: `interface Props extends ButtonHTMLAttributes<HTMLButtonElement>`
## Code Style
- No explicit linter configured (ESLint/Prettier not in package.json)
- TypeScript `--noEmit` for type checking (run via `npm run lint`), twice: the root `tsconfig.json` excludes `api/`, which has its own `api/tsconfig.json`
- Type annotations on function parameters and return values
- Explicit type extends for HTML element props: `forwardRef<HTMLButtonElement, Props>`, `InputHTMLAttributes<HTMLInputElement>`
- Run `npm run lint` (executes `tsc --noEmit && tsc --noEmit -p api`) to check types; never `tsc --noEmit` alone, it skips the serverless functions. The Vercel `buildCommand` runs it first, so a type error blocks the deploy (Convex included)
- No console.log in production code except for errors in catch blocks or critical boundaries
- console.error usage examples: `console.error('Error optimizing CV:', error)`, `console.error('[ErrorBoundary]', error, info.componentStack)`
## Import Organization
- `@/*` resolves to project root (configured in `tsconfig.json`)
- Relative paths used within same feature: `../lib/cn`, `../shared/hooks`
- Absolute imports with `@/` used for cross-feature: `import { cn } from '@/src/shared/lib/cn'` (though relative also acceptable)
## Error Handling
- Try-catch blocks with console.error logging inside catch blocks
- User-facing error notifications via `notify({ message: '...', type: 'error' })`
- Error message context included: `console.error('Error optimizing CV:', error)`
- ErrorBoundary wrapper in main.tsx for React component crashes
- Fallback messages in French (app language): `'Une erreur est survenue'`, `'Erreur lors de l\'optimisation du CV'`
## Logging
- `console.error()` for exceptions: used in try-catch blocks and error boundaries
- `console.warn()` for non-critical issues: `console.warn('VITE_CONVEX_URL is not defined')`
- Prefix patterns for clarity: `'[ErrorBoundary]'`, `'[Calibre] LinkedIn parser failed'`
- Error details always logged with context
## Comments
- Complex algorithm explanation: `src/features/editor/lib/autoFit.ts` includes detailed comments explaining condensation strategy
- Function purpose (JSDoc style): Functions include inline comments explaining parameters
- Section dividers using em-dash pattern: `// ─── Date formatting ───`, `// ─── Skills display modes ───`
- JSDoc comments on public functions explaining behavior
- Example from `autoFit.ts`:
- Inline comments explain non-obvious logic but avoid restating code
- Example from `scoring.ts`:
## Function Design
- Example: `useAutoZoom()` = 39 lines (including return statement)
- Example: `useAccessCode()` = 30 lines
- Larger orchestrator functions acceptable in pages: `EditorPage.tsx` = 1637 lines (necessarily complex due to feature scope)
- Use destructuring for props: `function Button({ variant = 'primary', size = 'md', loading, ...props }, ref)`
- Default values provided: `size = 'md'`, `className?: string`, `loading?: boolean`
- No positional boolean parameters; use objects for multiple flags
- Functions return new objects instead of mutating: `return { ...exp, displayMode: nextMode }` (immutable pattern)
- Null returned when operation can't be performed: `return null` for `condenseOneStep()` when nothing can condense
- Boolean functions use clear names: `isHidden()`, `isCompact()`, `shouldShowKPI()` not `hasHidden()` or `checkHidden()`
- As const for object returns to freeze returned values: `return { zoom, setZoom, isAutoZoom, setIsAutoZoom } as const`
## Module Design
- Named exports for utilities: `export function cn(...)`, `export function useAutoZoom(...)`
- Default export for pages/feature components: `export default function EditorPage()`
- Barrel exports in index files collect related exports: `export { cn } from './cn'; export { useAccessCode } from './useAccessCode'`
- `src/shared/ui/index.ts` - exports all UI atoms
- `src/shared/hooks/index.ts` - exports all shared hooks
- `src/shared/types/index.ts` - exports all types and DEFAULT_DESIGN/EMPTY_CV constants
- `src/features/editor/hooks/index.ts` - exports editor-specific hooks
- `src/features/editor/components/index.ts` - exports editor components
- `src/features/editor/templates/index.ts` - exports CV templates
## State Management Patterns
- Used for local UI state (activeTab, expandedSection, isExporting)
- Example: `const [zoom, setZoom] = useState(85)`
- Default initialization: `const [isAutoZoom, setIsAutoZoom] = useState(enabled)`
- Used to track one-time operations: `const dataLoaded = useRef(false)`
- Used to hold DOM references: `const cvRef = useRef<HTMLDivElement>(null)`
- Pattern for preventing multiple initializations:
## Component Patterns
- `Button.tsx` uses `variantStyles` and `sizeStyles` Record objects
- `displayModes.ts` exports mode arrays with metadata: `{ value: 'hidden', label: 'Masqué', icon: '⊘', color: '#9ca3af' }`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Client-side reactive state management via Convex hooks (useQuery, useMutation, useAction)
- Feature-based organization with co-located components, hooks, and utilities
- Template-based CV rendering with memoization optimization
- Backend authentication via Clerk + Convex identity validation
- Intégration IA derrière une abstraction provider (`convex/_ai/providers.ts`) : un seul vendeur aujourd'hui, Claude
- Accès aux actions IA : un compte connecté OU un code d'accès valide (`convex/_ai/auth.ts`), sans interrupteur d'environnement
- Erreurs lisibles par l'utilisateur : toujours `userError()` (`convex/_shared/errors.ts`), jamais `new Error` (message masqué par Convex en production)
- ATS : exigences d'offre (`JobRequirement`, extraites par `extractRequirements` dans `convex/_ai/tailor.ts`, citation vérifiée dans l'offre, libellé = premier terme que la citation écrit, variantes dans les deux langues, cache client `jobRequirementsCache.ts` (clé `job_requirements_cache_v2`) avec une seule analyse en cours par offre) ; score = `computeATSReport` (`src/features/editor/lib/keywordAnalysis.ts`), le même côté client et serveur ; pas de score sans exigences
- Écarts avant l'écriture : `analyzeGaps` (`gapsPipeline`, `convex/_ai/prove.ts`) cherche dans le CV une citation par exigence (appel rapide). Une citation ne prouve que si elle est faite de mots du CV et partage un radical **propre à cette exigence** (`provenByQuote`) : « design », commun à plusieurs exigences, ne prouve rien. Le tableau de bord (`useOfferTailoring`, `OfferGapsPanel`) demande les écarts restants AVANT l'unique génération, puis ouvre l'éditeur sur l'onglet ATS (le score se lit après le tri). Ne jamais relâcher cette règle pour remonter un score : la version permissive inventait des puces
- Adaptation : `tailorCV` (`convex/_ai/tailor.ts`) reçoit les citations (revérifiées) et les réponses du candidat `{ id, text }` (seulement `isProvable` et `saysWhere`). Ce que seule une réponse prouve ne s'écrit que dans les expériences qu'elle nomme (`experiencesNamedBy`), jamais dans le résumé, le titre ni une étiquette, sans nom que personne n'a donné, et ses nombres ne valent que là ; la réparation ne s'en sert jamais. Une ligne `[tailorCV]` par adaptation dans les journaux (prouvées, score avant et après la garde, réparations). Ensuite : génération avec citations de preuve, garde vérité en code (`convex/_ai/truthGuard.ts`, nombres lus par `convex/_ai/numbers.ts`), mesure, au plus 2 réparations (`prompts/distribute.ts` = prompt de réparation) avant 240 s. Tout ce que le CV adapté écrit doit être prouvé par le CV source
- Preuve : `proveRequirement` (`convex/_ai/prove.ts`) écrit UNE exigence depuis les mots de l'utilisateur, sous la même garde. Ce que le modèle répond est relu en code : puce **ajoutée** à une expérience que la preuve nomme (employeur d'abord, poste en secours), aucun nom propre que la preuve, l'expérience ou l'offre ne nomme, compétence sous le seul libellé de l'offre, jamais le résumé ; gardé seulement si le score monte, sinon `written: false` et le CV de l'utilisateur est rendu intact. Refus gratuits (exigence inconnue, non `isProvable`, preuve trop courte) décidés sans appel
- Bornes d'entrée : `convex/_ai/inputLimits.ts`. Toute action qui met un CV `v.any()` dans un prompt appelle `assertBoundedPrompt` AVANT `verifyAccessCode`
- Templates : registre unique `TEMPLATES` / `TemplateId` (`lib/pagination/templateLayouts.ts`) ; un design stocké avec un template retiré (A, B) ou `atsMode` est migré à la lecture (`migratedDesign`)
- E2E tests: `e2e/smoke.spec.ts` (pages publiques), `e2e/ats-panel.spec.ts` (ATS panel, écarts, preuve), `e2e/cover-letter.spec.ts`, `e2e/fit-to-pages.spec.ts` (tri auto + lien portfolio), `e2e/dashboard.spec.ts` (dont les écarts avant l'écriture), `e2e/pdf-legibility.spec.ts` (texte du PDF réel, C et E) : tous en mode guest
- E2E et appels payants : `seedGuestSession` réchauffe les caches pour qu'aucune action ne parte, `watchAICalls`/`expectNoAICalls` le prouvent. Un flux qui finit par un appel payant (preuve) passe par `answerAIActions` (route la WebSocket Convex et répond à la place du serveur) ; un socket routé est invisible à `watchAICalls`, donc le fixture rend `answered`/`forwarded` et **`forwarded` doit rester vide**
- `e2e/capture-pdf.spec.ts` n'est pas une régression : il écrit le PDF réellement produit sur disque pour inspection humaine, et ne tourne que si `CAPTURE_PDF=<chemin>` est défini
- Display mode system for content optimization (experience and skills visibility control)
- Noms de langue : imprimés dans la langue du CV (`localizeLanguageName`, `LANGUAGE_NAMES` dans `formatting.ts`), par les templates, l'export Word, le score et la garde
- Anonymization toggle: client-side only, masks personal info at render time without touching Convex data (`src/shared/lib/anonymize.ts`)
## Layers
- Purpose: Render UI, handle user interactions, manage local UI state
- Location: `src/features/`, `src/pages/`, `src/shared/ui/`
- Contains: Page components, feature components, UI atoms
- Depends on: React Router, Clerk auth context, Convex hooks, shared types/utilities
- Used by: React DOM via entry point `src/main.tsx`
- Purpose: Fetch, cache, and mutate server state; sync client state with server
- Location: `convex/` (backend), React components via hooks
- Contains: Query resolvers (cvs.listMyCVs), mutations (cvs.createMyCV), actions (ai.tailorCV)
- Depends on: Clerk identity for auth, Convex database schema
- Used by: All components via `useQuery()`, `useMutation()`, `useAction()` from convex/react
- Purpose: Verify user identity and enforce access control
- Location: `src/features/auth/`, Clerk SDK, Convex identity context
- Contains: ProtectedRoute HOC, SyncUser component, access code verification
- Depends on: Clerk for credential management, Convex auth context for backend
- Used by: App.tsx routing, protected features
- Purpose: Compute visibility/rendering of CV sections based on job match and page constraints
- Location: `src/features/editor/lib/` (scoring.ts, displayModes.ts)
- Contains: Requirement coverage (ATS report), relevance ordering, fit-to-pages condensing, date formatting
- Depends on: CV data types, job description
- Used by: EditorPage, blockRenderers
- Purpose: Render CV content in different visual layouts
- Location: `src/features/editor/templates/blockRenderers/` (templateC/E, A and B removed 2026-09-15), shared utilities in `src/features/editor/templates/shared.tsx`
- Contains: Per-block renderers per template, consumed by PaginatedCV (block-based pagination). Monolithic Template components and CVRenderer removed 2026-08-07 (commit 86d4cab)
- Depends on: Design settings, display mode computations, CV data structure
- Used by: EditorPage preview rendering, PDF export
- Purpose: Shared functions, type definitions, UI utilities
- Location: `src/shared/` (types, hooks, lib, ui), `src/lib/`
- Contains: Type definitions (CVData, DesignSettings), hooks (useAccessCode, useAutoZoom), export functions (pdfExport.ts)
- Depends on: React, third-party libraries (pdfjs, docx)
- Used by: All layers
## Data Flow
- **Server state:** Persisted in Convex (cvs, users, coverLetters tables)
- **Client state:** React useState in EditorPage (cvData, designSettings, selectedTemplate, UI flags)
- **Auth state:** Clerk useAuth + Convex identity + sessionStorage flag for guest access
- **Session state:** localStorage for guest-mode CV data (`guest_last_optimized`)
- **Sync mechanism:** Convex hooks auto-sync when mutations complete, triggering component re-renders
## Key Abstractions
- Purpose: Single source of truth for all CV information (content + design + visibility)
- Examples: `src/shared/types/index.ts`, `convex/schema.ts` cvs table
- Pattern: Immutable updates via spread operator (never mutate CVData directly)
- Purpose: Control visibility of experience/skill sections without deletion
- Examples: `ExperienceDisplayMode` ('hidden' | 'compact' | 'normal' | 'extended')
- Pattern: Stored on each Experience object, computed by displayModes.ts functions
- Purpose: Encapsulate CV visual appearance (colors, fonts, layout, page limit)
- Examples: `DesignSettings` in types, persisted on cvData.design
- Pattern: Passed to template components as prop, uses Tailwind dynamic color classes
- Purpose: Registry pattern for dynamic template selection
- Examples: `getBlockRenderers()` in `src/features/editor/templates/blockRenderers/index.ts`, `TEMPLATE_LAYOUTS` in `src/features/editor/lib/pagination/templateLayouts.ts`
- Pattern: templateId resolves to a BlockRendererMap (per-block renderers) + a TemplateLayout (dimensions), consumed by PaginatedCV/allocatePages
- Purpose: Isoler le choix du modèle du code appelant
- Examples: `getProviders()` in `convex/_ai/providers.ts` returns the provider list (un seul depuis 2026-08-16)
- Pattern: un seul vendeur, SDK Anthropic natif ; chat.ts ne branche plus sur un protocole
## Entry Points
- Location: `src/main.tsx`
- Triggers: User visits app URL
- Responsibilities: Bootstrap React app, initialize Clerk + Convex providers, set up global error boundary
- Location: `src/App.tsx`
- Triggers: Route navigation
- Responsibilities: Route requests to pages, apply ProtectedRoute wrapper, code-split lazy load pages
- Location: `src/pages/EditorPage.tsx`
- Triggers: User navigates to `/editor/:id?`
- Responsibilities: Load CV from Convex or localStorage, manage editing UI (tabs, sidebar), coordinate AI actions
- Location: `src/pages/DashboardPage.tsx`
- Triggers: User navigates to `/dashboard`
- Responsibilities: List saved CVs, upload PDF, call AI to generate initial CV structure
## Error Handling
- **Auth checks:** Every Convex mutation/query checks `ctx.auth.getUserIdentity()` and throws "Unauthenticated"
- **Access control:** CVs/coverLetters queries verify userId matches identity.subject before returning
- **Form validation:** Input fields validate on change (Button disables if required fields empty)
- **AI responses:** JSON parsing wrapped in try-catch with fallback error messages in French
- **PDF export:** iframe creation wrapped with document checks; print dialog handles user cancellation
- **Global boundary:** `src/shared/ui/ErrorBoundary.tsx` catches React rendering errors
## Cross-Cutting Concerns
- Zod-style validators used in Convex schema (v.object, v.array, v.any for flexible AI output)
- Client-side validation on form inputs (min length, email format via HTML5)
- Clerk provider wraps app in main.tsx
- useAuth hook checks isSignedIn + isLoaded before rendering protected content
- sessionStorage flag for guest access mode (temporary CVs in localStorage)
- Templates use memoized display mode computations
- useOverflowDetection debounces resize checks to avoid excessive recalculations
- Vite code-splitting for lazy-loaded pages (HomePage, EditorPage, etc.)
- Anonymization toggle (`isAnonymous` state in EditorPage): `usePaginationFit` always receives real `cvData` for layout stability; `pageAssignments` are post-processed to replace header block data with masked `PersonalInfo`: keeps title, hides name/email/phone/location/linkedin/github/website/photo
<!-- GSD:architecture-end -->

