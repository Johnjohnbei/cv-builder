<!-- GSD:project-start source:PROJECT.md -->
## Project

**Calibre — CV Builder avec IA**

Application web de création et d'optimisation de CV propulsée par l'IA (NVIDIA NIM / Gemini). Calibre permet d'importer un CV LinkedIn ou PDF, de l'éditer avec 6 templates professionnels, et de l'optimiser pour des offres d'emploi spécifiques. Le projet entre dans une phase de conformité ATS complète pour maximiser les chances des candidats face aux systèmes de tri automatisés.

**Core Value:** Les CV générés par Calibre doivent passer les filtres ATS avec le meilleur score possible tout en restant visuellement professionnels — un CV non lu par un ATS est un CV perdu.

### Constraints

- **Tech stack**: React 18 + Vite + Convex + Clerk — stack existante, pas de migration
- **IA Provider**: NVIDIA NIM — conserver le provider actuel, améliorer les prompts
- **Performance**: Le score basique doit être calculé en temps réel sans lag perceptible
- **Simplicité**: Ne pas ajouter de complexité — fusionner et simplifier les fichiers existants
- **PDF Export**: window.print() pour l'instant — explorer des alternatives si possible
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
- Vitest 4.1.2 - Unit/integration test runner
- Vite 6.2.0 - Dev server and build tool
- @vitejs/plugin-react 5.0.4 - React fast refresh
- @tailwindcss/vite 4.2.2 - Tailwind CSS integration (v4)
- TypeScript 5.8.2 - Type checking (`npm run lint`)
- tsx 4.21.0 - TypeScript execution (dev dependency)
## Key Dependencies
- `@clerk/clerk-react` 5.61.4 - Authentication provider
- `convex/react` 1.34.1 - Convex client SDK (auto-subscriptions)
- `convex/react-clerk` 1.34.1 - Convex + Clerk integration layer
- `openai` 6.33.0 - OpenAI SDK for API calls (used server-side via actions)
- `@google/genai` 1.48.0 - Google Generative AI (Gemini) client
- Multi-provider support: NVIDIA NIM (primary), Gemini (fallback)
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
- camelCase for all function/hook definitions: `useAutoZoom()`, `condenseOneStep()`, `formatDateShort()`, `extractKeywords()`
- Function names are descriptive and indicate purpose: `getVisibleBullets()`, `shouldShowKPI()`, `isHidden()`, `autoAssignModes()`
- camelCase for all variables and constants: `zoom`, `cvData`, `designSettings`, `jobKeywords`, `expandedSection`
- UPPERCASE for constant values that are truly immutable: `CV_WIDTH_PX`, `PADDING`, `STORAGE_KEY`, `TEMPLATE_NAMES`
- Ref variables suffixed with `.current`: `cvRef`, `previewContainerRef`, `dataLoaded`, `hasAutoAssigned`
- PascalCase for all type/interface names: `CVData`, `DesignSettings`, `Experience`, `PersonalInfo`, `ExperienceDisplayMode`
- Discriminated union types using `type`: `type ExperienceDisplayMode = 'hidden' | 'compact' | 'normal' | 'extended'`
- Props interfaces named `Props` in components: `interface Props extends ButtonHTMLAttributes<HTMLButtonElement>`
## Code Style
- No explicit linter configured (ESLint/Prettier not in package.json)
- TypeScript `--noEmit` for type checking (run via `npm run lint`)
- Type annotations on function parameters and return values
- Explicit type extends for HTML element props: `forwardRef<HTMLButtonElement, Props>`, `InputHTMLAttributes<HTMLInputElement>`
- Run `npm run lint` (executes `tsc --noEmit`) to check types
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
- AI integration via pluggable provider abstraction (NVIDIA NIM primary, Gemini fallback)
- Display mode system for content optimization (experience and skills visibility control)
## Layers
- Purpose: Render UI, handle user interactions, manage local UI state
- Location: `src/features/`, `src/pages/`, `src/shared/ui/`
- Contains: Page components, feature components, UI atoms
- Depends on: React Router, Clerk auth context, Convex hooks, shared types/utilities
- Used by: React DOM via entry point `src/main.tsx`
- Purpose: Fetch, cache, and mutate server state; sync client state with server
- Location: `convex/` (backend), React components via hooks
- Contains: Query resolvers (cvs.listMyCVs), mutations (cvs.createMyCV), actions (ai.optimizeCVForPage)
- Depends on: Clerk identity for auth, Convex database schema
- Used by: All components via `useQuery()`, `useMutation()`, `useAction()` from convex/react
- Purpose: Verify user identity and enforce access control
- Location: `src/features/auth/`, Clerk SDK, Convex identity context
- Contains: ProtectedRoute HOC, SyncUser component, access code verification
- Depends on: Clerk for credential management, Convex auth context for backend
- Used by: App.tsx routing, protected features
- Purpose: Compute visibility/rendering of CV sections based on job match and page constraints
- Location: `src/features/editor/lib/` (scoring.ts, displayModes.ts)
- Contains: Relevance scoring, keyword extraction, display mode assignment, date formatting
- Depends on: CV data types, job description
- Used by: EditorPage, CVRenderer, templates
- Purpose: Render CV content in different visual layouts
- Location: `src/features/editor/templates/`
- Contains: Template components (TemplateA-F), shared utilities (shared.tsx), CVRenderer dispatcher
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
- Examples: `TEMPLATE_MAP` in `src/features/editor/templates/CVRenderer.tsx`
- Pattern: Record<string, React.ComponentType<TemplateProps>> dispatches to correct renderer
- Purpose: Support multiple AI providers without client code changes
- Examples: `getProvider()` in `convex/ai.ts` returns AIProvider interface
- Pattern: OpenAI-compatible API used by all providers, single getClient() function
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
- CVRenderer wrapped with memo() to skip re-renders when only sidebar UI state changes
- Templates use memoized display mode computations
- useOverflowDetection debounces resize checks to avoid excessive recalculations
- Vite code-splitting for lazy-loaded pages (HomePage, EditorPage, etc.)
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
