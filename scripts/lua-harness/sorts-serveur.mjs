// sorts-serveur.mjs — harnais de l'EXÉCUTANT des sorts
// (narvos-map-proto/Server/Sorts.lua) branché sur les VRAIES règles
// (Logic/Sorts.lua) et les VRAIS catalogues (Spells, Classes, Vfx, SortsVfx).
//
//   node scripts/lua-harness/sorts-serveur.mjs
//
// ── POURQUOI (2026-10-03) ──────────────────────────────────────────────────────
// `sorts.mjs` prouve les règles pures ; aucun harnais n'exécutait l'exécutant :
// ciblage, instant de libération, dégâts, réseau, régénération. Ce fichier vient
// des historiques d'agents (récupération du 03/10) et doit être refondu en
// pipeline de capacités : ce harnais FIGE ce qui marche avant d'y toucher.
//
// Il n'affirme que des comportements voulus. Les manques connus (pas de filtre
// de faction dans une zone, pas de statut, pas de bouclier) ne sont pas affirmés
// ici : ils auront leurs tests quand ils seront écrits.
import fs from "node:fs";
import { LuaFactory } from "wasmoon";

const RACINE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/";
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
Rotator = function(p, y, r)
  local rot = { Pitch = p or 0, Yaw = y or 0, Roll = r or 0 }
  function rot:GetForwardVector()
    local a = math.rad(self.Yaw)
    return Vector(math.cos(a), math.sin(a), 0)
  end
  return rot
end
Reliability = { Unreliable = 0, Reliable = 1 }
AttachmentRule = { SnapToTarget = 0 }
AnimationSlotType = { FullBody = 0, UpperBody = 1 }
DamageType = { Unknown = 0 }
Weapon = {}
local journal = {}
Console = {
  Log = function(t, ...) journal[#journal + 1] = tostring(t) end,
  Warn = function(t) journal[#journal + 1] = "WARN " .. tostring(t) end,
  Error = function(t) journal[#journal + 1] = "ERR " .. tostring(t) end,
}

local maintenant = 1000000
Server = { GetTime = function() return maintenant end }
local delais, intervalles, prochain_id = {}, {}, 0
Timer = {
  SetInterval = function(fn, ms) intervalles[#intervalles + 1] = { fn = fn, ms = ms, du = maintenant + ms } end,
  SetTimeout = function(fn, ms) prochain_id = prochain_id + 1; delais[prochain_id] = { fn = fn, du = maintenant + ms }; return prochain_id end,
}
local function avancer(ms)
  local fin = maintenant + ms
  while (maintenant < fin) do
    maintenant = maintenant + 50
    -- Les échus sont relevés AVANT d'être appelés : un délai en pose d'autres
    -- (fondu d'une particule), et on n'ajoute pas à une table qu'on parcourt.
    local echus = {}
    for id, d in pairs(delais) do
      if (maintenant >= d.du) then echus[#echus + 1] = id end
    end
    for _, id in ipairs(echus) do
      local d = delais[id]
      delais[id] = nil
      d.fn()
    end
    for _, i in ipairs(intervalles) do
      if (maintenant >= i.du) then i.du = i.du + i.ms; i.fn() end
    end
  end
end

local distants, recepteurs = {}, {}
Events = {
  CallRemote = function(nom, joueur, fiab, charge) distants[#distants + 1] = { nom = nom, joueur = joueur, charge = charge } end,
  SubscribeRemote = function(nom, fn) recepteurs[nom] = fn end,
}
local function compter_distants(nom, joueur)
  local n = 0
  for _, d in ipairs(distants) do if (d.nom == nom and (joueur == nil or d.joueur == joueur)) then n = n + 1 end end
  return n
end
local function dernier_distant(nom)
  for i = #distants, 1, -1 do if (distants[i].nom == nom) then return distants[i] end end
  return nil
end

local abonnes = {}
local personnages, simples = {}, {}
local function Classe(nom, liste)
  return {
    Subscribe = function(ev, fn) abonnes[nom .. ":" .. ev] = abonnes[nom .. ":" .. ev] or {}; table.insert(abonnes[nom .. ":" .. ev], fn) end,
    GetAll = function() return liste end,
  }
end
local function emettre(nom, ev, ...) for _, fn in ipairs(abonnes[nom .. ":" .. ev] or {}) do fn(...) end end
Character = Classe("Character", personnages)
CharacterSimple = Classe("CharacterSimple", simples)
Player = Classe("Player", {})

local particules = {}
Particle = function(position, rotation, asset)
  local p = { asset = asset, valide = true }
  function p:IsValid() return self.valide end
  function p:Destroy() self.valide = false end
  function p:Deactivate() end
  function p:SetScale() end
  function p:AttachTo() end
  function p:TranslateTo() end
  particules[#particules + 1] = p
  return p
end

local function Corps(liste, x, y, lacet)
  local e = { pos = Vector(x, y, 0), rot = Rotator(0, lacet or 0, 0), vie = 500, vie_max = 500, valide = true, coups = {}, gestes = {} }
  function e:IsValid() return self.valide end
  function e:IsDead() return self.vie <= 0 end
  function e:GetLocation() return Vector(self.pos.X, self.pos.Y, self.pos.Z) end
  function e:GetRotation() return self.rot end
  function e:GetPicked() return nil end
  function e:GetValue() return nil end
  function e:GetHealth() return self.vie end
  function e:GetMaxHealth() return self.vie_max end
  function e:SetHealth(v) self.vie = v end
  function e:PlayAnimation(chemin, slot) self.gestes[#self.gestes + 1] = { chemin = chemin, slot = slot } end
  function e:ApplyDamage(d, os, genre, direction, instigateur, causeur)
    self.coups[#self.coups + 1] = { degats = d, instigateur = instigateur, causeur = causeur }
    self.vie = self.vie - d
  end
  liste[#liste + 1] = e
  return e
end

local function Joueur(nom, corps)
  local j = { nom = nom, valide = true, corps = corps }
  function j:IsValid() return self.valide end
  function j:GetName() return self.nom end
  function j:GetControlledCharacter() return self.corps end
  return j
end

-- ── Narvos réel ───────────────────────────────────────────────────────────────
Narvos = {}
Narvos.Spells = (function() ${lire("narvos/Shared/Catalogs/Spells.lua")} end)()
Narvos.Classes = (function() ${lire("narvos/Shared/Catalogs/Classes.lua")} end)()
Narvos.Vfx = (function() ${lire("narvos/Shared/Catalogs/Vfx.lua")} end)()
Narvos.SortsVfx = (function() ${lire("narvos/Shared/Catalogs/SortsVfx.lua")} end)()
Narvos.Sorts = (function() ${lire("narvos/Shared/Logic/Sorts.lua")} end)()

local sessions, hors_jeu = {}, {}
Narvos.SessionServeur = {
  De = function(p) return sessions[p] end,
  EnJeu = function(p) return sessions[p] ~= nil and not hors_jeu[p] end,
}

local S = (function() ${lire("narvos-map-proto/Server/Sorts.lua")} end)()
local Logique = Narvos.Sorts
S.JOURNAL = false

-- Attente qui couvre toute libération de geste (plafonnée à 900 ms par les règles).
local LIBERATION_MAX_MS = 1000

-- ── 1. Sort de base (bruiser, emplacement 1) : la cible DEVANT encaisse ──────
local bruiser = Joueur("Bruiser", Corps(personnages, 0, 0, 0))
sessions[bruiser] = { perso = { classId = "warrior_bruiser" } }
local base = Logique.ParEmplacement("warrior_bruiser", 1)
ok(base ~= nil and base.archetype == "basic", "catalogue : l'emplacement 1 du bruiser est un sort de base")

local devant = Corps(personnages, base.range * 100 - 150, 0)
local derriere = Corps(personnages, -150, 0)
local etat = S.Etat(bruiser)
ok(etat ~= nil, "etat cree a la demande depuis la classe de la session")
local mana_avant = etat.mana

egal(select(1, S.LancerEmplacement(bruiser, 1)), true, "sort de base : lance")
egal(etat.mana, mana_avant - base.manaCost, "le mana est paye au lancement")
egal(#bruiser.corps.gestes, 1, "un geste est joue")
egal(bruiser.corps.gestes[1].slot, AnimationSlotType.UpperBody, "le geste ne prend que le haut du corps")
avancer(LIBERATION_MAX_MS)
egal(#devant.coups, 1, "la cible devant encaisse une fois")
ok(devant.coups[1].degats > 0, "les degats sont positifs")
egal(devant.coups[1].instigateur, bruiser, "l'instigateur est le JOUEUR (XP, quetes)")
egal(devant.coups[1].causeur, bruiser.corps, "le causeur est son corps")
egal(#derriere.coups, 0, "la cible derriere n'encaisse rien")
egal(#bruiser.corps.coups, 0, "le lanceur ne se frappe pas")

-- ── 2. Recharge : refus sans payer ───────────────────────────────────────────
local mana_apres = etat.mana
local ok2, raison2 = S.LancerEmplacement(bruiser, 1)
ok(ok2 == false and type(raison2) == "string", "relance immediate : refusee avec une raison")
egal(etat.mana, mana_apres, "un refus ne coute pas de mana")
avancer(LIBERATION_MAX_MS)
egal(#devant.coups, 1, "un refus ne frappe pas")

-- ── 3. Zone (emplacement 2) : centree a la portee, dans le rayon ─────────────
local zone = Logique.ParEmplacement("warrior_bruiser", 2)
ok(zone ~= nil and zone.archetype == "aoe", "catalogue : l'emplacement 2 du bruiser est une zone")
local dans_zone = Corps(simples, zone.range * 100, (zone.aoeRadius * 100) - 100)
local hors_zone = Corps(personnages, zone.range * 100 + zone.aoeRadius * 100 + 500, 0)
egal(select(1, S.LancerEmplacement(bruiser, 2)), true, "zone : lancee")
avancer(LIBERATION_MAX_MS)
egal(#dans_zone.coups, 1, "zone : un CharacterSimple dans le rayon encaisse")
egal(#hors_zone.coups, 0, "zone : hors du rayon, rien")
egal(#bruiser.corps.coups, 0, "zone : le lanceur est epargne")

-- ── 4. Un mort ne lance rien et ne paie rien ─────────────────────────────────
local mort = Joueur("Mort", Corps(personnages, 50000, 0, 0))
sessions[mort] = { perso = { classId = "warrior_bruiser" } }
local etat_mort = S.Etat(mort)
local mana_mort = etat_mort.mana
mort.corps.vie = 0
local okm, rm = S.LancerEmplacement(mort, 1)
ok(okm == false and type(rm) == "string", "un mort : refuse")
egal(etat_mort.mana, mana_mort, "un mort : aucun mana paye")

-- ── 5. Lanceur tue pendant le geste : la liberation n'a pas lieu ─────────────
local fauche = Joueur("Fauche", Corps(personnages, 100000, 0, 0))
sessions[fauche] = { perso = { classId = "warrior_bruiser" } }
local proie = Corps(personnages, 100000 + base.range * 100 - 150, 0)
egal(select(1, S.LancerEmplacement(fauche, 1)), true, "lance avant de mourir")
if (#proie.coups == 0) then
  fauche.corps.vie = 0
  avancer(LIBERATION_MAX_MS)
  egal(#proie.coups, 0, "mort pendant le geste : aucun degat libere")
else
  ok(true, "liberation immediate pour ce geste : cas sans objet")
end

-- ── 6. Projectile (dps, emplacement 1) : les degats tombent A L'ARRIVEE ──────
local dps = Joueur("Dps", Corps(personnages, 200000, 0, 0))
sessions[dps] = { perso = { classId = "warrior_dps" } }
local tir = Logique.ParEmplacement("warrior_dps", 1)
ok(tir ~= nil and tir.archetype == "projectile", "catalogue : l'emplacement 1 du dps est un projectile")
local lointain = Corps(personnages, 200000 + tir.range * 100 - 200, 0)
egal(select(1, S.LancerEmplacement(dps, 1)), true, "projectile : lance")
local vol_ms = math.floor(Logique.TempsDeVol(tir.range * 100 - 200, tir.speed * 100) * 1000)
ok(vol_ms > 200, "le vol dure (" .. tostring(vol_ms) .. " ms)")
avancer(LIBERATION_MAX_MS + vol_ms + 200)
egal(#lointain.coups, 1, "projectile : la cible encaisse apres le vol")

-- ── 7. Reseau ────────────────────────────────────────────────────────────────
ok(type(recepteurs["Narvos:LancerSort"]) == "function" and type(recepteurs["Narvos:DemanderSorts"]) == "function", "recepteurs reseau poses")

local absent = Joueur("Absent", Corps(personnages, 300000, 0, 0))
sessions[absent] = { perso = { classId = "warrior_bruiser" } }
hors_jeu[absent] = true
recepteurs["Narvos:LancerSort"](absent, 1)
egal(#absent.corps.gestes, 0, "hors jeu : rien ne part")
egal(compter_distants("Narvos:Sorts", absent), 0, "hors jeu : rien n'est envoye")
hors_jeu[absent] = false

local avant_err = compter_distants("Narvos:SortErreur", absent)
recepteurs["Narvos:LancerSort"](absent, 4)
egal(compter_distants("Narvos:SortErreur", absent), avant_err + 1, "emplacement vide : l'erreur est envoyee au client")
recepteurs["Narvos:LancerSort"](absent, "n'importe quoi")
egal(compter_distants("Narvos:SortErreur", absent), avant_err + 2, "emplacement non numerique : refuse sans lever")

recepteurs["Narvos:DemanderSorts"](absent)
local barre = dernier_distant("Narvos:Sorts")
ok(barre ~= nil and barre.joueur == absent and type(barre.charge.barre) == "table"
   and type(barre.charge.mana) == "number" and type(barre.charge.mana_max) == "number",
   "la barre envoyee porte barre, mana et mana_max")

-- ── 8. Regeneration : le mana remonte avec le temps reel, borne au maximum ───
local bas = etat.mana
ok(bas < etat.mana_max, "(le bruiser a depense du mana)")
avancer(S.PAS_REGEN_MS * 4)
ok(etat.mana > bas, "le mana remonte")
avancer(600000)
egal(etat.mana, etat.mana_max, "le mana est borne a son maximum")

-- ── 9. Consommables et purge ─────────────────────────────────────────────────
bruiser.corps.vie = 100
egal(S.Soigner(bruiser, 9999), true, "Soigner : applique")
egal(bruiser.corps.vie, bruiser.corps.vie_max, "Soigner : borne a la vie maximale")
etat.mana = 0
egal(S.AjouterMana(bruiser, 10), 10, "AjouterMana : rend la quantite ajoutee")
egal(S.AjouterMana(bruiser, -5), 0, "AjouterMana : une quantite negative ne retire rien")

emettre("Player", "Destroy", bruiser)
ok(S.Etat(bruiser) ~= etat, "deconnexion : l'etat est purge (un nouvel etat est cree au retour)")

return { reussis = reussis, echecs = echecs, messages = messages }
`);
} catch (e) {
  console.error("ERREUR LUA :", e.message);
  process.exit(1);
}
const resultat = { reussis: sortie.reussis, echecs: sortie.echecs, messages: sortie.messages };
lua.global.close();
for (const m of Object.values(resultat.messages || {})) console.error(m);
console.log(`sorts-serveur : ${resultat.reussis} assertion(s) reussie(s), ${resultat.echecs} echec(s)`);
process.exitCode = resultat.echecs > 0 || resultat.reussis === 0 ? 1 : 0;
