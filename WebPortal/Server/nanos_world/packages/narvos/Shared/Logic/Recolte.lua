-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Recolte.lua — le deuxième maillon de la chaîne
-- EXPLORE → RÉCOLTE → RESSOURCES → TRANSFORMATION → CRAFT → INVENTAIRE.
--
-- ── PUR ET PROUVABLE ──────────────────────────────────────────────────────────
-- Aucun appel à l'API nanos (Character, Timer, Player, Console, Vector). Tout ce
-- qui vient du moteur — l'heure, un tirage aléatoire, l'état d'un joueur — ENTRE
-- EN PARAMÈTRE. Un module qui irait le chercher lui-même serait intestable.
--
-- ── RÈGLE : IMMUABLE ──────────────────────────────────────────────────────────
-- Aucune fonction ne modifie l'état qu'on lui donne. `MarquerRecolte` et
-- `Reinitialiser` rendent un état NEUF ; `etat` d'entrée reste intact. C'est la
-- règle du dépôt (cf. `Logic/Inventory.lua`, en-tête de la section GRILLE).
--
-- ── RÈGLE : LE TIRAGE ENTRE EN PARAMÈTRE ──────────────────────────────────────
-- `Recolte.Rendement(gisement, niveau, rng)` appelle `rng()`, qui rend un flottant
-- dans [0, 1]. Chaque VM a sa propre graine : le serveur tire, le client reçoit.
-- Un module qui tire lui-même ne se rejoue pas et ne se teste pas.
--
-- ⚠ « RÉCOLTÉ » N'EST PAS « RÉINITIALISÉ » ─────────────────────────────────
-- Un gisement VIDÉ PAR UN JOUEUR attend `repousse_ms` (état `MarquerRecolte`).
-- Un gisement REMIS À ZÉRO parce que sa zone s'est déchargée est disponible
-- immédiatement (état `Reinitialiser`). Confondre les deux ferait réapparaître
-- le minerai sous les yeux de qui vient de le prendre — la même distinction que
-- `Server/Peuplement.lua` fait déjà avec ses points (`Mourir(rang, tue)` :
-- `etats[rang] = tue and { mort_a_ms = horloge_ms } or nil`, ligne 168 — un
-- PNJ TUÉ attend `REPOUSSE_MS`, un PNJ RETIRÉ par distance revient tout de
-- suite). Notre équivalent : `MarquerRecolte` ⇔ `mort_a_ms` ; `Reinitialiser` ⇔
-- `etats[rang] = nil` (disponible immédiatement).
-- ═══════════════════════════════════════════════════════════════════════════════

local Recolte = {}

-- Repli hors moteur : dans Shared/Index.lua, `Narvos.Gisements` est posé par le
-- chargeur ; en VM nue (tests), `Narvos.Gisements` est fourni par le harnais.
local function requis(nom, fichier)
    return (Narvos and Narvos[nom]) or Package.Require(fichier)
end
local Gisements = requis("Gisements", "Catalogs/Gisements.lua")

--- Gisement par identifiant. nil si inconnu.
---@param id string
---@return table|nil gisement
function Recolte.Gisement(id)
    if (id == nil) then return nil end
    return Gisements.GISEMENTS[id]
end

--- Liste ORDONNÉE des identifiants de gisement. Pour tout affichage.
---@return table
function Recolte.Sequence()
    return Gisements.ORDRE
end

--- Le geste de chaque outil : l'animation jouée à la récolte et le mesh tenu en
--- main pendant qu'elle se joue.
---
--- Source : Farming And Mining, cuit le 2026-09-13 avec ses 72 animations posées
--- sur SKEL_Mannequin (ObjectRedirects du squelette, prouvé sur le paquet cuit).
--- Clés relues dans Assets.toml : `Pick_Swing_*_Anim`, `Shovel_Action1_Anim`
--- en [assets.animations], `Pickaxe_SM`, `Shovel_SM` en [assets.static_meshes].
---
--- ⚠ LA FOREUSE EMPRUNTE LA PIOCHE. Le pack n'a ni foreuse ni geste de forage :
--- le coup bas de pioche est le plus proche. Dit, pas caché.
--- ⚠ Les pistes des os OUTILS du pack (`Tool_R_Hand`) sont tombées au cook : le
--- mesh s'attache à `hand_r`, et son orientation dans la main n'a pas été vue.
Recolte.GESTES_OUTIL = {
    pioche = { animation = "narvos::Pick_Swing_Med_Anim", mesh = "narvos::Pickaxe_SM" },
    foreuse = { animation = "narvos::Pick_Swing_Low_Anim", mesh = "narvos::Pickaxe_SM" },
    collecteur = { animation = "narvos::Shovel_Action1_Anim", mesh = "narvos::Shovel_SM" },
}

--- Le geste d'un gisement, ou nil (mains nues, gisement inconnu).
---@param gisement table|nil
---@return table|nil { animation, mesh }
function Recolte.GesteDe(gisement)
    if (gisement == nil or gisement.outil == nil) then return nil end
    return Recolte.GESTES_OUTIL[gisement.outil]
end

--- Les outils que des gisements EXIGENT, chacun une fois, dans l'ordre du
--- catalogue (`Gisements.ORDRE`, jamais `pairs`).
---
--- C'est la liste que le serveur cherche dans le sac. Elle était RECOPIÉE en dur
--- dans `Server/Index.lua` (`{ "pioche", "foreuse", "collecteur" }`) : un outil
--- ajouté au catalogue n'aurait jamais été détecté — la forme exacte du défaut
--- des portails (CLAUDE.md, « une liste de clés recopiée diverge toujours »).
---@return table liste
function Recolte.OutilsRequis()
    local sortie, vus = {}, {}
    for _, id in ipairs(Gisements.ORDRE) do
        local g = Gisements.GISEMENTS[id]
        local o = g and g.outil
        if (type(o) == "string" and o ~= "" and not vus[o]) then
            vus[o] = true
            sortie[#sortie + 1] = o
        end
    end
    return sortie
end

--- Gisements d'une zone, pour un INDEX PAR ZONE (décision : pas de balayage
--- global). Le serveur tiendra `zone_id → instances de gisements` et n'interrogera
--- que la zone du joueur. Compter ici, jamais balayer la table entière.
---@param zone_id string
---@return table liste (séquence, vide si zone inconnue)
function Recolte.GisementsDeZone(zone_id)
    local sortie = {}
    for i, id in ipairs(Gisements.ORDRE) do
        local g = Gisements.GISEMENTS[id]
        if (g and g.zone_id == zone_id) then
            sortie[#sortie + 1] = g
        end
    end
    return sortie
end

--- État neuf d'un gisement : jamais récolté, pas réinitialisé.
---@param gisement_id string
---@return table etat
function Recolte.EtatNeuf(gisement_id)
    return { gisement_id = gisement_id, vide_a_ms = nil, reinitialise = false }
end

--- Le joueur peut-il récolter CE gisement ?
--- La raison est OBLIGATOIRE quand c'est faux : « il te faut une pioche » est
--- jouable, `false` seul oblige l'interface à redevenir le cerveau du système.
---
--- ⚠ `outils` (ENSEMBLE { [outil] = true }) est la forme à passer. `outil`
--- (une seule chaîne) reste lu pour les appelants existants, mais il ne décrit
--- pas un sac : le 2026-09-13, le serveur réduisait le sac à SON PREMIER outil,
--- et un joueur porteur d'une pioche ET d'une foreuse se voyait refuser tout
--- gisement à foreuse.
---@param gisement table
---@param etat_joueur table { outils = table|nil, outil = string|nil, palier = number }
---@return boolean ok
---@return string|nil raison
function Recolte.Peut(gisement, etat_joueur)
    if (gisement == nil) then return false, "gisement inconnu" end
    if (etat_joueur == nil) then return false, "état du joueur absent" end
    if (gisement.outil ~= nil) then
        local possede
        if (type(etat_joueur.outils) == "table") then
            possede = etat_joueur.outils[gisement.outil] == true
        else
            possede = etat_joueur.outil ~= nil and etat_joueur.outil == gisement.outil
        end
        if (not possede) then
            return false, "il te faut une " .. tostring(gisement.outil_label or gisement.outil)
        end
    end
    local palier = etat_joueur.palier or 0
    if (palier < gisement.palier) then
        return false, "palier de compétence " .. tostring(gisement.palier) .. " requis"
    end
    return true, nil
end

--- Rendement d'une récolte : liste `{ { item_id, quantite } }`.
--- Le palier de compétence augmente le RENDEMENT, jamais la vitesse :
--- `bonus_palier` unités supplémentaires (min ET max) par palier au-dessus du
--- requis. Le tirage est borné à [quantite_min, max_eff], quoi que rende rng.
---@param gisement table
---@param niveau number palier EFFECTIF du joueur
---@param rng function rend un flottant [0, 1]
---@return table|nil liste
---@return string|nil raison (rng absent ou invalide)
function Recolte.Rendement(gisement, niveau, rng)
    if (gisement == nil) then return nil, "gisement inconnu" end
    if (type(rng) ~= "function") then return nil, "rng manquant" end

    local palier_bonus = math.max(0, (niveau or 0) - gisement.palier)
    local max_eff = gisement.quantite_max + palier_bonus * (gisement.bonus_palier or 0)
    local min_eff = gisement.quantite_min

    local tirage = rng()
    if (type(tirage) ~= "number") then return nil, "rng invalide" end
    -- rng() peut rendre exactement 1.0 (une graine tordu) : on borne l'intervalle.
    if (tirage < 0) then tirage = 0 end
    if (tirage > 1) then tirage = 1 end

    -- +1 pour que les bornes soient atteignables : tirage 0 → min, tirage 1 → max.
    local quantite = math.floor(min_eff + tirage * (max_eff - min_eff + 1))
    if (quantite < min_eff) then quantite = min_eff end
    if (quantite > max_eff) then quantite = max_eff end

    return { { item_id = gisement.ressource, quantite = quantite } }, nil
end

--- Le gisement est-il prêt à être récolté, d'après son état et l'horloge ?
---   - état absent         → vrai (jamais récolté)
---   - état réinitialisé   → vrai IMMÉDIATEMENT (zone déchargée, voir en-tête)
---   - jamis récolté       → vrai
---   - récolté à `vide_a_ms` → vrai seulement après `repousse_ms`.
---@param gisement table
---@param etat table|nil
---@param horloge_ms number
---@return boolean
function Recolte.EstPret(gisement, etat, horloge_ms)
    if (gisement == nil) then return false end
    if (etat == nil) then return true end
    if (etat.reinitialise) then return true end
    if (etat.vide_a_ms == nil) then return true end
    return horloge_ms >= etat.vide_a_ms + gisement.repousse_ms
end

--- Marque le gisement comme récolté à `horloge_ms` : il attendra `repousse_ms`.
--- REND UN ÉTAT NEUF ; `etat` d'entrée n'est pas modifié.
---@param etat table
---@param horloge_ms number
---@return table nouvel_etat
function Recolte.MarquerRecolte(etat, horloge_ms)
    return {
        gisement_id = etat and etat.gisement_id or nil,
        vide_a_ms = horloge_ms,
        reinitialise = false,
    }
end

--- Remet le gisement à zéro (zone déchargée, serveur repart) : immédiatement
--- disponible, SANS attendre la repousse. REND UN ÉTAT NEUF.
---@param etat table
---@return table nouvel_etat
function Recolte.Reinitialiser(etat)
    return {
        gisement_id = etat and etat.gisement_id or nil,
        vide_a_ms = nil,
        reinitialise = true,
    }
end

--- Vérifie la cohérence du catalogue GAUCHE contre `items` (le CATALOGUE RÉEL).
--- Rend la liste des problèmes : ressource inconnue, bornes inversées, palier ou
--- délais invalides. Liste vide = cohérent. Ne lève jamais.
---@param items table|nil dictionnaire d'items (Items.ITEM_DB)
---@return table problemes
function Recolte.Verifier(items)
    local problemes = {}
    for i, id in ipairs(Gisements.ORDRE) do
        local g = Gisements.GISEMENTS[id]
        if (g == nil) then
            problemes[#problemes + 1] = id .. ": entrée absente de GISEMENTS"
        else
            if (items == nil or items[g.ressource] == nil) then
                problemes[#problemes + 1] = id .. ": ressource inconnue " .. tostring(g.ressource)
            end
            if (type(g.quantite_min) ~= "number" or type(g.quantite_max) ~= "number"
                or g.quantite_min < 1 or g.quantite_max < g.quantite_min) then
                problemes[#problemes + 1] = id .. ": bornes invalides"
            end
            if (type(g.palier) ~= "number" or g.palier < 1) then
                problemes[#problemes + 1] = id .. ": palier invalide"
            end
            if (type(g.duree_ms) ~= "number" or g.duree_ms <= 0) then
                problemes[#problemes + 1] = id .. ": duree_ms invalide"
            end
            if (type(g.repousse_ms) ~= "number" or g.repousse_ms <= 0) then
                problemes[#problemes + 1] = id .. ": repousse_ms invalide"
            end
            if (type(g.zone_id) ~= "string" or g.zone_id == "") then
                problemes[#problemes + 1] = id .. ": zone_id invalide"
            end
        end
    end
    return problemes
end

return Recolte
