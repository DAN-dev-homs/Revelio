# Utilise une image Node.js officielle
FROM node:18-alpine

# Installer les outils de build pour better-sqlite3
RUN apk add --no-cache python3 make g++

# Définit le répertoire de travail
WORKDIR /app

# Copie les fichiers package.json et package-lock.json du backend
COPY backend/package*.json ./

# Installe les dépendances
RUN npm install

# Copie le code du backend
COPY backend/ ./

# Copie le frontend
COPY frontend ./frontend

# Créer les dossiers uploads nécessaires
RUN mkdir -p uploads/avatars uploads/media

# Expose le port
EXPOSE 3000

# Commande pour démarrer l'application
CMD ["npm", "start"]