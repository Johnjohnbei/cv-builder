# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- PascalCase for React components: `Button.tsx`, `ErrorBoundary.tsx`, `EditorPage.tsx`
- camelCase for utility/hook files: `useAutoZoom.ts`, `useAccessCode.ts`, `linkedinParser.ts`
- index.ts for barrel exports: `src/shared/ui/index.ts`, `src/shared/hooks/index.ts`, `src/shared/types/index.ts`

**Functions:**
- camelCase for all function/hook definitions: `useAutoZoom()`, `condenseOneStep()`, `formatDateShort()`, `extractKeywords()`
- Function names are descriptive and indicate purpose: `getVisibleBullets()`, `shouldShowKPI()`, `isHidden()`, `autoAssignModes()`

**Variables:**
- camelCase for all variables and constants: `zoom`, `cvData`, `designSettings`, `jobKeywords`, `expandedSection`
- UPPERCASE for constant values that are truly immutable: `CV_WIDTH_PX`, `PADDING`, `STORAGE_KEY`, `TEMPLATE_NAMES`
- Ref variables suffixed with `.current`: `cvRef`, `previewContainerRef`, `dataLoaded`, `hasAutoAssigned`

**Types:**
- PascalCase for all type/interface names: `CVData`, `DesignSettings`, `Experience`, `PersonalInfo`, `ExperienceDisplayMode`
- Discriminated union types using `type`: `type ExperienceDisplayMode = 'hidden' | 'compact' | 'normal' | 'extended'`
- Props interfaces named `Props` in components: `interface Props extends ButtonHTMLAttributes<HTMLButtonElement>`

**Types sourced from single location:** `src/shared/types/index.ts` is the single source of truth for domain types. All cross-feature type usage imports from here.

## Code Style

**Formatting:**
- No explicit linter configured (ESLint/Prettier not in package.json)
- TypeScript `--noEmit` for type checking (run via `npm run lint`)
- Type annotations on function parameters and return values
- Explicit type extends for HTML element props: `forwardRef<HTMLButtonElement, Props>`, `InputHTMLAttributes<HTMLInputElement>`

**Linting:**
- Run `npm run lint` (executes `tsc --noEmit`) to check types
- No console.log in production code except for errors in catch blocks or critical boundaries
- console.error usage examples: `console.error('Error optimizing CV:', error)`, `console.error('[ErrorBoundary]', error, info.componentStack)`

## Import Organization

**Order (consistent across files):**
1. React imports: `import { useState, useRef, useEffect, useMemo } from 'react'`
2. Third-party libraries: `import { Download, Eye, Save } from 'lucide-react'`, `import { useQuery, useMutation } from "convex/react"`
3. Internal shared utilities/types: `import { cn } from '../shared/lib/cn'`, `import type { CVData, DesignSettings } from '@/src/shared/types'`
4. Local feature imports: `import { CVRenderer } from '../features/editor/templates'`, `import { useCVLoader } from '../features/editor/hooks'`
5. Styles (CSS imports): `import './index.css'`

**Path Aliases:**
- `@/*` resolves to project root (configured in `tsconfig.json`)
- Relative paths used within same feature: `../lib/cn`, `../shared/hooks`
- Absolute imports with `@/` used for cross-feature: `import { cn } from '@/src/shared/lib/cn'` (though relative also acceptable)

## Error Handling

**Patterns:**
- Try-catch blocks with console.error logging inside catch blocks
- User-facing error notifications via `notify({ message: '...', type: 'error' })`
- Error message context included: `console.error('Error optimizing CV:', error)`
- ErrorBoundary wrapper in main.tsx for React component crashes
- Fallback messages in French (app language): `'Une erreur est survenue'`, `'Erreur lors de l\'optimisation du CV'`

**Example from EditorPage.tsx:**
```typescript
try {
  const optimizedData = await optimizeCVAction({ cvData, pageLimit, accessCode });
  setCvData(optimizedData);
  notify({ message: 'CV optimisé avec succès !', type: 'success' });
} catch (error) {
  console.error('Error optimizing CV:', error);
  notify({ message: 'Erreur lors de l\'optimisation du CV.', type: 'error' });
}
```

## Logging

**Framework:** console (no logging library used)

**Patterns:**
- `console.error()` for exceptions: used in try-catch blocks and error boundaries
- `console.warn()` for non-critical issues: `console.warn('VITE_CONVEX_URL is not defined')`
- Prefix patterns for clarity: `'[ErrorBoundary]'`, `'[Calibre] LinkedIn parser failed'`
- Error details always logged with context

## Comments

**When to Comment:**
- Complex algorithm explanation: `src/features/editor/lib/autoFit.ts` includes detailed comments explaining condensation strategy
- Function purpose (JSDoc style): Functions include inline comments explaining parameters
- Section dividers using em-dash pattern: `// ─── Date formatting ───`, `// ─── Skills display modes ───`

**JSDoc/TSDoc:**
- JSDoc comments on public functions explaining behavior
- Example from `autoFit.ts`:
```typescript
/**
 * Condense one block by one step. Alternates between experiences and skills
 * to keep the CV balanced. Never hides ALL experiences — keeps at least
 * the top priority one visible (compact minimum).
 * 
 * Returns null if nothing can be condensed further.
 */
export function condenseOneStep(...)
```

- Inline comments explain non-obvious logic but avoid restating code
- Example from `scoring.ts`:
```typescript
// Budget heuristics: how many experiences can fit on N pages
// 1 page: ~5 visible (1 extended + 1 normal + 3 compact)
```

## Function Design

**Size:** Functions kept under 50 lines in general. Utility/hook functions are small and focused.
- Example: `useAutoZoom()` = 39 lines (including return statement)
- Example: `useAccessCode()` = 30 lines
- Larger orchestrator functions acceptable in pages: `EditorPage.tsx` = 1637 lines (necessarily complex due to feature scope)

**Parameters:** 
- Use destructuring for props: `function Button({ variant = 'primary', size = 'md', loading, ...props }, ref)`
- Default values provided: `size = 'md'`, `className?: string`, `loading?: boolean`
- No positional boolean parameters; use objects for multiple flags

**Return Values:**
- Functions return new objects instead of mutating: `return { ...exp, displayMode: nextMode }` (immutable pattern)
- Null returned when operation can't be performed: `return null` for `condenseOneStep()` when nothing can condense
- Boolean functions use clear names: `isHidden()`, `isCompact()`, `shouldShowKPI()` not `hasHidden()` or `checkHidden()`
- As const for object returns to freeze returned values: `return { zoom, setZoom, isAutoZoom, setIsAutoZoom } as const`

## Module Design

**Exports:**
- Named exports for utilities: `export function cn(...)`, `export function useAutoZoom(...)`
- Default export for pages/feature components: `export default function EditorPage()`
- Barrel exports in index files collect related exports: `export { cn } from './cn'; export { useAccessCode } from './useAccessCode'`

**Barrel Files:** 
- `src/shared/ui/index.ts` - exports all UI atoms
- `src/shared/hooks/index.ts` - exports all shared hooks
- `src/shared/types/index.ts` - exports all types and DEFAULT_DESIGN/EMPTY_CV constants
- `src/features/editor/hooks/index.ts` - exports editor-specific hooks
- `src/features/editor/components/index.ts` - exports editor components
- `src/features/editor/templates/index.ts` - exports CV templates

**No re-export chains:** Direct imports from source files used when crossing features (avoids circular dependencies).

## State Management Patterns

**useState:** 
- Used for local UI state (activeTab, expandedSection, isExporting)
- Example: `const [zoom, setZoom] = useState(85)`
- Default initialization: `const [isAutoZoom, setIsAutoZoom] = useState(enabled)`

**useRef:** 
- Used to track one-time operations: `const dataLoaded = useRef(false)`
- Used to hold DOM references: `const cvRef = useRef<HTMLDivElement>(null)`
- Pattern for preventing multiple initializations:
```typescript
const dataLoaded = useRef(false);
useEffect(() => {
  if (dataLoaded.current) return;
  dataLoaded.current = true;
  // initialization logic
}, [dependencies]);
```

**useMutation/useQuery:** Convex operations (not local React state)

## Component Patterns

**Functional components with hooks:** All components are functional (no classes except ErrorBoundary).

**Error Boundary is class-based:** `ErrorBoundary.tsx` uses `Component`, `getDerivedStateFromError`, `componentDidCatch` for crash handling.

**Controlled inputs:** Input components use `forwardRef` to expose refs while managing their own validation styling:
```typescript
export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, mono = true, className, id, ...props }, ref) => (
    <input ref={ref} {...props} />
  ),
);
```

**Variant-based UI systems:** 
- `Button.tsx` uses `variantStyles` and `sizeStyles` Record objects
- `displayModes.ts` exports mode arrays with metadata: `{ value: 'hidden', label: 'Masqué', icon: '⊘', color: '#9ca3af' }`

---

*Conventions analysis: 2026-04-09*
