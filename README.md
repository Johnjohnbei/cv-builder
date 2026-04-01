# CV Builder — Optimisation ATS par IA

Application web de création et d'optimisation de CV propulsée par l'IA (Gemini). Analyse votre profil, adapte votre CV à chaque offre d'emploi et maximise votre score ATS.

## Stack technique

- **Frontend** : React 19 + TypeScript + Vite + TailwindCSS v4
- **Backend** : Convex (BaaS temps réel)
- **Auth** : Clerk (Google OAuth)
- **IA** : Google Gemini (extraction PDF, optimisation ATS, analyse)
- **UI** : Lucide Icons + Motion (Framer Motion)

## Fonctionnalités

- 📄 Import de CV depuis un PDF
- 🤖 Extraction intelligente des données via Gemini
- 🎯 Optimisation ATS adaptée à chaque offre d'emploi
- 📊 Analyse de compatibilité ATS avec score et recommandations
- 🎨 6 templates de CV professionnels personnalisables
- 📥 Export PDF haute qualité
- 💾 Sauvegarde dans Convex (ou localStorage pour les invités)

## Prérequis

- Node.js >= 18
- Compte [Convex](https://convex.dev)
- Compte [Clerk](https://clerk.com)
- Clé API [Google Gemini](https://ai.google.dev)

## Installation

```bash
# 1. Cloner le repo
git clone https://github.com/joaud/cv-builder.git
cd cv-builder

# 2. Installer les dépendances
npm install

# 3. Copier et remplir les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés

# 4. Lancer Convex (première fois)
npx convex dev

# 5. Lancer l'app (dans un autre terminal)
npm run dev
```

## Variables d'environnement

| Variable | Description |
|---|---|
| `VITE_CONVEX_URL` | URL de votre déploiement Convex |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clé publique Clerk |
| `CLERK_SECRET_KEY` | Clé secrète Clerk |
| `GEMINI_API_KEY` | Clé API Google Gemini |

## Structure du projet

```
├── src/
│   ├── components/     # Composants réutilisables (Layout, ProtectedRoute, SyncUser)
│   ├── pages/          # Pages (Home, Auth, Dashboard, Editor)
│   ├── services/       # Services IA (Gemini)
│   ├── types/          # Types TypeScript
│   ├── lib/            # Utilitaires (cn)
│   └── main.tsx        # Point d'entrée
├── convex/
│   ├── schema.ts       # Schéma de la base de données
│   ├── users.ts        # Mutations/queries utilisateurs
│   ├── cvs.ts          # Mutations/queries CV
│   └── auth.config.js  # Config auth Clerk
├── index.html
├── vite.config.ts
└── package.json
```

## Licence

MIT
