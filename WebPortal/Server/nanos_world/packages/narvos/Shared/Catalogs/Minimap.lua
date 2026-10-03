-- ══════════════════════════════════════════════════════════════════════════════
-- Minimap.lua — les pieces de la minimap Ako et la taille mesuree de sa boite.
--
-- FICHIER GENERE par scripts/narvos-minimap-to-lua.mjs depuis Assets.toml et
-- adk/_manifests/ako-bornes.json. Ne pas editer a la main : regenerer apres chaque
-- construction du pack.
--
-- 4 piece(s) sur 4 declaree(s).
-- PRETE = false tant qu'une piece manque : le client ne pose rien, le radar WebUI
-- reste la carte.
-- ══════════════════════════════════════════════════════════════════════════════

local Minimap = {}

Minimap.WIDGET = "narvos::ui_minimap_showup"   -- widget a l'ecran (disque, fleche, pictogrammes)
Minimap.BORNES = "narvos::BP_MAP_Bounds"   -- boite de bornes, une par monde
Minimap.JOUEUR = "narvos::BP_NarvosCarteJoueur"   -- proxy attache au personnage local (player ref du DataAsset)
Minimap.REPERE = "narvos::BP_NarvosCarteRepere"   -- proxy d'un repere du radar (item_setting du DataAsset)

Minimap.PRETE = true

--- Demi-etendue (cm) de la boite de BP_MAP_Bounds a l'echelle 1 : Box_board
--- (50 x 50 cm) fois l'echelle du composant BOX_Bounds (200 x 200).
Minimap.BOITE_DEMI_ETENDUE_CM = { x = 10000, y = 10000 }

return Minimap
