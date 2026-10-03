-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Voitures.lua — faire ROULER les 12 voitures City_Traffic_Pro cuites.
--
-- Câblage : Narvos.VoituresServeur = Package.Require("Server/Voitures.lua")
-- depuis Server/Index.lua, APRÈS Server/Session.lua (même discipline que les
-- autres exécutants : il faut un personnage contrôlé pour spawn).
--
-- ── LE PARTAGE ────────────────────────────────────────────────────────────────
--   · `Shared/Logic/Voitures.lua` (Narvos.Voitures) — DONNÉE et logique PURE :
--     catalogue, os mesurés, réglage provisoire, résolution des roues par
--     `OsVehicules.Resoudre` ;
--   · CE FICHIER — l'exécutant : la classe `VehicleWheeled` héritée (patron
--     `game-mod/default-vehicles-main/Shared/Index.lua`), le spawn, la purge.
--
-- ── ENTRÉE / SORTIE CONDUCTEUR ────────────────────────────────────────────────
-- L'API n'exige AUCUN handler : nanos place le personnage au volant quand il
-- interagit dans le rayon d'une porte (`SetDoor`, trigger_radius) — le game-mod
-- sandbox ne fait qu'ÉCOUTER l'événement `EnterVehicle` côté client pour son
-- HUD (sandbox-master/Client/Index.lua:66), il ne provoque rien. Ici, le spawn
-- pose en plus le conducteur au volant immédiatement — `Character:EnterVehicle(
-- vehicle, seat)`, autorité server (Character.json) — parce que la commande
-- `/vehicule` sert à ESSAYER la voiture, pas à la regarder.
--
-- ── ⚠ CE QUE CE FICHIER NE PEUT PAS PROUVER ───────────────────────────────────
-- Que `VehicleWheeled` accepte `Car_Skeleton` ne se tranche qu'en jeu (le
-- patron lance). Tout le reste — os, meshes, câblage, handler — est prouvé
-- par `scripts/lua-harness/vehicules.mjs`.
-- ═══════════════════════════════════════════════════════════════════════════════

local VoituresServeur = {}

local Voitures = Narvos.Voitures

-- ── État — table par joueur, EN TÊTE (jamais après un lecteur) ────────────────
--
-- Une voiture par joueur : la nouvelle détruit l'ancienne. Sans ça, chaque
-- `/vehicule` ajouterait une entité physiquement simulée — le coût du tick est
-- le NOMBRE d'entités (même constat que Peuplement).
local voitures = {}

Player.Subscribe("Destroy", function(player)
    local v = voitures[player]
    if (v and v:IsValid()) then v:Destroy() end
    voitures[player] = nil
end)

-- ── La classe — patron VehicleWheeled.Inherit du gabarit officiel ─────────────
--
-- Courbe de couple et rapports : gabarit Offroad (default-vehicles-main/
-- Shared/Index.lua:13-21), PROVISOIRE — rien de lisible dans les Blueprints
-- cuits du pack (voir l'en-tête de Shared/Logic/Voitures.lua).

---@class NarvosVoitureCTP : VehicleWheeled
---@overload fun(location: Vector, rotation: Rotator, modele_id: string): NarvosVoitureCTP
VoituresServeur.VoitureCTP = VehicleWheeled.Inherit("NarvosVoitureCTP", {
    name = "Voiture City Traffic Pro",
    category = "wheeled",

    -- provisoire : gabarit Offroad
    torque_curve = {
        [   0.0] = 0.5,
        [ 800.0] = 0.9,
        [2000.0] = 1.0,
        [4000.0] = 0.9,
        [5000.0] = 0.0,
    },
    forward_gears = { 4.25, 2.52, 1.66, 1.22, 1 },   -- provisoire
    reverse_gears = { 4.04 },                        -- provisoire
})

--- Constructeur. Le TROISIÈME paramètre du Super est le SkeletalMeshPath
--- (VehicleWheeled.json) : `modele.asset` = "narvos::SK_…", cuit et déclaré
--- dans [assets.skeletal_meshes] — vérifié par narvos-verifier-catalogues.mjs.
function VoituresServeur.VoitureCTP:Constructor(location, rotation, modele_id)
    local modele = Voitures.Modele(modele_id)
    if (not modele) then
        -- Le spawn valide AVANT : arriver ici est une erreur de programmation,
        -- pas un cas utilisateur. On le dit fort plutôt que de fabriquer une
        -- voiture sans mesh — le mode d'échec muet que tout ce chantier combat.
        error("NarvosVoitureCTP : modele inconnu '" .. tostring(modele_id) .. "'")
    end

    -- Sons moteur/klaxon cuits du pack (S_Car_Engine_*, S_Horn, [assets.sounds]).
    -- Frein/démarrage/portière : défauts du pack de base (nanos-world::A_*),
    -- comme les 9 véhicules du gabarit qui passent nil.
    -- ⚠ 14e argument `SpawnMode.AfterConstructor`, 13e (ABP personnalise) nil.
    -- Mesure en jeu le 2026-09-13 20:33 (Client/Diagnostic.lua, diag_vehicule.txt) :
    -- `IsInAir() = true` pendant 15 s, regime au ralenti — AUCUNE roue ne touchait
    -- le sol. En `Immediate` (le defaut), l'entite part chez les clients DES ce
    -- constructeur, AVANT les `SetWheel` ci-dessous : leur physique Chaos est creee
    -- sans roues. Le binaire serveur le dit : « Using deprecated
    -- 'VehicleWheeled:RecreatePhysics()' method! Please replace it with
    -- 'VehicleWheeled:FinishSpawn()' ». En AfterConstructor, le spawn se finit quand
    -- CE constructeur rend la main (BaseEntity.json), reglages compris — c'est ce que
    -- font les dix vehicules du gabarit officiel (14e argument `true`).
    self.Super:Constructor(location or Vector(), rotation or Rotator(),
        modele.asset, CollisionType.Normal, true, true,
        modele.son_moteur, modele.son_klaxon, nil, nil, nil, true,
        nil, SpawnMode.AfterConstructor)

    local reglages = Voitures.REGLAGE_COMMUN
    local m = reglages.moteur
    self:SetEngineSetup(m.max_torque, m.max_rpm, m.idle_rpm, m.brake_effect,
        m.rev_up_moi, m.rev_down_rate, self.torque_curve)

    local t = reglages.transmission
    self:SetTransmissionSetup(t.finale, t.montee_rpm, t.descente_rpm,
        t.temps_passage, t.rendement, self.forward_gears, self.reverse_gears)

    local a = reglages.aerodynamique
    self:SetAerodynamicsSetup(a.masse, a.trainee, a.largeur, a.hauteur, a.appui,
        Vector(a.centre[1], a.centre[2], a.centre[3]))

    -- provisoire : Ackermann + propulsion arrière, cohérent avec le gabarit
    -- Sedan (moteur sur les roues arrière). Enums.json : Ackermann = 2,
    -- RearWheelDrive = 3.
    self:SetSteeringSetup(SteeringType.Ackermann)
    self:SetDifferentialSetup(DifferentialType.RearWheelDrive)

    -- Les roues : os résolus PAR SIGNATURE (OsVehicules.Resoudre), jamais en
    -- dur. Si la résolution refuse, on préfère tuer le spawn en nommant la
    -- raison qu'une voiture posée sans roues — nanos ne lèverait rien.
    -- Le rayon est celui DU MODÈLE (mesuré, `rayon_roue`) : un rayon commun
    -- laissait Crossover, Pickup et SUV posés sur leur châssis.
    local roues, raison = Voitures.RouesPour(modele)
    if (not roues) then
        error("NarvosVoitureCTP : roues non resolues — " .. tostring(raison))
    end
    for _, r in ipairs(roues) do
        self:SetWheel(r.index, r.os, table.unpack(r.args))
    end

    -- Portes : offsets du gabarit Sedan (provisoire). C'est le trigger de la
    -- porte 0 qui permet AUSSI d'entrer sans ce module (interaction native).
    for _, p in ipairs(reglages.portes) do
        self:SetDoor(p.siege,
            Vector(p.offset[1], p.offset[2], p.offset[3]),
            Vector(p.place[1], p.place[2], p.place[3]),
            Rotator(p.rotation[1], p.rotation[2], p.rotation[3]),
            p.rayon, p.sortie)
    end

    local c = reglages.camera
    self:SetCameraOffset(Vector(c[1], c[2], c[3]))

    -- Plaques d'immatriculation sur RegPlateF / RegPlateR — provisoire : os ou
    -- sockets, la table de noms ne tranche pas ; AddStaticMeshAttached accepte
    -- les deux (BaseVehicle.json, autorité both). SM_RegPlate01-04 sont cuites
    -- ([assets.static_meshes]).
    if (modele.plaque) then
        self:AddStaticMeshAttached("plaque_av", modele.plaque, "RegPlateF")
        self:AddStaticMeshAttached("plaque_ar", modele.plaque, "RegPlateR")
    end

    -- La même valeur que posera le futur système de véhicules persistants :
    -- l'identifiant catalogue, répliqué (true), lisible par tous.
    self:SetValue("narvos_vehicule", modele_id, true)
end

-- ── Les motos Ridable (2026-09-13) ──────────────────────────────────────────────
--
-- Même patron que la voiture : classe héritée, réglage PROVISOIRE lu dans
-- `Voitures.REGLAGE_MOTO`, roues résolues par signature (`RouesMotoPour`,
-- convention digital_dive_moto). Ce qui diffère : pas de klaxon ni de plaque
-- dans le pack, une seule place, six rapports.
-- ⚠ JAMAIS ESSAYÉE : ni la tenue à l'arrêt (quatre roues rapprochées), ni la
-- rotation des roues visibles, ni la place du pilote.
VoituresServeur.MotoRidable = VehicleWheeled.Inherit("NarvosMotoRidable", {
    name = "Moto Ridable",
    category = "wheeled",

    -- provisoire : courbe de moteur léger, qui monte haut dans les tours
    torque_curve = {
        [   0.0] = 0.4,
        [2000.0] = 0.8,
        [6000.0] = 1.0,
        [9000.0] = 0.8,
        [9500.0] = 0.0,
    },
    forward_gears = { 3.0, 2.1, 1.6, 1.3, 1.1, 0.95 },   -- provisoire
    reverse_gears = { 3.0 },                             -- provisoire
})

function VoituresServeur.MotoRidable:Constructor(location, rotation, modele_id)
    local modele = Voitures.Modele(modele_id)
    if (not modele or not Voitures.EstMoto(modele_id)) then
        error("NarvosMotoRidable : modele inconnu ou pas une moto '" .. tostring(modele_id) .. "'")
    end

    -- Klaxon, frein, démarrage, portière : défauts du pack de base (nil).
    -- Meme raison que la voiture : reglages AVANT l'envoi aux clients.
    self.Super:Constructor(location or Vector(), rotation or Rotator(),
        modele.asset, CollisionType.Normal, true, true,
        modele.son_moteur, nil, nil, nil, nil, true,
        nil, SpawnMode.AfterConstructor)

    local reglages = Voitures.REGLAGE_MOTO
    local m = reglages.moteur
    self:SetEngineSetup(m.max_torque, m.max_rpm, m.idle_rpm, m.brake_effect,
        m.rev_up_moi, m.rev_down_rate, self.torque_curve)

    local t = reglages.transmission
    self:SetTransmissionSetup(t.finale, t.montee_rpm, t.descente_rpm,
        t.temps_passage, t.rendement, self.forward_gears, self.reverse_gears)

    local a = reglages.aerodynamique
    self:SetAerodynamicsSetup(a.masse, a.trainee, a.largeur, a.hauteur, a.appui,
        Vector(a.centre[1], a.centre[2], a.centre[3]))

    self:SetSteeringSetup(SteeringType.Ackermann)
    self:SetDifferentialSetup(DifferentialType.RearWheelDrive)

    local roues, raison = Voitures.RouesMotoPour()
    if (not roues) then
        error("NarvosMotoRidable : roues non resolues — " .. tostring(raison))
    end
    for _, r in ipairs(roues) do
        self:SetWheel(r.index, r.os, table.unpack(r.args))
    end

    for _, p in ipairs(reglages.portes) do
        self:SetDoor(p.siege,
            Vector(p.offset[1], p.offset[2], p.offset[3]),
            Vector(p.place[1], p.place[2], p.place[3]),
            Rotator(p.rotation[1], p.rotation[2], p.rotation[3]),
            p.rayon, p.sortie)
    end

    local c = reglages.camera
    self:SetCameraOffset(Vector(c[1], c[2], c[3]))

    self:SetValue("narvos_vehicule", modele_id, true)
end

-- ── Spawn ─────────────────────────────────────────────────────────────────────

--- Distance devant le joueur, en cm : assez pour ne pas chevaucher le
--- personnage, assez près pour voir la voiture apparaître.
VoituresServeur.DISTANCE = 600.0

--- Hauteur de dépose, en cm : la suspension absorbe une petite chute ; une
--- voiture posée DANS le sol, elle, peut être éjectée par la physique.
VoituresServeur.HAUTEUR = 100.0

--- Fait apparaître une voiture devant le joueur et l'installe au volant.
--- REVALIDATION SERVEUR : le modèle est relu dans le catalogue ici, jamais
--- pris au mot du client ; le personnage vient de `player`, pas d'un paramètre.
---@param player table
---@param modele_id any
---@return boolean ok, string|nil raison, table|nil vehicule
function VoituresServeur.Spawner(player, modele_id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "conduite")) then return false, "vos mains sont menottees" end
    local modele = Voitures.Modele(modele_id)
    if (not modele) then
        return false, "modele inconnu : " .. tostring(modele_id)
            .. " — /vehicule sans argument liste les modeles"
    end

    local character = player:GetControlledCharacter()
    if (not character) then return false, "aucun personnage controle" end

    -- Une voiture par joueur : l'ancienne est détruite, pas abandonnée.
    local ancienne = voitures[player]
    if (ancienne and ancienne:IsValid()) then ancienne:Destroy() end
    voitures[player] = nil

    local origine = character:GetLocation()
    local avant = character:GetRotation():GetForwardVector()
    local position = Vector(
        origine.X + avant.X * VoituresServeur.DISTANCE,
        origine.Y + avant.Y * VoituresServeur.DISTANCE,
        origine.Z + VoituresServeur.HAUTEUR)
    -- Même cap que le joueur : on essaie une voiture en partant, pas en
    -- faisant demi-tour autour d'elle.
    local rotation = Rotator(0, character:GetRotation().Yaw, 0)

    -- La classe suit le catalogue : une moto n'a ni les roues ni le moteur
    -- d'une voiture, et construire l'une avec la classe de l'autre lèverait
    -- dans le constructeur (ou pire, roulerait de travers sans rien dire).
    local classe = Voitures.EstMoto(modele.id) and VoituresServeur.MotoRidable
        or VoituresServeur.VoitureCTP
    local ok, v = pcall(classe, position, rotation, modele.id)
    if (not ok or not v) then
        Console.Error("Voitures.Spawner : spawn refuse pour " .. modele.id
            .. " — " .. tostring(v))
        return false, "spawn refuse (voir la console serveur)"
    end

    voitures[player] = v

    -- Le conducteur monte (Character.json : EnterVehicle, autorité server).
    -- Sans ça, la commande poserait une voiture à contempler ; elle sert à
    -- ROULER. La sortie reste l'interaction native (porte / touche véhicule).
    local ok_monte, err_monte = pcall(function() character:EnterVehicle(v, 0) end)
    if (not ok_monte) then
        Console.Warn("Voitures.Spawner : EnterVehicle a refuse — "
            .. tostring(err_monte))
    end

    return true, nil, v
end

-- ── LA GARDE : QUI PEUT FAIRE APPARAÎTRE UN VÉHICULE ─────────────────────────
-- `/vehicule` est une commande de développement, gardée par le répartiteur de
-- chat. Cet événement, lui, ne l'était PAS : un client pouvait l'émettre sans
-- passer par la commande et spawner à volonté. `Server/Index.lua` branche la même
-- règle que les commandes DEV (`commandes_dev` OU administrateur). FERMÉE PAR
-- DÉFAUT : un oubli de branchement se voit au premier essai.
local garde = function()
    return false, "Vehicules non configures sur ce serveur (garde non branchee)"
end

--- Installe la garde de spawn de véhicule.
---@param fn fun(player:table):boolean, string|nil
function VoituresServeur.UtiliserGarde(fn)
    if (type(fn) ~= "function") then return false end
    garde = fn
    return true
end

-- Le client demande, le serveur revalide — même discipline que Narvos:Invoquer.
Events.SubscribeRemote("Narvos:DemanderVehicule", function(player, modele_id)
    local permis, refus = garde(player)
    if (not permis) then
        Chat.SendMessage(player, "<grey>" .. tostring(refus or "Vehicules reserves aux administrateurs") .. "</>")
        return
    end
    local ok, raison = VoituresServeur.Spawner(player, modele_id)
    if (not ok) then
        Chat.SendMessage(player, "<grey>" .. tostring(raison) .. "</>")
    end
end)

return VoituresServeur