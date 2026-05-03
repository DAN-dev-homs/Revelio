# Utilise une image Node.js officielle
FROM node:18-alpine

# Installer les outils de build pour better-sqlite3
RUN apk add --no-cache python3 make g++

# Définit le répertoire de travail
WORKDIR /app

# Copie les fichiers package.json et package-lock.json
COPY backend/package*.json ./

# Installe les dépendances
RUN npm install

# Copie le reste du code
COPY backend/ ./

# Expose le port
EXPOSE 3000

# Commande pour démarrer l'application
CMD ["npm", "start"]