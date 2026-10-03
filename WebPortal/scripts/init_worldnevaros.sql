-- =========================================================================================
-- INITIALISATION DE LA BASE DE DONNÉES NARVOS PRIME (WorldNevaros)
-- =========================================================================================
-- Ce script crée toutes les tables nécessaires pour le fonctionnement du jeu.
-- Il gère les utilisateurs, les personnages, et les sauvegardes de scènes (mapping).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------------------
-- 1. TABLE : USERS (Comptes Utilisateurs)
-- -----------------------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL, -- Pour l'instant stocké en clair ou simple hash selon implémentation
  `email` VARCHAR(255) NULL,
  `role` ENUM('USER', 'ADMIN', 'MODERATOR') DEFAULT 'USER',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_login` TIMESTAMP NULL,
  `is_banned` BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------------------
-- 2. TABLE : CHARACTERS (Personnages Joueurs)
-- -----------------------------------------------------------------------------------------
DROP TABLE IF EXISTS `characters`;
CREATE TABLE `characters` (
  `id` VARCHAR(64) PRIMARY KEY, -- ex: "char_17098234"
  `user_id` INT NOT NULL,
  `server_id` VARCHAR(64) DEFAULT 'normal_1',
  `name` VARCHAR(64) NOT NULL,
  `class_id` VARCHAR(64) NOT NULL, -- Référence à PlayerClass (ex: PRESSURE_MANIPULATOR)
  `faction` VARCHAR(32) NOT NULL, -- ex: HUMAN, ALIEN, MERCENARY
  `level` INT DEFAULT 1,
  `experience` INT DEFAULT 0,
  `gender` ENUM('MALE', 'FEMALE') DEFAULT 'MALE',
  `money_lys` INT DEFAULT 0,
  `money_ala` INT DEFAULT 0,
  `map_id` VARCHAR(64) DEFAULT 'hub', -- Planète ou map actuelle
  
  -- Stockage JSON pour les données complexes (plus flexible pour le prototypage)
  `position_json` JSON, -- {x, y, z}
  `stats_json` JSON, -- {hp, maxHp, ap, mp, armor, magic_res, crit_chance, haste...}
  `customization_json` JSON, -- {colors: {...}, faceId...}
  `inventory_json` JSON, -- Array of items
  `equipped_items_json` JSON, -- {HEAD: "itemId", ...}
  `spells_unlocked_json` JSON, -- Array of spell IDs
  
  `last_faction_name` VARCHAR(128) NULL,
  `last_map_name` VARCHAR(128) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------------------
-- 3. TABLE : SCENES (Sauvegardes de Maps/Planètes)
-- -----------------------------------------------------------------------------------------
DROP TABLE IF EXISTS `scenes`;
CREATE TABLE `scenes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `planet_id` VARCHAR(64) NOT NULL, -- ex: "aquarys", "space"
  `scene_mode` VARCHAR(32) NOT NULL, -- ex: "PLANET", "HUB"
  `version` VARCHAR(16) DEFAULT '1.0.0',
  `global_settings_json` JSON, -- Paramètres globaux de la scène (lumière, météo...)
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `unique_scene` (`planet_id`, `scene_mode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------------------
-- 4. TABLE : SCENE_OBJECTS (Objets placés dans les scènes)
-- -----------------------------------------------------------------------------------------
DROP TABLE IF EXISTS `scene_objects`;
CREATE TABLE `scene_objects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `scene_id` INT NOT NULL,
  `object_uuid` VARCHAR(64) NOT NULL, -- ID unique de l'objet dans la scène (ThreeJS uuid)
  `name` VARCHAR(128),
  `type` VARCHAR(32) NOT NULL, -- PROP, BUILDING, TERRAIN...
  
  -- Transform
  `pos_x` FLOAT DEFAULT 0, `pos_y` FLOAT DEFAULT 0, `pos_z` FLOAT DEFAULT 0,
  `rot_x` FLOAT DEFAULT 0, `rot_y` FLOAT DEFAULT 0, `rot_z` FLOAT DEFAULT 0,
  `scl_x` FLOAT DEFAULT 1, `scl_y` FLOAT DEFAULT 1, `scl_z` FLOAT DEFAULT 1,
  
  -- Material & Visuals
  `material_type` VARCHAR(32),
  `color_hex` INT,
  `opacity` FLOAT DEFAULT 1.0,
  `is_transparent` BOOLEAN DEFAULT FALSE,
  `texture_map_url` VARCHAR(255),
  
  -- Model
  `model_path` VARCHAR(255),
  
  -- Extra Data
  `user_data_json` JSON, -- Données spécifiques scriptées
  
  FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------------------
-- 5. TABLE : SCENE_BACKUPS (Historique des sauvegardes)
-- -----------------------------------------------------------------------------------------
DROP TABLE IF EXISTS `scene_backups`;
CREATE TABLE `scene_backups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `scene_id` INT NOT NULL,
  `backup_name` VARCHAR(128) NOT NULL,
  `snapshot_json` LONGTEXT, -- Sauvegarde complète de la scène en JSON (MariaDB LONGTEXT)
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------------------
-- DONNÉES INITIALES (SEED)
-- -----------------------------------------------------------------------------------------

-- Création d'un compte Admin par défaut
INSERT INTO `users` (`username`, `password_hash`, `role`) 
VALUES ('admin', 'admin123', 'ADMIN')
ON DUPLICATE KEY UPDATE last_login = NOW();

-- Création d'un compte Joueur Test
INSERT INTO `users` (`username`, `password_hash`, `role`) 
VALUES ('testplayer', 'nevaros', 'USER')
ON DUPLICATE KEY UPDATE last_login = NOW();

SET FOREIGN_KEY_CHECKS = 1;

-- Fin du script
