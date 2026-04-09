# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**Authentication & Identity:**
- Clerk - User authentication provider
  - SDK: `@clerk/clerk-react` 5.61.4
  - Config: `convex/auth.config.js` with domain `https://improved-mayfly-32.clerk.accounts.dev`
  - Env vars: `VITE_CLERK_PUBLISHABLE_KEY` (client), `CLERK_SECRET_KEY` (server)
  - Integration: `src/main.tsx` provides `ClerkProvider` context
  - Callback: `/sso-callback` route handles OAuth redirects
  - User sync: `src/features/auth/components/SyncUser.tsx` mutations `api.users.store` on auth state change

**LLM / AI Providers:**
- NVIDIA NIM (primary)
  - Endpoint: `https://integrate.api.nvidia.com/v1`
  - Models: `meta/llama-3.1-70b-instruct` (default and fast)
  - Env var: `NVIDIA_API_KEY` (set in Convex env, not .env file)
  - Rate limit: 40 req/min (free tier)
  - Used for: CV extraction, tailoring, ATS analysis, cover letter generation
  - Location: `convex/ai.ts` - `getProvider()` function

- Google Generative AI / Gemini (fallback)
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/openai/`
  - Model: `gemini-2.5-flash`
  - Env var: `GEMINI_API_KEY` (Convex env)
  - SDK: `@google/genai` 1.48.0
  - Location: `convex/ai.ts` - fallback in `getProvider()`

- OpenAI SDK
  - Package: `openai` 6.33.0
  - Used to call both NVIDIA NIM and Gemini via OpenAI-compatible APIs
  - Functions: `chatJSON()`, `chatText()` helpers in `convex/ai.ts`
  - Features: JSON mode with fallback (some NIM models don't support `response_format`)

**Web Content Extraction:**
- Jina Reader (free)
  - Endpoint: `https://r.jina.ai/{url}`
  - Purpose: Extract and render job posting from URLs (handles JS, SPAs, accordions)
  - Location: `convex/ai.ts` in `extractJobDescriptionFromURL` action (lines 343-350)
  - Fallback: Direct HTTP fetch if Jina fails
  - No auth required (free service)

## Data Storage

**Databases:**
- Convex (serverless database)
  - Type: Hosted NoSQL (JSON-based)
  - Client: Built-in Convex client (`convex/react`)
  - Connection: `VITE_CONVEX_URL` (e.g., `https://xxxxx.convex.cloud`)
  - Auth: Clerk integration via `convex/react-clerk`

**Schema:**
- `users` table - User profile & CV state
  - Fields: `userId` (from Clerk), `email`, `fullName`, `baseCV`, `lastGeneratedCV`, `lastJobDescription`, timestamps
  - Index: `by_userId`
  - Mutations: `users.store` (sync from Clerk), `users.updateLastGeneratedCV`
  - Queries: `users.getMe`

- `cvs` table - Saved CV documents
  - Fields: `userId`, `title`, `personal_info`, `experience`, `education`, `skills`, `languages`, `design`, `jobDescription`, timestamps
  - Index: `by_userId`
  - CRUD: `listMyCVs` (query), `createMyCV` (mutation), `remove` (mutation), `patch` (mutation)

- `coverLetters` table - Generated cover letters
  - Fields: `userId`, `cvId`, `jobDescription`, `companyName`, `subject`, `greeting`, `body`, `closing`, timestamps
  - Index: `by_userId`

- `accessCodes` table - Rate-limit / early-access codes
  - Fields: `code`, `maxUses`, `usedCount`, `expiresAt`, `createdAt`, `label`
  - Index: `by_code`
  - Used by: `verifyAccessCode()` in `convex/ai.ts` (can disable with `REQUIRE_ACCESS_CODE=false`)

- `accessRequests` table - User email access requests
  - Fields: `email`, `message`, `createdAt`

**File Storage:**
- Local filesystem only (no S3/cloud storage)
- PDFs uploaded by user are processed client-side only
  - PDF text extraction: `src/lib/pdfTextExtract.ts` (pdfjs-dist)
  - No server-side storage of uploaded PDFs
- Exports generated:
  - `.docx` files (Word documents) via `docx` package
  - Downloaded via `file-saver` browser API

**Caching:**
- None detected (no Redis, in-memory cache libs)

## Authentication & Identity

**Auth Provider:**
- Clerk (via `@clerk/clerk-react` and `convex/react-clerk`)
  - Implementation:
    1. Client loads Clerk config with `VITE_CLERK_PUBLISHABLE_KEY` in `src/main.tsx`
    2. `<ClerkProvider>` wraps `<ConvexProviderWithClerk>` which passes Clerk's `useAuth()` to Convex
    3. Convex receives Clerk JWT automatically in server functions
    4. `convex/auth.config.js` maps Clerk domain to "convex" app ID
  - User identity: `ctx.auth.getUserIdentity()` in Convex functions
    - Returns: `{ subject: userId, email, name, ...}`
  - Protected routes: `src/features/auth/components/ProtectedRoute.tsx` checks `useAuth().isSignedIn`
  - SSO callback: `/sso-callback` uses `<AuthenticateWithRedirectCallback />`

**Access Control:**
- Optional access codes (early access / rate limiting)
  - Env var: `REQUIRE_ACCESS_CODE` (default: allow all if not set to "true")
  - Check: `verifyAccessCode()` in `convex/ai.ts` (lines 61-73)
  - Used by all AI actions (extractCVDataFromPDF, tailorCV, etc.)
  - Endpoint: Check against `accessCodes` table

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, LogRocket, etc.)

**Logs:**
- Server-side: `console.log()` in Convex functions (e.g., AI response parsing errors)
- Client-side: Console errors via ErrorBoundary (`src/shared/ui/ErrorBoundary`)
- No centralized logging service detected

## CI/CD & Deployment

**Hosting:**
- Vercel (frontend + Convex integration)
  - Config: `vercel.json`
  - Build command: `npx convex deploy --cmd "npx vite build" --cmd-url-env-var-name VITE_CONVEX_URL`
  - Rewrites: SPA fallback to `/index.html`
  - Environment: Auto-set `VITE_CONVEX_URL` from Convex deployment

- Convex (backend)
  - Config: `convex.json` with functions directory `convex/`
  - Auth: Clerk integration via `convex/auth.config.js`
  - Deployment: Via `npx convex deploy` (triggered in Vercel build)

**CI Pipeline:**
- None detected (no GitHub Actions, Jenkins, etc.)

## Environment Configuration

**Required env vars:**

*Frontend (in `.env.local` or Vercel project settings):*
- `VITE_CONVEX_URL` - Convex deployment URL (auto-set by Vercel)
- `VITE_CLERK_PUBLISHABLE_KEY` - From Clerk Dashboard → API Keys

*Backend (Convex env, set via `npx convex env set`):*
- `NVIDIA_API_KEY` - LLM provider key (recommended)
- `GEMINI_API_KEY` - Fallback LLM key (optional)
- `CLERK_SECRET_KEY` - For Clerk auth validation
- `REQUIRE_ACCESS_CODE` - "true" to enforce access codes (optional, default: disabled)

**Secrets location:**
- Frontend: `.env.local` (not committed, gitignored)
- Backend: Convex secure environment variables (`npx convex env set KEY value`)
- GitHub: Vercel project secrets (for build-time env vars)

## Webhooks & Callbacks

**Incoming:**
- `/sso-callback` - Clerk OAuth redirect callback
  - Location: `src/App.tsx` route
  - Component: `<AuthenticateWithRedirectCallback />`
- Job description extraction endpoints:
  - `convex/ai.ts` → `extractJobDescriptionFromURL` - Web scraping with Jina Reader fallback
  - `convex/ai.ts` → `extractJobDescriptionFromPDF` - PDF text parsing

**Outgoing:**
- None detected (no webhooks sent to external services)
- Clerk authentication is pull-based (JWT verification), not webhook-based

## External Web Resources

**Parsing & Content Extraction:**
- Jina Reader: `https://r.jina.ai/{url}` - Free, no auth
- Direct HTTP fetches for job posting pages (User-Agent spoofing for LinkedIn compatibility)
  - Location: `convex/ai.ts` lines 359-386

**LinkedIn Profile Support:**
- LinkedIn URL parsing: `src/lib/linkedinParser.ts`
  - Extracts LinkedIn profile URL from CV text
  - Stored in `personal_info.linkedin` field
  - Displayed in CV templates (A-F)
  - Format: `https://www.linkedin.com/in/...`

---

*Integration audit: 2026-04-09*
