-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Digicode.lua — l'EXÉCUTANT de la porte à code.
--
-- Câblage : Narvos.DigicodeServeur = Package.Require("Server/Digicode.lua")
--           puis .Configurer{ base, grille, ecrire, compte_de, peut_editer_ici,
--           joueur_de, est_admin } et .Charger() depuis Server/Index.lua, qui
--           route aussi la commande de chat `/digicode`.
--
-- La DÉCISION vit dans `narvos/Shared/Logic/Digicode.lua` (39 assertions) : format
-- du code, empreinte salée, essais, blocage, passe-droit. Ce fichier relève les
-- faits (où est le joueur, a-t-il le droit d'éditer ICI, porte-t-il l'objet),
-- persiste les portes, pose les meshes et fait bouger le battant.
--
-- ── LE LIEN AVEC LES ZONES ────────────────────────────────────────────────────
-- `peut_editer_ici` est la MÊME garde que la pose de props (Server/Index.lua,
-- `PeutEditerIci` → `Zones.PeutEditer`). Poser, changer le code, retirer, et
-- passer sans code : réservé à qui édite à cet endroit. Relue à CHAQUE geste —
-- une zone qui change de propriétaire change qui passe, sans migration.
--
-- ── LE CODE NE PASSE JAMAIS PAR LE CHAT ───────────────────────────────────────
-- `/digicode poser` n'accepte pas de code en argument : le chat peut finir dans
-- un journal. Le code se tape dans le clavier WebUI et part par un événement
-- distant (`Narvos:Digicode:Valider`), jamais gardé en clair.
--
-- ── L'API, LUE ET NON DEVINÉE ─────────────────────────────────────────────────
-- `StaticMesh(location, rotation, asset, collision)`, `Trigger(location, rotation,
-- extent, TriggerType, visible, color, overlap_only_classes)` + BeginOverlap /
-- EndOverlap [authority] ; `Actor:TranslateTo(location, time, exp)`
-- [network-authority], `SetCollision(CollisionType)` [authority] ;
-- `Timer.SetTimeout(fn, ms)` ; `Database:Select/Execute(requête, :0, :1…)` —
-- relevés dans `libraries/api-main/api-main`.
--
-- ── ⚠ CE QUI N'EST PAS PROUVÉ ─────────────────────────────────────────────────
--   · LEVEE_CM : le battant MONTE de 230 cm pour ouvrir. La hauteur réelle de
--     SM_2m_door_leaf n'a jamais été mesurée (GetBounds est d'autorité CLIENT) ;
--     le passage est garanti par la collision coupée, pas par la hauteur ;
--   · le pivot des deux meshes (supposé au sol, centré) et l'orientation du
--     battant dans son cadre ;
--   · SOL_CM : la position d'un Character est le centre de sa capsule, supposé
--     à 90 cm au-dessus des pieds ;
--   · le clavier (GLB `keypad_door_lock`) n'est pas encore cuit : sans lui la
--     porte fonctionne, sans son boîtier visible.
-- RIEN n'a tourné en jeu.
-- ═══════════════════════════════════════════════════════════════════════════════

local DigicodeServeur = {}

-- ── État et injections — DÉCLARÉS EN TÊTE ─────────────────────────────────────
local portes = {}         -- [id] = { id, x, y, z, yaw, compte_id, objet_consomme, serrure, entites, ouverte, ouverte_jusqu_a }
local proche = {}         -- [player] = id de la porte dont il est dans le cercle
local essais = {}         -- ["compte:porte"] = état d'essais (survit à la reconnexion)
local attente_pose = {}   -- [player] = { x, y, z, yaw, expire }
local deps = {}

DigicodeServeur.RAYON_CM = 180.0
DigicodeServeur.DISTANCE_POSE_CM = 150.0
DigicodeServeur.SOL_CM = 90.0
DigicodeServeur.LEVEE_CM = 230.0
DigicodeServeur.DUREE_MOUVEMENT_S = 0.6
DigicodeServeur.ATTENTE_POSE_S = 90
--- Tolérance de proximité au moment du geste : le cercle du déclencheur, plus la
--- marge d'un pas (le serveur revérifie, le client peut avoir un temps de retard).
DigicodeServeur.PORTEE_GESTE_CM = 300.0
--- Longueur maximale reçue du client avant toute analyse : un code fait 8 chiffres.
local LONGUEUR_RECUE_MAX = 32

--- Branche l'exécutant.
---@param options table { base, grille, ecrire, compte_de, peut_editer_ici, joueur_de, est_admin }
function DigicodeServeur.Configurer(options)
    if (type(options) ~= "table") then return end
    for _, cle in ipairs({ "grille", "ecrire", "compte_de", "peut_editer_ici", "joueur_de", "est_admin" }) do
        if (type(options[cle]) == "function") then deps[cle] = options[cle] end
    end
    if (options.base ~= nil) then deps.base = options.base end
end

-- ── Faits ─────────────────────────────────────────────────────────────────────

local function Hacher(texte) return Narvos.Crypto.Sha256Hex(texte) end
local function Egal(a, b) return Narvos.Crypto.EgalConstant(a, b) end

local function Dire(player, texte, ton)
    local couleur = (ton == "ok") and "cyan" or "grey"
    pcall(function() Chat.SendMessage(player, ("<%s>%s</>"):format(couleur, texte)) end)
end

local function Menotte(player)
    return Narvos.MenottesServeur ~= nil and Narvos.MenottesServeur.Refuse(player, "interaction")
end

local function PeutEditer(player, porte)
    if (not deps.peut_editer_ici) then return false end
    local ok = deps.peut_editer_ici(player, porte.x, porte.y, porte.z)
    return ok == true
end

--- Le joueur est-il assez près de cette porte pour agir ? Le cercle d'abord
--- (annoncé par le déclencheur), la distance ensuite : un client ne choisit pas
--- la porte qu'il ouvre à distance.
local function APortee(player, porte)
    if (proche[player] ~= porte.id) then return false end
    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return false end
    local p = character:GetLocation()
    local dx, dy, dz = p.X - porte.x, p.Y - porte.y, p.Z - (porte.z + DigicodeServeur.SOL_CM)
    return math.sqrt(dx * dx + dy * dy + dz * dz) <= DigicodeServeur.PORTEE_GESTE_CM
end

--- Le clavier du client. Les bornes du code voyagent AVEC la demande : la page
--- ne recopie jamais LONGUEUR_MIN / LONGUEUR_MAX.
local function Clavier(player, etat)
    etat.longueur_min = Narvos.Digicode.LONGUEUR_MIN
    etat.longueur_max = Narvos.Digicode.LONGUEUR_MAX
    Events.CallRemote("Narvos:Digicode:Clavier", player, Reliability.Reliable, etat)
end

local function Resultat(player, ok, message)
    Events.CallRemote("Narvos:Digicode:Resultat", player, Reliability.Reliable, ok == true, tostring(message or ""))
end

-- ── Le battant ────────────────────────────────────────────────────────────────

local function Fermer(porte)
    local battant = porte.entites and porte.entites.battant
    porte.ouverte = false
    if (not battant or not battant:IsValid()) then return end
    pcall(function()
        battant:TranslateTo(Vector(porte.x, porte.y, porte.z), DigicodeServeur.DUREE_MOUVEMENT_S, 0)
    end)
    pcall(function() battant:SetCollision(CollisionType.Normal) end)
end

local function SurveillerFermeture(id)
    local porte = portes[id]
    if (not porte or not porte.ouverte) then return end
    local maintenant = os.time()
    if (Narvos.Digicode.EstOuverte(porte.ouverte_jusqu_a, maintenant)) then
        -- Rouverte entre-temps : on attend la NOUVELLE échéance.
        local reste_ms = math.max(250, math.floor((porte.ouverte_jusqu_a - maintenant) * 1000))
        Timer.SetTimeout(function() SurveillerFermeture(id) end, reste_ms)
        return
    end
    Fermer(porte)
end

--- Ouvre (ou prolonge l'ouverture de) la porte.
local function Ouvrir(porte)
    porte.ouverte_jusqu_a = Narvos.Digicode.OuvertureJusqua(os.time())
    if (porte.ouverte) then return end
    porte.ouverte = true
    local battant = porte.entites and porte.entites.battant
    if (battant and battant:IsValid()) then
        pcall(function() battant:SetCollision(CollisionType.NoCollision) end)
        pcall(function()
            battant:TranslateTo(Vector(porte.x, porte.y, porte.z + DigicodeServeur.LEVEE_CM),
                DigicodeServeur.DUREE_MOUVEMENT_S, 0)
        end)
    end
    local id = porte.id
    Timer.SetTimeout(function() SurveillerFermeture(id) end, Narvos.Digicode.OUVERTURE_S * 1000)
end

-- ── Poser et retirer les entités ──────────────────────────────────────────────

local function Annoncer(player, porte)
    Events.CallRemote("Narvos:Digicode:Proche", player, Reliability.Reliable, {
        id = porte.id,
        passe_droit = Narvos.Digicode.PasseDroit(PeutEditer(player, porte)),
    })
end

local function Spawner(asset, location, rotation, collision)
    if (type(asset) ~= "string" or asset == "") then return nil end
    local ok, entite = pcall(function() return StaticMesh(location, rotation, asset, collision) end)
    if (ok) then return entite end
    Console.Warn("[DIGICODE] mesh refuse " .. asset .. " : " .. tostring(entite))
    return nil
end

local function PoserEntites(porte)
    local rotation = Rotator(0, porte.yaw, 0)
    local base = Vector(porte.x, porte.y, porte.z)
    local pieces = Narvos.ObjetsDivers and Narvos.ObjetsDivers.PORTE or {}
    local e = {}
    e.cadre = Spawner(pieces.cadre, base, rotation, CollisionType.Normal)
    e.battant = Spawner(pieces.battant, base, rotation, CollisionType.Normal)
    -- Le clavier, à hauteur de main, à côté du cadre, le long de la LARGEUR de la
    -- porte (axe X local, voir `PreparerPose`) : 100 cm de demi-largeur + 30.
    local largeur = rotation:GetForwardVector()
    e.clavier = Spawner(Narvos.ObjetsDivers and Narvos.ObjetsDivers.Mesh(Narvos.Digicode.OBJET),
        Vector(base.X + largeur.X * 130.0, base.Y + largeur.Y * 130.0, base.Z + 120.0),
        rotation, CollisionType.NoCollision)

    local centre = Vector(base.X, base.Y, base.Z + DigicodeServeur.SOL_CM)
    e.trigger = Trigger(centre, Rotator(), Vector(DigicodeServeur.RAYON_CM), TriggerType.Sphere,
        false, nil, { "Character" })
    local id = porte.id
    e.trigger:Subscribe("BeginOverlap", function(_, acteur)
        local player = deps.joueur_de and deps.joueur_de(acteur)
        if (not player or not portes[id]) then return end
        proche[player] = id
        Annoncer(player, portes[id])
    end)
    e.trigger:Subscribe("EndOverlap", function(_, acteur)
        local player = deps.joueur_de and deps.joueur_de(acteur)
        if (not player or proche[player] ~= id) then return end
        proche[player] = nil
        Events.CallRemote("Narvos:Digicode:Proche", player, Reliability.Reliable, false)
    end)
    porte.entites = e
end

local function RetirerEntites(porte)
    for _, entite in pairs(porte.entites or {}) do
        if (entite and entite:IsValid()) then entite:Destroy() end
    end
    porte.entites = nil
    for player, id in pairs(proche) do
        if (id == porte.id) then
            proche[player] = nil
            Events.CallRemote("Narvos:Digicode:Proche", player, Reliability.Reliable, false)
        end
    end
end

-- ── Persistance ───────────────────────────────────────────────────────────────

--- Relit toutes les portes de la base et les pose. Rend le nombre posé.
---@return integer
function DigicodeServeur.Charger()
    if (not deps.base) then
        Console.Warn("[DIGICODE] aucune base : les portes a code ne sont pas chargees")
        return 0
    end
    local lignes = deps.base:Select(
        "SELECT id, x, y, z, yaw, sel, empreinte, compte_id, objet_consomme FROM digicodes") or {}
    local n = 0
    for _, l in ipairs(lignes) do
        local porte = {
            id = tostring(l.id), x = tonumber(l.x) or 0, y = tonumber(l.y) or 0,
            z = tonumber(l.z) or 0, yaw = tonumber(l.yaw) or 0,
            compte_id = tonumber(l.compte_id),
            -- SQLite rend 0/1 : comparer au nombre, `0` est VRAI en Lua.
            objet_consomme = (tonumber(l.objet_consomme) or 1) == 1,
            serrure = { id = tostring(l.id), sel = tostring(l.sel), empreinte = tostring(l.empreinte) },
            ouverte = false, ouverte_jusqu_a = 0,
        }
        portes[porte.id] = porte
        PoserEntites(porte)
        n = n + 1
    end
    Console.Log(("[DIGICODE] %d porte(s) a code posee(s)"):format(n))
    return n
end

-- ── Les gestes ────────────────────────────────────────────────────────────────

local function PorteObjet(player)
    local grille = deps.grille and deps.grille(player)
    return grille ~= nil and Narvos.Inventory.CountItem(grille, Narvos.Digicode.OBJET) > 0
end

--- Prépare une pose devant le joueur ; le code viendra du clavier.
local function PreparerPose(player, character)
    local est_admin = deps.est_admin and deps.est_admin(player)
    if (not PorteObjet(player) and not est_admin) then
        return Dire(player, "il faut un digicode dans le sac")
    end
    -- Le REGARD (rotation de contrôle), pas le corps : on pose là où l'on vise.
    local loc, rot = character:GetLocation(), character:GetControlRotation()
    local avant = Rotator(0, rot.Yaw, 0):GetForwardVector()
    local x = loc.X + avant.X * DigicodeServeur.DISTANCE_POSE_CM
    local y = loc.Y + avant.Y * DigicodeServeur.DISTANCE_POSE_CM
    local z = loc.Z - DigicodeServeur.SOL_CM
    local ok, raison = deps.peut_editer_ici(player, x, y, z)
    if (not ok) then return Dire(player, "pose refusee : " .. tostring(raison)) end

    -- ⚠ +90° SUPPOSE la largeur du battant le long de son X local (convention la
    -- plus courante des packs Unreal) : la porte se met alors EN TRAVERS du
    -- regard. Jamais vu en jeu — si elle se pose de profil, c'est ce +90.
    attente_pose[player] = { x = x, y = y, z = z, yaw = rot.Yaw + 90.0,
        expire = os.time() + DigicodeServeur.ATTENTE_POSE_S }
    Clavier(player, { mode = "poser", id = "", titre = "Nouveau code",
        aide = "la porte se posera devant vous" })
end

--- La grille APRÈS consommation d'un digicode — calculée, pas écrite. Rend
--- (grille | nil, dispense) : `dispense` = administrateur sans objet dans le sac.
local function GrilleSansObjet(player)
    local grille = deps.grille and deps.grille(player)
    if (not grille or Narvos.Inventory.CountItem(grille, Narvos.Digicode.OBJET) <= 0) then
        return nil, deps.est_admin ~= nil and deps.est_admin(player) == true
    end
    return Narvos.Craft.Consommer(grille, {
        entrees = { { item_id = Narvos.Digicode.OBJET, quantite = 1 } },
    }), false
end

local function ConfirmerPose(player, code)
    local attente = attente_pose[player]
    attente_pose[player] = nil
    if (not attente or os.time() > attente.expire) then
        return Resultat(player, false, "pose expiree — relancer /digicode poser")
    end
    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return Resultat(player, false, "aucun personnage") end
    local p = character:GetLocation()
    if (math.abs(p.X - attente.x) + math.abs(p.Y - attente.y) > DigicodeServeur.PORTEE_GESTE_CM * 2) then
        return Resultat(player, false, "vous vous etes eloigne de l'emplacement")
    end
    local droit, raison_zone = deps.peut_editer_ici(player, attente.x, attente.y, attente.z)
    if (not droit) then return Resultat(player, false, "pose refusee : " .. tostring(raison_zone)) end
    local compte_id = deps.compte_de and deps.compte_de(player)
    if (not compte_id) then return Resultat(player, false, "session inconnue") end

    local id = "dc_" .. Narvos.Comptes.NouveauSel():sub(1, 16)
    local serrure, raison = Narvos.Digicode.NouvelleSerrure(id, code, Narvos.Comptes.NouveauSel(), Hacher)
    if (not serrure) then return Resultat(player, false, raison) end
    local grille_apres, dispense = GrilleSansObjet(player)
    if (not grille_apres and not dispense) then return Resultat(player, false, "il faut un digicode dans le sac") end

    -- ⚠ LA BASE D'ABORD, LE SAC ENSUITE : une écriture refusée ne doit pas avoir
    -- mangé l'objet. L'inverse perdait le digicode sur une erreur SQL.
    local ecrit = pcall(function()
        deps.base:Execute("INSERT INTO digicodes (id, x, y, z, yaw, sel, empreinte, compte_id, pose_le, objet_consomme)"
            .. " VALUES (:0, :1, :2, :3, :4, :5, :6, :7, :8, :9)",
            id, attente.x, attente.y, attente.z, attente.yaw, serrure.sel, serrure.empreinte, compte_id,
            os.time(), grille_apres and 1 or 0)
    end)
    if (not ecrit) then return Resultat(player, false, "enregistrement impossible — rien n'a ete consomme") end
    if (grille_apres) then deps.ecrire(player, grille_apres) end
    local porte = { id = id, x = attente.x, y = attente.y, z = attente.z, yaw = attente.yaw,
        compte_id = compte_id, objet_consomme = grille_apres ~= nil,
        serrure = serrure, ouverte = false, ouverte_jusqu_a = 0 }
    portes[id] = porte
    PoserEntites(porte)
    Resultat(player, true, "porte a code posee")
end

local function ChangerCode(player, porte, code)
    if (not PeutEditer(player, porte)) then return Resultat(player, false, "seul qui construit ici change le code") end
    local serrure, raison = Narvos.Digicode.NouvelleSerrure(porte.id, code, Narvos.Comptes.NouveauSel(), Hacher)
    if (not serrure) then return Resultat(player, false, raison) end
    deps.base:Execute("UPDATE digicodes SET sel = :0, empreinte = :1 WHERE id = :2",
        serrure.sel, serrure.empreinte, porte.id)
    porte.serrure = serrure
    -- Un nouveau code efface les essais de tous : un blocage sur l'ancien n'a plus de sens.
    local suffixe = ":" .. porte.id
    for cle in pairs(essais) do
        if (cle:sub(-#suffixe) == suffixe) then essais[cle] = nil end
    end
    Resultat(player, true, "code change")
end

local function EssayerCode(player, porte, code)
    local compte_id = deps.compte_de and deps.compte_de(player)
    if (not compte_id) then return Resultat(player, false, "session inconnue") end
    local cle = tostring(compte_id) .. ":" .. porte.id
    local ok, raison, etat = Narvos.Digicode.Essayer(essais[cle], porte.serrure, code, os.time(), Hacher, Egal)
    essais[cle] = etat
    if (not ok) then return Resultat(player, false, raison) end
    Ouvrir(porte)
    Resultat(player, true, "code accepte — porte ouverte")
end

-- ── Entrées réseau ────────────────────────────────────────────────────────────

--- La touche d'interaction devant une porte : passe-droit, ou clavier.
Events.SubscribeRemote("Narvos:Digicode:Interagir", function(player, id)
    if (Menotte(player)) then return end
    local porte = portes[tostring(id)]
    if (not porte or not APortee(player, porte)) then return end
    if (Narvos.Digicode.PasseDroit(PeutEditer(player, porte))) then
        Ouvrir(porte)
        return Dire(player, "porte ouverte (vous construisez ici)", "ok")
    end
    Clavier(player, { mode = "essayer", id = porte.id, titre = "Porte à code",
        aide = "tapez le code puis validez" })
end)

--- Le code tapé au clavier. `mode` = essayer | poser | changer.
Events.SubscribeRemote("Narvos:Digicode:Valider", function(player, mode, id, code)
    if (Menotte(player)) then return end
    if (type(code) ~= "string" or #code > LONGUEUR_RECUE_MAX) then
        return Resultat(player, false, "code illisible")
    end
    if (mode == "poser") then return ConfirmerPose(player, code) end
    local porte = portes[tostring(id)]
    if (not porte or not APortee(player, porte)) then
        return Resultat(player, false, "approchez-vous de la porte")
    end
    if (mode == "changer") then return ChangerCode(player, porte, code) end
    if (mode == "essayer") then return EssayerCode(player, porte, code) end
    Resultat(player, false, "geste inconnu")
end)

-- ── La commande de chat ───────────────────────────────────────────────────────

local AIDE = {
    "<cyan>/digicode poser</> — pose une porte a code devant vous (zone ou vous construisez)",
    "<cyan>/digicode code</> — change le code de la porte devant vous",
    "<cyan>/digicode retirer</> — retire la porte devant vous et rend le digicode",
}

local function RetirerPorte(player, porte)
    if (not PeutEditer(player, porte)) then return Dire(player, "seul qui construit ici retire la porte") end
    -- Une porte posée SANS objet (dispense d'administrateur) ne rend rien.
    local rendue = nil
    if (porte.objet_consomme) then
        local grille = deps.grille and deps.grille(player)
        local def = Narvos.Inventory.GetItemDef(Narvos.Digicode.OBJET)
        rendue = grille and def and Narvos.Inventory.AddItemToGrid(grille, def, 1)
        if (not rendue) then return Dire(player, "sac plein : faites de la place pour recuperer le digicode") end
    end
    if (not pcall(function() deps.base:Execute("DELETE FROM digicodes WHERE id = :0", porte.id) end)) then
        return Dire(player, "suppression impossible en base — la porte reste")
    end
    RetirerEntites(porte)
    portes[porte.id] = nil
    if (rendue) then deps.ecrire(player, rendue) end
    Dire(player, rendue and "porte retiree — le digicode est dans le sac" or "porte retiree", "ok")
end

--- `/digicode [poser|code|retirer]`.
---@param player table
---@param character table
---@param argument string
function DigicodeServeur.Commande(player, character, argument)
    if (Menotte(player)) then return end
    if (not deps.base or not deps.peut_editer_ici) then
        return Dire(player, "portes a code indisponibles (base ou zones non branchees)")
    end
    local verbe = tostring(argument or ""):lower():match("^%s*(%S*)")
    if (verbe == "poser") then return PreparerPose(player, character) end
    if (verbe == "code" or verbe == "retirer") then
        local porte = portes[proche[player] or ""]
        if (not porte or not APortee(player, porte)) then
            return Dire(player, "aucune porte a code a portee")
        end
        if (verbe == "retirer") then return RetirerPorte(player, porte) end
        if (not PeutEditer(player, porte)) then return Dire(player, "seul qui construit ici change le code") end
        return Clavier(player, { mode = "changer", id = porte.id, titre = "Changer le code",
            aide = "le nouveau code remplace l'ancien pour tous" })
    end
    for _, ligne in ipairs(AIDE) do pcall(function() Chat.SendMessage(player, ligne) end) end
end

-- L'état de proximité est de SESSION ; les essais, eux, sont par COMPTE et
-- survivent à la déconnexion — sinon se reconnecter remettrait le blocage à zéro.
Player.Subscribe("Destroy", function(player)
    proche[player] = nil
    attente_pose[player] = nil
end)

return DigicodeServeur