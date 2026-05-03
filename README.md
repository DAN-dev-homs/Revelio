# Revelio

Une application spirituelle interactive avec frontend et backend.

## Structure du projet

- `frontend/` : Interface utilisateur (HTML, CSS, JS)
- `backend/` : API REST (Node.js, Express, SQLite)

## Installation

### Backend
```bash
cd backend
npm install
```

### Frontend
Ouvrez `frontend/index.html` dans un navigateur ou servez statiquement.

## Démarrage

### Backend
```bash
cd backend
npm start  # ou npm run dev pour développement
```

Le serveur démarre sur le port 3000 (ou PORT défini).

## Variables d'environnement

- `JWT_SECRET` : Clé secrète pour JWT (défaut: revelio_secret_2024)
- `PORT` : Port du serveur (défaut: 3000)

Créez un fichier `.env` dans `backend/` si nécessaire.

## Déploiement

### Backend
- Hébergez sur Heroku, Railway, ou VPS.
- Assurez-vous que Node.js >= 18 est installé.

### Frontend
- Déployez sur Netlify, Vercel, ou GitHub Pages.

## Fonctionnalités

- Authentification utilisateur
- Gestion de livres spirituels
- Communauté
- Notifications

## Technologies

- Backend: Node.js, Express, SQLite, JWT, bcrypt
- Frontend: HTML5, CSS3, JavaScript (ES6+)