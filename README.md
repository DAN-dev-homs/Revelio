# Revelio

**Revelio** est une plateforme web d'enseignements chrétiens : catalogue multimédia (vidéo, audio, texte), suivi de progression, communauté, profils avec badges, et panneau d'administration complet. L'application est livrée en **monolithe Node.js** (API + frontend statique) pour un déploiement simple, avec une architecture prête pour la montée en charge via PostgreSQL, Cloudinary et scaling horizontal.

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Structure du projet](#structure-du-projet)
- [Fonctionnalités](#fonctionnalités)
- [Modèle de données](#modèle-de-données)
- [Design system & UX](#design-system--ux)
- [Installation](#installation)
- [Démarrage](#démarrage)
- [Variables d'environnement](#variables-denvironnement)
- [Déploiement](#déploiement)
- [Scalabilité & performance](#scalabilité--performance)
- [API REST](#api-rest)
- [Technologies](#technologies)
- [Sécurité](#sécurité)

---

## Vue d'ensemble

| Composant | Description |
|-----------|-------------|
| **Application utilisateur** | SPA mobile-first (`index.html`) — Accueil, Explorer, Communauté, Profil, fiche enseignement |
| **Panneau admin** | Interface dédiée (`admin.html`) — gestion contenus, utilisateurs, stats, messages |
| **Page À propos** | Site vitrine (`about.html`) — mission, équipe, partenaires, formulaire de contact |
| **API REST** | Express.js sous `/api/*` — JWT, uploads Cloudinary |
| **Base de données** | SQLite (dev local) ou PostgreSQL (production) |

---

## Architecture

### Schéma global

```mermaid
flowchart TB
    subgraph Client
        SPA[SPA utilisateur<br/>index.html]
        Admin[Admin panel<br/>admin.html]
        About[Page À propos<br/>about.html]
    end

    subgraph Serveur["Node.js / Express"]
        Static[Serveur statique<br/>frontend/]
        API[API REST /api]
        MW[Middlewares<br/>auth · rate limit · compression]
    end

    subgraph Données
        DB[(SQLite / PostgreSQL)]
        Cloudinary[Cloudinary<br/>médias]
    end

    SPA --> Static
    Admin --> Static
    About --> Static
    SPA --> API
    Admin --> API
    About --> API
    API --> MW
    MW --> DB
    API --> Cloudinary
```

### Principes

- **Monolithe stateless** : une instance Node sert le frontend et l'API ; plusieurs instances peuvent tourner derrière un load balancer (Render, Docker).
- **Pas de build frontend** : JavaScript modulaire (IIFE), CSS par couches, chargement direct des scripts.
- **Abstraction base de données** : `database.js` expose une API `prepare()` compatible SQLite et PostgreSQL (`?` converti en `$1, $2…` côté Postgres).
- **Médias externalisés** : images, vidéos et audios des enseignements sont stockés sur **Cloudinary** (upload direct navigateur pour les grosses vidéos admin).

### Pipeline d'une requête

1. **Compression gzip** + en-têtes de sécurité
2. **Rate limiting** (300 req/min API, 30 tentatives / 15 min sur login/register)
3. Fichiers statiques (cache 7 jours sur CSS/JS/images)
4. Injection `req.db` sur les routes API
5. Middleware **JWT** (`Authorization: Bearer`) sur les routes protégées
6. Fallback SPA → `index.html` pour le routing côté client

### Résolution du chemin frontend

Le serveur détecte automatiquement le dossier `frontend/` (racine du repo ou copie Docker dans `backend/frontend`) via `middleware/performance.js`.

---

## Structure du projet

```
REVELIO/
├── server.js                      # Point d'entrée racine → backend/server.js
├── package.json                   # npm start (depuis la racine)
├── Dockerfile                     # Image production (backend + frontend)
├── docker-compose.yml
├── render.yaml                    # Déploiement Render
│
├── backend/
│   ├── server.js                  # Express : static + API + fallback SPA
│   ├── database.js                # Schéma, seed, SQLite / PostgreSQL
│   ├── database/
│   │   └── indexes.js             # Index de performance
│   ├── middleware/
│   │   ├── auth.js                # JWT + garde admin
│   │   ├── rateLimit.js           # Limitation de débit
│   │   └── performance.js         # Headers sécurité, cache, chemin frontend
│   ├── config/
│   │   └── cloudinary.js          # Upload / suppression médias
│   ├── routes/
│   │   ├── auth.js                # Login, register
│   │   ├── books.js               # Enseignements, progression, favoris
│   │   ├── community.js           # Posts, likes, commentaires
│   │   ├── profile.js             # Profil, avatar, recherche
│   │   ├── notifications.js     # Notifications utilisateur
│   │   ├── admin.js               # Administration complète
│   │   └── about.js               # Stats publiques, contact
│   ├── migrations/
│   └── uploads/                   # Fichiers temporaires (avatars locaux)
│
└── frontend/
    ├── index.html                 # Application principale (SPA)
    ├── admin.html                 # Panneau administrateur
    ├── about.html                 # Page institutionnelle
    ├── manifest.webmanifest       # PWA
    └── assets/
        ├── css/
        │   ├── variables.css      # Design tokens
        │   ├── base.css           # Reset, layout, splash
        │   ├── animations.css     # Keyframes, stagger, transitions
        │   ├── components.css     # UI (nav, cards, mini-player…)
        │   ├── admin.css          # Styles admin
        │   └── about.css          # Styles page À propos
        ├── js/
        │   ├── app.js             # Routeur SPA (hash)
        │   ├── api.js             # Client REST
        │   ├── i18n.js            # FR / EN
        │   ├── home.js            # Accueil
        │   ├── explore.js         # Catalogue enseignements
        │   ├── book_detail.js     # Fiche enseignement (vidéo, timer, audio)
        │   ├── community.js       # Fil communautaire
        │   ├── profile.js         # Profil personnel
        │   ├── public_profile.js  # Profil public
        │   ├── notifications.js   # Panneau + polling optimisé
        │   ├── audio_manager.js   # Lecteur audio global + mini-player
        │   ├── admin.js           # Logique panneau admin
        │   └── about.js           # Page À propos
        ├── i18n/
        │   ├── fr.json
        │   └── en.json
        └── images/
```

---

## Fonctionnalités

### Application utilisateur (SPA)

| Module | Fonctionnalités |
|--------|-----------------|
| **Accueil** | Message de bienvenue, série de jours (streak), catégories, enseignements en cours, suggestions |
| **Explorer** | Liste paginée, filtres (catégorie, niveau, durée), recherche titre/auteur, sauvegarde |
| **Fiche enseignement** | Vidéo, audio, résumé, points clés, timer de lecture, progression %, partage, lien Amazon |
| **Communauté** | Posts (témoignage / réflexion), images, likes, commentaires, recherche de membres |
| **Profil** | Stats, enseignements sauvegardés, historique, paramètres, avatar, mot de passe, église |
| **Profil public** | Consultation d'un autre membre (stats, badge) |
| **Notifications** | Panneau latéral, badge non lus, son discret, marquage lu à l'ouverture |
| **Audio** | Mini-player persistant, vitesse de lecture, reprise de progression |
| **i18n** | Français et anglais (fichiers JSON) |

### Système de progression & badges

- **Sessions de lecture** : progression 0–100 % par enseignement (`reading_sessions`)
- **Timer** : validation de lecture sur la fiche enseignement
- **Heures totales** : incrémentées à la complétion (100 %)
- **Badges automatiques** : silver (30), gold (100), diamond (200) enseignements terminés
- **Badges manuels** : attribuables par un admin (non écrasés par le calcul auto, sauf bronze)

### Page À propos (`about.html`)

- Statistiques publiques (utilisateurs, enseignements…)
- Équipe et partenaires
- **Formulaire de contact** → table `contact_messages`

### Panneau administrateur (`admin.html`)

| Section | Capacités |
|---------|-----------|
| **Monitoring** | Utilisateurs, enseignements, engagement, activité récente, top lecteurs, enseignements populaires |
| **Enseignements** | CRUD, couverture / vidéo / audio, tags, catégories, upload Cloudinary direct (vidéos) |
| **Utilisateurs** | Liste, recherche, création, édition rôle, reset mot de passe, badges |
| **Communauté** | Modération des posts (liste, recherche, suppression) |
| **Notifications** | Envoi ciblé ou broadcast à tous les utilisateurs |
| **Équipe & partenaires** | CRUD avec photos/logos Cloudinary |
| **Messages de contact** | Lecture intégrale, modale détail, marquer lu, supprimer |
| **Catégories** | Ajout de catégories pour le catalogue |

### Médias & uploads

- **Cloudinary** : stockage CDN des couvertures, vidéos, audios, avatars, équipe, partenaires
- **Signature d'upload** (`GET /api/admin/upload-signature`) : upload vidéo direct depuis le navigateur (évite timeout 502)
- **Multer** : réception temporaire sur disque (max 100 Mo par fichier média admin)

---

## Modèle de données

| Table | Rôle |
|-------|------|
| `users` | Comptes, rôles (`user` / `admin`), avatar, streak, heures, badge, église |
| `books` | Enseignements (titre, auteur, catégorie, niveau, durée, médias, résumé, Amazon) |
| `book_tags` | Tags par enseignement |
| `book_likes` | Likes sur enseignements |
| `reading_sessions` | Progression par utilisateur / enseignement |
| `reading_activity` | Historique d'activité de lecture |
| `saved_books` | Enseignements sauvegardés |
| `posts` | Publications communauté |
| `post_likes` | Likes sur posts |
| `comments` | Commentaires |
| `notifications` | Notifications (system, like, comment…) |
| `categories` | Catégories du catalogue |
| `team_members` | Équipe (page À propos) |
| `partners` | Partenaires |
| `contact_messages` | Messages du formulaire de contact |
| `activity_log` | Journal des actions admin |

**Index de performance** (`backend/database/indexes.js`) : notifications, posts, commentaires, sessions de lecture, favoris, livres, utilisateurs.

---

## Design system & UX

- **Mobile-first** : largeur max 480px, navigation basse fixe
- **Thème sombre** : tokens CSS (`variables.css`) — surfaces, accents rouge/mint, typographie Inter
- **Composants** : cartes enseignements, chips filtres, streak banner, posts, modales, panneau notifications
- **Animations** : transitions de page, stagger des listes, hover lift, splash animé, mini-player glassmorphism
- **Accessibilité** : labels ARIA sur la navigation, contraste texte secondaire

---

## Installation

### Prérequis

- **Node.js** ≥ 18
- **npm**
- (Production) Compte **PostgreSQL**, **Cloudinary**, secret **JWT** fort

### Depuis la racine du projet (recommandé)

```bash
npm install
```

Les dépendances sont déclarées dans le `package.json` racine et utilisent le dossier `backend/`.

### Backend seul

```bash
cd backend
npm install
```

---

## Démarrage

### Développement (racine)

```bash
npm run dev
# ou
npm start
```

- **URL** : http://localhost:3000  
- **SPA** : http://localhost:3000/  
- **Admin** : http://localhost:3000/admin.html  
- **À propos** : http://localhost:3000/about.html  
- **Health check** : http://localhost:3000/api/health  

Sans `DATABASE_URL`, la base **SQLite** locale est créée dans `backend/revelio.db` avec données de seed.

### Docker

```bash
docker compose up --build
```

### Ancienne méthode (non recommandée)

Servir le frontend séparément n'est plus nécessaire : Express sert tout sur le port 3000.

---

## Variables d'environnement

Créez un fichier `.env` à la racine ou configurez-les sur Render :

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `PORT` | Non | Port HTTP (défaut `3000`) |
| `NODE_ENV` | Non | `production` en prod |
| `JWT_SECRET` | **Oui (prod)** | Secret de signature JWT (ne pas utiliser la valeur par défaut) |
| `DATABASE_URL` | **Oui (prod)** | URL PostgreSQL (`postgresql://…`) |
| `CLOUDINARY_CLOUD_NAME` | **Oui (médias)** | Compte Cloudinary |
| `CLOUDINARY_API_KEY` | **Oui (médias)** | Clé API Cloudinary |
| `CLOUDINARY_API_SECRET` | **Oui (médias)** | Secret Cloudinary |
| `CORS_ORIGINS` | Non | Origines autorisées séparées par des virgules |
| `PG_POOL_MAX` | Non | Taille max du pool PostgreSQL (défaut `20`) |
| `PG_IDLE_TIMEOUT` | Non | Timeout idle pool (ms) |
| `PG_CONNECT_TIMEOUT` | Non | Timeout connexion pool (ms) |

Exemple `.env` :

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=votre_secret_long_et_aleatoire
DATABASE_URL=postgresql://user:pass@localhost:5432/revelio
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

---

## Déploiement

### Render (configuré via `render.yaml`)

1. Connecter le dépôt GitHub
2. Définir les variables d'environnement (PostgreSQL, Cloudinary, JWT)
3. Build : `cd backend && npm install`
4. Start : `cd backend && npm start`  
   > **Note** : pour servir le frontend depuis la racine, préférer depuis la racine : `npm start` (voir `package.json` racine) ou aligner `render.yaml` sur `npm start` à la racine après `npm install`.

### Docker

L'image copie `backend/` et `frontend/` ; exposition du port **3000**.

### Checklist production

- [ ] PostgreSQL avec `DATABASE_URL`
- [ ] `JWT_SECRET` unique et long
- [ ] Cloudinary configuré
- [ ] HTTPS (géré par Render / reverse proxy)
- [ ] Sauvegardes base de données planifiées

---

## Scalabilité & performance

| Mécanisme | Détail |
|-----------|--------|
| **Pool PostgreSQL** | Connexions configurables (`PG_POOL_MAX`) |
| **Index SQL** | Requêtes fréquentes optimisées |
| **Pagination livres** | `GET /api/books?page=1&limit=50` (max 100) — réponse `{ books, total, page, limit, hasMore }` |
| **Compression** | gzip sur les réponses API |
| **Rate limiting** | Protection API et auth |
| **Cache assets** | CSS/JS/images : 7 jours |
| **Polling notifications** | Endpoint léger `/unread-count`, 60 s (onglet actif) / 180 s (arrière-plan) |
| **Upload vidéo admin** | Direct vers Cloudinary (pas de transit long sur le serveur) |
| **Health check** | `GET /api/health` pour monitoring |

### Monter en charge (milliers d'utilisateurs)

1. **PostgreSQL** obligatoire (pas SQLite en production multi-instances)
2. **Plusieurs instances** Render / conteneurs derrière un load balancer
3. **Cloudinary** pour tous les médias
4. **CDN** optionnel devant `/assets`
5. **Évolution** : WebSockets ou push pour remplacer le polling notifications à très grande échelle

---

## API REST

Toutes les routes API sont préfixées par `/api`. Les routes protégées exigent :

```http
Authorization: Bearer <token_jwt>
```

### Santé

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/health` | Statut serveur, uptime, type de BDD |

### Authentification (`/api/auth`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/login` | Non | Connexion → `{ token, user }` |
| `POST` | `/register` | Non | Inscription |

### Enseignements (`/api/books`)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/` | Liste filtrée + pagination (`category`, `level`, `duration`, `q`, `author`, `page`, `limit`) |
| `GET` | `/categories` | Liste des catégories |
| `GET` | `/:id` | Détail + progression + tags |
| `POST` | `/:id/save` | Sauvegarder / retirer des favoris |
| `DELETE` | `/:id/save` | Retirer des favoris |
| `POST` | `/:id/like` | Like / unlike |
| `PATCH` | `/:id/progress` | Mettre à jour la progression (`progress_pct`) |

### Communauté (`/api/community`)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/posts` | Fil des posts (50 derniers) |
| `POST` | `/posts` | Créer un post (`type`, `content`, `image_url`?) |
| `POST` | `/posts/:id/like` | Like / unlike |
| `GET` | `/posts/:id/comments` | Commentaires |
| `POST` | `/posts/:id/comments` | Ajouter un commentaire |
| `DELETE` | `/posts/:id` | Supprimer son post |
| `POST` | `/upload-image` | Upload image post → Cloudinary |

### Profil (`/api/profile`)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/me` | Profil connecté |
| `PATCH` | `/me` | Modifier nom, église |
| `PATCH` | `/password` | Changer le mot de passe |
| `POST` | `/avatar` | Upload avatar |
| `GET` | `/search?q=` | Rechercher des utilisateurs |
| `GET` | `/:id` | Profil public |
| `GET` | `/saved-books` | Enseignements sauvegardés |
| `GET` | `/reading` | Enseignements en cours |
| `GET` | `/posts-history` | Historique de posts |

### Notifications (`/api/notifications`)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/unread-count` | Nombre de non lus (polling léger) |
| `GET` | `/` | Liste (20) + `unreadCount` |
| `PATCH` | `/read-all` | Tout marquer comme lu |
| `POST` | `/send` | Admin : notification à un utilisateur |
| `POST` | `/broadcast` | Admin : notification à tous |

### À propos (`/api/about`)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/stats` | Statistiques publiques |
| `GET` | `/team` | Membres de l'équipe |
| `GET` | `/partners` | Partenaires |
| `POST` | `/contact` | Envoyer un message de contact |

### Administration (`/api/admin`) — rôle `admin` requis

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/stats` | Tableau de bord |
| `GET` | `/upload-signature` | Signature Cloudinary (upload direct) |
| `GET/POST/PUT/DELETE` | `/books`, `/books/:id` | CRUD enseignements |
| `GET/POST` | `/categories` | Catégories |
| `GET/POST/PATCH/DELETE` | `/users`, `/users/:id` | Utilisateurs |
| `POST` | `/users/:id/reset-password` | Mot de passe temporaire |
| `POST` | `/users/:id/badge` | Attribuer un badge |
| `POST` | `/recalculate-badges` | Recalcul badges auto |
| `GET/DELETE` | `/posts`, `/posts/:id` | Modération posts |
| `GET/POST/PUT/DELETE` | `/team`, `/team/:id` | Équipe |
| `GET/POST/PUT/DELETE` | `/partners`, `/partners/:id` | Partenaires |
| `GET` | `/contact-messages` | Messages de contact |
| `PATCH` | `/contact-messages/:id/read` | Marquer un message lu |
| `DELETE` | `/contact-messages/:id` | Supprimer un message |

---

## Technologies

| Couche | Stack |
|--------|--------|
| **Runtime** | Node.js 18+ |
| **Serveur** | Express 4 |
| **BDD** | better-sqlite3 (dev) · pg (prod) |
| **Auth** | jsonwebtoken · bcryptjs |
| **Uploads** | multer · cloudinary |
| **Frontend** | HTML5, CSS3 (variables, grid, flex), JavaScript ES6+ modules IIFE |
| **i18n** | JSON (`fr` / `en`) |
| **Ops** | Docker · Render · Git |

---

## Sécurité

- Mots de passe hashés (**bcrypt**, 10 rounds)
- API protégée par **JWT** (expiration 7 jours)
- Rôle **admin** vérifié sur toutes les routes `/api/admin`
- **Rate limiting** sur l'API et l'authentification
- En-têtes **X-Content-Type-Options**, **X-Frame-Options**, **Referrer-Policy**
- Limite body JSON **2 Mo**
- Échappement HTML côté admin (messages de contact)
- En production : définir **`JWT_SECRET`** et **`DATABASE_URL`**, ne jamais committer les secrets

---

## Licence & contribution

Projet privé — **Revelio**. Pour toute évolution, travailler sur une branche, tester localement (`npm run dev`), puis déployer via GitHub → Render.

---

*Dernière mise à jour de la documentation : reflet de l'architecture actuelle (design system, scalabilité, messages admin, upload Cloudinary, enseignements).*
