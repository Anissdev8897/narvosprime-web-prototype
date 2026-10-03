-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Assemblage.lua — l'exécutant serveur de l'établi d'assemblage.
--
-- Le MODÈLE est `Narvos.Assemblage` (Shared/Logic/Assemblage.lua, 201 assertions,
-- chantier A) : il décide TOUT — ce qu'un slot accepte, ce qui manque, comment
-- l'abandon restitue. Ce fichier ne fait que RELIER : proximité, session,
-- grille réelle, sauvegarde, et le pont vers la WebUI.
--
-- ── LE SERVEUR RE-DÉCIDE TOUT ─────────────────────────────────────────────────
-- La page n'envoie que des CHAÎNES (plan_id, slot_id, uid, item_id). Chaque
-- geste est revalidé ici : le joueur est-il en jeu, a-t-il un personnage, est-il
-- à portée de l'établi, l'uid est-il dans SA grille ? La pose elle-même est
-- re-décidée par le modèle (filtre du slot, pile réelle, quantités) — un client
-- modifié ne peut rien forcer, seulement demander.
--
-- ── LE CATALOGUE DES PLANS EST LU À L'EXÉCUTION ───────────────────────────────
-- Les plans sont générés par un chantier parallèle (Shared/Catalogs/Plans.lua,
-- câblé en `Narvos.Plans`). AUCUNE liste de plans n'est écrite ici : le
-- catalogue est lu via `deps.catalogue_plans()` à CHAQUE envoi — un catalogue
-- régénéré est pris en compte sans recharger ce module. S'il est absent, l'établi
-- le dit honnêtement (« aucun plan disponible ») au lieu de dessiner des plans
-- bouchonnés.
--
-- ── INJECTION DE DÉPENDANCES (harnais) ────────────────────────────────────────
-- Session, inventaires, sauvegarde, catalogue : tout arrive par `Brancher`,
-- comme `PropsServeur.UtiliserGarde`. Le harnais
-- (scripts/lua-harness/assemblage-ui.mjs) peut ainsi charger CE fichier réel
-- avec des dépendances factices et prouver la chaîne handler → Assemblage →
-- réponse, sans nanos.
-- ═══════════════════════════════════════════════════════════════════════════════

local AssemblageServeur = {}

-- ── État ──────────────────────────────────────────────────────────────────────
-- Tables indexées par joueur EN TÊTE (règle §3 de la mission) : jamais un
-- `local` déclaré après son lecteur.

--- true tant que le joueur se tient dans la zone de l'établi (posé au
--- BeginOverlap, retiré au EndOverlap et à la déconnexion). C'est la garde de
--- proximité : sans elle, un client modifié poserait des pièces depuis
--- n'importe où — leçon de `atelier_du_joueur` pour le craft.
local etabli_du_joueur = {}

--- Dépendances injectées par Server/Index.lua (ou par le harnais).
---   session            : le module Server/Session.lua (De, EnJeu)
---   inventaires        : la table player -> grille (référence partagée)
---   enregistrer_sac    : function(player) — persistance du sac
---   envoyer_inventaire : function(player) — pousse Narvos:Inventaire + la roue
---   catalogue_plans    : function() -> table|nil — Narvos.Plans, lu à l'appel
---   joueur_de          : function(acteur) -> player|nil (pour le Trigger)
local deps = {
    session = nil,
    inventaires = nil,
    enregistrer_sac = function(_) end,
    envoyer_inventaire = function(_) end,
    catalogue_plans = function() return nil end,
    joueur_de = function(_) return nil end,
}

-- ── Utilitaires ───────────────────────────────────────────────────────────────

--- Refus nommé : le bandeau du panneau d'assemblage, pas le chat — le joueur
--- a l'établi sous les yeux quand il agit.
---@param player table
---@param raison any
local function Erreur(player, raison)
    Events.CallRemote("Narvos:AssemblageErreur", player, Reliability.Reliable,
        tostring(raison or "Assemblage impossible"))
end

--- Les champs d'affichage d'un objet du catalogue. Le client ne lit jamais le
--- catalogue lui-même : nom, rareté et icône voyagent avec l'état.
---@param item_id any
---@return table
local function Enrichi(item_id)
    local def = Narvos.Inventory.GetItemDef(item_id)
    return {
        item_id  = item_id,
        nom      = (def and def.label) or tostring(item_id),
        rarete   = (def and def.rarity) or "common",
        icone    = (def and def.icon) or "?",
        iconFile = (def and def.iconFile) or nil,
    }
end

--- Le plan `plan_id` du catalogue, ou nil. Le catalogue arrive du chantier B :
--- on tolère une table indexée par id comme une liste, sans deviner sa forme
--- définitive — `ValiderPlan` reste le juge de la structure.
---@param plan_id any
---@return table|nil
local function TrouverPlan(plan_id)
    if (type(plan_id) ~= "string" or plan_id == "") then return nil end
    local catalogue = deps.catalogue_plans and deps.catalogue_plans() or nil
    if (type(catalogue) ~= "table") then return nil end
    local direct = catalogue[plan_id]
    if (type(direct) == "table" and direct.id == plan_id) then return direct end
    for _, plan in pairs(catalogue) do
        if (type(plan) == "table" and plan.id == plan_id) then return plan end
    end
    return nil
end

--- Le contexte d'un geste : personnage + grille, ou nil. Aucun geste n'existe
--- sans session en jeu — c'est la garde que chaque handler applique avant tout.
---@param player table
---@return table|nil perso
---@return table|nil grille
local function Contexte(player)
    if (not player) then return nil, nil end
    if (not deps.session or not deps.session.EnJeu(player)) then return nil, nil end
    local s = deps.session.De(player)
    local perso = s and s.perso or nil
    local grille = deps.inventaires and deps.inventaires[player] or nil
    if (not perso or not grille) then return nil, nil end
    return perso, grille
end

--- La garde de proximité, nommée : hors de la zone, tout geste est refusé.
---@param player table
---@return boolean
local function AEtabli(player)
    if (etabli_du_joueur[player] ~= true) then
        Erreur(player, "Approchez-vous de l'établi d'assemblage")
        return false
    end
    return true
end

-- ── L'état poussé vers la page ────────────────────────────────────────────────
--
-- Le serveur POUSSE l'état complet à chaque mutation ; la page ne calcule rien
-- (même discipline que l'inventaire). Un envoi porte :
--   etabli  : le joueur est-il dans la zone ?
--   plans   : le catalogue lu À L'EXÉCUTION (vide si le chantier B n'a pas
--             encore livré — la page l'affiche honnêtement)
--   session : la vue du modèle, enrichie (pièces posées, manquants nommés,
--             et pour chaque slot les uids du sac qu'il accepterait — le
--             filtrage de l'inventaire est donc AUSSI décidé par le serveur)
--   sac     : la grille aplatie AVEC les uids — la pose vise une pile, jamais
--             un item_id (consommation UID-correcte, en-tête de Craft.lua).

---@param player table
local function Envoyer(player)
    if (not player) then return end
    local s = deps.session and deps.session.De(player) or nil
    local perso = s and s.perso or nil
    local grille = deps.inventaires and deps.inventaires[player] or nil

    -- Le sac : une entrée PAR PILE (l'uid est l'identité de la pile).
    local sac = {}
    if (grille) then
        for _, inst in ipairs(grille.instances or {}) do
            local e = Enrichi(inst.itemId)
            e.uid = inst.uid
            e.quantite = inst.quantity or 1
            sac[#sac + 1] = e
        end
    end

    -- Les plans : le catalogue du chantier B, relu à chaque envoi. Un plan qui
    -- ne passe pas `Emplacements` (donc `ValiderPlan`) n'est PAS proposé :
    -- l'UI ne dessine jamais un plan que le modèle aurait refusé.
    local plans = {}
    local catalogue = deps.catalogue_plans and deps.catalogue_plans() or nil
    if (type(catalogue) == "table") then
        for _, plan in pairs(catalogue) do
            if (type(plan) == "table") then
                local emplacements = Narvos.Assemblage.Emplacements(plan)
                if (emplacements) then
                    local r = Enrichi(plan.resultat.item_id)
                    r.quantite = plan.resultat.quantite or 1
                    plans[#plans + 1] = {
                        id = plan.id,
                        label = plan.label or plan.id,
                        resultat = r,
                        emplacements = emplacements,
                    }
                end
            end
        end
        -- Ordre stable : la liste ne doit pas danser d'un envoi à l'autre.
        table.sort(plans, function(a, b) return tostring(a.label) < tostring(b.label) end)
    end

    -- La session en cours, s'il y en a une (Vue rend des COPIES).
    local session = nil
    if (perso) then
        local vue = Narvos.Assemblage.Vue(perso.id)
        if (vue) then
            local slots = {}
            for i, slot in ipairs(vue.slots) do
                local pieces = {}
                for j, p in ipairs(slot.pieces) do
                    local e = Enrichi(p.item_id)
                    e.quantite = p.quantite
                    pieces[j] = e
                end
                -- Ce que CE slot accepterait MAINTENANT, pile par pile : le
                -- modèle re-décide (filtre + occupation), la page se contente
                -- de griser le reste.
                local accepte = {}
                for _, piece in ipairs(sac) do
                    if (Narvos.Assemblage.Accepte(perso.id, slot.id, piece.item_id)) then
                        accepte[#accepte + 1] = piece.uid
                    end
                end
                slots[i] = {
                    id = slot.id,
                    label = slot.label,
                    obligatoire = slot.obligatoire,
                    quantite = slot.quantite,
                    pose = slot.pose,
                    pieces = pieces,
                    accepte = accepte,
                }
            end
            local r = Enrichi(vue.resultat.item_id)
            r.quantite = vue.resultat.quantite
            session = {
                plan_id = vue.plan_id,
                label = vue.label,
                resultat = r,
                slots = slots,
                manquants = Narvos.Assemblage.Manquants(perso.id),
                complet = Narvos.Assemblage.Complet(perso.id),
            }
        end
    end

    Events.CallRemote("Narvos:Assemblage", player, Reliability.Reliable, {
        etabli = etabli_du_joueur[player] == true,
        plans = plans,
        session = session,
        sac = sac,
    })
end

--- Après une mutation acceptée : la grille neuve remplace l'ancienne, le sac
--- est sauvegardé (un serveur qui tombe ne doit pas manger les pièces posées
--- depuis la dernière écriture), et les deux interfaces suivent.
---@param player table
---@param grille table
local function ApresMutation(player, grille)
    deps.inventaires[player] = grille
    deps.enregistrer_sac(player)
    deps.envoyer_inventaire(player)
    Envoyer(player)
end

-- ── Les gestes (handlers distants) ────────────────────────────────────────────
--
-- La page émet une INTENTION (des chaînes) ; ici on revalide tout, puis le
-- MODÈLE décide. Aucune quantité ne vient du client : une pose = une unité de
-- la pile nommée, pièce par pièce — c'est le geste du chantier, pas un clic
-- « fabriquer ».

-- La page réclame l'état (elle est prête, ou l'onglet vient d'ouvrir).
Events.SubscribeRemote("Narvos:DemanderAssemblage", function(player)
    if (not deps.session or not deps.session.EnJeu(player)) then return end
    Envoyer(player)
end)

-- Choisir un plan : ouvre la session, ou REPREND celle qui était persistée
-- (le joueur a déco entre deux pièces — ses pièces posées n'ont pas bougé).
Events.SubscribeRemote("Narvos:AssemblageOuvrir", function(player, plan_id)
    local perso, grille = Contexte(player)
    if (not perso) then return end
    if (not AEtabli(player)) then return end

    local plan = TrouverPlan(plan_id)
    if (not plan) then
        -- Message honnête : le catalogue du chantier B n'est peut-être pas
        -- encore livré, ou l'id ne vient pas de la page (client modifié).
        Erreur(player, "plan inconnu — le catalogue des plans n'est peut-être pas encore livré")
        return
    end

    -- Une session DÉJÀ ouverte (en mémoire) ? Le joueur ne « rouvre » pas :
    -- l'état courant suffit, on le repousse.
    if (Narvos.Assemblage.Vue(perso.id) ~= nil) then
        Envoyer(player)
        return
    end

    local ligne = Narvos.Assemblage.Charger(perso.id)
    if (ligne ~= nil) then
        if (ligne.plan_id ~= plan.id) then
            -- Écraser abandonnerait des pièces consommées dans le vide : on
            -- refuse en nommant le plan persisté.
            Erreur(player, "un assemblage « " .. tostring(ligne.plan_id)
                .. " » est en cours — ouvrez ce plan pour le reprendre")
            return
        end

        -- LA PLACE AVANT LA REPRISE : les pièces orphelines (plan retouché
        -- entre-temps) seront à restituer. On ne connaît leur liste qu'après
        -- `Reprendre`, alors on simule la restitution du PIRE CAS — toutes les
        -- pièces persistées : si le tout rentre, n'importe quel sous-ensemble
        -- rentre. Sans place, on refuse AVANT d'avoir touché quoi que ce soit.
        local essai = grille
        for _, p in ipairs(ligne.pieces) do
            local def = Narvos.Inventory.GetItemDef(p.item_id)
            if (def) then
                local suivante = Narvos.Inventory.AddItemToGrid(essai, def, p.quantite)
                if (not suivante) then
                    Erreur(player, "faites de la place dans le sac — des pièces posées"
                        .. " lors de la session précédente pourraient devoir être rendues")
                    return
                end
                essai = suivante
            end
        end

        local ok, a_rendre = Narvos.Assemblage.Reprendre(perso.id, plan)
        if (not ok) then
            Erreur(player, a_rendre)   -- c'est la raison, pas une liste
            return
        end

        -- Restitution des orphelines, NOMMÉES en cas de souci. La simulation
        -- ci-dessus garantit la place ; un échec ici serait une anomalie, on
        -- le dit fort plutôt que de laisser une pièce disparaître en silence.
        local rendues = {}
        for _, p in ipairs(a_rendre or {}) do
            local def = Narvos.Inventory.GetItemDef(p.item_id)
            if (def) then
                local suivante = Narvos.Inventory.AddItemToGrid(grille, def, p.quantite)
                if (suivante) then
                    grille = suivante
                    rendues[#rendues + 1] = tostring(def.label or p.item_id)
                        .. " ×" .. tostring(p.quantite)
                else
                    Console.Error("ASSEMBLAGE : restitution impossible de "
                        .. tostring(p.item_id) .. " ×" .. tostring(p.quantite)
                        .. " pour " .. tostring(perso.id) .. " malgré la simulation")
                    Erreur(player, "restitution impossible de « " .. tostring(p.item_id)
                        .. " » — signalez-le, la pièce est nommée dans les logs")
                end
            else
                -- La pièce n'existe plus dans le catalogue : impossible de la
                -- rendre. On le nomme, c'est tout ce qu'on peut faire d'honnête.
                Console.Error("ASSEMBLAGE : pièce orpheline hors catalogue : "
                    .. tostring(p.item_id) .. " ×" .. tostring(p.quantite))
                Erreur(player, "« " .. tostring(p.item_id)
                    .. " » n'existe plus dans le catalogue — restitution impossible")
            end
        end

        deps.inventaires[player] = grille
        deps.enregistrer_sac(player)
        deps.envoyer_inventaire(player)
        if (#rendues > 0) then
            Events.CallRemote("Narvos:AssemblageInfo", player, Reliability.Reliable,
                "Assemblage repris — pièces rendues : " .. table.concat(rendues, ", "))
        end
        Envoyer(player)
        return
    end

    local ok, raison = Narvos.Assemblage.Ouvrir(perso.id, plan)
    if (not ok) then
        Erreur(player, raison)
        return
    end
    Envoyer(player)
end)

-- Poser une pièce : un clic = une unité de la pile `uid` dans `slot_id`.
Events.SubscribeRemote("Narvos:AssemblagePoser", function(player, slot_id, uid)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    local perso, grille = Contexte(player)
    if (not perso) then return end
    if (not AEtabli(player)) then return end
    -- Le client n'envoie que des chaînes : tout autre type est un client
    -- modifié, on refuse sans toucher à rien.
    if (type(slot_id) ~= "string" or type(uid) ~= "string") then
        Erreur(player, "demande mal formée")
        return
    end

    -- Le modèle re-décide TOUT : la pile existe dans SA grille (uid), la pièce
    -- est acceptée par le slot (motif nommé sinon), les quantités suffisent.
    local nouvelle, raison = Narvos.Assemblage.Poser(perso.id, grille, slot_id, uid, 1)
    if (not nouvelle) then
        Erreur(player, raison)
        Envoyer(player)   -- l'état n'a pas changé, mais le filtrage peut avoir vieilli
        return
    end
    ApresMutation(player, nouvelle)
end)

-- Retirer une pièce posée : elle revient dans le sac (la place est simulée
-- d'abord par le modèle ; sans place, elle reste posée).
Events.SubscribeRemote("Narvos:AssemblageRetirer", function(player, slot_id, item_id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    local perso, grille = Contexte(player)
    if (not perso) then return end
    if (not AEtabli(player)) then return end
    if (type(slot_id) ~= "string" or type(item_id) ~= "string") then
        Erreur(player, "demande mal formée")
        return
    end

    local nouvelle, raison = Narvos.Assemblage.Retirer(perso.id, grille, slot_id, item_id, 1)
    if (not nouvelle) then
        Erreur(player, raison)
        Envoyer(player)
        return
    end
    ApresMutation(player, nouvelle)
end)

-- Abandonner : TOUTES les pièces posées reviennent, ou aucune (le modèle
-- refuse si le sac ne peut pas tout reprendre — la session reste ouverte).
Events.SubscribeRemote("Narvos:AssemblageAbandonner", function(player)
    local perso, grille = Contexte(player)
    if (not perso) then return end
    if (not AEtabli(player)) then return end

    local nouvelle, raison = Narvos.Assemblage.Abandonner(perso.id, grille)
    if (not nouvelle) then
        Erreur(player, raison)
        Envoyer(player)
        return
    end
    ApresMutation(player, nouvelle)
    Events.CallRemote("Narvos:AssemblageInfo", player, Reliability.Reliable,
        "Assemblage abandonné — les pièces sont revenues dans le sac")
end)

-- Finaliser : le modèle exige la complétude (manquants NOMMÉS sinon) et
-- simule la place du résultat avant de détruire quoi que ce soit. Le résultat
-- est un ITEM en grille — le spawn du véhicule est un exécutant ultérieur,
-- et la page le dit honnêtement.
Events.SubscribeRemote("Narvos:AssemblageFinaliser", function(player)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    local perso, grille = Contexte(player)
    if (not perso) then return end
    if (not AEtabli(player)) then return end

    local nouvelle, resultat = Narvos.Assemblage.Finaliser(perso.id, grille)
    if (not nouvelle) then
        Erreur(player, resultat)   -- c'est la raison (manquants nommés)
        Envoyer(player)
        return
    end
    ApresMutation(player, nouvelle)
    Events.CallRemote("Narvos:AssemblageFait", player, Reliability.Reliable,
        resultat.item_id, resultat.quantite)
end)

-- ── Proximité et cycle de vie ─────────────────────────────────────────────────

--- Le joueur entre dans la zone : la page s'ouvre (relais client) et l'état
--- part aussitôt — il sera tamponné côté client tant que la page n'est pas
--- prête, puis réclamé (`NarvosAssemblage:Pret`).
---@param player table
function AssemblageServeur.Entrer(player)
    if (not player) then return end
    etabli_du_joueur[player] = true
    Events.CallRemote("Narvos:AssemblageOuverture", player, Reliability.Reliable)
    Envoyer(player)
end

--- Le joueur sort de la zone : la page se ferme (relais client). La session,
--- elle, SURVIT — elle est persistée ; le joueur revient la finir ou l'abandonne
--- ici. Fermer l'interface ne doit jamais décider du sort des pièces.
---@param player table
function AssemblageServeur.Sortir(player)
    if (not player) then return end
    etabli_du_joueur[player] = nil
    Events.CallRemote("Narvos:AssemblageFermeture", player, Reliability.Reliable)
end

--- Déconnexion : purge de la table par joueur (une référence morte par
--- déconnexion, et la table grossit tant que le serveur tourne).
---@param player table
function AssemblageServeur.Oublier(player)
    etabli_du_joueur[player] = nil
end

--- Injecte les dépendances. Appelé par Server/Index.lua au chargement, et par
--- le harnais avec des factices — c'est ce qui rend CE fichier testable.
---@param d table
function AssemblageServeur.Brancher(d)
    if (type(d) ~= "table") then return end
    for cle, valeur in pairs(d) do
        deps[cle] = valeur
    end
end

--- Pose l'établi dans le monde : un prop repère + un déclencheur de proximité,
--- le même patron que les 4 stations de craft (`PoserAteliers`, Server/Index.lua).
--- Le mesh vient du catalogue généré `Catalogs/Ateliers.lua` : l établi réel si
--- sa clé est déclarée dans Assets.toml, le cube sinon. Une référence morte ne
--- lève RIEN dans nanos — le prop n apparaît pas, et personne n est prévenu.
---@param position table Vector monde
---@param rayon number  rayon du déclencheur, en unités monde
function AssemblageServeur.PoserEtabli(position, rayon)
    Prop(position, Rotator(), Narvos.Ateliers.MeshEtabli(), CollisionType.Normal, false)
    -- 7e argument = overlap_only_classes : seuls des personnages nous
    -- intéressent, la liste blanche épargne le moteur (leçon des pads).
    local trigger = Trigger(position, Rotator(), Vector(rayon), TriggerType.Sphere,
        false, nil, { "Character" })
    trigger:Subscribe("BeginOverlap", function(_, acteur)
        local player = deps.joueur_de(acteur)
        if (not player) then return end
        AssemblageServeur.Entrer(player)
    end)
    trigger:Subscribe("EndOverlap", function(_, acteur)
        local player = deps.joueur_de(acteur)
        if (not player) then return end
        AssemblageServeur.Sortir(player)
    end)
    -- Rendre le temoin, pas une promesse : l'appelant journalise ce qui EST,
    -- pas ce qu'il a demande. Un etabli absent du monde serait autrement
    -- invisible jusqu'au jour ou un joueur marche a l'endroit vide.
    return trigger:IsValid()
end

return AssemblageServeur