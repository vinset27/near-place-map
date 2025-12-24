## Déploiement rapide sur Cloudflare (nouveau projet) via Wrangler

Ce dossier **ne modifie pas** l’app existante. Il sert uniquement de guide pour créer et déployer un **nouveau** projet Cloudflare.

### Prérequis
- Un compte Cloudflare
- Node.js installé

### 1) Login Wrangler

```bash
npx wrangler@latest login
```

### 2) Build du projet (dans la racine du repo)

Depuis la racine `Near-Place/Near-Place` :

```bash
npm run build
```

Le build sort dans `dist/public`.

### 3) Déployer sur Cloudflare Pages (création d’un nouveau projet)

Choisis un nom unique (ex: `near-place-oshow-dev`) :

```bash
npx wrangler@latest pages deploy dist/public --project-name near-place-oshow-dev
```

Wrangler va créer le projet Pages s’il n’existe pas, et publier le site.

### Notes
- Le routage SPA est géré côté app; si Cloudflare te renvoie des 404 sur refresh, on ajoutera un petit fichier `_redirects` (ou config Pages) pour tout renvoyer vers `index.html`.


