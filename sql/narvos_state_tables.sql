-- ════════════════════════════════════════════════════════════════════════════
-- narvos_state_tables.sql — Tables d'état du jeu (progression RPG + monde).
--
-- Créées AUTOMATIQUEMENT au runtime par le client (rpg/persistence/dbStore.ts)
-- via `CREATE TABLE IF NOT EXISTS` sur le canal mysqlQuery, mais documentées ici
-- pour que le GameServer reste cohérent et puisse les lire.
--
-- Modèle clé/valeur JSON dédié et extensible : ajouter un futur store de jeu = une
-- nouvelle `state_key`, ZÉRO migration. Isolé des colonnes characters.* existantes
-- (stats_json "Dofus", inventory_json…) → n'interfère pas avec le schéma legacy.
-- ════════════════════════════════════════════════════════════════════════════

-- Progression PAR PERSONNAGE (clé = character_state.character_id = characters.id).
-- state_key connus (client) :
--   progression       → inventaire + équipement + crédits + stats/XP + map + position
--   professions       → niveaux/XP des 6 métiers + endurance + sac de ressources
--   quests            → quêtes actives (compteurs) + terminées
--   consumable_slots   → 3 slots de consommables (barre 4/5/6)
--   appearance        → teinte + modèle d'avatar du personnage
CREATE TABLE IF NOT EXISTS `character_state` (
  `character_id` VARCHAR(64)  NOT NULL,
  `state_key`    VARCHAR(64)  NOT NULL,
  `value_json`   LONGTEXT     NOT NULL,
  `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`character_id`, `state_key`),
  KEY `idx_character` (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Données MONDE / éditeur + préférences utilisateur.
--   scope = "global"          → contenu monde partagé :
--       portals           → portails de donjon plaçables, par map
--       npc_placements    → PNJ plaçables (éditeur F9), par map
--       harvestnodes      → nœuds de récolte plaçables (éditeur F11), par map
--       environment       → tuning d'environnement par map (éditeur admin)
--   scope = "user:<username>" → préférences par compte (suivent l'utilisateur) :
--       settings          → touches + vidéo + audio
--       characterScale    → échelle des personnages
--       cameraOffset      → offset caméra TPS
--       audio_volumes     → volumes musique/SFX (AudioManager)
CREATE TABLE IF NOT EXISTS `world_state` (
  `scope`      VARCHAR(96)  NOT NULL,
  `state_key`  VARCHAR(64)  NOT NULL,
  `value_json` LONGTEXT     NOT NULL,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`scope`, `state_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;