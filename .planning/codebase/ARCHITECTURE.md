# Architecture

**Analysis Date:** 2026-04-09

## Pattern Overview

**Overall:** Fullstack React + Convex BaaS with feature-driven UI structure

**Key Characteristics:**
- Client-side reactive state management via Convex hooks (useQuery, useMutation, useAction)
- Feature-based organization with co-located components, hooks, and utilities
- Template-based CV rendering with memoization optimization
- Backend authentication via Clerk + Convex identity validation
- AI integration via pluggable provider abstraction (NVIDIA NIM primary, Gemini fallback)
- Display mode system for content optimization (experience and skills visibility control)

## Layers

**Presentation (React Components):**
- Purpose: Render UI, handle user interactions, manage local UI state
- Location: `src/features/`, `src/pages/`, `src/shared/ui/`
- Contains: Page components, feature components, UI atoms
- Depends on: React Router, Clerk auth context, Convex hooks, shared types/utilities
- Used by: React DOM via entry point `src/main.tsx`

**Data Management (Convex + React Hooks):**
- Purpose: Fetch, cache, and mutate server state; sync client state with server
- Location: `convex/` (backend), React components via hooks
- Contains: Query resolvers (cvs.listMyCVs), mutations (cvs.createMyCV), actions (ai.optimizeCVForPage)
- Depends on: Clerk identity for auth, Convex database schema
- Used by: All components via `useQuery()`, `useMutation()`, `useAction()` from convex/react

**Authentication & Authorization:**
- Purpose: Verify user identity and enforce access control
- Location: `src/features/auth/`, Clerk SDK, Convex identity context
- Contains: ProtectedRoute HOC, SyncUser component, access code verification
- Depends on: Clerk for credential management, Convex auth context for backend
- Used by: App.tsx routing, protected features

**Business Logic (Display Modes & Optimization):**
- Purpose: Compute visibility/rendering of CV sections based on job match and page constraints
- Location: `src/features/editor/lib/` (scoring.ts, displayModes.ts)
- Contains: Relevance scoring, keyword extraction, display mode assignment, date formatting
- Depends on: CV data types, job description
- Used by: EditorPage, CVRenderer, templates

**Template System (Dynamic Rendering):**
- Purpose: Render CV content in different visual layouts
- Location: `src/features/editor/templates/`
- Contains: Template components (TemplateA-F), shared utilities (shared.tsx), CVRenderer dispatcher
- Depends on: Design settings, display mode computations, CV data structure
- Used by: EditorPage preview rendering, PDF export

**Utilities & Helpers:**
- Purpose: Shared functions, type definitions, UI utilities
- Location: `src/shared/` (types, hooks, lib, ui), `src/lib/`
- Contains: Type definitions (CVData, DesignSettings), hooks (useAccessCode, useAutoZoom), export functions (pdfExport.ts)
- Depends on: React, third-party libraries (pdfjs, docx)
- Used by: All layers

## Data Flow

**CV Import → Editor Flow:**

1. User uploads PDF via DashboardPage dropzone
2. `parseLinkedInPDF()` extracts text and structure from PDF (`src/lib/linkedinParser.ts`)
3. Text extraction via pdfjs: `extractTextFromPDF()` (`src/lib/pdfTextExtract.ts`)
4. User clicks "Optimize for Job" → calls AI action `ai.optimizeCVForPage`
5. Convex action calls OpenAI-compatible provider (NVIDIA NIM or Gemini)
6. AI returns structured CV JSON with experience/skills/education
7. Response stored in user profile via `users.updateLastGeneratedCV` mutation
8. Client-side `useCVLoader` hook loads lastGeneratedCV data into EditorPage state
9. `autoAssignModes()` computes display modes for each experience based on job keywords
10. CVRenderer memoizes to prevent re-renders, dispatches to selected Template component
11. Template renders sections based on display mode visibility

**Job Description → Display Optimization:**

1. User pastes job description in EditorPage
2. `extractKeywords()` parses job text into keyword list
3. For each experience: `scoreExperience()` computes relevance (0-100)
4. `autoAssignModes()` assigns displayMode ('hidden' | 'compact' | 'normal' | 'extended') based on:
   - Experience score (job relevance)
   - Page budget (1-4 pages max)
   - Visibility heuristics (extended exp shows intro + 4 bullets + KPI)
5. State updates trigger re-render
6. `useOverflowDetection` hook monitors if content exceeds page height
7. If overflow detected, adjusts zoom or visibility to fit

**PDF Export Flow:**

1. User clicks "Download PDF" in EditorPage
2. `renderPDF()` creates hidden iframe with CV content
3. Copies all Tailwind/Vite stylesheets into iframe
4. Clones CVRenderer output (with current zoom, visibility, design settings)
5. Calls browser `print()` dialog (user selects "Save as PDF")
6. Browser print engine renders CSS same as screen preview (WYSIWYG)

**State Management Pattern:**

- **Server state:** Persisted in Convex (cvs, users, coverLetters tables)
- **Client state:** React useState in EditorPage (cvData, designSettings, selectedTemplate, UI flags)
- **Auth state:** Clerk useAuth + Convex identity + sessionStorage flag for guest access
- **Session state:** localStorage for guest-mode CV data (`guest_last_optimized`)
- **Sync mechanism:** Convex hooks auto-sync when mutations complete, triggering component re-renders

## Key Abstractions

**CVData Structure:**
- Purpose: Single source of truth for all CV information (content + design + visibility)
- Examples: `src/shared/types/index.ts`, `convex/schema.ts` cvs table
- Pattern: Immutable updates via spread operator (never mutate CVData directly)

**Display Mode System:**
- Purpose: Control visibility of experience/skill sections without deletion
- Examples: `ExperienceDisplayMode` ('hidden' | 'compact' | 'normal' | 'extended')
- Pattern: Stored on each Experience object, computed by displayModes.ts functions

**Design Settings:**
- Purpose: Encapsulate CV visual appearance (colors, fonts, layout, page limit)
- Examples: `DesignSettings` in types, persisted on cvData.design
- Pattern: Passed to template components as prop, uses Tailwind dynamic color classes

**Template Map:**
- Purpose: Registry pattern for dynamic template selection
- Examples: `TEMPLATE_MAP` in `src/features/editor/templates/CVRenderer.tsx`
- Pattern: Record<string, React.ComponentType<TemplateProps>> dispatches to correct renderer

**AI Provider Abstraction:**
- Purpose: Support multiple AI providers without client code changes
- Examples: `getProvider()` in `convex/ai.ts` returns AIProvider interface
- Pattern: OpenAI-compatible API used by all providers, single getClient() function

## Entry Points

**Web Application:**
- Location: `src/main.tsx`
- Triggers: User visits app URL
- Responsibilities: Bootstrap React app, initialize Clerk + Convex providers, set up global error boundary

**Router:**
- Location: `src/App.tsx`
- Triggers: Route navigation
- Responsibilities: Route requests to pages, apply ProtectedRoute wrapper, code-split lazy load pages

**Editor Page:**
- Location: `src/pages/EditorPage.tsx`
- Triggers: User navigates to `/editor/:id?`
- Responsibilities: Load CV from Convex or localStorage, manage editing UI (tabs, sidebar), coordinate AI actions

**Dashboard Page:**
- Location: `src/pages/DashboardPage.tsx`
- Triggers: User navigates to `/dashboard`
- Responsibilities: List saved CVs, upload PDF, call AI to generate initial CV structure

## Error Handling

**Strategy:** Multi-layer defensive coding with user-friendly messaging

**Patterns:**
- **Auth checks:** Every Convex mutation/query checks `ctx.auth.getUserIdentity()` and throws "Unauthenticated"
- **Access control:** CVs/coverLetters queries verify userId matches identity.subject before returning
- **Form validation:** Input fields validate on change (Button disables if required fields empty)
- **AI responses:** JSON parsing wrapped in try-catch with fallback error messages in French
- **PDF export:** iframe creation wrapped with document checks; print dialog handles user cancellation
- **Global boundary:** `src/shared/ui/ErrorBoundary.tsx` catches React rendering errors

## Cross-Cutting Concerns

**Logging:** Console methods used sparingly; AI response errors logged with first 300 chars for debugging

**Validation:** 
- Zod-style validators used in Convex schema (v.object, v.array, v.any for flexible AI output)
- Client-side validation on form inputs (min length, email format via HTML5)

**Authentication:** 
- Clerk provider wraps app in main.tsx
- useAuth hook checks isSignedIn + isLoaded before rendering protected content
- sessionStorage flag for guest access mode (temporary CVs in localStorage)

**Internationalization:** UI primarily in French (section titles, button labels, error messages)

**Performance Optimization:**
- CVRenderer wrapped with memo() to skip re-renders when only sidebar UI state changes
- Templates use memoized display mode computations
- useOverflowDetection debounces resize checks to avoid excessive recalculations
- Vite code-splitting for lazy-loaded pages (HomePage, EditorPage, etc.)

---

*Architecture analysis: 2026-04-09*
