-- ============================================================
-- cleanup_old_characters.sql
-- Supprime TOUS les personnages de test (ancien systeme Meshy)
-- de la base worldnevaros.
--
-- QUAND L'EXECUTER :
--   Apres la migration vers le systeme Quaternius (deja faite).
--   Les personnages stockes utilisent l'ancien class_id (ex.
--   PRESSURE_MANIPULATOR, AQUARYS, etc.) issus du systeme legacy.
--
-- COMMENT L'EXECUTER :
--   Dans HeidiSQL : Fichier > Charger ce script > Executer (F9)
--   Ou : mysql -u root -p worldnevaros < cleanup_old_characters.sql
--
-- EFFET :
--   - Vide la table `characters` (CASCADE -> `inventory`)
--   - Vide aussi `character_inventory`, `character_quests`,
--     `character_settings` si elles existent (requetes conditionnelles)
--   - Laisse les utilisateurs (table `users`) intacts
--   - Ne touche PAS aux maps, items, scenes, etc.
-- ============================================================

USE `worldnevaros`;

-- Desactiver les verifications FK pour la suppression
SET FOREIGN_KEY_CHECKS = 0;

-- Vider les tables dependantes (si elles existent)
TRUNCATE TABLE IF EXISTS `character_inventory`;
TRUNCATE TABLE IF EXISTS `character_quests`;
TRUNCATE TABLE IF EXISTS `character_settings`;

-- Vider l'inventaire lie aux personnages (FK CASCADE, mais TRUNCATE ignore CASCADE)
TRUNCATE TABLE `inventory`;

-- Vider la table principale des personnages
TRUNCATE TABLE `characters`;

-- Reactiver les verifications FK
SET FOREIGN_KEY_CHECKS = 1;

-- Verification : doit afficher 0 ligne
SELECT COUNT(*) AS remaining_characters FROM `characters`;

-- ============================================================
-- APRES EXECUTION :
--   Les joueurs pourront creer de nouveaux personnages via
--   l'interface Narvos Prime (systeme Quaternius modulaire).
--   Les donnees de compte (users, mots de passe) sont
--   preservees.
-- ============================================================