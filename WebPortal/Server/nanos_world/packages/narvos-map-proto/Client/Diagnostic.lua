-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/Diagnostic.lua — la TAILLE RENDUE des personnages, mesurée dans le moteur.
--
-- Câblage : `local Diagnostic = Package.Require("Client/Diagnostic.lua")` depuis
-- Client/Index.lua, plus la commande console `/diag`.
--
-- ── POURQUOI CE MODULE EXISTE ─────────────────────────────────────────────────
-- Retour de jeu du 2026-09-10 : « les PNJ sont très grands ». La sonde ADK
-- (`scripts/adk-bornes-pnj.py`) a répondu « 0 géant » — en mesurant les BORNES
-- DU MESH SOURCE. C'est le même instrument qui avait donné « 1,7 cm » le 05/09
-- et fait poser `echelle = 100` sur 30 PNJ… sans jamais les voir tourner.
--
-- Un squelette importé peut porter une échelle sur son os racine : les bornes du
-- mesh disent 1,7 cm, le rendu fait 1,7 m, et × 100 fait 170 m. Les deux
-- mesures ADK diraient la même chose dans les deux cas — elles ne peuvent pas
-- trancher.
--
-- Ici on mesure l'ENTITÉ EN JEU : `GetBounds()` rend des bornes MONDE, os et
-- échelle d'acteur compris. C'est ce que voit le joueur.
--
-- ── ⚠ AUTORITÉ CLIENT ─────────────────────────────────────────────────────────
-- `Actor:GetBounds()` est d'autorité CLIENT (BaseActor.json). Le serveur ne peut
-- pas faire cette mesure : d'où ce module, et d'où le journal CLIENT
-- (`%LOCALAPPDATA%/NanosWorld/Saved/Logs/NanosWorldCore.log`) comme témoin.
--
-- ── L'IDENTITÉ ────────────────────────────────────────────────────────────────
-- Aucun accesseur ne rend le mesh d'un personnage côté client. Chaque voie
-- d'apparition du serveur pose donc `narvos_pnj` (l'identifiant de catalogue) et
-- `narvos_echelle` (l'échelle demandée), synchronisés. Une entité sans ces
-- valeurs est nommée « ? » — et c'est une information : elle vient d'une voie
-- qui ne s'identifie pas.
-- ═══════════════════════════════════════════════════════════════════════════════

local Diagnostic = {}

local GEANT_M = 4.0         -- au-delà : géant, quel que soit le personnage
local POUPEE_M = 0.5        -- en deçà : poupée — sauf les compagnons
local RAYON_M = 300.0       -- on ne mesure que ce qui est à portée de regard
local DELAI_ARRIVEE_MS = 8000
-- ⚠ Le délai n'est pas du confort : juste après l'apparition, les bornes d'un
-- personnage peuvent valoir zéro (mesh pas encore rendu). Mesurer trop tôt
-- rendrait des « poupées » qui n'en sont pas.

local function Moi()
    local joueur = Client.GetLocalPlayer()
    return joueur and joueur:GetControlledCharacter() or nil
end

local function Distance(a, b)
    local dx, dy, dz = a.X - b.X, a.Y - b.Y, a.Z - b.Z
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

--- Mesure une classe d'entités ; rend les lignes et les compteurs.
local function MesurerClasse(classe, nom_classe, moi, pos_moi, acc, lignes)
    local ok, entites = pcall(function() return classe.GetAll() end)
    if (not ok or type(entites) ~= "table") then return end

    for _, e in ipairs(entites) do
        if (e ~= moi and e:IsValid()) then
            local pos = e:GetLocation()
            local d = Distance(pos, pos_moi) / 100.0
            if (d <= RAYON_M) then
                local lu, b = pcall(function() return e:GetBounds() end)
                local h = (lu and b and b.BoxExtent) and (b.BoxExtent.Z * 2.0 / 100.0) or -1
                local id = tostring(e:GetValue("narvos_pnj", "?"))
                local echelle = e:GetValue("narvos_echelle", nil)
                local compagnon = id:sub(1, 10) == "compagnon:"

                local verdict = "ok"
                if (h < 0) then
                    verdict = "BORNES ILLISIBLES"
                elseif (h > GEANT_M) then
                    verdict = "GEANT"
                    acc.geants = acc.geants + 1
                elseif (h < POUPEE_M and not compagnon) then
                    verdict = "POUPEE"
                    acc.poupees = acc.poupees + 1
                end
                acc.total = acc.total + 1

                -- On n'écrit que les anomalies… et les entités SANS identité,
                -- qui en sont une aussi : elles viennent d'une voie muette.
                if (verdict ~= "ok" or id == "?") then
                    local ligne = ("%-8s %-24s %-15s echelle=%-6s hauteur=%6.2f m  a %4.0f m  (%.0f, %.0f, %.0f)")
                        :format(verdict, id, nom_classe, tostring(echelle or "?"),
                            h, d, pos.X, pos.Y, pos.Z)
                    Console.Log("[DIAG] " .. ligne)
                    lignes[#lignes + 1] = ligne
                end
            end
        end
    end
end

-- ── Les Blueprints posés : le MetaHuman est-il là où son porteur l'attend ? ────
--
-- Vu en jeu le 2026-09-13 : du MetaHuman, seules les TONGS s'affichent. Dans
-- l'éditeur, le même Blueprint attaché au même porteur rend corps, tête et
-- cheveux, et ses os suivent le porteur au centimètre (scripts/adk-sonder-
-- metahuman-rendu.py). La question ne se tranche donc que DANS le client : les os
-- du corps y sont-ils à leur place, écrasés, ou NaN ? `GetSocketTransform` et
-- `GetBounds` sont d'autorité CLIENT (BaseActor.json).
local OS_TEMOINS = { "root", "pelvis", "head", "hand_r", "hand_l", "index_01_r", "index_01_l" }

local function EstNaN(x) return x ~= x end

local function Vec(v)
    if (type(v) ~= "userdata" and type(v) ~= "table") then return "nil" end
    local x, y, z = v.X, v.Y, v.Z
    if (x == nil) then return "?" end
    if (EstNaN(x) or EstNaN(y) or EstNaN(z)) then return "NaN" end
    return ("(%.0f %.0f %.0f)"):format(x, y, z)
end

local function Os(entite, nom)
    local ok, t = pcall(function() return entite:GetSocketTransform(nom) end)
    if (not ok or type(t) ~= "table") then return "illisible" end
    return Vec(t.Location or t.location)
end

local function MesurerBlueprints(lignes)
    local ok, bps = pcall(function() return Blueprint.GetAll() end)
    if (not ok or type(bps) ~= "table") then
        lignes[#lignes + 1] = "blueprints : Blueprint.GetAll() illisible"
        return
    end
    lignes[#lignes + 1] = ("blueprints : %d entite(s) cote client"):format(#bps)
    for _, bp in ipairs(bps) do
        if (bp:IsValid()) then
            local nom = tostring(bp:GetValue("narvos_blueprint", "?"))
            local porteur = nil
            pcall(function() porteur = bp:GetAttachedTo() end)
            local lu, b = pcall(function() return bp:GetBounds() end)
            local bornes = (lu and type(b) == "table")
                and ("centre=%s demi=%s"):format(Vec(b.Origin), Vec(b.BoxExtent)) or "bornes illisibles"
            lignes[#lignes + 1] = ("MH %s @ %s visible=%s attache=%s %s")
                :format(nom, Vec(bp:GetLocation()), tostring(bp:IsVisible()), tostring(porteur ~= nil), bornes)
            for _, o in ipairs(OS_TEMOINS) do
                lignes[#lignes + 1] = ("   os %-6s MetaHuman=%s  porteur=%s")
                    :format(o, Os(bp, o), porteur and Os(porteur, o) or "-")
            end
        end
    end
end

--- Mesure maintenant. `origine` dit qui l'a demandé (arrivée, commande).
function Diagnostic.Mesurer(origine)
    local moi = Moi()
    if (not moi) then
        -- A l'ecran de creation, aucun personnage n'est controle — et c'est la
        -- que l'apercu MetaHuman se pose : on mesure quand meme les Blueprints.
        local lignes = { "aucun personnage controle (" .. tostring(origine) .. ")" }
        MesurerBlueprints(lignes)
        for _, l in ipairs(lignes) do Console.Log("[DIAG] " .. l) end
        return nil, lignes
    end
    local pos_moi = moi:GetLocation()
    local acc = { total = 0, geants = 0, poupees = 0 }
    local lignes = {}

    if (Sky) then
        local ok, h, m, s = pcall(Sky.GetTimeOfDay)
        local meteo_ok, meteo = pcall(Sky.GetWeather)
        lignes[#lignes + 1] = ("ciel heure=%s:%s:%s meteo=%s")
            :format(ok and tostring(h) or "?", tostring(m), tostring(s),
                meteo_ok and tostring(meteo) or "?")
    end

    -- Mesure du sol réel dans le client, y compris les décors chargés par Lua.
    -- Deux traces distinguent collision simple et triangles visibles ; aucune
    -- téléportation ni correction automatique à partir d'une mesure client.
    lignes[#lignes + 1] = "joueur @ " .. Vec(pos_moi)
    for _, complexe in ipairs({ false, true }) do
        local mode = TraceMode.ReturnNames
        if (complexe) then mode = mode | TraceMode.TraceComplex end
        local ok, sol = pcall(function()
            return Trace.LineSingle(pos_moi + Vector(0, 0, 100000),
                pos_moi - Vector(0, 0, 100000), CollisionChannel.WorldStatic,
                mode, { moi })
        end)
        lignes[#lignes + 1] = ("sol %s : %s %s")
            :format(complexe and "triangles" or "simple",
                ok and sol and sol.Success and Vec(sol.Location) or "absent",
                ok and sol and tostring(sol.ActorName or "") or "trace impossible")
    end

    MesurerClasse(CharacterSimple, "CharacterSimple", moi, pos_moi, acc, lignes)
    MesurerClasse(Character, "Character", moi, pos_moi, acc, lignes)
    MesurerBlueprints(lignes)

    -- ⚠ Le bilan s'écrit TOUJOURS, même à zéro anomalie. Un diagnostic qui ne
    -- dit rien quand tout va bien ne se distingue pas d'un diagnostic qui n'a
    -- pas tourné.
    local bilan = ("bilan (%s) : %d personnage(s) a moins de %d m, %d geant(s), %d poupee(s)")
        :format(tostring(origine), acc.total, RAYON_M, acc.geants, acc.poupees)
    Console.Log("[DIAG] " .. bilan)
    lignes[#lignes + 1] = bilan
    return acc, lignes
end

-- ── Automatique : à chaque arrivée dans un monde, et une fois au démarrage ────
Events.SubscribeRemote("Narvos:Voyage", function()
    Timer.SetTimeout(function() Diagnostic.Mesurer("arrivee") end, DELAI_ARRIVEE_MS)
end)
Timer.SetTimeout(function() Diagnostic.Mesurer("demarrage") end, DELAI_ARRIVEE_MS * 2)

-- ── Automatique : chaque MetaHuman pose est mesure et RAPPORTE au serveur ──────
-- A l'ecran de creation le chat n'est pas joignable (le WebUI a le clavier) :
-- `/diag` n'y peut rien demander. Test du 2026-09-13 18:35 : l'apercu a ete pose
-- trois fois, aucun rapport. La valeur `narvos_blueprint` (posee par le serveur
-- juste apres le Blueprint, MetaHumainBP.Poser) declenche donc la mesure, qui
-- part au serveur ; il l'ecrit dans `.data/diag_client.txt`.
local DELAI_METAHUMAN_MS = 3000
local mesure_en_attente = false

Blueprint.Subscribe("ValueChange", function(_, cle)
    if (cle ~= "narvos_blueprint" or mesure_en_attente) then return end
    mesure_en_attente = true
    Timer.SetTimeout(function()
        mesure_en_attente = false
        local _, lignes = Diagnostic.Mesurer("metahuman pose")
        Events.CallRemote("Narvos:DiagRapport", Reliability.Reliable, lignes or {})
    end, DELAI_METAHUMAN_MS)
end)

-- ── Automatique : la CONDUITE, echantillonnee des qu'on prend le volant ────────
-- Retour de jeu du 2026-09-13 19h : « au volant », la voiture ne bouge pas, sur
-- huit modeles. Rien ne permettait de separer les trois causes possibles :
--   · l'ENTREE ne parvient pas au vehicule  -> regime au ralenti, rapport 0 ;
--   · la PHYSIQUE retient la caisse          -> regime qui monte, vitesse nulle ;
--   · les roues ne touchent pas le sol       -> IsInAir vrai.
-- Chaque echantillon porte les trois, plus l'etat souris/entree et les touches
-- de conduite enfoncees. Le rapport part au serveur, qui l'ecrit dans
-- `.data/diag_vehicule.txt` (meme canal que le MetaHuman).
local ECHANTILLON_MS = 500
local ECHANTILLONS = 30
local TOUCHES_CONDUITE = { "W", "Z", "S", "A", "Q", "D", "SpaceBar", "LeftShift" }
local conduite_en_cours = false

local function Nombre(fn, defaut)
    local ok, v = pcall(fn)
    if (ok and v ~= nil) then return v end
    return defaut
end

--- Les liaisons de jeu qui touchent a la conduite, telles que nanos les rend.
local function LiaisonsConduite()
    local ok, liaisons = pcall(function() return Input.GetGameKeyBindings() end)
    if (not ok or type(liaisons) ~= "table") then return "liaisons de jeu illisibles" end
    local morceaux = {}
    for nom, touches in pairs(liaisons) do
        local n = tostring(nom)
        if (n:find("Forward") or n:find("Backward") or n:find("Right") or n:find("Left")
            or n:find("Throttle") or n:find("Brake") or n:find("Steer") or n:find("Vehicle")
            or n:find("Handbrake") or n:find("Horn") or n:find("Enter") or n:find("Interact")) then
            local liste = {}
            if (type(touches) == "table") then
                for _, t in ipairs(touches) do liste[#liste + 1] = tostring(t) end
            else
                liste[1] = tostring(touches)
            end
            morceaux[#morceaux + 1] = n .. "=" .. table.concat(liste, "/")
        end
    end
    table.sort(morceaux)
    return table.concat(morceaux, " ")
end

local function Echantillon(vehicule, t_ms, origine)
    local pos = Nombre(function() return vehicule:GetLocation() end, Vector())
    local vit = Nombre(function() return vehicule:GetVelocity() end, Vector())
    local kmh = math.sqrt(vit.X * vit.X + vit.Y * vit.Y + vit.Z * vit.Z) * 0.036
    local enfoncees = {}
    for _, t in ipairs(TOUCHES_CONDUITE) do
        if (Nombre(function() return Input.IsKeyDown(t) end, false)) then enfoncees[#enfoncees + 1] = t end
    end
    return ("t=%.1fs depl=%.0fcm v=%.1fkm/h rpm=%s rapport=%s air=%s moteur=%s souris=%s entree=%s touches=[%s]")
        :format(t_ms / 1000, Distance(pos, origine), kmh,
            tostring(Nombre(function() return math.floor(vehicule:GetRPM()) end, "?")),
            tostring(Nombre(function() return vehicule:GetGear() end, "?")),
            tostring(Nombre(function() return vehicule:IsInAir() end, "?")),
            tostring(Nombre(function() return vehicule:IsEngineStarted() end, "?")),
            tostring(Nombre(function() return Input.IsMouseEnabled() end, "?")),
            tostring(Nombre(function() return Input.IsInputEnabled() end, "?")),
            table.concat(enfoncees, ","))
end

--- Echantillonne la conduite pendant ECHANTILLONS x ECHANTILLON_MS, puis rapporte.
function Diagnostic.Conduite(vehicule)
    if (conduite_en_cours or not vehicule or not vehicule:IsValid()) then return end
    conduite_en_cours = true
    local origine = Nombre(function() return vehicule:GetLocation() end, Vector())
    local lignes = {
        ("vehicule %s (%s) siege conducteur ; valeur narvos_vehicule=%s")
            :format(tostring(Nombre(function() return vehicule:GetMesh() end, "?")),
                tostring(Nombre(function() return vehicule:GetClass():GetName() end, "?")),
                tostring(Nombre(function() return vehicule:GetValue("narvos_vehicule") end, "?"))),
        "clavier : " .. tostring(Nombre(function() return Input.GetKeyboardLayout() end, "?")),
        "liaisons : " .. LiaisonsConduite(),
    }
    local n = 0
    local minuterie
    minuterie = Timer.SetInterval(function()
        n = n + 1
        if (not vehicule:IsValid()) then
            lignes[#lignes + 1] = "vehicule detruit pendant la mesure"
            n = ECHANTILLONS
        else
            lignes[#lignes + 1] = Echantillon(vehicule, n * ECHANTILLON_MS, origine)
        end
        if (n >= ECHANTILLONS) then
            Timer.ClearInterval(minuterie)
            conduite_en_cours = false
            for _, l in ipairs(lignes) do Console.Log("[DIAG] " .. l) end
            Events.CallRemote("Narvos:DiagRapport", Reliability.Reliable, lignes, "vehicule")
        end
    end, ECHANTILLON_MS)
end

Character.Subscribe("EnterVehicle", function(character, vehicule)
    if (character ~= Moi()) then return end
    Diagnostic.Conduite(vehicule)
end)

return Diagnostic
