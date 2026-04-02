# KNOWLEDGE — CV Builder (Calibre)

## À faire au démarrage de la prochaine session

**Poser ces questions immédiatement à l'utilisateur :**

1. **Export PDF** : As-tu testé l'export PDF après le passage à `html2canvas-pro` ? L'erreur oklch est-elle résolue ?
2. **Qualité IA** : As-tu testé l'optimisation CV avec un vrai CV + offre d'emploi ? Les données sont-elles bien conservées (rien de supprimé) ?
3. **Clerk prod** : Veux-tu migrer vers des clés Clerk de production (`pk_live_*`) maintenant ou plus tard ?

## Architecture

- **Frontend** : React + Vite + Tailwind v4 (utilise oklch par défaut)
- **Auth** : Clerk (instance dev `improved-mayfly-32`, JWT template "convex" configuré)
- **Backend** : Convex (dev: `necessary-bobcat-348`, prod: `cautious-mule-560`)
- **IA** : Google Gemini via `@google/genai` (Pro pour extraction/optimisation, Flash pour analyse ATS et pagination)
- **PDF** : `html2canvas-pro` + `jspdf` (html2canvas-pro = fork supportant oklch)
- **Deploy** : Vercel (https://cv-builder-indol-three.vercel.app)

## Règles apprises

- `html2canvas` ne supporte PAS oklch (Tailwind v4 default). Utiliser `html2canvas-pro` à la place.
- Convex `npx convex logs` hang indéfiniment sur Windows — ne jamais l'utiliser, vérifier les erreurs via le dashboard web ou les logs console côté client.
- Les env vars Convex doivent être configurées séparément pour dev ET prod (`npx convex env set KEY VALUE --prod`).
- Port 3000 souvent occupé par d'autres projets (Coeurdar, etc.) — le dev server Vite peut finir sur 3006+.
- Les prompts IA doivent explicitement interdire la suppression de données ("NE SUPPRIME JAMAIS").

## Déploiements

| Service | Dev | Prod |
|---------|-----|------|
| Convex | `necessary-bobcat-348` | `cautious-mule-560` |
| Vercel | — | `cv-builder-indol-three.vercel.app` |
| Clerk | `improved-mayfly-32` (dev keys) | À migrer |
