-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/OsVehicules.lua — la table de correspondance entre les squelettes des
-- packs de véhicules et les rôles canoniques NARVOS (roues, direction,
-- suspensions).
--
-- Câblage : Narvos.OsVehicules = Package.Require("Logic/OsVehicules.lua") dans
-- Shared/Index.lua.
--
-- ── POURQUOI UNE TABLE, JAMAIS DU CODE EN DUR ─────────────────────────────────
-- La mission (§3.B, P1) est formelle : DEUX conventions d'os coexistent dans
-- nos packs, et un troisième pack ne doit pas rouvrir le chantier. Le mapping
-- est donc une DONNÉE ci-dessous ; la logique (Resoudre) ne connaît que des
-- signatures et des exclusions.
--
-- ── MESURES (sur disque, 2026-09) ─────────────────────────────────────────────
--   · City_Traffic_Pro — squelette partagé `Car_Skeleton` des 12 voitures,
--     os de roues `Wheel_FL/FR/RL/RR` (docs/FAB_RECHERCHE_P1_P2.md, preuve
--     binaire par grep sur le .uasset).
--   · Drivable Cars Basic (Digital Dive) — squelette partagé
--     `Car_Base_Skeleton` : `Front_Left/Right_Wheel`, `Rear_Left/Right_Wheel`,
--     `Steering_Wheel`, `FL/FR/RL/RR_SuspensionWheel`
--     (docs/AUDIT_PACK_DRIVABLE_CARS_BASIC.md §3).
--   · Motos Digital Dive — squelette partagé `SKL_Bike_base` : les MÊMES quatre
--     os de roues que les voitures Digital Dive, PLUS `Front_Visible_Wheel` et
--     `SuspensionTop/Bottom/Front` (docs/AUDIT_A_TRIER_LOT1.md).
--
-- ── CE QUI N'EST PAS TRANCHÉ ──────────────────────────────────────────────────
-- La moto a TROIS os de suspension pour DEUX roues, et l'audit ne dit pas
-- lequel de `Rear_Left_Wheel` / `Rear_Right_Wheel` porte la roue arrière
-- visible : le rôle `roue_ar` est canonique mais VOLONTAIREMENT absent de la
-- convention moto — à trancher au premier import (MANIFESTE_IMPORT_20260910).
-- Resoudre ne devine jamais : un os non reconnu ne reçoit pas de rôle.
--
-- ── RÈGLES DE RÉSOLUTION ──────────────────────────────────────────────────────
-- Un squelette (liste de noms d'os) reconnaît une convention si :
--   1. TOUS les os de sa `signature` sont présents, ET
--   2. AUCUN os de ses `exclus` n'est présent.
-- Zéro candidat → nil + raison (jamais de repli muet). Plusieurs → la
-- signature la plus longue l'emporte ; à égalité → nil « ambigu » : deviner
-- câblerait les roues sur les mauvais os sans prévenir.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosOsVehicules
local OsVehicules = {}

-- ── Rôles canoniques ──────────────────────────────────────────────────────────
-- Tout rôle utilisé par une convention DOIT figurer ici : un rôle inventé dans
-- une convention passerait en silence sinon. `roue_ar` est canonique mais
-- n'est attribué par AUCUNE convention tant que la question moto n'est pas
-- tranchée — sa présence ici est une promesse, pas un oubli.
OsVehicules.ROLES = {
    "roue_av_g", "roue_av_d", "roue_ar_g", "roue_ar_d",
    "roue_av", "roue_ar",
    "direction",
    "suspension_av_g", "suspension_av_d", "suspension_ar_g", "suspension_ar_d",
    "suspension_haut", "suspension_bas", "suspension_avant",
}

-- ── Les conventions — la DONNÉE, pas la logique ───────────────────────────────
--
--   signature — les os DISCRIMINANTS : tous requis pour reconnaître le pack ;
--   exclus    — leur présence RÉFUTE la convention (ex. `Front_Visible_Wheel`
--               est la marque de la moto : un squelette qui le porte n'est pas
--               une voiture Digital Dive, même si les quatre roues y sont) ;
--   roles     — rôle canonique → nom d'os DANS ce pack. Un rôle dont l'os est
--               absent du squelette est rapporté dans `manquants`, pas deviné.
OsVehicules.CONVENTIONS = {
    city_traffic_pro = {
        id = "city_traffic_pro",
        squelette = "Car_Skeleton",   -- mesuré ; indicatif, jamais exigé
        signature = { "Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR" },
        exclus = {},
        roles = {
            roue_av_g = "Wheel_FL",
            roue_av_d = "Wheel_FR",
            roue_ar_g = "Wheel_RL",
            roue_ar_d = "Wheel_RR",
        },
    },
    digital_dive_voiture = {
        id = "digital_dive_voiture",
        squelette = "Car_Base_Skeleton",
        signature = {
            "Front_Left_Wheel", "Front_Right_Wheel",
            "Rear_Left_Wheel", "Rear_Right_Wheel",
        },
        -- `Front_Visible_Wheel` est la marque de la MOTO : sa présence réfute
        -- la voiture, sinon tout squelette moto passerait pour une voiture
        -- (les quatre os de roues sont identiques entre les deux packs).
        exclus = { "Front_Visible_Wheel" },
        roles = {
            roue_av_g = "Front_Left_Wheel",
            roue_av_d = "Front_Right_Wheel",
            roue_ar_g = "Rear_Left_Wheel",
            roue_ar_d = "Rear_Right_Wheel",
            direction = "Steering_Wheel",
            suspension_av_g = "FL_SuspensionWheel",
            suspension_av_d = "FR_SuspensionWheel",
            suspension_ar_g = "RL_SuspensionWheel",
            suspension_ar_d = "RR_SuspensionWheel",
        },
    },
    digital_dive_moto = {
        id = "digital_dive_moto",
        squelette = "SKL_Bike_base",
        signature = {
            "Front_Left_Wheel", "Front_Right_Wheel",
            "Rear_Left_Wheel", "Rear_Right_Wheel",
            "Front_Visible_Wheel",   -- LE discriminant moto
        },
        -- Les suspensions de voiture réfutent la moto (hybride = inconnu).
        exclus = { "FL_SuspensionWheel" },
        roles = {
            roue_av_g = "Front_Left_Wheel",
            roue_av_d = "Front_Right_Wheel",
            roue_ar_g = "Rear_Left_Wheel",
            roue_ar_d = "Rear_Right_Wheel",
            -- ⚠ PAS de `roue_ar` : lequel de Rear_Left/Right porte la roue
            -- arrière visible n'est pas tranché par l'audit. Ne pas deviner.
            roue_av = "Front_Visible_Wheel",
            direction = "Steering_Wheel",
            suspension_haut = "SuspensionTop",
            suspension_bas = "SuspensionBottom",
            suspension_avant = "SuspensionFront",
        },
    },
}

-- ── Données : lectures et garde-fous ──────────────────────────────────────────

--- La convention d'un identifiant, ou nil.
---@param id any
---@return table|nil
function OsVehicules.Convention(id)
    if (type(id) ~= "string") then return nil end
    return OsVehicules.CONVENTIONS[id]
end

--- Vrai si le rôle est canonique.
local function roleCanonique(role)
    for _, r in ipairs(OsVehicules.ROLES) do
        if (r == role) then return true end
    end
    return false
end

--- Vérifie la cohérence de CHAQUE convention. Les harnais l'appellent : une
--- donnée fausse doit tomber au test, pas câbler des roues sur un mauvais os.
--- Rend true, ou false + la raison nommant la convention et le champ.
---@return boolean, string|nil
function OsVehicules.VerifierDonnees()
    local compte = 0
    for cle, conv in pairs(OsVehicules.CONVENTIONS) do
        compte = compte + 1
        if (conv.id ~= cle) then
            return false, cle .. " : id incohérent (" .. tostring(conv.id) .. ")"
        end
        if (type(conv.signature) ~= "table" or #conv.signature == 0) then
            return false, cle .. " : signature vide — rien ne la distingue"
        end
        local vus = {}
        for _, os_requis in ipairs(conv.signature) do
            if (type(os_requis) ~= "string" or os_requis == "") then
                return false, cle .. " : os de signature invalide"
            end
            if (vus[os_requis]) then
                return false, cle .. " : os en double dans la signature (" .. os_requis .. ")"
            end
            vus[os_requis] = true
        end
        for _, os_exclu in ipairs(conv.exclus or {}) do
            if (vus[os_exclu]) then
                return false, cle .. " : " .. os_exclu .. " est à la fois requis et exclu"
            end
        end
        -- Chaque os de la signature doit servir : s'il ne porte aucun rôle, il
        -- discrimine sans jamais être câblé — suspect.
        local os_roles = {}
        for role, os_cible in pairs(conv.roles or {}) do
            if (not roleCanonique(role)) then
                return false, cle .. " : rôle non canonique (" .. tostring(role) .. ")"
            end
            if (os_roles[os_cible]) then
                return false, cle .. " : " .. os_cible .. " porte deux rôles"
            end
            os_roles[os_cible] = role
        end
        for _, os_requis in ipairs(conv.signature) do
            if (not os_roles[os_requis]) then
                return false, cle .. " : " .. os_requis .. " discrimine mais ne porte aucun rôle"
            end
        end
    end
    if (compte < 3) then
        return false, "trois packs sont documentés, la table en porte " .. compte
    end
    return true, nil
end

-- ── Résolution ────────────────────────────────────────────────────────────────

--- Résout un squelette contre une LISTE de conventions. Exposée pour que les
--- tests puissent prouver l'ambiguïté et la priorité sur des conventions
--- fabriquées, sans toucher la donnée réelle.
---@param noms_os any       liste de noms d'os (table array de chaînes)
---@param conventions any   table id → convention (même forme que CONVENTIONS)
---@return table|nil resolution { convention, roles, manquants }, string|nil raison
function OsVehicules.ResoudreParmi(noms_os, conventions)
    if (type(noms_os) ~= "table") then return nil, "liste d'os attendue" end
    if (type(conventions) ~= "table") then return nil, "conventions attendues" end

    local presents = {}
    for _, nom in ipairs(noms_os) do
        if (type(nom) == "string" and nom ~= "") then presents[nom] = true end
    end

    local candidats = {}
    for _, conv in pairs(conventions) do
        local complete = true
        for _, os_requis in ipairs(conv.signature or {}) do
            if (not presents[os_requis]) then complete = false break end
        end
        if (complete) then
            for _, os_exclu in ipairs(conv.exclus or {}) do
                if (presents[os_exclu]) then complete = false break end
            end
        end
        if (complete) then candidats[#candidats + 1] = conv end
    end

    if (#candidats == 0) then
        return nil, "aucune convention ne reconnait ce squelette"
    end

    -- La signature la plus longue l'emporte : c'est la reconnaissance la plus
    -- exigeante. À égalité, choisir serait deviner — on rend nil et on NOMME.
    local longueur_max = 0
    for _, conv in ipairs(candidats) do
        longueur_max = math.max(longueur_max, #conv.signature)
    end
    local ex_aequo = {}
    for _, conv in ipairs(candidats) do
        if (#conv.signature == longueur_max) then ex_aequo[#ex_aequo + 1] = conv.id end
    end
    table.sort(ex_aequo)
    if (#ex_aequo > 1) then
        return nil, "squelette ambigu : " .. table.concat(ex_aequo, " et ")
            .. " le reconnaissent"
    end

    local gagnante = nil
    for _, conv in ipairs(candidats) do
        if (conv.id == ex_aequo[1]) then gagnante = conv break end
    end

    local roles, manquants = {}, {}
    for role, os_cible in pairs(gagnante.roles) do
        if (presents[os_cible]) then
            roles[role] = os_cible
        else
            manquants[#manquants + 1] = role
        end
    end
    table.sort(manquants)

    return {
        convention = gagnante.id,
        squelette = gagnante.squelette,
        roles = roles,
        manquants = manquants,
    }, nil
end

--- Résout un squelette contre les conventions connues.
---@param noms_os any
---@return table|nil resolution, string|nil raison
function OsVehicules.Resoudre(noms_os)
    return OsVehicules.ResoudreParmi(noms_os, OsVehicules.CONVENTIONS)
end

return OsVehicules
