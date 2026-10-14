import { RACINE_DEPOT } from "./_racine.mjs";
// traversee-harness.mjs — preuve exécutable de Server/Traversee.lua (v2 :
// normale, snap, collision capsule, arc 2 phases). Charge les vrais modules
// (Shared/Logic/Traversee.lua + Server/Traversee.lua) dans wasmoon (Lua 5.4).
// Usage : node scripts/lua-harness/traversee-harness.mjs
import { readFileSync } from "node:fs";
import { LuaFactory } from "wasmoon";

const RACINE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";
const SHARED = RACINE + "/narvos/Shared/Logic/Traversee.lua";
const SERVEUR = RACINE + "/narvos-map-proto/Server/Traversee.lua";

const sharedSrc = readFileSync(SHARED, "utf8");
const serveurSrc = readFileSync(SERVEUR, "utf8");

const engine = await (new LuaFactory()).createEngine();

// ── Stubs moteur (Lua), AVANT tout chargement ────────────────────────────────
await engine.doString(`
_NOW = 0
_RES = { journaux = {}, tick = nil, derniere_pos = nil, anims = {}, gravite = nil, collision = nil, yaw = nil, events = {} }
Console = {
  Log  = function(...) table.insert(_RES.journaux, table.concat({...}, " ")) end,
  Warn = function(...) table.insert(_RES.journaux, table.concat({...}, " ")) end,
}
Events = { SubscribeRemote = function() end }
Player = { Subscribe = function() end }
Server = { GetTime = function() return _NOW end }
Timer = {
  SetInterval = function(fn, ms) _RES.tick = fn return "tid" end,
  ClearInterval = function() end,
}
Vector = function(x, y, z) return { X = x, Y = y, Z = z } end
Rotator = function(p, y, r) return { Pitch = p, Yaw = y, Roll = r } end
AnimationSlotType = { FullBody = 0 }
CollisionType = { Normal = 0, StaticOnly = 1, NoCollision = 2, IgnoreOnlyPawn = 3, Auto = 4 }
`);

// ── Module partagé RÉEL (constantes, Classer, Preparer, Clip) ────────────────
await engine.doString(`_TRAVERS_SHARED = (function()\n${sharedSrc}\nend)()`);

// ── Table Narvos (surface brancheur) ──────────────────────────────────────────
await engine.doString(`
Narvos = {
  Traversee = _TRAVERS_SHARED,
  Animations = { Asset = function(nom) return nom end },
  SessionServeur = { EnJeu = function() return true end },
  EnergieServeur = { Peut = function() return true end, Purger = function() return true end },
  Energie = { COUTS = {}, PAS_PURGE_MS = 33 },
  EmotesServeur = { EnCours = function() return false end },
  MenottesServeur = { Refuse = function() return false end },
  AnimNoms = { NOMS = {
    "M_Neutral_Traversal_Vault_1_0_run_F_Rfoot",
    "M_Neutral_Traversal_Vault_1_0_walk_F_Rfoot",
    "M_Neutral_Traversal_Mantle_1_0_run_F_Rfoot",
    "M_Neutral_Traversal_Mantle_1_0_walk_F_Rfoot",
    "M_Neutral_Traversal_Climb_2_5_run_F_Rfoot",
    "M_Neutral_Traversal_Climb_2_5_walk_F_Rfoot",
  } },
}
`);

// ── Module serveur RÉEL ───────────────────────────────────────────────────────
await engine.doString(`_TRAVERS_SERVEUR = (function()\n${serveurSrc}\nend)()`);

// ── Personnage et joueur factices (stubs avec self, journal des événements) ──
await engine.doString(`
_P = {
  GetControlledCharacter = function() return _C end,
  GetName = function() return "Testeur" end,
}
_C = {
  IsValid = function() return true end,
  IsDead = function() return false end,
  GetVehicle = function() return nil end,
  GetLocation = function() return { X = 0, Y = 0, Z = 100 } end,  -- bassin, pieds=10
  GetRotation = function() return { Yaw = 0 } end,                 -- cap +X
  GetVelocity = function() return { X = 0, Y = 0 } end,
  PlayAnimation = function(self, nom) table.insert(_RES.anims, nom) return true end,
  SetGravityEnabled = function(self, v) table.insert(_RES.events, "gravite=" .. tostring(v)) _RES.gravite = v end,
  SetCollision = function(self, v) table.insert(_RES.events, "collision=" .. tostring(v)) _RES.collision = v end,
  SetRotation = function(self, v) table.insert(_RES.events, "rotation=" .. tostring(v.Yaw)) _RES.yaw = v.Yaw end,
  SetLocation = function(self, v) table.insert(_RES.events, "location=" .. tostring(v.X) .. "," .. tostring(v.Z)) _RES.derniere_pos = v end,
}
`);

// ── Assertions ────────────────────────────────────────────────────────────────
let reussies = 0;
let echecs = 0;
function verifie(libelle, condition, detail) {
  if (condition) {
    reussies++;
  } else {
    echecs++;
    console.log(`ECHEC ${libelle} : ${detail}`);
  }
}

async function appelle(scriptLua) {
  return await engine.doString(scriptLua);
}

// Reset de l'état observé entre tests (+ avance l'horloge pour passer le cooldown)
async function resetObs() {
  await engine.doString(`
_RES.tick = nil
_RES.derniere_pos = nil
_RES.anims = {}
_RES.gravite = nil
_RES.collision = nil
_RES.yaw = nil
_RES.events = {}
_NOW = _NOW + 1000
`);
}

// Test 1 : payload nil → refus propre, SANS crash
await resetObs();
let r = await appelle(`local ok, err = _TRAVERS_SERVEUR.Escalader(_P, nil) return tostring(ok) .. "|" .. tostring(err)`);
verifie("payload nil -> refus sans crash", r === "false|Mesures invalides", r);

// Test 2 : mur DERRIÈRE le personnage (cap +X, mur en -Y) → refus
await resetObs();
r = await appelle(`local ok, err = _TRAVERS_SERVEUR.Escalader(_P, { px = 0, py = -100, sommet = 100, profondeur = 50, nx = -1, ny = 0 }) return tostring(ok) .. "|" .. tostring(err)`);
verifie("mur derriere -> refus", r === "false|Mur pas devant", r);

// Test 3 : mantle de FACE (normale -X → entrée +X), hauteur 90 -> mantle
await resetObs();
r = await appelle(`local ok, err = _TRAVERS_SERVEUR.Escalader(_P, { px = 100, py = 0, sommet = 100, profondeur = 50, nx = -1, ny = 0 }) return tostring(ok) .. "|" .. tostring(err)`);
verifie("mantle face -> accepte", r.split("|")[0] === "true", r);
let t0 = parseFloat(await appelle(`return tostring(_NOW)`));
// Mi-parcours : f = 0.5 → z = pic = sommet + 90 + ARC_PIC = 230
await appelle(`_NOW = ${t0 + 550}; _RES.tick()`);
r = await appelle(`return tostring(_RES.derniere_pos.Z) .. "|" .. tostring(_RES.yaw)`);
verifie("mantle : pic a mi-parcours Z=230 (arc 2 phases)", parseFloat(r.split("|")[0]) === 230, r);
verifie("mantle : snap yaw = 0 (mur face +X)", parseFloat(r.split("|")[1]) === 0, r);
// Fin : f = 1 → Z = sommet+95 = 195, X = px+40 = 140
await appelle(`_NOW = ${t0 + 2000}; _RES.tick()`);
r = await appelle(`return tostring(_RES.derniere_pos.X) .. "|" .. tostring(_RES.derniere_pos.Z)`);
verifie("mantle : arrivee X = px+40 (140)", parseFloat(r.split("|")[0]) === 140, r);
verifie("mantle : arrivee Z = sommet+95 (195)", parseFloat(r.split("|")[1]) === 195, r);
// Ordre collision → gravité + collision coupée avant le premier déplacement
r = await appelle(`
local s = table.concat(_RES.events, "|")
local ic2 = s:find("collision=2", 1, true)
local il  = s:find("location=", 1, true)
local ic0 = s:find("collision=0", 1, true)
local ig  = s:find("gravite=true", 1, true)
return tostring(ic2 ~= nil and il ~= nil and ic2 < il) .. "|" .. tostring(ic0 ~= nil and ig ~= nil and ic0 < ig)
`);
verifie("mantle : capsule NoCollision avant le 1er deplacement", r.split("|")[0] === "true", r);
verifie("mantle : collision restauree AVANT la gravite", r.split("|")[1] === "true", r);

// Test 4 : payload SANS nx/ny → repli sur le cap du personnage
await resetObs();
r = await appelle(`local ok, err = _TRAVERS_SERVEUR.Escalader(_P, { px = 100, py = 0, sommet = 100, profondeur = 50 }) return tostring(ok) .. "|" .. tostring(err)`);
verifie("mantle sans normale -> accepte (repli)", r.split("|")[0] === "true", r);
t0 = parseFloat(await appelle(`return tostring(_NOW)`));
await appelle(`_NOW = ${t0 + 2000}; _RES.tick()`);
r = await appelle(`return tostring(_RES.derniere_pos.X) .. "|" .. tostring(_RES.derniere_pos.Z) .. "|" .. tostring(_RES.yaw)`);
verifie("repli : arrivee X = 140", parseFloat(r.split("|")[0]) === 140, r);
verifie("repli : arrivee Z = 195", parseFloat(r.split("|")[1]) === 195, r);
verifie("repli : snap yaw = 0", parseFloat(r.split("|")[2]) === 0, r);

// Test 5 : mur en BIAIS — normale (-0.707, -0.707) → entrée (0.707, 0.707), yaw 45°
await resetObs();
r = await appelle(`local ok, err = _TRAVERS_SERVEUR.Escalader(_P, { px = 70, py = 70, sommet = 100, profondeur = 50, nx = -0.7071, ny = -0.7071 }) return tostring(ok) .. "|" .. tostring(err)`);
verifie("mur en biais -> accepte", r.split("|")[0] === "true", r);
t0 = parseFloat(await appelle(`return tostring(_NOW)`));
await appelle(`_NOW = ${t0 + 2000}; _RES.tick()`);
r = await appelle(`return tostring(_RES.derniere_pos.X) .. "|" .. tostring(_RES.derniere_pos.Y) .. "|" .. tostring(_RES.yaw)`);
verifie("biais : snap yaw ~45", Math.abs(parseFloat(r.split("|")[2]) - 45) < 0.5, r);
verifie("biais : atterrissage suit la normale (X~98.3)", Math.abs(parseFloat(r.split("|")[0]) - 98.28) < 0.2, r);
verifie("biais : atterrissage suit la normale (Y~98.3)", Math.abs(parseFloat(r.split("|")[1]) - 98.28) < 0.2, r);

// Test 6 : vault — arc sin conservé, atterrit AU SOL
await resetObs();
r = await appelle(`local ok, err = _TRAVERS_SERVEUR.Escalader(_P, { px = 100, py = 0, sommet = 50, profondeur = 30, nx = -1, ny = 0 }) return tostring(ok) .. "|" .. tostring(err)`);
verifie("vault face -> accepte", r.split("|")[0] === "true", r);
t0 = parseFloat(await appelle(`return tostring(_NOW)`));
// Mi-parcours vault : hauteur_arc = (50+60)-100 = 10 → z = 100 + 10*sin(pi/2) = 110
await appelle(`_NOW = ${t0 + 400}; _RES.tick()`);
r = await appelle(`return tostring(_RES.derniere_pos.Z)`);
verifie("vault : arc sin a mi-parcours Z=110", parseFloat(r) === 110, r);
// Fin : Z = sol (100), X = px+profondeur+MARGE+40 = 240
await appelle(`_NOW = ${t0 + 2000}; _RES.tick()`);
r = await appelle(`return tostring(_RES.derniere_pos.X) .. "|" .. tostring(_RES.derniere_pos.Z)`);
verifie("vault : arrivee X = 240", parseFloat(r.split("|")[0]) === 240, r);
verifie("vault : arrivee Z = sol (100)", parseFloat(r.split("|")[1]) === 100, r);

// Test 7 : mesures aberrantes → refus
await resetObs();
r = await appelle(`local ok, err = _TRAVERS_SERVEUR.Escalader(_P, { px = 0, py = 0, sommet = 10000, profondeur = 0, nx = -1, ny = 0 }) return tostring(ok) .. "|" .. tostring(err)`);
verifie("sommet aberrant -> refus", r === "false|Mesures invalides", r);

// Test 8 : payload non-table → refus propre
await resetObs();
r = await appelle(`local ok, err = _TRAVERS_SERVEUR.Escalader(_P, "garbage") return tostring(ok) .. "|" .. tostring(err)`);
verifie("payload non-table -> refus sans crash", r === "false|Mesures invalides", r);

// Test 9 : mur trop loin → refus, raison propagée
await resetObs();
r = await appelle(`local ok, err = _TRAVERS_SERVEUR.Escalader(_P, { px = 500, py = 0, sommet = 100, profondeur = 50, nx = -1, ny = 0 }) return tostring(ok) .. "|" .. tostring(err)`);
verifie("mur a 500 -> refus", r === "false|Mur trop loin", r);

// Preuve que le module a bien tourné au chargement
r = await appelle(`
for _, ligne in ipairs(_RES.journaux) do
  if ligne:find("escalade prete", 1, true) then return "OK" end
end
return "ABSENT"
`);
verifie("module charge : 'escalade prete' dans le journal", r === "OK", r);

console.log(`${reussies} assertion(s) réussie(s), ${echecs} échec(s) déclaré(s)`);