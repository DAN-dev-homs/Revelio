# Revelio

Une application spirituelle interactive avec frontend et backend.

## 📋 Table des matières

- [Architecture](#architecture)
- [Structure du projet](#structure-du-projet)
- [Installation](#installation)
- [Démarrage](#démarrage)
- [Variables d'environnement](#variables-denvironnement)
- [Déploiement](#déploiement)
- [Fonctionnalités](#fonctionnalités)
- [Technologies](#technologies)
- [API Endpoints](#api-endpoints)

## 🏗️ Architecture

Revelio suit une architecture client-serveur moderne avec séparation claire des responsabilités :

### Backend (Node.js + Express)
- **API REST** : Endpoints sécurisés avec JWT
- **Base de données** : SQLite pour développement, PostgreSQL pour production
- **Authentification** : JWT avec bcrypt
- **Middleware** : CORS, compression, validation

### Frontend (SPA JavaScript)
- **Architecture modulaire** : Pattern IIFE pour chaque page
- **Routing client** : Navigation SPA avec hash URLs
- **Components** : Réutilisables et maintenus
- **Internationalisation** : Support multi-langues

### Admin Panel
- **Interface dédiée** : Gestion complète de l'application
- **CSS séparé** : Structure CSS professionnelle
- **Permissions** : Accès administrateur sécurisé

## 📁 Structure du projet

```
REVELIO/
├── backend/                    # API REST Node.js
│   ├── routes/                # Routes API
│   │   ├── auth.js           # Authentification
│   │   ├── books.js          # Gestion livres
│   │   ├── community.js      # Posts communautaires
│   │   ├── profile.js        # Profils utilisateurs
│   │   ├── admin.js          # Admin panel
│   │   └── notifications.js  # Notifications
│   ├── middleware/            # Middleware Express
│   ├── database.js           # Configuration DB
│   ├── uploads/              # Fichiers uploadés
│   └── server.js              # Point d'entrée
├── frontend/                  # Application web
│   ├── assets/               # Ressources statiques
│   │   ├── css/             # Stylesheets
│   │   │   ├── admin.css    # Admin panel
│   │   │   ├── base.css     # Base styles
│   │   │   ├── components.css# Components UI
│   │   │   ├── variables.css# CSS variables
│   │   │   └── animations.css# Animations
│   │   ├── js/              # Modules JavaScript
│   │   │   ├── app.js       # Router SPA
│   │   │   ├── api.js       # Client API
│   │   │   ├── i18n.js      # Internationalisation
│   │   │   ├── home.js      # Page accueil
│   │   │   ├── explore.js   # Exploration livres
│   │   │   ├── profile.js   # Profil utilisateur
│   │   │   ├── community.js # Communauté
│   │   │   ├── book_detail.js# Détails livre
│   │   │   ├── admin.js     # Admin panel
│   │   │   └── notifications.js# Notifications
│   │   ├── images/          # Images et icônes
│   │   └── i18n/           # Fichiers de langue
│   ├── index.html           # Application principale
│   └── admin.html           # Panel admin
├── docker-compose.yml       # Docker configuration
├── Dockerfile               # Container Docker
└── README.md               # Documentation
```

## 🚀 Installation

### Prérequis
- Node.js >= 18
- npm ou yarn

### Backend
```bash
cd backend
npm install
```

### Frontend
Aucune installation requise - fichiers statiques.

## ⚡ Démarrage

### Backend
```bash
cd backend
npm start          # Production
npm run dev        # Développement avec nodemon
```

Le serveur démarre sur le port 3000 (ou variable PORT).

### Frontend
1. **Développement local** :
   ```bash
   # Servez statiquement le dossier frontend/
   npx serve frontend -p 8080
   ```

2. **Navigateur** :
   Ouvrez `frontend/index.html` directement

## 🔧 Variables d'environnement

Créez un fichier `.env` dans `backend/` :

```env
JWT_SECRET=revelio_secret_2024
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname  # Production uniquement
```

## 🌐 Déploiement

### Backend (Production)
- **Render** : Configuration automatique avec `DATABASE_URL`
- **Heroku/Railway** : Compatible PostgreSQL
- **VPS/Docker** : Utilisez `docker-compose.yml`

### Frontend
- **Netlify/Vercel** : Déploiement statique
- **GitHub Pages** : Pages GitHub
- **CDN** : Cloudflare, AWS S3

## ✨ Fonctionnalités

### Utilisateurs
- 🔐 Authentification sécurisée JWT
- 👤 Profils personnalisés avec badges
- 📚 Suivi de lecture avec timer automatique
- 🏆 Système de badges (Bronze, Silver, Gold, Diamond)
- 📊 Statistiques de lecture

### Contenu
- 📖 Bibliothèque spirituelle
- 🔍 Recherche et filtrage avancés
- ⏱️ Timer de lecture 1 minute automatique
- 💾 Sauvegarde automatique de la progression

### Communauté
- 📝 Posts et discussions
- ❤️ Système de likes
- 💬 Commentaires
- 🔗 Profils publics

### Administration
- 👑 Panel admin complet
- 👥 Gestion des utilisateurs
- 📚 Modération des contenus
- 📈 Statistiques et analytics
- 🏅 Attribution manuelle des badges

## 🛠 Technologies

### Backend
- **Runtime** : Node.js 18+
- **Framework** : Express.js
- **Base de données** : SQLite (dev) / PostgreSQL (prod)
- **Authentification** : JWT + bcrypt
- **Uploads** : Multer
- **Sécurité** : CORS, compression

### Frontend
- **Langages** : HTML5, CSS3, JavaScript ES6+
- **Architecture** : SPA (Single Page Application)
- **Styles** : CSS Grid, Flexbox, CSS Variables
- **Internationalisation** : i18n.js
- **Icons** : SVG intégrés

### DevOps
- **Containerisation** : Docker
- **Version control** : Git
- **Déploiement** : Render, Netlify

## 📡 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur

### Livres
- `GET /api/books` - Liste des livres
- `GET /api/books/:id` - Détails d'un livre
- `POST /api/books/:id/progress` - Mettre à jour la progression

### Communauté
- `GET /api/posts` - Liste des posts
- `POST /api/posts` - Créer un post
- `GET /api/users/search` - Rechercher des utilisateurs

### Profils
- `GET /api/profile/me` - Profil personnel
- `GET /api/profile/:id` - Profil public
- `PUT /api/profile/badge` - Attribuer un badge (admin)

### Administration
- `GET /api/admin/stats` - Statistiques
- `GET /api/admin/users` - Liste des utilisateurs
- `PUT /api/admin/users/:id/badge` - Badge manuel

## 🎯 Points forts de l'architecture

1. **Code organisé** : Séparation claire frontend/backend
2. **CSS professionnel** : Fichiers CSS modulaires et maintenus
3. **JavaScript modulaire** : Pattern IIFE pour chaque page
4. **Pas de doublons** : Code optimisé et maintenu
5. **Scalable** : Architecture prête pour la production
6. **Sécurisé** : Authentification JWT robuste
7. **Responsive** : Design mobile-first
8. **Internationalisation** : Support multi-langues

---

**Revelio** - Application spirituelle moderne et professionnelle