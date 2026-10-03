-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Traversee.lua — escalade : vault, rétablissement (mantle), grimper.
--
-- Câblage : Narvos.Traversee = Package.Require("Logic/Traversee.lua")
--
-- ── POURQUOI, ET POURQUOI PUR ──────────────────────────────────────────────────
-- Les clips `M_Neutral_Traversal_*` sont cuits (Catalogues, ~40 entrées, hauteurs
-- 1_0 et 2_5, allures run/stand/walk, pieds L/R) mais AUCUN n'était câblé : le
-- jeu n'a pas d'escalade. Comme Dash et Frappes, ce fichier DÉCIDE (quel geste
-- pour quelle hauteur, quels clips), sans moteur : testable seul.
--
-- ── IP SEULEMENT ───────────────────────────────────────────────────────────────
-- La traversée DÉPLACE le personnage (interpolation serveur) : `pilote_par_code`.
-- Pas de root motion, sinon le mouvement serait doublé.
--
-- ── POURQUOI ON CONSTUIT LES CLIPS AU CHARGEMENT ───────────────────────────────
-- Les noms réels ne sont pas symétriques (ex. `Vault_1_0_walk_F_Rfoot` mais
-- `Vault_1_0_run_F_Lfoot`) : construire un nom « à la main » donnerait des clips
-- manquants. On BALAYE les noms cuits une fois (`Preparer`) et on garde un nom
-- réel par (type, allure).
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosTraversee
local Traversee = {}

-- ── Constantes ────────────────────────────────────────────────────────────────

--- Hauteurs (cm) : en dessous de la borne, on monte au geste inférieur.
Traversee.BORNE_PAS      = 20   -- marche normale, pas une traversée
Traversee.BORNE_VAULT    = 60   -- enjamber / glisser par-dessus
Traversee.BORNE_MANTLE   = 140  -- rétablissement
Traversee.BORNE_CLIMB    = 260  -- grimper ; au-delà, on refuse

--- Durée du geste par type (ms) — les clips font ~0,8 s / 1,1 s / 2,2 s.
Traversee.DUREES = { vault = 800, mantle = 1100, climb = 2200 }

--- Recharge entre deux traversées (ms).
Traversee.COOLDOWN_MS = 500

--- Rayon de détection : on cherche un obstacle jusqu'à cette distance (cm).
Traversee.PORTEE = 260

--- Distance d'atterrissage au-delà du mur (cm) : on se pose un pas derrière
--- le bord, pas dessus.
Traversee.MARGE_ATTERRISSAGE = 70

--- Hauteur de l'arc au-dessus du bord pendant le geste (cm).
Traversee.ARC = 60

--- Pic de montée pour mantle/climb (cm au-dessus du bord, pour les PIEDS) :
--- l'arc en deux phases monte jusqu'à ce pic puis redescend poser sur le
--- sommet. Plus bas que ARC : un rétablissement ne doit pas « flotter ».
Traversee.ARC_PIC = 40

--- Allure choisie depuis la vitesse au sol (cm/s).
Traversee.SEUIL_RUN  = 400
Traversee.SEUIL_MARCHE = 30

--- Le type (vault/mantle/climb) vers sa famille de clips.
Traversee.FAMILLES = {
    vault   = { hauteur = "1_0" },
    mantle  = { hauteur = "1_0" },
    climb   = { hauteur = "2_5" },
}

-- ── Préparation des clips (une fois au chargement) ────────────────────────────

--- Classe une hauteur d'obstacle (cm) en type de traversée, ou nil.
---@param hauteur number
---@return string|nil  "vault" | "mantle" | "climb"
function Traversee.Classer(hauteur)
    if (not hauteur) then return nil end
    if (hauteur <= Traversee.BORNE_PAS) then return nil end
    if (hauteur <= Traversee.BORNE_VAULT) then return "vault" end
    if (hauteur <= Traversee.BORNE_MANTLE) then return "mantle" end
    if (hauteur <= Traversee.BORNE_CLIMB) then return "climb" end
    return nil
end

--- Allure depuis la vitesse au sol (cm/s).
---@param vitesse number
---@return string  "run" | "walk" | "stand"
function Traversee.Allure(vitesse)
    if (vitesse >= Traversee.SEUIL_RUN) then return "run" end
    if (vitesse >= Traversee.SEUIL_MARCHE) then return "walk" end
    return "stand"
end

--- Construit la table des clips réels à partir des noms cuits.
--- Un clip par (type, allure) : le premier nom rencontré fait foi.
--- Les noms ne sont pas symétriques (ex. `Vault_1_0_run_F_Lfoot` mais
--- `Vault_1_0_walk_F_Rfoot`) : on lit les JETONS, pas un motif de forme fixe.
---@param noms string[]  noms d'animations cuites
---@return table  clips[type][allure] = nom
function Traversee.Preparer(noms)
    local clips = {}
    for _, nom in ipairs(noms) do
        local jeton4, allure
        local rang = 0
        for jeton in nom:gmatch("[^_]+") do
            rang = rang + 1
            if (rang == 4) then jeton4 = jeton end  -- M_Neutral_Traversal_<TYPE>…
            if (jeton == "run" or jeton == "walk" or jeton == "stand") then
                allure = jeton
                break
            end
        end
        -- Le 4e jeton est fiable : "Vault", "Mantle", "Climb", "Hurdle", "Catch".
        -- (`Climb_Start_2_5_run…` : le jeton avant "run" serait "5", pas "Start".)
        local famille
        if (jeton4 == "Vault") then famille = "vault"
        elseif (jeton4 == "Mantle") then famille = "mantle"
        elseif (jeton4 == "Climb") then famille = "climb"
        end
        if (famille and allure and not (clips[famille] and clips[famille][allure])) then
            clips[famille] = clips[famille] or {}
            clips[famille][allure] = nom
        end
    end
    return clips
end

--- Clip pour un type et une allure, avec repli (run → walk → stand).
---@param clips table  produit par Preparer
---@param typ string    "vault" | "mantle" | "climb"
---@param allure string "run" | "walk" | "stand"
---@return string|nil
function Traversee.Clip(clips, typ, allure)
    if (not clips or not clips[typ]) then return nil end
    return clips[typ][allure]
        or clips[typ]["walk"]
        or clips[typ]["stand"]
        or clips[typ]["run"]
end

--- Types sans AUCUN clip cuit — signalés au chargement.
---@param clips table
---@return string[]
function Traversee.Verifier(clips)
    local manquants = {}
    for typ in pairs(Traversee.FAMILLES) do
        if (not clips or not clips[typ] or not Traversee.Clip(clips, typ, "run")) then
            table.insert(manquants, typ)
        end
    end
    return manquants
end

return Traversee
