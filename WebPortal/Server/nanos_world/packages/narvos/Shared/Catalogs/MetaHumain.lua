-- ══════════════════════════════════════════════════════════════════════════════
-- MetaHumain.lua — les pièces MetaHuman portées par le pont (retarget vivant).
--
-- FICHIER GÉNÉRÉ par scripts/narvos-metahumain-to-lua.mjs — ne pas éditer à la main.
-- Source : WebPortal/Server/adk/_pont-metahuman.json (scripts/adk-pont-metahuman.py).
--
-- 14 pièce(s), 14 réellement posable(s) (Blueprint déclaré ET pont cuit).
-- Pont cuit : oui.
-- Porteur invisible : narvos::Mat_Invisible.
--
-- Une pièce non cuite est REFUSÉE en la nommant (Logic/MetaHumain.lua) : un
-- Blueprint sur une référence morte n'apparaît pas, et ne lève rien.
-- ══════════════════════════════════════════════════════════════════════════════

local MetaHumain = {}

--- Slots, dans l'ordre de l'écran de création.
MetaHumain.SLOTS = { "corps", "haut", "bas", "pieds", "tenue" }
MetaHumain.SLOT_CORPS = "corps"
MetaHumain.LIBELLES_SLOTS = { corps = "Corps", haut = "Haut", bas = "Bas", pieds = "Chaussures", tenue = "Tenue complete" }

--- Ce qu'une pièce retire en arrivant (une tenue complète occupe haut et bas).
MetaHumain.REMPLACE = { tenue = { "haut", "bas" }, haut = { "tenue" }, bas = { "tenue" } }

--- Os du Character auquel chaque pièce s'attache : un nom d'os fait attacher au
--- MAILLAGE (le parent que le retarget copie), pas à la capsule.
MetaHumain.OS_ATTACHE = "root"

--- Matériau qui rend le mesh nanos invisible SANS l'empêcher d'être rendu.
MetaHumain.MATERIAU_INVISIBLE = "narvos::Mat_Invisible"

MetaHumain.PIECES = {
    bas_f_jupe = { blueprint = "narvos::BP_NarvosMH_bas_f_jupe", slot = "bas", genre = "F", label = "Jupe de travail", mesh = "SK_Set_3_Work_Skirt", cuit = true },
    bas_f_pantalon = { blueprint = "narvos::BP_NarvosMH_bas_f_pantalon", slot = "bas", genre = "F", label = "Pantalon", mesh = "SK_Pants", cuit = true },
    bas_f_pantalon_2 = { blueprint = "narvos::BP_NarvosMH_bas_f_pantalon_2", slot = "bas", genre = "F", label = "Pantalon ajuste", mesh = "SK_Set_2_Pants", cuit = true },
    bas_f_short = { blueprint = "narvos::BP_NarvosMH_bas_f_short", slot = "bas", genre = "F", label = "Short", mesh = "SK_Set_1Shorts", cuit = true },
    corps_f_base = { blueprint = "narvos::BP_NarvosMH_corps_f_base", slot = "corps", genre = "F", label = "Corps MetaHuman", mesh = "SK_Meta_Female_Base", cuit = true },
    haut_f_crop_top = { blueprint = "narvos::BP_NarvosMH_haut_f_crop_top", slot = "haut", genre = "F", label = "Brassiere", mesh = "SK_Set_1_Crop_Top", cuit = true },
    haut_f_travail = { blueprint = "narvos::BP_NarvosMH_haut_f_travail", slot = "haut", genre = "F", label = "Haut de travail", mesh = "SK_Set_3_Work_Top", cuit = true },
    pieds_f_bottes = { blueprint = "narvos::BP_NarvosMH_pieds_f_bottes", slot = "pieds", genre = "F", label = "Bottes", mesh = "SK_Boots", cuit = true },
    tenue_f_armure = { blueprint = "narvos::BP_NarvosMH_tenue_f_armure", slot = "tenue", genre = "F", label = "Armure sci-fi", mesh = "SK_Sci_Fi_Armor", cuit = true },
    tenue_f_combinaison = { blueprint = "narvos::BP_NarvosMH_tenue_f_combinaison", slot = "tenue", genre = "F", label = "Combinaison sci-fi", mesh = "SK_Sci_Fi_Jumpsuit", cuit = true },
    tenue_f_fantasy = { blueprint = "narvos::BP_NarvosMH_tenue_f_fantasy", slot = "tenue", genre = "F", label = "Tenue fantasy", mesh = "SK_Fantasy_Outfit_F_Tal_Med1", cuit = true },
    tenue_f_meta_p = { blueprint = "narvos::BP_NarvosMH_tenue_f_meta_p", slot = "tenue", genre = "F", label = "Tenue MetaP", mesh = "SK_MetaP", cuit = true },
    tenue_f_meta_p1 = { blueprint = "narvos::BP_NarvosMH_tenue_f_meta_p1", slot = "tenue", genre = "F", label = "Tenue MetaP II", mesh = "SK_MetaP1", cuit = true },
    tenue_f_une_piece = { blueprint = "narvos::BP_NarvosMH_tenue_f_une_piece", slot = "tenue", genre = "F", label = "Une-piece", mesh = "SK_1_peace", cuit = true },
}

return MetaHumain
