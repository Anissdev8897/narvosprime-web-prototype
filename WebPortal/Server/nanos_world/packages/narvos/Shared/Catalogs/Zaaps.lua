-- ══════════════════════════════════════════════════════════════════════════════
-- Zaaps.lua — les Zaaps (points de sauvegarde et de réapparition) de toutes les maps.
--
-- ÉCRIT PAR LE JEU (/zaap creer, /zaap ici, /zaap renommer, /zaap supprimer) via
-- Server/Export.lua. Ne pas éditer à la main pendant que le serveur tourne : il
-- réécrit ce fichier à chaque édition. Une entrée mal formée est ÉCARTÉE au
-- chargement, et le journal la nomme.
--
-- 0 zaap(s). Coordonnées LOCALES au monde (Mondes.DECALAGES), comme Teleports.lua.
-- Un personnage retient l'IDENTIFIANT de son Zaap (colonne personnages.zaap) :
-- renommer ne casse rien, supprimer renvoie ses joueurs à leur cité.
-- ══════════════════════════════════════════════════════════════════════════════

local Zaaps = {}

Zaaps.LISTE = {

}

return Zaaps
