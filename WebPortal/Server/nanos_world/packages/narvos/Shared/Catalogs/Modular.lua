-- ══════════════════════════════════════════════════════════════════════════════
-- Modular.lua — corps et pièces modulaires.
--
-- FICHIER GÉNÉRÉ par scripts/narvos-modular-to-lua.mjs — ne pas éditer à la main.
-- Il est reconstruit depuis les GLB réellement importés et les clés d'Assets.toml,
-- ce qui garantit qu'aucune entrée ne référence une pièce absente du pack cuit.
--
-- 12 corps, 132 pièces, 6 familles.
--
-- ── LA FAMILLE EST UNE CONTRAINTE, PAS UNE ÉTIQUETTE ──────────────────────────
-- Familles présentes dans CETTE génération : defender, metacustom, metahuman, stylized, trooper_f, trooper_m, trooper_pf.
--   [defender]  Personnage modulaire UE4 du pack Defender : têtes, bustes et
--               jambes, lus depuis Assets.toml et filtrés par le manifeste
--               adk/_manifests/defender-squelettes.json (18 clés, 18 sur
--               SKEL_Mannequin, mesuré 2026-09-12). Genre « * » : rien dans
--               ces meshes ne distingue M de F.
--   [metacustom] Vêtements du pack Meta Customization, lus depuis Assets.toml
--               (clés dédupliquées). N'entrent que si leur squelette est
--               PROUVÉ compatible, listé dans le manifeste
--               adk/_manifests/metacustom-squelettes.json écrit après
--               rebind + cook. Volumes taillés MetaHuman Tall/Medium.
--   [metahuman] Le Meta Customization System, acheté sur Fab. SES CORPS SONT
--               DES BLUEPRINTS, pas des meshes : ils portent leur propre
--               logique (corps, visage, cheveux, peau, tatouages, vêtements)
--               et se pilotent par CallBlueprintEvent. Cette famille n'a donc
--               AUCUNE pièce, et n'en aura pas : le Blueprint habille.
--               Le champ `asset` est le PORTEUR invisible (SKM_Manny_3), qui
--               donne squelette, animations et capsule ; `blueprint` est ce
--               qui se voit. Clés relues dans Assets.toml le 2026-09-12.
--               ⚠ NON PROUVÉ EN JEU : qu'un CallBlueprintEvent venu du
--               serveur change réellement le haut ou la peau. Un nom faux ne
--               lève rien côté serveur — le premier verdict sera visuel.
--   [stylized]  Pack StylizedModularChar, reconstruit depuis les GLB
--               réellement importés (_export/stylized_modular).
--   [trooper_f] SciFi_Trooper_Set morphologie F, filtré par les manifestes
--               d'import (68 os, hiérarchie identique, vérifié 2026-09-03).
--   [trooper_m] SciFi_Trooper_Set morphologie M, filtré par les manifestes
--               d'import (68 os, hiérarchie identique, vérifié 2026-09-03).
--   [trooper_pf] SciFi_Trooper_Set morphologie PF, filtré par les manifestes
--               d'import (68 os, hiérarchie identique, vérifié 2026-09-03).
--
-- Les familles ne partagent PAS les mêmes volumes : un vêtement d'une
-- morphologie posé sur le corps d'une autre s'interpénètre, et le joueur
-- verrait un défaut sans que rien ne l'ait prévenu. ValiderTenue refuse donc
-- tout mélange de familles.

-- ── GENRE ETOILE ──────────────────────────────────────────────────────────────
-- Les pièces au genre "*" sont skinnées sur une base commune : un seul mesh
-- sert aux deux corps, et ParSlot les rend pour M comme pour F.

-- ── EXCLUSES À LA GÉNÉRATION ─────────────────────────────────────────────────
-- 17 vêtement(s) et 0 corps MetaCustom vus dans Assets.toml et NON
-- émis : squelette non prouvé compatible (lié à Skel_Dummy, pas à SKEL_Mannequin).
-- Ils entreront SEULS le jour du rebind + cook + manifeste de preuve.
--     SK_1_Piece
--     SK_Belt
--     SK_Boots_3
--     SK_Dress
--     SK_Dress_Sim
--     SK_Fantasy_outfit_1
--     SK_Hat
--     SK_Helmet1
--     SK_LowerArmor1
--     SK_Male_Armor_Bottoms
--     SK_Male_Armor_Top
--     SK_Male_Helmet
--     SK_Shirt2
--     SK_Socks
--     SK_SocksM
--     SK_Suspenders
--     Sk_UpperArmor1
-- 17 entrée(s) MetaCustom hors garde-robe (rigs, outils visage/corps) :
--     Barbarian_Remover
--     Rogue_Rig
--     SK_CyborgHeadArms
--     SK_CyborgHeadArms_2
--     SK_Dummy_F_Tal_Med
--     SK_Dummy_F_Tal_Med_2
--     SK_Dummy_Live_Retarget
--     SK_Goggles
--     SK_Horns
--     SK_M
--     SK_Mask
--     SK_Mask_R
--     SK_Orc
--     SK_Pierc
--     SK_head2
--     Sk_Staff
--     Sk_head

-- ── ÉCARTÉES PARCE QUE GRISES ────────────────────────────────────────────────
-- 22 pièce(s) cuites, au bon squelette, mais dont aucune texture ne vient du
-- PROJET : elles s'afficheraient grises. Mesure : adk/_personnages-mesures.json.
-- Réparer leurs matériaux les fait rentrer sans toucher à ce générateur.
--   [metacustom] SK_Jacket, SK_Pants, SK_Pants_2, SK_Set_3_Work_Skirt, SK_Set_3_Work_Top, SK_Shirt, SK_Waist_Shorts
--   [defender] SK_Head1, SK_Head2, SK_Head3, SK_Head4, SK_Head5, SK_Legs1, SK_Legs2, SK_Legs3, SK_Legs4, SK_Legs5, SK_Torso1, SK_Torso2, SK_Torso3, SK_Torso4, SK_Torso5
-- ══════════════════════════════════════════════════════════════════════════════

local Modular = {}

--- Slots d'habillage, dans l'ordre d'empilement à l'écran de création.
--- 'pieds' vient des MetaHuman : le pack Stylized n'a pas de chaussures.
--- Ordre d'empilement a l'ecran de creation, du plus interne au plus externe.
--- 'epaules' et 'bras' viennent de SciFi_Trooper_Set : un buste sans bras plus
--- des bras separes plus des epaulieres interchangeables multiplie les
--- silhouettes au lieu de les additionner.
--- 'taille' (ceintures, bretelles) n'est écrit que si une pièce vivante
--- l'occupe — voir SLOTS_SORTIE dans le générateur.
Modular.SLOTS = { "visage", "barbe", "tete", "torse", "epaules", "bras", "mains", "jambes", "pieds" }

--- Registres, pour filtrer l'écran de création.
Modular.REGISTRES = { "base", "civil", "uniforme", "guerre" }

--- Familles de morphologie. Voir l'avertissement en tête de fichier.
Modular.FAMILLES = { "defender", "metacustom", "metahuman", "stylized", "trooper_f", "trooper_m", "trooper_pf" }

--- Corps de base : les mesh passés à Character(...), PAS des attachements.
--- Ils PORTENT les pièces, ils ne s'y ajoutent pas.
Modular.CORPS = {
    defender_mannequin_f = { asset = "narvos::SKM_Manny_3", genre = "F", famille = "defender", label = "Mannequin modulaire UE4" },
    defender_mannequin_m = { asset = "narvos::SKM_Manny_3", genre = "M", famille = "defender", label = "Mannequin modulaire UE4" },
    mh_femme = { asset = "nanos-world::SK_Mannequin", genre = "F", famille = "metahuman", label = "MetaHuman — Femme", blueprint = "narvos::BP_NarvosMH_F" },
    mh_homme = { asset = "nanos-world::SK_Mannequin", genre = "M", famille = "metahuman", label = "MetaHuman — Homme", blueprint = "narvos::BP_NarvosMH_M" },
    narvos_operateur_m = { asset = "narvos::SK_CyberpunkSamurai_WithoutHelmet", genre = "M", famille = "stylized", label = "Opérateur NARVOS" },
    narvos_valkiria_f = { asset = "narvos::SK_Valkiria", genre = "F", famille = "stylized", label = "Valkiria NARVOS" },
    sk_female_form_standalone = { asset = "narvos::SK_Female_Form_Standalone", genre = "F", famille = "trooper_f", label = "Trooper — Female" },
    sk_male_form_standalone = { asset = "narvos::SK_Male_Form_Standalone", genre = "M", famille = "trooper_m", label = "Trooper — Male" },
    sk_meta_female_base = { asset = "narvos::SK_Meta_Female_Base", genre = "F", famille = "metacustom", label = "Corps femme MetaCustom", pnj_simple = true },
    sk_metap = { asset = "narvos::SK_MetaP", genre = "F", famille = "metacustom", label = "Corps femme MetaCustom (P)", pnj_simple = true },
    sk_metap1 = { asset = "narvos::SK_MetaP1", genre = "F", famille = "metacustom", label = "Corps femme MetaCustom (P1)", pnj_simple = true },
    sk_petite_female_form_standalone = { asset = "narvos::SK_Petite_Female_Form_Standalone", genre = "F", famille = "trooper_pf", label = "Trooper — Petite Female" },
}

--- Tenue nue — ce qu'un corps porte AVANT tout vêtement, par « famille|genre ».
---
--- ── POURQUOI ELLE EXISTE ──────────────────────────────────────────────────────
--- Le mesh donné à Character(...) est désormais CACHÉ, via SetMeshSettings. Il ne
--- sert plus qu'à porter le squelette, l'animation et les dimensions de la
--- capsule. Tout ce qui se voit — peau comprise — vient d'un slot.
---
--- C'est ce qui rend une armure REMPLAÇANTE : elle occupe le slot torse, et la
--- pièce de peau qui s'y trouvait en sort. Avant, le corps habillé du mesh de
--- base restait dessous et transparaissait aux jointures.
---
--- Corollaire : toutes les parties deviennent modifiables, visage inclus,
--- puisque plus aucune n'est cuite dans le mesh de base.
Modular.TENUE_BASE = {
    ["defender|F"] = { jambes = "defender_legsbase", tete = "defender_headbase", torse = "defender_torsobase" },
    ["defender|M"] = { jambes = "defender_legsbase", tete = "defender_headbase", torse = "defender_torsobase" },
    ["metacustom|F"] = { jambes = "sk_set_1shorts", torse = "sk_1_peace" },
    ["metacustom|M"] = { torse = "sk_inner_clothing" },
    ["stylized|F"] = { jambes = "body_legs_f", mains = "body_hands_f", torse = "body_chest_f", visage = "bodyface_default_f" },
    ["stylized|M"] = { jambes = "body_legs_m", mains = "body_hands_m", torse = "body_chest_m", visage = "body_face_m" },
    ["trooper_f|F"] = { jambes = "sk_female_form_legs", mains = "sk_female_form_hands", pieds = "sk_female_form_feet", tete = "sk_female_form_head", torse = "sk_female_form_upper" },
    ["trooper_m|M"] = { jambes = "sk_male_form_legs", mains = "sk_male_form_hands", pieds = "sk_male_form_feet", tete = "sk_male_form_head", torse = "sk_male_form_upper" },
    ["trooper_pf|F"] = { jambes = "sk_petite_female_form_lower", mains = "sk_petite_female_form_hands", pieds = "sk_petite_female_form_feet", tete = "sk_petite_female_form_head", torse = "sk_petite_female_form_upper" },
}

--- Tenue nue d'une famille et d'un genre. Rend une table NEUVE : l'appelant la
--- complète avec les choix du joueur, et deux joueurs ne doivent pas partager
--- la même table.
---@param famille string
---@param genre string
---@return table
function Modular.TenueBase(famille, genre)
    local source = Modular.TENUE_BASE[tostring(famille) .. "|" .. tostring(genre)]
    local sortie = {}
    if (source) then
        for slot, id in pairs(source) do sortie[slot] = id end
    end
    return sortie
end

--- Tenue nue complétée par les choix du joueur.
---
--- Un slot demandé à false est RETIRÉ, même s'il figure dans la tenue nue :
--- c'est ainsi qu'on enlève un gant sans enlever la main. Un slot absent de
--- choix garde sa pièce nue.
---@param famille string
---@param genre string
---@param choix table|nil
---@return table
function Modular.TenueComplete(famille, genre, choix)
    local sortie = Modular.TenueBase(famille, genre)
    if (type(choix) ~= "table") then return sortie end
    for slot, id in pairs(choix) do
        if (id == false) then
            sortie[slot] = nil
        elseif (type(id) == "string" and id ~= "") then
            sortie[slot] = id
        end
    end
    return sortie
end

--- Vrai si le mesh de base peut être caché sans amputer le personnage.
---
--- Deux conditions, et la seconde a failli coûter cher :
---
---  1. la famille livre une peau découpée — sinon le mesh de base EST la seule
---     peau, et le cacher rendrait le joueur invisible ;
---  2. cette peau couvre la TÊTE, par un slot visage ou tete.
---
--- ⚠ SANS LA SECONDE, LE PERSONNAGE EST DÉCAPITÉ. La famille mpfb a reçu le
--- 2026-09-04 quatre vêtements taillés dans son corps — torse, jambes, mains,
--- pieds. Ils suffisaient à la déclarer « cachable », le porteur disparaissait,
--- et il ne restait plus de tête : aucune pièce ne la remplaçait.
---
--- Les familles Stylized (slot visage) et Trooper (slot tete) passent, elles.
---@param famille string
---@param genre string
---@return boolean
function Modular.PorteurCachable(famille, genre)
    local t = Modular.TENUE_BASE[tostring(famille) .. "|" .. tostring(genre)]
    if (t == nil or next(t) == nil) then return false end
    return t.visage ~= nil or t.tete ~= nil
end

--- Toutes les pièces, indexées par identifiant.
Modular.PIECES = {
    aviator_chest_f = { asset = "narvos::smc__SK_Female_Aviator_Chest", slot = "torse", genre = "F", famille = "stylized", ensemble = "Aviator", registre = "civil", label = "Aviateur — Buste" },
    aviator_chest_m = { asset = "narvos::smc__SK_Aviator_Chest", slot = "torse", genre = "M", famille = "stylized", ensemble = "Aviator", registre = "civil", label = "Aviateur — Buste" },
    aviator_legs_f = { asset = "narvos::smc__SK_Female_Aviator_Legs", slot = "jambes", genre = "F", famille = "stylized", ensemble = "Aviator", registre = "civil", label = "Aviateur — Jambes" },
    aviator_legs_m = { asset = "narvos::smc__SK_Aviator_Legs", slot = "jambes", genre = "M", famille = "stylized", ensemble = "Aviator", registre = "civil", label = "Aviateur — Jambes" },
    body_chest_f = { asset = "narvos::smc__SK_Female_Body_Chest", slot = "torse", genre = "F", famille = "stylized", ensemble = "Body", registre = "base", label = "Buste" },
    body_chest_m = { asset = "narvos::smc__SK_Body_Chest", slot = "torse", genre = "M", famille = "stylized", ensemble = "Body", registre = "base", label = "Buste" },
    body_face_m = { asset = "narvos::smc__SK_Body_Face", slot = "visage", genre = "M", famille = "stylized", ensemble = "Body", registre = "base", label = "Neutre" },
    body_hands_f = { asset = "narvos::smc__SK_Female_Body_Hands", slot = "mains", genre = "F", famille = "stylized", ensemble = "Body", registre = "base", label = "Mains" },
    body_hands_m = { asset = "narvos::smc__SK_Body_Hands", slot = "mains", genre = "M", famille = "stylized", ensemble = "Body", registre = "base", label = "Mains" },
    body_legs_f = { asset = "narvos::smc__SK_Female_Body_Legs", slot = "jambes", genre = "F", famille = "stylized", ensemble = "Body", registre = "base", label = "Jambes" },
    body_legs_m = { asset = "narvos::smc__SK_Body_Legs", slot = "jambes", genre = "M", famille = "stylized", ensemble = "Body", registre = "base", label = "Jambes" },
    bodyface_african_f = { asset = "narvos::smc__SK_FemaleBody_AfricanFace", slot = "visage", genre = "F", famille = "stylized", ensemble = "BodyFace", registre = "base", label = "Africain" },
    bodyface_african_m = { asset = "narvos::smc__SK_BodyFace_African", slot = "visage", genre = "M", famille = "stylized", ensemble = "BodyFace", registre = "base", label = "Africain" },
    bodyface_asian_f = { asset = "narvos::smc__SK_FemaleBody_AsianFace", slot = "visage", genre = "F", famille = "stylized", ensemble = "BodyFace", registre = "base", label = "Asiatique" },
    bodyface_asian_m = { asset = "narvos::smc__SK_BodyFace_Asian", slot = "visage", genre = "M", famille = "stylized", ensemble = "BodyFace", registre = "base", label = "Asiatique" },
    bodyface_default_f = { asset = "narvos::smc__SK_FemaleBody_Face", slot = "visage", genre = "F", famille = "stylized", ensemble = "BodyFace", registre = "base", label = "Europeen" },
    casual_chest_m = { asset = "narvos::smc__SK_Casual_Chest", slot = "torse", genre = "M", famille = "stylized", ensemble = "Casual", registre = "civil", label = "Civil — Buste" },
    casual_hands_m = { asset = "narvos::smc__SK_Casual_Hands", slot = "mains", genre = "M", famille = "stylized", ensemble = "Casual", registre = "civil", label = "Civil — Mains" },
    casual_legs_m = { asset = "narvos::smc__SK_Casual_Legs", slot = "jambes", genre = "M", famille = "stylized", ensemble = "Casual", registre = "civil", label = "Civil — Jambes" },
    cop_chest_f = { asset = "narvos::smc__SK_Female_Cop_Chest", slot = "torse", genre = "F", famille = "stylized", ensemble = "Cop", registre = "uniforme", label = "Police — Buste" },
    cop_chest_m = { asset = "narvos::smc__SK_Cop_Chest", slot = "torse", genre = "M", famille = "stylized", ensemble = "Cop", registre = "uniforme", label = "Police — Buste" },
    cop_legs_f = { asset = "narvos::smc__SK_Female_Cop_Legs", slot = "jambes", genre = "F", famille = "stylized", ensemble = "Cop", registre = "uniforme", label = "Police — Jambes" },
    cop_legs_m = { asset = "narvos::smc__SK_Cop_Legs", slot = "jambes", genre = "M", famille = "stylized", ensemble = "Cop", registre = "uniforme", label = "Police — Jambes" },
    defender_headbase = { asset = "narvos::SK_HeadBase", slot = "tete", genre = "*", famille = "defender", ensemble = "Corps nu", registre = "base", label = "Tête nue" },
    defender_legsbase = { asset = "narvos::SK_LegsBase", slot = "jambes", genre = "*", famille = "defender", ensemble = "Corps nu", registre = "base", label = "Jambes nue" },
    defender_torsobase = { asset = "narvos::SK_TorsoBase", slot = "torse", genre = "*", famille = "defender", ensemble = "Corps nu", registre = "base", label = "Buste nue" },
    sk_1_peace = { asset = "narvos::SK_1_peace", slot = "torse", genre = "F", famille = "metacustom", ensemble = "MetaCustom", registre = "civil", pnj_simple = true, label = "Ensemble une pièce" },
    sk_barbarian_male = { asset = "narvos::SK_Barbarian_Male", slot = "torse", genre = "M", famille = "metacustom", ensemble = "MetaCustom", registre = "guerre", pnj_simple = true, label = "Tenue de barbare" },
    sk_boots = { asset = "narvos::SK_Boots", slot = "pieds", genre = "F", famille = "metacustom", ensemble = "MetaCustom", registre = "civil", pnj_simple = true, label = "Bottes" },
    sk_boots_2 = { asset = "narvos::SK_Boots_2", slot = "pieds", genre = "M", famille = "metacustom", ensemble = "MetaCustom", registre = "civil", pnj_simple = true, label = "Bottes" },
    sk_f_trooper_arms_with_hands = { asset = "narvos::SK_F_Trooper_Arms_with_Hands", slot = "bras", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Bras et mains" },
    sk_f_trooper_arms_without_hands = { asset = "narvos::SK_F_Trooper_Arms_without_Hands", slot = "bras", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Bras seuls" },
    sk_f_trooper_hands = { asset = "narvos::SK_F_Trooper_Hands", slot = "mains", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Gants" },
    sk_f_trooper_head_a = { asset = "narvos::SK_F_Trooper_Head_A", slot = "tete", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Casque A" },
    sk_f_trooper_head_b = { asset = "narvos::SK_F_Trooper_Head_B", slot = "tete", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Casque B" },
    sk_f_trooper_lower_legs_only = { asset = "narvos::SK_F_Trooper_Lower_legs_only", slot = "jambes", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Jambières seules" },
    sk_f_trooper_lower_shoes_only = { asset = "narvos::SK_F_Trooper_Lower_shoes_only", slot = "pieds", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Bottes seules" },
    sk_f_trooper_lower_with_feet = { asset = "narvos::SK_F_Trooper_Lower_with_Feet", slot = "jambes", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Bas et bottes" },
    sk_f_trooper_shoulders_a = { asset = "narvos::SK_F_Trooper_Shoulders_A", slot = "epaules", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Épaulières A" },
    sk_f_trooper_shoulders_b = { asset = "narvos::SK_F_Trooper_Shoulders_B", slot = "epaules", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Épaulières B" },
    sk_f_trooper_shoulders_c = { asset = "narvos::SK_F_Trooper_Shoulders_C", slot = "epaules", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Épaulières C" },
    sk_f_trooper_upper_noarms = { asset = "narvos::SK_F_Trooper_Upper_noarms", slot = "torse", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Buste sans bras" },
    sk_f_trooper_upper_with_hands = { asset = "narvos::SK_F_Trooper_Upper_with_Hands", slot = "torse", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Buste et mains" },
    sk_f_trooper_upper_with_shoulders_a = { asset = "narvos::SK_F_Trooper_Upper_with_Shoulders_A", slot = "torse", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Buste et épaulières" },
    sk_f_trooper_upper_without_hands = { asset = "narvos::SK_F_Trooper_Upper_without_hands", slot = "torse", genre = "F", famille = "trooper_f", ensemble = "Trooper", registre = "guerre", label = "Buste sans mains" },
    sk_fantasy_outfit_f_tal_med1 = { asset = "narvos::SK_Fantasy_Outfit_F_Tal_Med1", slot = "torse", genre = "F", famille = "metacustom", ensemble = "MetaCustom", registre = "guerre", pnj_simple = true, label = "Tenue fantasy" },
    sk_female_form_feet = { asset = "narvos::SK_Female_Form_Feet", slot = "pieds", genre = "F", famille = "trooper_f", ensemble = "Corps nu", registre = "base", label = "Corps nu — Pieds" },
    sk_female_form_hands = { asset = "narvos::SK_Female_Form_Hands", slot = "mains", genre = "F", famille = "trooper_f", ensemble = "Corps nu", registre = "base", label = "Corps nu — Gants" },
    sk_female_form_head = { asset = "narvos::SK_Female_Form_Head", slot = "tete", genre = "F", famille = "trooper_f", ensemble = "Corps nu", registre = "base", label = "Corps nu — Tête" },
    sk_female_form_legs = { asset = "narvos::SK_Female_Form_Legs", slot = "jambes", genre = "F", famille = "trooper_f", ensemble = "Corps nu", registre = "base", label = "Corps nu — Jambières" },
    sk_female_form_lower_with_feet = { asset = "narvos::SK_Female_Form_Lower_with_Feet", slot = "jambes", genre = "F", famille = "trooper_f", ensemble = "Corps nu", registre = "base", label = "Corps nu — Bas et bottes" },
    sk_female_form_upper = { asset = "narvos::SK_Female_Form_Upper", slot = "torse", genre = "F", famille = "trooper_f", ensemble = "Corps nu", registre = "base", label = "Corps nu — Buste" },
    sk_female_form_upper_with_hands = { asset = "narvos::SK_Female_Form_Upper_with_Hands", slot = "torse", genre = "F", famille = "trooper_f", ensemble = "Corps nu", registre = "base", label = "Corps nu — Buste et mains" },
    sk_inner_clothing = { asset = "narvos::SK_Inner_Clothing", slot = "torse", genre = "M", famille = "metacustom", ensemble = "MetaCustom", registre = "base", pnj_simple = true, label = "Sous-vêtements" },
    sk_m_trooper_arms_with_hands = { asset = "narvos::SK_M_Trooper_Arms_with_Hands", slot = "bras", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Bras et mains" },
    sk_m_trooper_arms_with_hands_thin = { asset = "narvos::SK_M_Trooper_Arms_with_Hands_thin", slot = "bras", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Bras et mains (fin)" },
    sk_m_trooper_arms_without_hands = { asset = "narvos::SK_M_Trooper_Arms_without_Hands", slot = "bras", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Bras seuls" },
    sk_m_trooper_arms_without_hands_thin = { asset = "narvos::SK_M_Trooper_Arms_without_Hands_thin", slot = "bras", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Bras seuls (fin)" },
    sk_m_trooper_chest = { asset = "narvos::SK_M_Trooper_Chest", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Plastron" },
    sk_m_trooper_chest_thin = { asset = "narvos::SK_M_Trooper_Chest_thin", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Plastron (fin)" },
    sk_m_trooper_hands = { asset = "narvos::SK_M_Trooper_Hands", slot = "mains", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Gants" },
    sk_m_trooper_hands_thin = { asset = "narvos::SK_M_Trooper_Hands_thin", slot = "mains", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Gants (fin)" },
    sk_m_trooper_head_a = { asset = "narvos::SK_M_Trooper_Head_A", slot = "tete", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Casque A" },
    sk_m_trooper_head_b = { asset = "narvos::SK_M_Trooper_Head_B", slot = "tete", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Casque B" },
    sk_m_trooper_legs = { asset = "narvos::SK_M_Trooper_Legs", slot = "jambes", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Jambières" },
    sk_m_trooper_legs_thin = { asset = "narvos::SK_M_Trooper_Legs_thin", slot = "jambes", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Jambières (fin)" },
    sk_m_trooper_lower_thin = { asset = "narvos::SK_M_Trooper_Lower_thin", slot = "jambes", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Bas (fin)" },
    sk_m_trooper_lower_with_feet = { asset = "narvos::SK_M_Trooper_Lower_with_Feet", slot = "jambes", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Bas et bottes" },
    sk_m_trooper_shoes = { asset = "narvos::SK_M_Trooper_Shoes", slot = "pieds", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Bottes" },
    sk_m_trooper_shoes_thin = { asset = "narvos::SK_M_Trooper_Shoes_thin", slot = "pieds", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Bottes (fin)" },
    sk_m_trooper_shoulders_a = { asset = "narvos::SK_M_Trooper_Shoulders_A", slot = "epaules", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Épaulières A" },
    sk_m_trooper_shoulders_b = { asset = "narvos::SK_M_Trooper_Shoulders_B", slot = "epaules", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Épaulières B" },
    sk_m_trooper_shoulders_c = { asset = "narvos::SK_M_Trooper_Shoulders_C", slot = "epaules", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Épaulières C" },
    sk_m_trooper_upper_thin = { asset = "narvos::SK_M_Trooper_Upper_thin", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Buste (fin)" },
    sk_m_trooper_upper_with_hands = { asset = "narvos::SK_M_Trooper_Upper_with_Hands", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Buste et mains" },
    sk_m_trooper_upper_with_shoulders_a = { asset = "narvos::SK_M_Trooper_Upper_with_Shoulders_A", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Buste et épaulières" },
    sk_m_trooper_upper_with_shoulders_a_thin = { asset = "narvos::SK_M_Trooper_Upper_with_Shoulders_A_thin", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Buste et épaulières (fin)" },
    sk_m_trooper_upper_without_hands = { asset = "narvos::SK_M_Trooper_Upper_without_hands", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Buste sans mains" },
    sk_m_trooper_upper_without_hands_thin = { asset = "narvos::SK_M_Trooper_Upper_without_hands_thin", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Trooper", registre = "guerre", label = "Buste sans mains (fin)" },
    sk_male_form_feet = { asset = "narvos::SK_Male_Form_Feet", slot = "pieds", genre = "M", famille = "trooper_m", ensemble = "Corps nu", registre = "base", label = "Corps nu — Pieds" },
    sk_male_form_hands = { asset = "narvos::SK_Male_Form_Hands", slot = "mains", genre = "M", famille = "trooper_m", ensemble = "Corps nu", registre = "base", label = "Corps nu — Gants" },
    sk_male_form_head = { asset = "narvos::SK_Male_Form_Head", slot = "tete", genre = "M", famille = "trooper_m", ensemble = "Corps nu", registre = "base", label = "Corps nu — Tête" },
    sk_male_form_legs = { asset = "narvos::SK_Male_Form_Legs", slot = "jambes", genre = "M", famille = "trooper_m", ensemble = "Corps nu", registre = "base", label = "Corps nu — Jambières" },
    sk_male_form_lower_with_feet = { asset = "narvos::SK_Male_Form_Lower_with_Feet", slot = "jambes", genre = "M", famille = "trooper_m", ensemble = "Corps nu", registre = "base", label = "Corps nu — Bas et bottes" },
    sk_male_form_upper = { asset = "narvos::SK_Male_Form_Upper", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Corps nu", registre = "base", label = "Corps nu — Buste" },
    sk_male_form_upper_with_hands = { asset = "narvos::SK_Male_Form_Upper_with_Hands", slot = "torse", genre = "M", famille = "trooper_m", ensemble = "Corps nu", registre = "base", label = "Corps nu — Buste et mains" },
    sk_male_police_armor_army = { asset = "narvos::SK_Male_Police_Armor_Army", slot = "torse", genre = "M", famille = "metacustom", ensemble = "MetaCustom", registre = "uniforme", pnj_simple = true, label = "Gilet pare-balles" },
    sk_pants3 = { asset = "narvos::SK_Pants3", slot = "jambes", genre = "M", famille = "metacustom", ensemble = "MetaCustom", registre = "civil", pnj_simple = true, label = "Pantalon" },
    sk_petite_female_form_feet = { asset = "narvos::SK_Petite_Female_Form_Feet", slot = "pieds", genre = "F", famille = "trooper_pf", ensemble = "Corps nu", registre = "base", label = "Corps nu — Pieds" },
    sk_petite_female_form_hands = { asset = "narvos::SK_Petite_Female_Form_Hands", slot = "mains", genre = "F", famille = "trooper_pf", ensemble = "Corps nu", registre = "base", label = "Corps nu — Gants" },
    sk_petite_female_form_head = { asset = "narvos::SK_Petite_Female_Form_Head", slot = "tete", genre = "F", famille = "trooper_pf", ensemble = "Corps nu", registre = "base", label = "Corps nu — Tête" },
    sk_petite_female_form_lower = { asset = "narvos::SK_Petite_Female_Form_Lower", slot = "jambes", genre = "F", famille = "trooper_pf", ensemble = "Corps nu", registre = "base", label = "Corps nu — Bas" },
    sk_petite_female_form_lower_with_feet = { asset = "narvos::SK_Petite_Female_Form_Lower_with_feet", slot = "jambes", genre = "F", famille = "trooper_pf", ensemble = "Corps nu", registre = "base", label = "Corps nu — Bas et pieds" },
    sk_petite_female_form_upper = { asset = "narvos::SK_Petite_Female_Form_Upper", slot = "torse", genre = "F", famille = "trooper_pf", ensemble = "Corps nu", registre = "base", label = "Corps nu — Buste" },
    sk_petite_female_form_upper_with_hands = { asset = "narvos::SK_Petite_Female_Form_Upper_with_hands", slot = "torse", genre = "F", famille = "trooper_pf", ensemble = "Corps nu", registre = "base", label = "Corps nu — Buste et mains" },
    sk_pf_trooper_arms_with_hands = { asset = "narvos::SK_PF_Trooper_Arms_with_Hands", slot = "bras", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Bras et mains" },
    sk_pf_trooper_arms_without_hands = { asset = "narvos::SK_PF_Trooper_Arms_without_Hands", slot = "bras", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Bras seuls" },
    sk_pf_trooper_hands = { asset = "narvos::SK_PF_Trooper_Hands", slot = "mains", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Gants" },
    sk_pf_trooper_head_a = { asset = "narvos::SK_PF_Trooper_Head_A", slot = "tete", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Casque A" },
    sk_pf_trooper_head_b = { asset = "narvos::SK_PF_Trooper_Head_B", slot = "tete", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Casque B" },
    sk_pf_trooper_lower_legs_only = { asset = "narvos::SK_PF_Trooper_Lower_legs_only", slot = "jambes", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Jambières seules" },
    sk_pf_trooper_lower_shoes_only = { asset = "narvos::SK_PF_Trooper_Lower_shoes_only", slot = "pieds", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Bottes seules" },
    sk_pf_trooper_lower_with_feet = { asset = "narvos::SK_PF_Trooper_Lower_with_Feet", slot = "jambes", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Bas et bottes" },
    sk_pf_trooper_shoulders_a = { asset = "narvos::SK_PF_Trooper_Shoulders_A", slot = "epaules", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Épaulières A" },
    sk_pf_trooper_shoulders_b = { asset = "narvos::SK_PF_Trooper_Shoulders_B", slot = "epaules", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Épaulières B" },
    sk_pf_trooper_shoulders_c = { asset = "narvos::SK_PF_Trooper_Shoulders_C", slot = "epaules", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Épaulières C" },
    sk_pf_trooper_upper_noarms = { asset = "narvos::SK_PF_Trooper_Upper_noarms", slot = "torse", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Buste sans bras" },
    sk_pf_trooper_upper_with_hands = { asset = "narvos::SK_PF_Trooper_Upper_with_Hands", slot = "torse", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Buste et mains" },
    sk_pf_trooper_upper_with_shoulders_a = { asset = "narvos::SK_PF_Trooper_Upper_with_Shoulders_A", slot = "torse", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Buste et épaulières" },
    sk_pf_trooper_upper_without_hands = { asset = "narvos::SK_PF_Trooper_Upper_without_hands", slot = "torse", genre = "F", famille = "trooper_pf", ensemble = "Trooper", registre = "guerre", label = "Buste sans mains" },
    sk_sci_fi_armor = { asset = "narvos::SK_Sci_Fi_Armor", slot = "torse", genre = "F", famille = "metacustom", ensemble = "MetaCustom", registre = "guerre", pnj_simple = true, label = "Armure sci-fi" },
    sk_sci_fi_jumpsuit = { asset = "narvos::SK_Sci_Fi_Jumpsuit", slot = "torse", genre = "F", famille = "metacustom", ensemble = "MetaCustom", registre = "civil", pnj_simple = true, label = "Combinaison sci-fi" },
    sk_set_1_crop_top = { asset = "narvos::SK_Set_1_Crop_Top", slot = "torse", genre = "F", famille = "metacustom", ensemble = "MetaCustom", registre = "civil", pnj_simple = true, label = "Crop top" },
    sk_set_1shorts = { asset = "narvos::SK_Set_1Shorts", slot = "jambes", genre = "F", famille = "metacustom", ensemble = "MetaCustom", registre = "civil", pnj_simple = true, label = "Short" },
    sk_set_2_pants = { asset = "narvos::SK_Set_2_Pants", slot = "jambes", genre = "F", famille = "metacustom", ensemble = "MetaCustom", registre = "civil", pnj_simple = true, label = "Pantalon" },
    smoking_chest_m = { asset = "narvos::smc__SK_Smoking_Chest", slot = "torse", genre = "M", famille = "stylized", ensemble = "Smoking", registre = "civil", label = "Smoking — Buste" },
    smoking_legs_m = { asset = "narvos::smc__SK_Smoking_Legs", slot = "jambes", genre = "M", famille = "stylized", ensemble = "Smoking", registre = "civil", label = "Smoking — Jambes" },
    soldier_balaclava_f = { asset = "narvos::smc__SK_Female_Balaclava", slot = "tete", genre = "F", famille = "stylized", ensemble = "Soldier", registre = "guerre", label = "Soldat — Balaclava" },
    soldier_chest_f = { asset = "narvos::smc__SK_Female_Soldier_Chest", slot = "torse", genre = "F", famille = "stylized", ensemble = "Soldier", registre = "guerre", label = "Soldat — Buste" },
    soldier_chest_m = { asset = "narvos::smc__SK_Soldier_Chest", slot = "torse", genre = "M", famille = "stylized", ensemble = "Soldier", registre = "guerre", label = "Soldat — Buste" },
    soldier_face_m = { asset = "narvos::smc__SK_Soldier_Face", slot = "visage", genre = "M", famille = "stylized", ensemble = "Soldier", registre = "guerre", label = "Soldat — Neutre" },
    soldier_hands_f = { asset = "narvos::smc__SK_Female_Soldier_Hands", slot = "mains", genre = "F", famille = "stylized", ensemble = "Soldier", registre = "guerre", label = "Soldat — Mains" },
    soldier_legs_f = { asset = "narvos::smc__SK_Female_Soldier_Legs", slot = "jambes", genre = "F", famille = "stylized", ensemble = "Soldier", registre = "guerre", label = "Soldat — Jambes" },
    soldier_legs_m = { asset = "narvos::smc__SK_Soldier_Legs", slot = "jambes", genre = "M", famille = "stylized", ensemble = "Soldier", registre = "guerre", label = "Soldat — Jambes" },
    spacesuit_chest_f = { asset = "narvos::smc__SK_Female_SpaceSuit_Chest", slot = "torse", genre = "F", famille = "stylized", ensemble = "SpaceSuit", registre = "guerre", label = "Combinaison spatiale — Buste" },
    spacesuit_chest_m = { asset = "narvos::smc__SK_SpaceSuit_Chest", slot = "torse", genre = "M", famille = "stylized", ensemble = "SpaceSuit", registre = "guerre", label = "Combinaison spatiale — Buste" },
    spacesuit_face_m = { asset = "narvos::smc__SK_SpaceSuit_Face", slot = "visage", genre = "M", famille = "stylized", ensemble = "SpaceSuit", registre = "guerre", label = "Combinaison spatiale — Neutre" },
    spacesuit_gloves_f = { asset = "narvos::smc__SK_Female_SpaceSuit_Gloves", slot = "mains", genre = "F", famille = "stylized", ensemble = "SpaceSuit", registre = "guerre", label = "Combinaison spatiale — Gloves" },
    spacesuit_hands_m = { asset = "narvos::smc__SK_SpaceSuit_Hands", slot = "mains", genre = "M", famille = "stylized", ensemble = "SpaceSuit", registre = "guerre", label = "Combinaison spatiale — Mains" },
    spacesuit_helm_f = { asset = "narvos::smc__SK_Female_SpaceSuit_Helm", slot = "tete", genre = "F", famille = "stylized", ensemble = "SpaceSuit", registre = "guerre", label = "Combinaison spatiale — Helm" },
    spacesuit_legs_f = { asset = "narvos::smc__SK_Female_SpaceSuit_Legs", slot = "jambes", genre = "F", famille = "stylized", ensemble = "SpaceSuit", registre = "guerre", label = "Combinaison spatiale — Jambes" },
    spacesuit_legs_m = { asset = "narvos::smc__SK_SpaceSuit_Legs", slot = "jambes", genre = "M", famille = "stylized", ensemble = "SpaceSuit", registre = "guerre", label = "Combinaison spatiale — Jambes" },
}

--- Corps PROPOSES A LA CREATION, dans l'ordre d'affichage.
---
--- ── POURQUOI CETTE LISTE EXISTE, ET N'EST PAS "CORPS" ────────────────────────
--- "Modular.CORPS" porte TOUS les corps du jeu : ils ouvrent leurs familles, et
--- sans eux les 119 pieces modulaires seraient ecartees comme orphelines. Les
--- PNJ les portent, la garde-robe s'y adosse.
---
--- Ce que le JOUEUR incarne est une autre question, et c'est celle-ci :
--- « efface cette interface avec les personnages qui sont a l'interieur,
--- branche le payant et les personnages que je controlais deviennent des PNJ »
--- (Hanibes, 2026-09-12). Le Meta Customization System est le systeme de
--- creation ; les corps modulaires restent en jeu, sans etre jouables.
---
--- ⚠ LISTE ECRITE, PAS DERIVEE — et c'est le seul endroit du fichier ou c'est
--- vrai. Elle n'est pas une copie d'un sous-ensemble calculable : elle exprime
--- une DECISION. La generer par filtre (« ceux qui ont un blueprint ») ferait
--- entrer d'office tout futur Blueprint, ce qui n'est pas la meme chose.
--- Le generateur verifie que chaque entree existe dans CORPS.
Modular.JOUABLES = { "mh_homme", "mh_femme" }

--- Corps disponibles pour un genre, ordre stable.
---
--- Ne rend QUE les corps jouables (voir Modular.JOUABLES). L'ordre est celui
--- de la liste, pas l'alphabetique : c'est un ordre d'affichage, et il a ete
--- decide.
---@param genre string
---@return table[]
function Modular.CorpsParGenre(genre)
    local sortie = {}
    for _, id in ipairs(Modular.JOUABLES) do
        local c = Modular.CORPS[id]
        if (c and c.genre == genre) then
            sortie[#sortie + 1] = {
                id = id, asset = c.asset, label = c.label,
                famille = c.famille, blueprint = c.blueprint,
            }
        end
    end
    return sortie
end

--- Un corps par son identifiant, ou nil.
--- Rend nil plutôt qu'un défaut : l'appelant décide, et un corps inconnu venant
--- du client ne doit surtout pas en spawner un autre.
---@param id string
---@return table|nil
function Modular.Corps(id)
    if (type(id) ~= "string") then return nil end
    return Modular.CORPS[id]
end

--- Pièces d'un slot, pour un genre ET une famille donnés.
---
--- Rend une LISTE (ordre stable) et non une table indexée : l'interface la
--- parcourt telle quelle, et pairs n'a aucun ordre garanti en Lua.
---
--- 'famille' est OBLIGATOIRE. Sans elle, l'écran proposerait des vêtements
--- MetaHuman sur un corps Stylized et le joueur composerait une tenue cassée.
---@param slot string
---@param genre string    "M" ou "F"
---@param famille string  voir Modular.FAMILLES
---@return table
function Modular.ParSlot(slot, genre, famille)
    local ids = {}
    for id, p in pairs(Modular.PIECES) do
        -- Genre "*" : pièce mixte, portée par les deux corps.
        local bon_genre = (p.genre == genre) or (p.genre == "*")
        if (p.slot == slot and bon_genre and p.famille == famille) then
            ids[#ids + 1] = id
        end
    end
    table.sort(ids)

    local sortie = {}
    for i = 1, #ids do
        local p = Modular.PIECES[ids[i]]
        sortie[i] = {
            id = ids[i], asset = p.asset, label = p.label,
            ensemble = p.ensemble, registre = p.registre, famille = p.famille,
        }
    end
    return sortie
end

--- Ordre de préférence pour la tenue par défaut.
---
--- CIVIL d'abord : un personnage neuf doit arriver HABILLÉ, pas nu. Les pièces
--- de corps nu restent choisissables — elles sont la base du système modulaire —
--- mais elles ne sont plus ce qu'on porte au départ.
---
--- 'base' en repli, parce que le slot visage n'a AUCUNE pièce civile : tous les
--- visages sont classés base. Sans ce repli, un personnage naîtrait sans tête.
local PREFERENCE_DEFAUT = { "civil", "base" }

--- Slots qui relèvent de l'IDENTITÉ : ils ne prennent que du base.
---
--- ⚠ SANS EUX, UN PERSONNAGE NEUF NAÎT COIFFÉ D'UN CHAPEAU. Depuis que les
--- couvre-chefs du pack Stylized sont au catalogue, le slot tete contient des
--- pièces civil — et PREFERENCE_DEFAUT les prend AVANT les coiffures, qui
--- sont en base. Le joueur héritait d'une casquette d'aviateur qu'il n'avait
--- pas choisie.
---
--- Un chapeau se choisit ; des cheveux, un visage et une barbe se reçoivent.
local SLOTS_IDENTITE = { visage = true, barbe = true, tete = true }

--- Tenue par défaut d'un genre et d'une famille.
---
--- Un slot sans pièce du registre voulu reste VIDE. C'est délibéré : coiffer
--- d'office quelqu'un d'un casque de combat, ou même d'une casquette, serait un
--- choix qu'il n'a pas fait.
---@param genre string
---@param famille string
---@return table
function Modular.TenueDefaut(genre, famille)
    local tenue = {}

    for _, slot in ipairs(Modular.SLOTS) do
        local liste = Modular.ParSlot(slot, genre, famille)

        local preference = SLOTS_IDENTITE[slot] and { "base" } or PREFERENCE_DEFAUT
        for _, registre in ipairs(preference) do
            for i = 1, #liste do
                if (liste[i].registre == registre) then
                    tenue[slot] = liste[i].id
                    break
                end
            end
            if (tenue[slot]) then break end
        end
    end

    return tenue
end

--- Une tenue est-elle cohérente ? Rend (ok, raison).
--- Une tenue invalide est un cas de jeu normal (fiche ancienne, pack modifié),
--- pas une exception.
---@param tenue table
---@param genre string
---@param famille string|nil
---@return boolean, string|nil
function Modular.ValiderTenue(tenue, genre, famille)
    if (type(tenue) ~= "table") then return false, "Tenue absente" end

    for slot, id in pairs(tenue) do
        local p = Modular.PIECES[id]
        if (not p) then
            return false, "Piece inconnue : " .. tostring(id)
        end
        if (p.slot ~= slot) then
            return false, string.format("La piece %s est un %s, pas un %s", id, p.slot, slot)
        end
        if (p.genre ~= "*" and p.genre ~= genre) then
            return false, string.format("La piece %s est %s, le personnage est %s", id, p.genre, genre)
        end
        -- LE MELANGE DE FAMILLES EST REFUSE. Voir l'en-tete : les os concordent,
        -- les volumes non, et l'interpenetration serait visible sans etre
        -- comprehensible.
        if (famille and p.famille ~= famille) then
            return false, string.format(
                "La piece %s est de morphologie %s, le corps est %s", id, p.famille, famille)
        end
    end
    return true, nil
end

return Modular
