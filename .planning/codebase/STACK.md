# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript ~5.8.2 - Full codebase (frontend + backend)
- JavaScript - Legacy config files (`convex/auth.config.js`)

**Secondary:**
- JSX/TSX - React component files
- CSS - Tailwind CSS styling

## Runtime

**Environment:**
- Node.js (via npm, implicit version from `.node-version` or nvmrc)

**Package Manager:**
- npm (lockfile: `package-lock.json` expected but not verified)

## Frameworks

**Core:**
- React 19.2.4 - UI framework
- React Router DOM 7.14.0 - Client-side routing (`src/App.tsx`)
- Convex 1.34.1 - Backend as a service (BaaS) with built-in database

**Testing:**
- Vitest 4.1.2 - Unit/integration test runner
  - Config: `vite.config.ts` with `test` section
  - Test files: `**/*.test.ts` pattern
  - Run commands: `npm test` (run), `npm run test:watch` (watch)

**Build/Dev:**
- Vite 6.2.0 - Dev server and build tool
- @vitejs/plugin-react 5.0.4 - React fast refresh
- @tailwindcss/vite 4.2.2 - Tailwind CSS integration (v4)
- TypeScript 5.8.2 - Type checking (`npm run lint`)
- tsx 4.21.0 - TypeScript execution (dev dependency)

## Key Dependencies

**Critical:**

- `@clerk/clerk-react` 5.61.4 - Authentication provider
  - Integrates with Convex via `convex/react-clerk` 1.34.1
  - Provides `ClerkProvider`, `useAuth()`, `useUser()` hooks
  - SSO callback routing at `/sso-callback`

- `convex/react` 1.34.1 - Convex client SDK (auto-subscriptions)
- `convex/react-clerk` 1.34.1 - Convex + Clerk integration layer
- `openai` 6.33.0 - OpenAI SDK for API calls (used server-side via actions)

**AI/LLM:**
- `@google/genai` 1.48.0 - Google Generative AI (Gemini) client
- Multi-provider support: NVIDIA NIM (primary), Gemini (fallback)
  - Configured in `convex/ai.ts` with environment variable switching
  - NVIDIA NIM: `https://integrate.api.nvidia.com/v1` with models like `meta/llama-3.1-70b-instruct`
  - Gemini: `https://generativelanguage.googleapis.com/v1beta/openai/` endpoint

**PDF Processing:**
- `pdfjs-dist` 5.6.205 - Client-side PDF text extraction
  - Uses bundled `pdf.worker.mjs` via `import.meta.url`
  - Function: `src/lib/pdfTextExtract.ts`
  - No server API call required

**Document Generation:**
- `docx` 9.6.1 - Word document (.docx) generation for exports
- `file-saver` 2.0.5 - Browser file download API wrapper

**UI Components & Styling:**
- `lucide-react` 1.7.0 - Icon library (Linkedin, delete icons, etc.)
- `motion` 12.38.0 - Animation library (likely for page transitions)
- `clsx` 2.1.1 - Conditional class name utility
- `tailwind-merge` 3.5.0 - Merge Tailwind CSS classes
- `tailwindcss` 4.2.2 - CSS framework (dev dependency)
- `autoprefixer` 10.4.27 - PostCSS vendor prefixing

**Markdown & File Upload:**
- `react-markdown` 10.1.0 - Render markdown to React components
- `react-dropzone` 15.0.0 - Drag-and-drop file upload

**Utilities:**
- `@types/node` 25.5.2 - TypeScript types for Node.js APIs

## Configuration

**Environment:**
- Variables defined in `.env.example`:
  - `VITE_CONVEX_URL` - Convex deployment URL (set by Vercel build)
  - `VITE_CLERK_PUBLISHABLE_KEY` - Clerk public key (loaded in `src/main.tsx`)
  - `CLERK_SECRET_KEY` - Clerk secret (Convex env var only)
  - `NVIDIA_API_KEY` - LLM provider (Convex env var)
  - `GEMINI_API_KEY` - Fallback LLM (Convex env var)

- TypeScript config: `tsconfig.json`
  - Target: ES2022
  - Module resolution: bundler
  - Path alias: `@/*` → root directory
  - Strict JSX mode
  - No emit (type-check only)

- Vite config: `vite.config.ts`
  - Plugins: React, Tailwind CSS
  - Manual code splitting (vendor chunks: react, clerk, convex, pdf, ui)
  - HMR disabled via `DISABLE_HMR` env var
  - Tailwind CSS inlined (no separate build step)

**Build:**
- Vercel: `vercel.json` with custom build command
  - Build: `npx convex deploy --cmd "npx vite build" --cmd-url-env-var-name VITE_CONVEX_URL`
  - Rewrites: SPA fallback to `/index.html`
- Output: `dist/` (from `npm run build`)
- Clean: `npm run clean` (removes `dist/`)

## Platform Requirements

**Development:**
- Node.js (version not pinned in visible files)
- npm (or yarn/pnpm with package-lock.json)

**Production:**
- Vercel (deployment platform configured in `vercel.json`)
- Convex backend hosting (configured via `convex.json`)
  - Functions directory: `convex/`
  - Clerk auth integration via `convex/auth.config.js`

---

*Stack analysis: 2026-04-09*
