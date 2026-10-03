-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Voitures.lua — les 12 voitures City_Traffic_Pro cuites, en DONNÉE et en
-- LOGIQUE PURE : aucune entité n'est créée ici (la classe `VehicleWheeled` et le
-- spawn vivent dans `narvos-map-proto/Server/Voitures.lua`, l'exécutant).
--
-- Câblage : Narvos.Voitures = Package.Require("Logic/Voitures.lua") dans
-- Shared/Index.lua.
--
-- ── CE QUI EST MESURÉ, CE QUI EST PROVISOIRE ──────────────────────────────────
-- MESURÉ (2026-09-10, sonde sur les .uasset cuits sous
-- `WebPortal/Server/Assets/narvos/Narvos/City_Traffic_Pro/Cars/Meshes/
-- Skeletal_Meshes/`) :
--   · les 12 SK_ partagent `Car_Skeleton` et la MÊME table de noms :
--     `Body`, `HeadlightL`, `HeadlightR`, `RegPlateF`, `RegPlateR`,
--     `Wheel_FL`, `Wheel_FR`, `Wheel_RL`, `Wheel_RR` ;
--   · aucun socket `VisWheel_*` ni os `PhysWheel_*` : le patron « roues visuelles
--     attachées par socket » du Offroad NE S'APPLIQUE PAS. Les roues sont dans le
--     mesh squelettique, skinnées sur les os `Wheel_*` — c'est le patron des 9
--     autres véhicules du gabarit officiel (Sedan, SUV, Pickup…), qui ne font
--     que `SetWheel(index, bone_name, …)` sans `AddStaticMeshAttached` ;
--   · les 12 clés SK_ sont dans `Assets.toml` [assets.skeletal_meshes], les
--     plaques SM_RegPlate01-04 dans [assets.static_meshes], les sons
--     S_Car_Engine_2K/3K/4K/5K et S_Horn dans [assets.sounds].
-- PROVISOIRE (marqué « provisoire » partout où il est utilisé) :
--   · le réglage moteur/boîte/roues/portes : les Blueprints du pack sont des
--     stubs cuits illisibles (BP_ParentBP_Drivable_Car.uasset = 1 431 octets,
--     WheelData/ vide) — RIEN n'a pu être puisé. Les valeurs viennent du Sedan
--     du gabarit officiel `default-vehicles-main/Shared/Index.lua:135-162`,
--     la carrosserie la plus proche. À recalibrer après le premier essai routier ;
--   · `RegPlateF`/`RegPlateR` : os ou sockets, la table de noms ne le dit pas.
--     `AddStaticMeshAttached` accepte les deux — à confirmer en jeu ;
--   · propulsion arrière + Ackermann : choix cohérent avec le gabarit Sedan
--     (moteur sur les roues arrière), pas une donnée du pack.
--
-- ── POURQUOI LA RÉSOLUTION PAR SIGNATURE, ICI AUSSI ───────────────────────────
-- Les os sont connus : on POURRAIT nommer `Wheel_FL` en dur. La mission §3.B
-- l'interdit : le mapping vit dans `OsVehicules` (donnée), et c'est
-- `OsVehicules.Resoudre` — la résolution par signature, sans repli muet — qui
-- attribue les rôles. Le jour où le pack est recuit avec des os renommés, ce
-- module REFUSE en nommant la raison au lieu de câbler des roues fantômes.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosVoitures
local Voitures = {}

-- Captures avec repli, même discipline que `Boutique`/`Recolte` : câblé dans
-- Shared/Index.lua, le module lit `Narvos.*` ; chargé seul (harnais wasmoon),
-- il reçoit les mêmes tables par injection du global `Narvos`.
local Vehicles = (Narvos and Narvos.Vehicles) or Package.Require("Catalogs/Vehicles.lua")
local OsVehicules = (Narvos and Narvos.OsVehicules) or Package.Require("Logic/OsVehicules.lua")

-- ── La mesure : la table de noms de Car_Skeleton ──────────────────────────────
-- Relevée le 2026-09-10 dans `Car_Skeleton.uasset` ET confirmée identique dans
-- chacun des 12 SK_*.uasset (sonde : extraction des chaînes ASCII ≥ 4,
-- comparaison ensemble par ensemble — 12/12 identiques).
Voitures.OS_CAR_SKELETON = {
    "Body",
    "HeadlightL", "HeadlightR",
    "RegPlateF", "RegPlateR",
    "Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR",
}

-- ── Le réglage commun — PROVISOIRE ────────────────────────────────────────────
-- Gabarit Sedan (default-vehicles-main/Shared/Index.lua:146-161), faute de
-- valeurs lisibles dans le pack. Toute retouche se fait ICI, une fois, pour les
-- 12 voitures — pas dans l'exécutant.
Voitures.REGLAGE_COMMUN = {
    -- SetEngineSetup(max_torque, max_rpm, idle_rpm, brake_effect, rev_up_moi,
    -- rev_down_rate, torque_curve) — la courbe vit dans la classe héritée.
    moteur = {
        max_torque = 700, max_rpm = 5700, idle_rpm = 1200,
        brake_effect = 0.05, rev_up_moi = 3, rev_down_rate = 600,
    },
    -- SetTransmissionSetup(finale, montee_rpm, descente_rpm, temps, rendement,
    -- forward, reverse) — rapports dans la classe héritée (gabarit Offroad).
    transmission = {
        finale = 2.81, montee_rpm = 3500, descente_rpm = 2000,
        temps_passage = 0.2, rendement = 0.9,
    },
    -- SetWheel : les 25 paramètres du gabarit Sedan, nommés. `propulsee` /
    -- `frein_main` diffèrent avant/arrière (propulsion arrière, provisoire).
    -- `rayon` : REPLI seulement. Chaque voiture du catalogue porte son rayon
    -- mesuré (`rayon_roue`, 28,7 à 40 cm) — voir `ReglageRoues`.
    roues = {
        rayon = 30, largeur = 20, braquage_av = 45,
        frein_max = 1900, frein_main_max = 3000,
        adherence = 2000, glissement = 1, friction = 5,
        seuil_glisse = 20, seuil_derapage = 20,
        ressort = 150, precharge = 30, montee = 7, descente = 7,
        lissage = 0, amortissement = 0.5, charge = 0.57,
    },
    -- SetDoor(siège, offset, place, rotation, rayon, sortie) — gabarit Sedan.
    portes = {
        { siege = 0, offset = { 31, -110, 90 }, place = { 10, -47, 80 },
          rotation = { 0, 0, 0 }, rayon = 60, sortie = -150 },
        { siege = 1, offset = { 31, 110, 90 }, place = { 5, 40, 85 },
          rotation = { 0, 0, 0 }, rayon = 60, sortie = 150 },
    },
    camera = { 0, 0, 100 },
    -- SetAerodynamicsSetup(masse, trainee, largeur, hauteur, appui, centre_de_masse)
    -- — gabarit Sedan (default-vehicles-main/Shared/Index.lua:147). Les dix
    -- vehicules du gabarit l'appellent TOUS ; sans lui, la masse et le centre de
    -- masse restent ceux que le moteur deduit du PhysicsAsset du pack.
    aerodynamique = { masse = 1400, trainee = 0.3, largeur = 200, hauteur = 190,
        appui = 0.4, centre = { 10, 0, 30 } },
}

-- ── Les MOTOS : Ridable MotorBikes (UE 4.26), 2026-09-13 ─────────────────────
--
-- MESURÉ : la table de noms de `SKL_Bike_base.uasset` (source du pack), le
-- squelette des trois corps `SK_<Moto>_Body_LOD0`. Onze os, dans l'ordre du fichier.
-- Leurs PhysicsAssets n'ont de corps que sur Root et Steering_Wheel — aucun sur
-- une roue (l'interdit nanos est respecté, rien à réparer).
Voitures.OS_BIKE_BASE = {
    "Root",
    "Front_Left_Wheel", "Front_Right_Wheel", "Front_Visible_Wheel",
    "Rear_Left_Wheel", "Rear_Right_Wheel",
    "Steering_Wheel",
    "SuspensionBottom", "SuspensionFront", "SuspensionTop",
    "Swingarm",
}

--- Le réglage des motos — PROVISOIRE, comme celui des voitures : les Blueprints
--- du pack (PhysX 4.26) ne se relisent pas en Chaos. Ce qui est décidé ici :
---   · QUATRE roues physiques, deux par essieu, sur les os L/R que le pack a
---     justement prévus — une moto sur deux roues tomberait à l'arrêt ;
---   · roues étroites, braquage court, une seule place.
--- ⚠ Les roues VISIBLES (`Front_Visible_Wheel`, et la roue arrière) ne sont
--- pilotées par aucun `SetWheel` : elles risquent de ne pas tourner à l'écran.
--- À trancher au premier essai routier.
Voitures.REGLAGE_MOTO = {
    moteur = {
        max_torque = 320, max_rpm = 9500, idle_rpm = 1300,
        brake_effect = 0.05, rev_up_moi = 1.5, rev_down_rate = 900,
    },
    transmission = {
        finale = 3.2, montee_rpm = 7500, descente_rpm = 3500,
        temps_passage = 0.15, rendement = 0.9,
    },
    roues = {
        rayon = 32, largeur = 10, braquage_av = 32,
        frein_max = 1500, frein_main_max = 2200,
        adherence = 2500, glissement = 1, friction = 4,
        seuil_glisse = 20, seuil_derapage = 20,
        ressort = 120, precharge = 25, montee = 7, descente = 7,
        lissage = 0, amortissement = 0.5, charge = 0.5,
    },
    -- Une seule place, à califourchon : l'offset de sortie est latéral.
    portes = {
        { siege = 0, offset = { 0, -70, 60 }, place = { -20, 0, 75 },
          rotation = { 0, 0, 0 }, rayon = 110, sortie = -120 },
    },
    camera = { 0, 0, 80 },
    -- provisoire : une moto pese ~250 kg ; centre de masse bas pour tenir a l'arret.
    aerodynamique = { masse = 260, trainee = 0.4, largeur = 80, hauteur = 120,
        appui = 0.2, centre = { 0, 0, 35 } },
}

-- ── Catalogue ─────────────────────────────────────────────────────────────────

--- Toutes les voitures cuites, dans l'ordre du catalogue généré.
--- `Vehicles.VOITURES_NANOS` vient de `vehicleCatalog.ts` via
--- `narvos-catalogs-to-lua.mjs`, filtré par la garde « mesh présent dans
--- Assets.toml » : ce qui est listé ici est CUITS, par construction.
---@return table
function Voitures.Liste()
    local liste = Vehicles and Vehicles.VOITURES_NANOS
    if (type(liste) ~= "table") then return {} end
    return liste
end

--- L'entrée catalogue d'un identifiant, ou nil. Recherche linéaire : 12
--- entrées, appelée au spawn, jamais dans un tick.
---@param id any
---@return table|nil
function Voitures.Modele(id)
    if (type(id) ~= "string") then return nil end
    for _, m in ipairs(Voitures.Liste()) do
        if (m.id == id) then return m end
    end
    for _, m in ipairs(Voitures.Motos()) do
        if (m.id == id) then return m end
    end
    return nil
end

--- Les motos cuites, dans l'ordre du catalogue généré (`MOTOS_NANOS`, même
--- garde « corps présent dans Assets.toml » que les voitures). Peut être VIDE.
---@return table
function Voitures.Motos()
    local liste = Vehicles and Vehicles.MOTOS_NANOS
    if (type(liste) ~= "table") then return {} end
    return liste
end

--- Voitures puis motos : ce que proposent le menu (Z) et `/vehicule`.
---@return table
function Voitures.ListeComplete()
    local sortie = {}
    for _, m in ipairs(Voitures.Liste()) do sortie[#sortie + 1] = m end
    for _, m in ipairs(Voitures.Motos()) do sortie[#sortie + 1] = m end
    return sortie
end

--- L'identifiant désigne-t-il une moto du catalogue ?
---@param id any
---@return boolean
function Voitures.EstMoto(id)
    if (type(id) ~= "string") then return false end
    for _, m in ipairs(Voitures.Motos()) do
        if (m.id == id) then return true end
    end
    return false
end

-- ── Résolution des os ─────────────────────────────────────────────────────────

--- Résout la table de noms mesurée contre les conventions d'OsVehicules.
--- Jamais de repli : zéro candidat ou ambiguïté → nil + la raison, et
--- l'exécutant refusera le spawn en la nommant.
---@return table|nil resolution { convention, roles, manquants }, string|nil raison
function Voitures.ResoudreOs()
    if (not OsVehicules) then return nil, "OsVehicules non cable" end
    return OsVehicules.Resoudre(Voitures.OS_CAR_SKELETON)
end

--- Les 4 roues prêtes pour `SetWheel`, os résolus par la convention.
--- Chaque entrée : { index, os, role, args } — `args` est la suite exacte des
--- paramètres APRÈS (index, bone_name) : l'exécutant fait
--- `self:SetWheel(r.index, r.os, table.unpack(r.args))`.
--- Propulsion arrière (provisoire, gabarit Sedan) : moteur + frein à main à
--- l'arrière, braquage à l'avant.
---
--- ⚠ LE RAYON EST CELUI DU MODÈLE quand le catalogue le porte (`rayon_roue`,
--- MESURÉ par narvos-catalogs-to-lua.mjs sur les os `Wheel_*` du squelette).
--- Retour de jeu du 2026-09-13 : « roues bloquées au niveau du sol ». Le rayon
--- commun de 30 cm, plus 7 de débattement, ne touchait pas le sol sous une roue
--- dont le centre est à 38-40 cm (Crossover, Pickup, SUV) : la voiture reposait
--- sur son châssis, sans contact de suspension (`IsInAir` toujours vrai).
---@param modele table|nil  entrée de VOITURES_NANOS
---@return table|nil roues, string|nil raison
function Voitures.RouesPour(modele)
    local resolution, raison = Voitures.ResoudreOs()
    if (not resolution) then return nil, raison end
    return Voitures.RouesDepuis(resolution, Voitures.ReglageRoues(modele))
end

--- Bornes d'un rayon de roue plausible, en cm : en dehors, la mesure est fausse
--- et le réglage commun reprend la main.
Voitures.RAYON_ROUE_MIN = 15
Voitures.RAYON_ROUE_MAX = 80

--- Le réglage de roues d'un modèle : le commun, rayon remplacé par la mesure.
--- Rend une COPIE — le réglage commun est partagé par les 12 voitures.
---@param modele table|nil
---@return table
function Voitures.ReglageRoues(modele)
    local copie = {}
    for k, v in pairs(Voitures.REGLAGE_COMMUN.roues) do copie[k] = v end
    local r = modele and tonumber(modele.rayon_roue) or nil
    if (r and r >= Voitures.RAYON_ROUE_MIN and r <= Voitures.RAYON_ROUE_MAX) then
        copie.rayon = r
    end
    return copie
end

--- Résout la table de noms MESURÉE des motos (`OS_BIKE_BASE`).
---@return table|nil resolution, string|nil raison
function Voitures.ResoudreOsMoto()
    if (not OsVehicules) then return nil, "OsVehicules non cable" end
    return OsVehicules.Resoudre(Voitures.OS_BIKE_BASE)
end

--- Les 4 roues physiques d'une moto, même contrat que `RouesPour`.
---@return table|nil roues, string|nil raison
function Voitures.RouesMotoPour()
    local resolution, raison = Voitures.ResoudreOsMoto()
    if (not resolution) then return nil, raison end
    return Voitures.RouesDepuis(resolution, Voitures.REGLAGE_MOTO.roues)
end

--- Le plan de `SetWheel` pour une résolution et un réglage de roues.
---@param resolution table  { convention, roles, manquants }
---@param reglages table    REGLAGE_*.roues
---@return table|nil roues, string|nil raison
function Voitures.RouesDepuis(resolution, reglages)
    local roles = resolution.roles
    -- L'ordre est celui du gabarit : 0 = avant gauche, 1 = avant droit,
    -- 2 = arrière gauche, 3 = arrière droit.
    local plan = {
        { index = 0, role = "roue_av_g", avant = true },
        { index = 1, role = "roue_av_d", avant = true },
        { index = 2, role = "roue_ar_g", avant = false },
        { index = 3, role = "roue_ar_d", avant = false },
    }

    local roues = {}
    for _, p in ipairs(plan) do
        local os_cible = roles[p.role]
        if (not os_cible) then
            -- Un rôle non résolu ne se devine pas : on nomme le rôle manquant.
            return nil, "role non resolu : " .. p.role
                .. " (convention " .. tostring(resolution.convention) .. ")"
        end
        roues[#roues + 1] = {
            index = p.index,
            role = p.role,
            os = os_cible,
            args = {
                reglages.rayon, reglages.largeur,
                p.avant and reglages.braquage_av or 0,
                Vector(),
                (not p.avant),   -- propulsee : arrière (provisoire)
                true,            -- freinee
                (not p.avant),   -- frein a main : arrière
                false,           -- abs
                false,           -- controle de traction
                reglages.frein_max, reglages.frein_main_max,
                reglages.adherence, reglages.glissement, reglages.friction,
                reglages.seuil_glisse, reglages.seuil_derapage,
                reglages.ressort, reglages.precharge,
                reglages.montee, reglages.descente,
                reglages.lissage, reglages.amortissement, reglages.charge,
            },
        }
    end
    return roues, nil
end

-- ── Garde-fou pour les harnais ────────────────────────────────────────────────

--- Prouve la cohérence du module : catalogue non vide et sans doublon, chaque
--- entrée complète (id, label, asset, sons, plaque), résolution des os franche,
--- 4 roues sur 4 os distincts. Rend true, ou false + la raison.
---@return boolean, string|nil
function Voitures.VerifierDonnees()
    local liste = Voitures.Liste()
    if (#liste == 0) then
        return false, "VOITURES_NANOS vide — la garde du generateur a tout exclu ?"
    end
    local vus = {}
    for _, m in ipairs(liste) do
        if (type(m.id) ~= "string" or m.id == "") then
            return false, "entree sans id"
        end
        if (vus[m.id]) then return false, "id en double : " .. m.id end
        vus[m.id] = true
        for _, champ in ipairs({ "label", "asset", "son_moteur", "son_klaxon", "plaque" }) do
            if (type(m[champ]) ~= "string" or m[champ] == "") then
                return false, m.id .. " : champ vide ou absent (" .. champ .. ")"
            end
        end
    end

    local resolution, raison = Voitures.ResoudreOs()
    if (not resolution) then return false, raison end
    if (resolution.convention ~= "city_traffic_pro") then
        return false, "convention inattendue : " .. tostring(resolution.convention)
    end
    if (#resolution.manquants > 0) then
        return false, "roles manquants : " .. table.concat(resolution.manquants, ", ")
    end

    local roues, raison_roues = Voitures.RouesPour()
    if (not roues) then return false, raison_roues end
    if (#roues ~= 4) then return false, "il faut 4 roues, " .. #roues .. " resolues" end
    local os_vus = {}
    local indices = {}
    for _, r in ipairs(roues) do
        if (os_vus[r.os]) then return false, "deux roues sur l'os " .. r.os end
        os_vus[r.os] = true
        if (indices[r.index]) then return false, "index de roue en double : " .. r.index end
        indices[r.index] = true
        if (#r.args ~= 23) then
            -- SetWheel : 25 paramètres, moins (index, bone_name) = 23.
            return false, r.role .. " : " .. #r.args .. " parametres, 23 attendus"
        end
    end
    return true, nil
end

--- La cohérence des motos : identifiants uniques et distincts des voitures,
--- champs complets, résolution franche sur la convention moto, 4 roues sur 4
--- os distincts. Un catalogue VIDE est cohérent (pas encore cuit) — la relation
--- avec Assets.toml est contrôlée par le harnais, pas ici.
---@return boolean, string|nil
function Voitures.VerifierMotos()
    local vus = {}
    for _, m in ipairs(Voitures.Liste()) do vus[m.id] = true end
    for _, m in ipairs(Voitures.Motos()) do
        if (type(m.id) ~= "string" or m.id == "") then return false, "moto sans id" end
        if (vus[m.id]) then return false, "id partage : " .. m.id end
        vus[m.id] = true
        for _, champ in ipairs({ "label", "asset", "son_moteur" }) do
            if (type(m[champ]) ~= "string" or m[champ] == "") then
                return false, m.id .. " : champ vide ou absent (" .. champ .. ")"
            end
        end
    end
    local resolution, raison = Voitures.ResoudreOsMoto()
    if (not resolution) then return false, raison end
    if (resolution.convention ~= "digital_dive_moto") then
        return false, "convention moto inattendue : " .. tostring(resolution.convention)
    end
    local roues, raison_roues = Voitures.RouesMotoPour()
    if (not roues) then return false, raison_roues end
    if (#roues ~= 4) then return false, "moto : 4 roues attendues, " .. #roues .. " resolues" end
    local os_vus = {}
    for _, r in ipairs(roues) do
        if (os_vus[r.os]) then return false, "moto : deux roues sur l'os " .. r.os end
        os_vus[r.os] = true
    end
    return true, nil
end

return Voitures
