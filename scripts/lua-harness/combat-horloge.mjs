// ══════════════════════════════════════════════════════════════════════════════
// combat-horloge.mjs — l'enchaînement de mêlée suit le TEMPS RÉEL, pas la minuterie.
//
//   node scripts/lua-harness/combat-horloge.mjs
//
// ── LE DÉFAUT QUE CE HARNAIS FERME (2026-09-19) ───────────────────────────────
// `Server/Combat.lua` tenait son temps d'un compteur de minuterie :
//
//     local horloge_ms = 0
//     Timer.SetInterval(function() horloge_ms = horloge_ms + 50 end, 50)
//
// Ce compteur avance de 50 ms PAR TOUR, et un tour de minuterie nanos n'est pas
// de 50 ms : `Sorts.lua` a relevé des tours de 475 à 685 ms pour 500 demandés
// (2026-09-15), et le serveur en perd quand il peine. Le compteur retarde donc
// sur le temps réel.
//
// Conséquence mesurée sur l'enchaînement : `enchaine_de` (420 ms × cadence pour
// la première attaque) restait DEVANT l'horloge, chaque second coup était refusé
// « Coup en cours », et la chaîne ne quittait jamais l'étape 1.
//
// ── CE QU'IL PROUVE ───────────────────────────────────────────────────────────
// Le module RÉEL est chargé (Server/Combat.lua + Shared/Logic/Combat.lua réels,
// catalogues réels), avec une doublure d'horloge :
//   · minuterie GELÉE (aucun tour) → +500 ms réels doivent enchaîner à l'étape 2 ;
//   · minuterie EN AVANCE (100 tours = 5 000 ms de faux temps) → à +100 ms réels,
//     le coup reste refusé.
// Les deux sens sont couverts : une horloge fausse ne peut plus ni bloquer ni
// accélérer le combat.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import { LuaFactory } from "wasmoon";

const NARVOS = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/";
const PROTO = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/";

const lire = (p) => fs.readFileSync(p, "utf8");

const classes = lire(NARVOS + "Catalogs/Classes.lua");
const items = lire(NARVOS + "Catalogs/Items.lua");
const animNoms = lire(NARVOS + "Catalogs/Animations.lua");
const animations = lire(NARVOS + "Logic/Animations.lua");
const combatLogique = lire(NARVOS + "Logic/Combat.lua");
const combatServeur = lire(PROTO + "Combat.lua");

const lua = await new LuaFactory().createEngine();

const script = `
local reussis, echecs = 0, 0
local function ok(condition, nom)
    if (condition) then reussis = reussis + 1
    else echecs = echecs + 1; print("  ECHEC  " .. nom) end
end
local function egal(obtenu, attendu, nom)
    ok(obtenu == attendu, nom .. " (obtenu " .. tostring(obtenu) .. ", attendu " .. tostring(attendu) .. ")")
end
local function section(nom) print("[" .. nom .. "]") end

-- ── Moteur simulé ─────────────────────────────────────────────────────────────
Vector = function(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end
Rotator = function(p, y, r) return { Pitch = p or 0, Yaw = y or 0, Roll = r or 0 } end
HandlingMode = { SingleHandedMelee = 1, DoubleHandedMelee = 2, Torch = 3 }
CollisionType = { Normal = 1 }
SurfaceType = { Flesh = 1, Default = 2 }
Reliability = { Reliable = 1 }
Package = { Require = function(p) error("Package.Require inattendu : " .. tostring(p)) end }

local messages = {}
Console = {
    Log = function(t) messages[#messages + 1] = tostring(t) end,
    Warn = function(t) messages[#messages + 1] = tostring(t) end,
    Error = function(t) messages[#messages + 1] = tostring(t) end,
}

-- Horloge RÉELLE simulée : c'est elle que \`Server.GetTime\` doit rendre.
local reelle = 0
local appels_gettime = 0
Server = { GetTime = function() appels_gettime = appels_gettime + 1; return reelle end }

-- Minuterie simulée : les tours sont enregistrés et déclenchés À LA MAIN, pour
-- reproduire une minuterie gelée comme une minuterie en avance.
local tours = {}
Timer = {
    SetInterval = function(fn) tours[#tours + 1] = fn end,
    SetTimeout = function() end,
}
local function tic(n)
    for _ = 1, (n or 1) do
        for _, fn in ipairs(tours) do fn() end
    end
end

-- Émissions serveur -> client : c'est ce qu'on observe.
local journal = {}
Events = {
    CallRemote = function(nom, joueur, fiabilite, ...)
        journal[#journal + 1] = { nom = nom, args = { ... } }
    end,
    SubscribeRemote = function() end,
    SelectRemote = function() end,
}

-- ── Doublures d'entités ───────────────────────────────────────────────────────
local function Entite()
    local e = { valide = true }
    function e:IsValid() return self.valide end
    function e:SetBaseDamage() end
    function e:SetDamageSettings() end
    function e:SetCooldown() end
    function e:SetAttachmentSettings() end
    function e:SetScale() end
    function e:ClearAnimationsCharacterUse() end
    function e:AddAnimationCharacterUse() end
    function e:SetImpactSound() end
    function e:SetSoundUse() end
    function e:Destroy() self.valide = false end
    return e
end
Melee = function() return Entite() end

local character = {
    GetLocation = function() return Vector(0, 0, 150000) end,
    GetRotation = function() return Rotator(0, 0, 0) end,
    PickUp = function() end,
    Drop = function() end,
    GetVehicle = function() return nil end,
    GetPicked = function() return nil end,
    IsInVehicle = function() return false end,
}
JOUEUR = {
    GetControlledCharacter = function() return character end,
    GetName = function() return "TestJoueur" end,
}
Player = { Subscribe = function() end, GetAll = function() return { JOUEUR } end }
Character = { Subscribe = function() end }

-- ── Modules RÉELS ─────────────────────────────────────────────────────────────
Narvos = {}
Narvos.Classes   = (function() ${classes} end)()
Narvos.Items     = (function() ${items} end)()
Narvos.AnimNoms  = (function() ${animNoms} end)()
Narvos.Animations = (function() ${animations} end)()
Narvos.Combat    = (function() ${combatLogique} end)()
Narvos.SessionServeur = { De = function() return nil end }
Narvos.ProgressionServeur = { BonusCombat = function() return nil end }
Narvos.Melee = { Reglages = function() return nil end, SON_CHAIR = "chair", SON_SOUFFLE = "souffle" }

local CombatServeur = (function() ${combatServeur} end)()

-- ── Observation ───────────────────────────────────────────────────────────────
local function dernier_coup()
    for i = #journal, 1, -1 do
        if (journal[i].nom == "Narvos:Coup") then return journal[i] end
    end
    return nil
end
local function dernier_nom() return journal[#journal] and journal[#journal].nom or nil end
local function etape_de(c) return c and c.args and c.args[1] or nil end

-- ── Scénario ──────────────────────────────────────────────────────────────────
section("equipement")
local equipe, raison = CombatServeur.Equiper(JOUEUR, "batte")
egal(equipe, true, "la batte s'equipe (" .. tostring(raison) .. ")")

section("l'enchainement suit le temps reel, jamais la minuterie")
-- Aucun tour de minuterie n'a ete joue : le compteur de l'ancien code vaut 0.
reelle = 1000
CombatServeur.Frapper(JOUEUR)
local c1 = dernier_coup()
egal(etape_de(c1), 1, "coup 1 (t=1000 ms) : etape 1")

-- 300 ms reels plus tard : la recuperation du premier coup court toujours.
reelle = 1300
CombatServeur.Frapper(JOUEUR)
ok(dernier_nom() == "Narvos:CoupRefuse", "a +300 ms : refuse (Coup en cours)")
ok(dernier_coup() == c1, "a +300 ms : aucun nouveau coup annonce")

-- LE TEST DU DÉFAUT : 500 ms reels plus tard, fenetre ouverte [420 ; 740].
reelle = 1500
CombatServeur.Frapper(JOUEUR)
local c2 = dernier_coup()
egal(etape_de(c2), 2, "a +500 ms, minuterie GELEE : etape 2")

-- Minuterie EN AVANCE : 100 tours = 5 000 ms de faux temps. Le temps reel, lui,
-- n'a avance que de 100 ms : le coup doit rester refuse.
tic(100)
reelle = 1600
CombatServeur.Frapper(JOUEUR)
ok(dernier_nom() == "Narvos:CoupRefuse", "minuterie en avance : le coup reste refuse")
ok(dernier_coup() == c2, "minuterie en avance : l'etape annoncee ne bouge pas")

-- Fin de chaine, puis retour a l'etape 1 hors fenetre.
reelle = 2100
CombatServeur.Frapper(JOUEUR)
egal(etape_de(dernier_coup()), 3, "dans la fenetre : etape 3 (finisher)")
reelle = 2900
CombatServeur.Frapper(JOUEUR)
egal(etape_de(dernier_coup()), 1, "hors fenetre : la chaine repart a l'etape 1")

section("horloge")
ok(appels_gettime > 0, "Server.GetTime est consulte (appels = " .. appels_gettime .. ")")

print("")
print(("%d assertion(s) reussie(s), %d echec(s)"):format(reussis, echecs))
if (echecs > 0) then error("harnais en echec", 0) end
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR:", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}