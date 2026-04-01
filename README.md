# Calibre — Optimisez votre CV avec l'IA

Application web de création et d'optimisation de CV propulsée par Gemini AI. Importez votre CV, collez une offre d'emploi, et l'IA adapte votre parcours pour maximiser votre score ATS.

**[→ Essayer en ligne](https://cv-builder-indol-three.vercel.app)**

## Stack technique

| Couche | Technologie |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite · TailwindCSS v4 |
| **Backend** | Convex (BaaS temps réel) |
| **Auth** | Clerk (Google OAuth + mode invité) |
| **IA** | Google Gemini (serveur Convex — clé jamais exposée côté client) |
| **UI** | Design System custom (15 composants) · Lucide Icons · Motion |
| **Deploy** | Vercel (frontend) · Convex Cloud (backend) |

## Fonctionnalités

- 📄 **Import CV** — PDF upload avec extraction IA automatique
- ✏️ **Création from scratch** — Formulaire complet sans PDF requis
- 🎯 **Optimisation ATS** — Adapte le CV aux mots-clés de l'offre d'emploi
- 📊 **Analyse ATS** — Score de compatibilité, mots-clés manquants, conseils
- ✨ **Suggestions IA inline** — Amélioration par bullet point avec 3 alternatives
- 📝 **Lettre de motivation IA** — Générée à partir du CV + offre, 4 tons disponibles
- 🎨 **6 templates pro** — Classic, Modern, Minimal, Creative, Elegant, Sidebar
- 🎛️ **Personnalisation** — Couleurs, typographie, sections, photo, presets thèmes
- 📥 **Export PDF & DOCX** — Téléchargement dans les deux formats
- 💾 **Sauvegarde cloud** — CVs et lettres stockés dans Convex
- 📱 **Responsive** — Mobile, tablet, desktop
- 🔒 **Sécurisé** — Clés API serveur-only, auth Clerk, safeParseJSON

## Architecture

```
src/
├── shared/                    # Couche partagée
│   ├── types/                 # CVData, DesignSettings, ATSResult, EMPTY_CV
│   ├── hooks/                 # useDebounce, useMediaQuery, useAutoNotification
│   ├── ui/                    # Design System (15 composants)
│   │   ├── Button.tsx         # 4 variants, 3 sizes, loading, mono
│   │   ├── Input.tsx          # Labeled, mono typography
│   │   ├── Textarea.tsx       # Labeled textarea
│   │   ├── Select.tsx         # Labeled select with options
│   │   ├── Panel.tsx          # Panel + PanelHeader + PanelBody
│   │   ├── Accordion.tsx      # Collapsible sections
│   │   ├── Toggle.tsx         # On/off switch
│   │   ├── Chip.tsx           # Selectable option chips
│   │   ├── StatCard.tsx       # Metric display
│   │   ├── Dropzone.tsx       # File upload
│   │   ├── Notification.tsx   # Toast feedback
│   │   ├── ConfirmModal.tsx   # Confirmation dialog
│   │   ├── ErrorBoundary.tsx  # React error catch
│   │   └── Spinner.tsx        # Loading states
│   └── lib/
│       ├── cn.ts              # Tailwind merge
│       └── export-docx.ts     # DOCX generation
├── features/                  # Feature modules (Arkanes pattern)
│   ├── auth/                  # AuthPage, ProtectedRoute, SyncUser
│   ├── landing/               # HomePage, Layout
│   ├── dashboard/             # Dashboard barrel
│   ├── editor/                # Editor barrel + CV templates
│   │   └── templates/         # CVRenderer, shared helpers
│   └── cover-letter/          # CoverLetterPage
├── pages/                     # Page components (migration incrémentale)
├── App.tsx                    # Routes (lazy-loaded)
├── main.tsx                   # Providers + ErrorBoundary
└── index.css                  # Design tokens + global styles

convex/
├── schema.ts                  # 3 tables: users, cvs, coverLetters
├── ai.ts                      # 8 actions IA serveur (use node)
├── users.ts                   # Queries/mutations users
├── cvs.ts                     # Queries/mutations CVs + getById
├── coverLetters.ts            # CRUD lettres de motivation
└── auth.config.js             # Clerk auth config
```

## Installation

```bash
git clone https://github.com/Johnjohnbei/cv-builder.git
cd cv-builder
npm install
cp .env.example .env.local
# Remplir .env.local avec vos clés (voir ci-dessous)
npx convex dev          # Terminal 1 — backend
npm run dev             # Terminal 2 — frontend (http://localhost:3000)
```

## Variables d'environnement

| Variable | Où | Description |
|---|---|---|
| `VITE_CONVEX_URL` | `.env.local` | URL du déploiement Convex |
| `VITE_CLERK_PUBLISHABLE_KEY` | `.env.local` | Clé publique Clerk |
| `CLERK_SECRET_KEY` | `.env.local` | Clé secrète Clerk |
| `GEMINI_API_KEY` | **Convex env vars** | Clé API Google Gemini (côté serveur uniquement) |

> ⚠️ `GEMINI_API_KEY` n'est **pas** dans `.env.local` — elle est configurée dans les variables d'environnement Convex via `npx convex env set GEMINI_API_KEY <key>`.

## Performance

| Métrique | Valeur |
|---|---|
| Chunk initial | **188 KB** (was 1,319 KB — -86%) |
| Pages lazy-loaded | 6 routes |
| Vendor splitting | react, clerk, convex, pdf, ui, docx |
| Build time | ~3s |

## Scripts

```bash
npm run dev        # Dev server (port 3000)
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # TypeScript type check
```

## Licence

MIT
