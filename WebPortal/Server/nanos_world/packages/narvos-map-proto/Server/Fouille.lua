-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Fouille.lua — les cadavres fouillables, côté serveur.
--
-- Câblage : Package.Require("Server/Fouille.lua") depuis Server/Index.lua,
-- APRÈS Session, inventaires et le butin. Il remplace le versement automatique
-- de `Narvos:IaServeur.UtiliserMort` par un cadavre à fouiller (ou par
-- l'auto-loot, selon les réglages de jouabilité du joueur).
--
-- ── LE MODÈLE EST AILLEURS ────────────────────────────────────────────────────
-- `Logic/Fouille.lua` décide du contenu, des retraits, du poids et du filtre
-- d'auto-loot — prouvé par scripts/lua-harness/fouille.mjs. Ici on ne fait que
-- relier : cadavre → état, proximité, grille d'inventaire, sauvegarde.
-- ═══════════════════════════════════════════════════════════════════════════════

local FouilleServeur = {}

local Fouille = Narvos.Fouille
local JouabiliteServeur = Narvos.JouabiliteServeur
local Session = Narvos.SessionServeur

--- Rayon d'interaction avec le cadavre (cm).
FouilleServeur.PORTEE_CM = 250

--- Durée de fouillabilité, alignée sur le cadavre lui-même.
FouilleServeur.DUREE_MS = 120000

--- Options branchées par Server/Index.lua : grille et sauvegarde du sac.
local options = {
    grille = nil,  -- function(player) -> grid
    ecrire = nil,  -- function(player, grid) -> boolean (sauvegarde)
    envoyer_inventaire = nil, -- function(player)
}

--- Les cadavres en attente : entite -> { etat = Fouille.etat, expire_ms }.
local cadavres = {}

---@param options table { grille = function, ecrire = function, envoyer_inventaire = function }
function FouilleServeur.Brancher(opts)
    if (type(opts) == "table") then
        if (type(opts.grille) == "function") then options.grille = opts.grille end
        if (type(opts.ecrire) == "function") then options.ecrire = opts.ecrire end
        if (type(opts.envoyer_inventaire) == "function") then options.envoyer_inventaire = opts.envoyer_inventaire end
    end
end

--- Distance carrée entre deux entités. Une entité disparue rend math.huge :
--- le cadavre détruit ne sera jamais « proche ».
---@param a table
---@param b table
---@return number
local function DistanceCarree(a, b)
    local ok1, pa = pcall(function() return a:GetLocation() end)
    local ok2, pb = pcall(function() return b:GetLocation() end)
    if (not ok1 or not ok2 or not pa or not pb) then return math.huge end
    local dx, dy, dz = pa.X - pb.X, pa.Y - pb.Y, pa.Z - pb.Z
    return dx * dx + dy * dy + dz * dz
end

---@param entite table
---@return table|nil  l'état du cadavre, ou nil.
local function EtatDe(entite)
    local f = cadavres[entite]
    if (not f) then return nil end
    if (Fouille.Expire(f.etat, Server.GetTime() * 1000)) then
        cadavres[entite] = nil
        return nil
    end
    return f.etat
end

-- ── À la mort d'un PNJ ─────────────────────────────────────────────────────────

--- Un ennemi est mort. Deux chemins :
---   auto-loot ACTIF   → le filtre décide, le sac reçoit, le cadavre est vide ;
---   sinon             → le butin attend sur le cadavre, annoncé au tueur.
---@param player table
---@param suivi table
---@param entite table  le cadavre lui-même.
function FouilleServeur.SurMort(player, suivi, entite)
    if (not player or not Session.EnJeu(player) or not suivi or not suivi.stats) then return end
    if (not entite or not options.grille) then return end

    local drops = Narvos.ButinEnnemi.Tirer(suivi.stats.niveau or 1, 1, math.random)
    if (#drops == 0) then return end

    -- Convertit le butin (drop.def/drop.quantite) en entrées fouillables.
    local entrees = {}
    for _, drop in ipairs(drops) do
        entrees[#entrees + 1] = { def = drop.def, quantite = drop.quantite }
    end
    local etat = Fouille.Nouveau(entrees, Server.GetTime() * 1000, FouilleServeur.DUREE_MS)

    local reglages = JouabiliteServeur and JouabiliteServeur.ReglagesDe(player) or nil
    if (reglages and reglages.auto_loot) then
        -- Auto-loot : le filtre (types + rareté) décide ce qui part au sac.
        local pris = Fouille.AutoLoot(etat, reglages)
        local grille = options.grille(player)
        local recus, pleins = {}, {}
        for _, p in ipairs(pris) do
            local suivante = Narvos.Inventory.AddItemToGrid(grille, p.def, p.quantite)
            if (suivante) then
                grille = suivante
                recus[#recus + 1] = (p.def.label or p.def.id)
                    .. " [" .. (Narvos.ButinEnnemi.RARETES_TITRES[p.def.rarity] or p.def.rarity) .. "]"
            else
                -- Sac plein : l'entrée RETOURNE au cadavre (elle n'a pas été
                -- confirmée par un retrait) — aucune perte.
                pleins[#pleins + 1] = (p.def.label or p.def.id)
            end
        end
        options.ecrire(player, grille)
        options.envoyer_inventaire(player)
        if (#recus > 0) then
            Chat.SendMessage(player, "<cyan>Auto-loot : " .. SansBalise(table.concat(recus, ", ")) .. "</>")
        end
        if (#pleins > 0) then
            Chat.SendMessage(player, "<grey>Sac plein : reste sur le cadavre (" ..
                SansBalise(table.concat(pleins, ", ")) .. ").</>")
        end
        if (Fouille.EstVide(etat)) then return end
    end

    -- Le reste (ou tout, sans auto-loot) attend sur le cadavre.
    cadavres[entite] = { etat = etat }
    local n = 0
    for _ in ipairs(etat.entrees) do n = n + 1 end
    local touche = Narvos.Commandes and Narvos.Commandes.Trouver("fouiller") and Narvos.Commandes.Trouver("fouiller").defaut or "F1"
    Chat.SendMessage(player, ("<yellow>%d objet(s) sur le cadavre — fouiller (%s).</>"):format(n, touche))
end

-- ── Interactions du joueur ─────────────────────────────────────────────────────

--- La vue envoyée à l'écran : entrées, quantités, poids.
---@param etat table
---@return table
local function Vue(etat)
    local objets = {}
    for _, e in ipairs(etat.entrees) do
        objets[#objets + 1] = {
            uid = e.uid,
            id = e.def.id,
            label = e.def.label or e.def.id,
            rarete = e.def.rarity or "normal",
            quantite = e.quantite,
            poids = (tonumber(e.def.weight) or 0) * e.quantite,
        }
    end
    return { objets = objets, poids = Fouille.Poids(etat) }
end

Events.SubscribeRemote("Narvos:Fouiller", function(player)
    if (not options.grille) then return end
    local perso = player:GetControlledCharacter()
    if (not perso) then return end

    -- Le cadavre le plus proche, sous la portée.
    local meilleur, meilleure_distance = nil, math.huge
    for entite in pairs(cadavres) do
        local d = DistanceCarree(perso, entite)
        if (d < meilleure_distance) then
            meilleur, meilleure_distance = entite, d
        end
    end

    if (not meilleur or meilleure_distance > FouilleServeur.PORTEE_CM ^ 2) then
        Events.CallRemote("Narvos:FouilleErreur", player, Reliability.Reliable, "Aucun cadavre à portée")
        return
    end

    local etat = EtatDe(meilleur)
    if (not etat) then
        Events.CallRemote("Narvos:FouilleErreur", player, Reliability.Reliable, "Le cadavre a disparu")
        return
    end

    Events.CallRemote("Narvos:Fouille", player, Reliability.Reliable, Vue(etat))
end)

--- Verse UNE entrée choisie dans le sac. Rend true si au moins un objet est parti.
---@param player table
---@param etat table
---@param uid any
---@param quantite number|nil
---@return boolean
local function Verser(player, etat, uid, quantite)
    local def, quantite_reelle, raison = Fouille.Prendre(etat, uid, quantite)
    if (not def) then
        Events.CallRemote("Narvos:FouilleErreur", player, Reliability.Reliable, raison or "Objet introuvable")
        return false
    end

    local grille = options.grille(player)
    local suivante = Narvos.Inventory.AddItemToGrid(grille, def, quantite_reelle)
    if (suivante) then
        options.ecrire(player, suivante)
        options.envoyer_inventaire(player)
        return true
    end

    -- ⚠ Sac plein : l'entrée RETOURNE au cadavre. Le retrait avait eu lieu ;
    -- on la repose exactement comme elle était — rien n'est perdu.
    etat.entrees[#etat.entrees + 1] = { uid = uid, def = def, quantite = quantite_reelle }
    Chat.SendMessage(player, "<grey>Sac plein : l'objet reste sur le cadavre.</>")
    return false
end

Events.SubscribeRemote("Narvos:FouillePrendre", function(player, uid, quantite)
    local perso = player:GetControlledCharacter()
    if (not perso) then return end

    for entite, f in pairs(cadavres) do
        local etat = EtatDe(entite)
        if (etat and DistanceCarree(perso, entite) <= FouilleServeur.PORTEE_CM ^ 2) then
            if (Fouille.Entree(etat, uid)) then
                Verser(player, etat, uid, quantite)
                if (Fouille.EstVide(etat)) then cadavres[entite] = nil end
                Events.CallRemote("Narvos:Fouille", player, Reliability.Reliable, Vue(etat))
                return
            end
        end
    end

    Events.CallRemote("Narvos:FouilleErreur", player, Reliability.Reliable, "Objet introuvable sur le cadavre")
end)

Events.SubscribeRemote("Narvos:FouilleToutPrendre", function(player)
    local perso = player:GetControlledCharacter()
    if (not perso) then return end

    for entite, f in pairs(cadavres) do
        local etat = EtatDe(entite)
        if (etat and DistanceCarree(perso, entite) <= FouilleServeur.PORTEE_CM ^ 2) then
            local tout = Fouille.ToutPrendre(etat)
            local recus, pleins = {}, {}
            local grille = options.grille(player)
            for _, p in ipairs(tout) do
                local suivante = Narvos.Inventory.AddItemToGrid(grille, p.def, p.quantite)
                if (suivante) then
                    grille = suivante
                    recus[#recus + 1] = (p.def.label or p.def.id)
                else
                    pleins[#pleins + 1] = { uid = nil, def = p.def, quantite = p.quantite }
                end
            end
            -- Les pleins retournent au cadavre, avec un NOUVEL uid (l'ordre du
            -- cadavre a changé) — l'écran reçoit la vue et s'aligne.
            for _, p in ipairs(pleins) do
                etat.entrees[#etat.entrees + 1] = {
                    uid = etat.uid_suivant, def = p.def, quantite = p.quantite,
                }
                etat.uid_suivant = etat.uid_suivant + 1
            end
            options.ecrire(player, grille)
            options.envoyer_inventaire(player)
            if (#recus > 0) then
                Chat.SendMessage(player, "<cyan>Récupéré : " .. SansBalise(table.concat(recus, ", ")) .. "</>")
            end
            if (#pleins > 0) then
                Chat.SendMessage(player, "<grey>Sac plein : certains objets restent sur le cadavre.</>")
            end
            if (Fouille.EstVide(etat)) then cadavres[entite] = nil end
            Events.CallRemote("Narvos:Fouille", player, Reliability.Reliable, Vue(etat))
            return
        end
    end

    Events.CallRemote("Narvos:FouilleErreur", player, Reliability.Reliable, "Aucun cadavre à portée")
end)

return FouilleServeur