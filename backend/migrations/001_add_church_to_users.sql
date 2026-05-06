-- Migration 001: Ajouter le champ 'church' à la table users
-- Date: 2025-05-06
-- Description: Permettre aux utilisateurs de spécifier leur église

ALTER TABLE users ADD COLUMN church TEXT DEFAULT NULL;

-- Index pour optimiser les recherches par église
CREATE INDEX IF NOT EXISTS idx_users_church ON users(church);
