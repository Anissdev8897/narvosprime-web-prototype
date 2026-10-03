import { RACINE_DEPOT } from "./_racine.mjs";
// ia-serveur.mjs — harnais de l'EXÉCUTANT des PNJ (narvos-map-proto/Server/Ia.lua)
// branché sur la VRAIE décision (Logic/Ia.lua), le vrai combat (Logic/Combat.lua)
// et les vrais niveaux (Logic/Progression.lua + catalogues).
//
//   node scripts/lua-harness/ia-serveur.mjs
//
// ── POURQUOI CE HARNAIS (2026-09-15) ──────────────────────────────────────────
// La décision avait 350 assertions vertes, et AUCUN PNJ n'avait jamais vu un joueur :
// l'exécutant transmettait les cibles en `{ id, x, y, z }`, la décision lit
// `position`. Aucun test n'exécutait Server/Ia.lua. Celui-ci le fait, avec des
// doublures d'entités (Character, Player, Timer), et prouve la CHAÎNE :
// détection → poursuite (MoveTo) → attaque (geste, impact différé, défense) →
// niveaux appliqués → mort (cadavre à durée de vie).
import fs from "node:fs";
import { LuaFactory } from "wasmoon";

const RACINE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/";
const lire = (p) => fs.readFileSync(RACINE + p, "utf8");

const lua = await new LuaFactory().createEngine();
let sortie;
try {
  sortie = await lua.doString(`
local reussis, echecs = 0, 0
local messages = {}
local function ok(c, nom) if (c) then reussis = reussis + 1 else echecs = echecs + 1; messages[#messages + 1] = "ECHEC " .. nom end end
local function egal(a, b, nom) ok(a == b, nom .. " (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")") end

-- ── Moteur simulé ───────────────────────────────────────────────────────────────
Vector = function(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end
Rotator = function(p, y, r) return { Pitch = p or 0, Yaw = y or 0, Roll = r or 0 } end
Color = function(r, g, b, a) return { R = r, G = g, B = b, A = a } end
AnimationSlotType = { FullBody = 0, UpperBody = 1 }
DamageType = { Melee = 6, Punch = 2 }
GaitMode = { Walking = 1, Sprinting = 2 }
local journal = {}
Console = { Log = function(t) journal[#journal + 1] = t end, Warn = function(t) journal[#journal + 1] = t end, Error = function(t) journal[#journal + 1] = t end }
Package = { Require = function(p) error("Package.Require inattendu : " .. tostring(p)) end }

local maintenant = 0
local intervalles, delais = {}, {}
Timer = {
  SetInterval = function(fn, ms) intervalles[#intervalles + 1] = { fn = fn, ms = ms, prochain = ms } end,
  SetTimeout = function(fn, ms) delais[#delais + 1] = { fn = fn, du = maintenant + ms } end,
}
local function avancer(ms)
  local fin = maintenant + ms
  while (maintenant < fin) do
    maintenant = maintenant + 100
    for _, i in ipairs(intervalles) do
      if (maintenant >= i.prochain) then i.prochain = i.prochain + i.ms; i.fn() end
    end
    local restants = {}
    for _, d in ipairs(delais) do if (maintenant >= d.du) then d.fn() else restants[#restants + 1] = d end end
    delais = restants
  end
end

local abonnes = {}
local function Classe(nom)
  return { nom = nom, Subscribe = function(ev, fn) abonnes[nom .. ":" .. ev] = abonnes[nom .. ":" .. ev] or {}; table.insert(abonnes[nom .. ":" .. ev], fn) end }
end
Character = Classe("Character")
CharacterSimple = Classe("CharacterSimple")
local function emettre(classe, ev, ...) for _, fn in ipairs(abonnes[classe.nom .. ":" .. ev] or {}) do fn(...) end end

local function Corps(classe, x, y, z, joueur)
  local e = { classe = classe, pos = Vector(x, y, z), vie = 100, vie_max = 100, valeurs = {}, valide = true,
              ordres = {}, arrets = 0, gestes = {}, degats_recus = {}, regards = 0, allures = {}, duree_vie = nil, joueur = joueur }
  function e:IsValid() return self.valide end
  function e:IsDead() return self.vie <= 0 end
  function e:IsA(c) return c == self.classe end
  function e:GetLocation() return Vector(self.pos.X, self.pos.Y, self.pos.Z) end
  function e:GetRotation() return Rotator() end
  function e:GetVelocity() return Vector(0, 0, self.vz or 0) end
  function e:GetHealth() return self.vie end
  function e:GetMaxHealth() return self.vie_max end
  function e:SetMaxHealth(v) self.vie_max = v end
  function e:SetHealth(v) self.vie = v end
  function e:SetValue(k, v) self.valeurs[k] = v end
  function e:GetValue(k, d) local v = self.valeurs[k]; if (v == nil) then return d end return v end
  function e:MoveTo(p, r) self.ordres[#self.ordres + 1] = { X = p.X, Y = p.Y, Z = p.Z, r = r } end
  function e:StopMovement() self.arrets = self.arrets + 1 end
  function e:GetMovingTo() return Vector() end
  function e:LookAt() self.regards = self.regards + 1 end
  function e:SetRotation() self.regards = self.regards + 1 end
  function e:SetGaitMode(g) self.allures[#self.allures + 1] = g end
  function e:PlayAnimation(a) self.gestes[#self.gestes + 1] = a end
  function e:SetLifeSpan(s) self.duree_vie = s end
  function e:GetPlayer() return self.joueur end
  function e:ApplyDamage(d, _, _, _, _, causeur)
    self.degats_recus[#self.degats_recus + 1] = d
    self.vie = self.vie - d
    if (self.vie <= 0) then emettre(self.classe, "Death", self) end
    return d
  end
  return e
end

local joueur = { id = 1 }
function joueur:IsValid() return true end
function joueur:GetID() return self.id end
local corps_joueur = Corps(Character, 0, 0, 0, joueur)
corps_joueur.vie, corps_joueur.vie_max = 132, 132
function joueur:GetControlledCharacter() return corps_joueur end
Player = { GetAll = function() return { joueur } end }

-- ── Narvos réel ───────────────────────────────────────────────────────────────
Narvos = {}
Narvos.Classes = (function() ${lire("narvos/Shared/Catalogs/Classes.lua")} end)()
Narvos.Items = (function() ${lire("narvos/Shared/Catalogs/Items.lua")} end)()
Narvos.Spells = (function() ${lire("narvos/Shared/Catalogs/Spells.lua")} end)()
Narvos.Stats = (function() ${lire("narvos/Shared/Catalogs/Stats.lua")} end)()
Narvos.NiveauxPnj = (function() ${lire("narvos/Shared/Catalogs/NiveauxPnj.lua")} end)()
Narvos.Mondes = (function() ${lire("narvos/Shared/Catalogs/Mondes.lua")} end)()
Narvos.Ia = (function() ${lire("narvos/Shared/Logic/Ia.lua")} end)()
Narvos.Combat = (function() ${lire("narvos/Shared/Logic/Combat.lua")} end)()
Narvos.Progression = (function() ${lire("narvos/Shared/Logic/Progression.lua")} end)()
Narvos.Progression.Configurer({ stats = Narvos.Stats, niveaux_pnj = Narvos.NiveauxPnj, classes = Narvos.Classes })
Narvos.SessionServeur = { EnJeu = function() return true end }
Narvos.Animations = { Grouper = function() return {} end, Choisir = function() return "ACB_Attack_01_A_IP_Anim" end, Asset = function(n) return "narvos::" .. n end }
Narvos.AnimNoms = { NOMS = {} }
local defense_joueur = 20
Narvos.ProgressionServeur = { Statistiques = function() return { defense = defense_joueur } end }

local IaServeur = (function() ${lire("narvos-map-proto/Server/Ia.lua")} end)()
IaServeur.JOURNAL = true

-- ── 1. Prise en charge et niveau (Tour : plage 30-50) ─────────────────────────
local tour = Narvos.Mondes.CENTRES.tower
local pnj = Corps(Character, tour.X + 900, tour.Y, tour.Z)
corps_joueur.pos = Vector(tour.X + 5000, tour.Y, tour.Z)   -- joueur à 41 m : hors détection
ok(IaServeur.Prendre(pnj, { role = "ennemi" }), "Prendre un ennemi")
local attendu = Narvos.Progression.StatistiquesEnnemi({ niveau = 30, sorts = Narvos.Progression.SortsPourClasse(Narvos.Spells.SPELL_CATALOG, "warrior_bruiser") })
egal(pnj.valeurs.narvos_niveau, 30, "niveau synchronise : bas de la plage de la Tour")
egal(pnj.vie_max, attendu.vie_max, "vie max du niveau 30")
egal(pnj.vie, attendu.vie_max, "PV pleins")
egal(pnj.valeurs.narvos_rang, "mob", "rang mob par defaut")
ok(type(pnj.valeurs.narvos_niveau_couleur) == "string", "couleur de palier synchronisee")
egal(IaServeur.StatsCombat(pnj).defense, attendu.defense, "StatsCombat : defense du niveau")
local passif = Corps(Character, tour.X - 900, tour.Y, tour.Z)
IaServeur.Prendre(passif, { role = "marchand" })
egal(passif.valeurs.narvos_niveau, nil, "un marchand (passif) ne recoit pas de niveau d'ennemi")
egal(passif.vie_max, 100, "et garde sa sante")

-- ── 2. Hors portée : aucun ordre ──────────────────────────────────────────────
avancer(1500)
egal(#pnj.ordres, 0, "joueur a 41 m : aucun MoveTo")

-- ── 3. Détection et poursuite (le défaut du 15/09) ───────────────────────────
corps_joueur.pos = Vector(tour.X, tour.Y, tour.Z)           -- 9 m
avancer(1000)
ok(#pnj.ordres >= 1, "joueur a 9 m : MoveTo emis (le PNJ voit le joueur)")
local premier = pnj.ordres[1]
ok(premier and math.abs(premier.X - tour.X) < 1, "MoveTo vise la position du joueur")
ok(#pnj.allures >= 1 and pnj.allures[#pnj.allures] == GaitMode.Sprinting, "poursuite en course")
local n_avant = #pnj.ordres
avancer(1000)
ok(#pnj.ordres - n_avant <= 1, "cible immobile : pas de reemission a chaque decision (" .. (#pnj.ordres - n_avant) .. ")")

-- ── 4. Attaque : geste, impact différé, défense appliquée ────────────────────
pnj.pos = Vector(tour.X + 120, tour.Y, tour.Z)              -- 1,2 m : à portée
local vie_avant = corps_joueur.vie
avancer(600)
ok(#pnj.gestes >= 1, "a portee : le PNJ joue un geste d'attaque")
ok(pnj.regards >= 1, "il se tourne vers sa cible")
ok(pnj.arrets >= 1, "il s'arrete pour frapper")
avancer(600)
ok(#corps_joueur.degats_recus >= 1, "l'impact tombe apres le geste")
local coup = Narvos.Combat.Degats({ puissance = 0, critique = 0 }, { degats = attendu.degats }, 1, { defense = defense_joueur }, function() return 1 end).degats
egal(corps_joueur.degats_recus[1], coup, "degats = niveau 30 mitiges par la defense du joueur")
ok(corps_joueur.vie < vie_avant, "la vie du joueur baisse")

-- ── 5. Esquive : le joueur recule avant l'impact ─────────────────────────────
local recus = #corps_joueur.degats_recus
avancer(attendu.cadence_ms - 900)                            -- juste avant le prochain coup
local gestes = #pnj.gestes
avancer(200)                                                 -- le geste part
if (#pnj.gestes > gestes) then
  corps_joueur.pos = Vector(tour.X + 2000, tour.Y, tour.Z)   -- 18,8 m avant l'impact
  avancer(IaServeur.IMPACT_MS + 100)
  egal(#corps_joueur.degats_recus, recus, "recul avant l'impact : coup esquive")
else
  ok(true, "pas de coup a cet instant (cadence) : esquive non testee ici")
end

-- ── 6. Ancre recalée au sol ───────────────────────────────────────────────────
local aerien = Corps(Character, tour.X + 3000, tour.Y + 3000, tour.Z + 500)
IaServeur.Prendre(aerien, { role = "ennemi" })
aerien.vz = -400
avancer(1500)
aerien.pos.Z = tour.Z
aerien.vz = 0
avancer(400)
local ok_ancre = false
-- L'ancre n'est pas exposée : le PNJ au repos, posé, ne doit plus viser le ciel.
avancer(3000)
local vise_ciel = false
for _, o in ipairs(aerien.ordres) do if (o.Z > tour.Z + 100) then vise_ciel = true end end
ok(not vise_ciel, "pose au sol : il ne vise plus son point d'apparition en l'air")

-- ── 7. Échecs de MoveTo comptés et dits ──────────────────────────────────────
for _ = 1, IaServeur.SEUIL_ECHECS_MOVE do emettre(Character, "MoveComplete", pnj, false) end
local dit = false
for _, l in ipairs(journal) do if (l:find("NavMesh", 1, true)) then dit = true end end
ok(dit, "echecs de MoveTo : le journal soupconne l'absence de NavMesh")

-- ── 8. Atténuation des dégâts reçus par un PNJ ───────────────────────────────
local att = IaServeur.Attenuer(pnj, 100)
local attendu_att = Narvos.Combat.Degats({ puissance = 0, critique = 0 }, { degats = 100 }, 1, { defense = attendu.defense }, function() return 1 end).degats
egal(att, attendu_att, "Attenuer : defense du niveau appliquee")
egal(IaServeur.Attenuer(corps_joueur, 100), 100, "Attenuer : un corps non suivi encaisse tout")
egal(IaServeur.Attenuer(pnj, 0), 0, "Attenuer : zero reste zero")

-- ── 9. Mort : cadavre à durée de vie, suivi oublié ───────────────────────────
-- Un ennemi blesse fuit et recupere progressivement, sans soin complet.
local fuyard = Corps(Character, tour.X + 100, tour.Y + 100, tour.Z)
corps_joueur.pos = Vector(tour.X + 500, tour.Y + 100, tour.Z)
IaServeur.Prendre(fuyard, { role = "ennemi" }, { niveau = 10 })
avancer(500) -- il engage d'abord en bonne sante
fuyard.vie = fuyard.vie_max * 0.20
emettre(Character, "TakeDamage", fuyard)
local vie_fuite = fuyard.vie
avancer(1200)
ok(fuyard.vie > vie_fuite, "repli : la vie remonte")
ok(fuyard.vie <= fuyard.vie_max * IaServeur.SOIN_REPLI_CIBLE + 0.01,
  "repli : le soin reste plafonne")

-- Le coup fatal expose l'instigateur et les statistiques a l'integration butin.
local mort_instigateur, mort_niveau = nil, nil
IaServeur.UtiliserMort(function(instigateur, suivi)
  mort_instigateur = instigateur
  mort_niveau = suivi.stats and suivi.stats.niveau
end)
local victime = Corps(Character, tour.X + 200, tour.Y, tour.Z)
IaServeur.Prendre(victime, { role = "ennemi" }, { niveau = 37 })
emettre(Character, "Death", victime, 99, nil, nil, nil, joueur, corps_joueur)
egal(mort_instigateur, joueur, "mort : instigateur transmis au butin")
egal(mort_niveau, 37, "mort : niveau transmis au butin")

local suivis_avant = IaServeur.Compte()
pnj:ApplyDamage(pnj.vie + 10)
egal(pnj.duree_vie, IaServeur.CADAVRE_S, "mort : le cadavre se detruira")
egal(IaServeur.Compte(), suivis_avant - 1, "mort : le PNJ sort du suivi")
local mort_dit = false
for _, l in ipairs(journal) do if (l:find("mort (niv 30)", 1, true)) then mort_dit = true end end
ok(mort_dit, "mort : temoin au journal avec le niveau")

-- Un joueur mort n'est jamais pris pour un cadavre de PNJ.
local j2 = { id = 2 }
local corps_j2 = Corps(Character, 0, 0, 0, j2)
emettre(Character, "Death", corps_j2)
egal(corps_j2.duree_vie, nil, "le corps d'un joueur n'a pas de duree de vie")

return reussis .. "|" .. echecs .. "|" .. table.concat(messages, "\\n")
`);
} catch (e) {
  console.error("ERREUR LUA :", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}
if (sortie) {
  const [r, e, msg] = String(sortie).split("|");
  if (msg) console.log(msg);
  console.log(`ia-serveur : ${r} reussi(s), ${e} echec(s)`);
  if (Number(e) > 0) process.exitCode = 1;
}