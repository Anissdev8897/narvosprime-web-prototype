// zaaps-serveur.mjs — harnais des EXÉCUTANTS des Zaaps et de la réapparition
// (narvos-map-proto/Server/Zaaps.lua + Server/Reapparition.lua) branchés sur les
// VRAIES règles (Logic/Zaaps, Logic/Teleports, Logic/Reapparition, Logic/Depart)
// et le VRAI catalogue des mondes.
//
//   node scripts/lua-harness/zaaps-serveur.mjs
//
// ── POURQUOI (2026-09-15, décision D4) ─────────────────────────────────────────
// Les règles pures ont leurs harnais (zaaps.mjs, reapparition.mjs) ; aucun
// n'exécute les exécutants. Celui-ci le fait avec des doublures d'entités et
// prouve la CHAÎNE demandée par Hanibes : poser un Zaap (garde, catalogue écrit)
// → entrer dans son cercle → l'activer (distance revérifiée, base écrite AVANT
// l'annonce) → mourir → réapparaître SEUL au Zaap, sinon à la cité ; /revive
// conservé ; aucune double réapparition.
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
local function proche_de(a, b, nom) ok(math.abs((a or 0/0) - b) < 0.01, nom .. " (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")") end

-- ── Moteur simulé ───────────────────────────────────────────────────────────────
Vector = function(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end
Rotator = function(p, y, r) return { Pitch = p or 0, Yaw = y or 0, Roll = r or 0 } end
Color = function(r, g, b, a) return { R = r, G = g, B = b, A = a } end
Reliability = { Unreliable = 0, Reliable = 1 }
TriggerType = { Sphere = 0, Box = 1 }
CollisionType = { NoCollision = 2 }
local journal = {}
Console = { Log = function(t) journal[#journal + 1] = t end, Warn = function(t) journal[#journal + 1] = "WARN " .. t end, Error = function(t) journal[#journal + 1] = "ERR " .. t end }
Package = { Require = function(p) error("Package.Require inattendu : " .. tostring(p)) end }

local maintenant = 0
Server = { GetTime = function() return maintenant end }
local delais, lies, prochain_id = {}, {}, 0
Timer = {
  SetInterval = function(fn, ms) end,
  SetTimeout = function(fn, ms) prochain_id = prochain_id + 1; delais[prochain_id] = { fn = fn, du = maintenant + ms }; return prochain_id end,
  Bind = function(id, acteur) lies[id] = acteur end,
}
local function avancer(ms)
  local fin = maintenant + ms
  while (maintenant < fin) do
    maintenant = maintenant + 100
    for id, d in pairs(delais) do
      if (lies[id] and not lies[id]:IsValid()) then delais[id] = nil
      elseif (maintenant >= d.du) then delais[id] = nil; d.fn() end
    end
  end
end

local distants, diffuses, recepteurs = {}, {}, {}
Events = {
  CallRemote = function(nom, joueur, fiab, charge) distants[#distants + 1] = { nom = nom, joueur = joueur, fiab = fiab, charge = charge } end,
  BroadcastRemote = function(nom, fiab, charge) diffuses[#diffuses + 1] = { nom = nom, fiab = fiab, charge = charge } end,
  SubscribeRemote = function(nom, fn) recepteurs[nom] = fn end,
}
local function dernier_distant(nom)
  for i = #distants, 1, -1 do if (distants[i].nom == nom) then return distants[i] end end
  return nil
end
local chat = {}
Chat = { SendMessage = function(joueur, texte) chat[#chat + 1] = texte end }

local abonnes = {}
local function Classe(nom)
  return { nom = nom, Subscribe = function(ev, fn) abonnes[nom .. ":" .. ev] = abonnes[nom .. ":" .. ev] or {}; table.insert(abonnes[nom .. ":" .. ev], fn) end }
end
local function emettre(nom, ev, ...) for _, fn in ipairs(abonnes[nom .. ":" .. ev] or {}) do fn(...) end end
Character = Classe("Character")
Player = Classe("Player")

local declencheurs = {}
Trigger = function(position, rotation, etendue, genre, visible, couleur, classes)
  local t = { position = position, rayon = etendue.X, classes = classes, valide = true, fn = {} }
  function t:Subscribe(ev, fn) self.fn[ev] = fn end
  function t:IsValid() return self.valide end
  function t:Destroy() self.valide = false end
  declencheurs[#declencheurs + 1] = t
  return t
end
StaticMesh = function() local m = { valide = true }; function m:IsValid() return self.valide end; function m:Destroy() self.valide = false end; function m:SetScale() end; return m end

local function Corps(x, y, z, joueur)
  local e = { pos = Vector(x, y, z), vie = 132, vie_max = 132, valide = true, joueur = joueur, respawns = {}, rot = Rotator(0, 12, 0) }
  function e:IsValid() return self.valide end
  function e:IsDead() return self.vie <= 0 end
  function e:GetLocation() return Vector(self.pos.X, self.pos.Y, self.pos.Z) end
  function e:SetLocation(v) self.pos = Vector(v.X, v.Y, v.Z) end
  function e:GetRotation() return self.rot end
  function e:SetRotation(r) self.rot = r end
  function e:GetHealth() return self.vie end
  function e:GetMaxHealth() return self.vie_max end
  function e:SetHealth(v) self.vie = v end
  function e:GetPlayer() return self.joueur end
  function e:Respawn(p, r) self.respawns[#self.respawns + 1] = { p = p, r = r }; self.pos = Vector(p.X, p.Y, p.Z); self.rot = r end
  function e:Mourir() self.vie = 0; emettre("Character", "Death", self) end
  return e
end

local function Joueur(nom)
  local j = { nom = nom, valide = true }
  function j:IsValid() return self.valide end
  function j:GetName() return self.nom end
  function j:GetControlledCharacter() return self.corps end
  return j
end

-- ── Narvos réel ───────────────────────────────────────────────────────────────
Narvos = {}
Narvos.Mondes = (function() ${lire("narvos/Shared/Catalogs/Mondes.lua")} end)()
Narvos.Voyage = (function() ${lire("narvos/Shared/Logic/Voyage.lua")} end)()
Narvos.Depart = (function() ${lire("narvos/Shared/Logic/Depart.lua")} end)()
Narvos.Teleports = (function() ${lire("narvos/Shared/Logic/Teleports.lua")} end)()
Narvos.TeleportsCatalogue = { LISTE = {} }
Narvos.Zaaps = (function() ${lire("narvos/Shared/Logic/Zaaps.lua")} end)()
Narvos.ZaapsCatalogue = { LISTE = {} }
Narvos.Reapparition = (function() ${lire("narvos/Shared/Logic/Reapparition.lua")} end)()

local mondes_charges = {}
Narvos.VoyageServeur = { Charger = function(id) mondes_charges[#mondes_charges + 1] = id; return true end }

local sessions = {}
Narvos.SessionServeur = { De = function(p) return sessions[p] end }

Narvos.TeleportsServeur = (function() ${lire("narvos-map-proto/Server/Teleports.lua")} end)()
Narvos.ZaapsServeur = (function() ${lire("narvos-map-proto/Server/Zaaps.lua")} end)()
Narvos.ReapparitionServeur = (function() ${lire("narvos-map-proto/Server/Reapparition.lua")} end)()
local Z, R = Narvos.ZaapsServeur, Narvos.ReapparitionServeur

-- ── Le monde de l'essai : Akarlys (capitale), le joueur a choisi la foret ─────
local capitale = Narvos.Mondes.Trouver("capitale")
local foret = Narvos.Mondes.Trouver("foret")
ok(capitale and capitale.arrivee and foret and foret.arrivee, "catalogue : capitale et foret ont une arrivee")
local base = capitale.arrivee

local admin = Joueur("Hanibes")
admin.corps = Corps(base.X + 500, base.Y, base.Z, admin)
local joueur = Joueur("Aventurier")
joueur.corps = Corps(base.X + 3000, base.Y + 3000, base.Z, joueur)
sessions[joueur] = { compte = { id = 7 }, perso = { id = "p1", cite = "foret" } }
sessions[admin] = { compte = { id = 1 }, perso = { id = "a1", cite = "capitale" } }

local ecrits, enregistrements = {}, {}
local panne_base = false
Z.Configurer({
  joueur_de = function(acteur) return acteur and acteur.joueur or nil end,
  peut_gerer = function(p) return p == admin end,
  ecrire = function(nom, contenu) ecrits[#ecrits + 1] = { nom = nom, contenu = contenu }; return "Catalogs/" .. nom end,
  charger_monde = function(id) mondes_charges[#mondes_charges + 1] = id end,
  perso_de = function(p) return sessions[p] and sessions[p].perso or nil end,
  enregistrer = function(p, id)
    if (panne_base) then return false, "Base indisponible" end
    enregistrements[#enregistrements + 1] = { joueur = p, id = id }
    return true
  end,
})
Z.Charger()
ok(journal[#journal]:find("0 zaap", 1, true) ~= nil, "chargement : le journal compte les zaaps (" .. tostring(journal[#journal]) .. ")")

-- ── 1. Poser : garde fermee, catalogue ecrit, liste diffusee ─────────────────
local refus, raison = Z.Editer(joueur, "Creer", "Zaap pirate")
ok(refus == false and raison:find("administrateurs", 1, true), "un joueur ordinaire ne pose pas de zaap")
egal(#ecrits, 0, "le refus n'a rien ecrit")
egal(select(1, Z.Editer(admin, "Inexistante")), false, "operation inconnue refusee")

admin.corps.rot = Rotator(0, 90, 0)
local cree, msg = Z.Editer(admin, "Creer", "Zaap du port")
ok(cree == true and msg:find("zaap_du_port", 1, true), "l'administrateur pose un zaap (" .. tostring(msg) .. ")")
egal(#declencheurs, 1, "un declencheur par zaap")
local t = declencheurs[1]
egal(t.rayon, Narvos.Zaaps.RAYON_DEFAUT, "declencheur : rayon d'activation")
ok(t.classes and t.classes[1] == "Character", "declencheur : personnages seulement")
proche_de(t.position.X, admin.corps.pos.X, "declencheur : pose ou se tient l'administrateur (X)")
egal(ecrits[#ecrits].nom, "Zaaps.lua", "catalogue ecrit dans Zaaps.lua")
local relu = Narvos.Zaaps.Charger(load(ecrits[#ecrits].contenu)())
ok(#relu == 1 and relu[1].id == "zaap_du_port" and relu[1].monde == "capitale", "le fichier ecrit se relit (monde capitale)")
proche_de(relu[1].x + (Narvos.Mondes.DECALAGES.capitale or Vector()).X, admin.corps.pos.X, "coordonnees LOCALES au monde dans le fichier")
local d = diffuses[#diffuses]
ok(d and d.nom == "Narvos:Zaap:Liste" and #d.charge.points == 1 and d.charge.actif == nil, "liste diffusee a tous, sans 'actif' (propre a chacun)")
egal(d.fiab, Reliability.Reliable, "diffusion fiable")

-- ── 2. Entrer dans le cercle, activer ────────────────────────────────────────
local av = Z.Activer(joueur, "zaap_du_port")
egal(av, false, "hors du cercle : aucun zaap a activer")

t.fn.BeginOverlap(t, joueur.corps)
local pr = dernier_distant("Narvos:Zaap:Proche")
ok(pr and pr.joueur == joueur and pr.charge.id == "zaap_du_port" and pr.charge.actif == false, "entree : invite envoyee, zaap pas encore actif")

-- Le client ment : il se dit dans le cercle mais le corps est a 30 m.
local oka, ra = Z.Activer(joueur, "zaap_du_port")
ok(oka == false and ra:find("loin", 1, true), "distance revérifiee par le serveur (" .. tostring(ra) .. ")")
egal(#enregistrements, 0, "trop loin : rien d'ecrit")

joueur.corps.pos = Vector(t.position.X + 100, t.position.Y, t.position.Z)
egal(select(1, Z.Activer(joueur, "autre_id")), false, "identifiant different du cercle : refuse")

panne_base = true
local okp, rp = Z.Activer(joueur, "zaap_du_port")
ok(okp == false and rp:find("non enregistre", 1, true), "base en panne : refus nomme")
egal(sessions[joueur].perso.zaap, nil, "base en panne : rien retenu en memoire non plus")
egal(dernier_distant("Narvos:Zaap:Actif"), nil, "base en panne : aucune annonce d'activation")
panne_base = false
maintenant = maintenant + 2000

local okb, nom, nouveau = Z.Activer(joueur, "zaap_du_port")
ok(okb == true and nom == "Zaap du port" and nouveau == true, "activation reussie")
egal(#enregistrements, 1, "la base est ecrite")
egal(enregistrements[1].id, "zaap_du_port", "... avec l'identifiant du zaap")
egal(sessions[joueur].perso.zaap, "zaap_du_port", "le personnage en jeu retient son zaap")
local act = dernier_distant("Narvos:Zaap:Actif")
ok(act and act.joueur == joueur and act.charge.nom == "Zaap du port", "annonce d'activation au joueur")
egal(dernier_distant("Narvos:Zaap:Proche").charge.actif, true, "l'invite passe a 'actif'")

local okc, _, nouveau2 = Z.Activer(joueur, "zaap_du_port")
ok(okc == true and nouveau2 == false and #enregistrements == 1, "re-activer le meme zaap : rien de reecrit")

local arr = Z.ArriveePour(joueur)
ok(arr and arr.nom == "Zaap du port" and arr.monde == "capitale", "ArriveePour : le zaap actif")
proche_de(arr.position.Y, t.position.Y + Narvos.Zaaps.RECUL_ARRIVEE, "ArriveePour : devant le zaap (lacet 90 -> +Y)")
egal(Z.ArriveePour(admin), nil, "un joueur sans zaap : ArriveePour nil")

-- Envoyer (a la possession d'un corps) : la liste ET l'actif de CE joueur.
emettre("Player", "Possess", joueur, joueur.corps)
local env = dernier_distant("Narvos:Zaap:Liste")
ok(env and env.joueur == joueur and env.charge.actif == "zaap_du_port" and #env.charge.points == 1, "possession : liste + zaap actif du joueur")
recepteurs["Narvos:Zaap:Demander"](admin)
egal(dernier_distant("Narvos:Zaap:Liste").charge.actif, "", "demande d'un joueur sans zaap : actif vide")

t.fn.EndOverlap(t, joueur.corps)
egal(dernier_distant("Narvos:Zaap:Proche").charge, false, "sortie du cercle : invite retiree")
egal(select(1, Z.Activer(joueur, "zaap_du_port")), false, "sorti du cercle : plus d'activation")

-- ── 3. Mourir : retour AUTOMATIQUE au zaap ───────────────────────────────────
joueur.corps.pos = Vector(base.X + 9000, base.Y - 4000, base.Z)
joueur.corps:Mourir()
local mort = dernier_distant("Narvos:Mort")
ok(mort and type(mort.charge) == "table" and mort.charge.lieu == "Zaap du port", "panneau de mort : retour au zaap annonce (" .. tostring(mort and mort.charge.lieu) .. ")")
egal(mort.charge.auto_ms, Narvos.Reapparition.DELAI_AUTO_MS, "panneau : delai automatique transmis")
egal(mort.charge.delai_ms, Narvos.Reapparition.DELAI_MIN_MS, "panneau : delai minimal transmis")

avancer(Narvos.Reapparition.DELAI_AUTO_MS - 500)
egal(#joueur.corps.respawns, 0, "avant l'echeance : toujours mort")
avancer(600)
egal(#joueur.corps.respawns, 1, "a l'echeance : releve SEUL")
local rs = joueur.corps.respawns[1]
proche_de(rs.p.X, arr.position.X, "releve au zaap (X)")
proche_de(rs.p.Y, arr.position.Y, "releve au zaap (Y)")
egal(rs.r.Yaw, 90, "releve tourne dans le sens du zaap")
egal(joueur.corps.vie, 66, "vie rendue : moitie")
egal(dernier_distant("Narvos:Mort").charge, false, "panneau de mort retire")
ok(journal[#journal]:find("automatique", 1, true) ~= nil, "journal : reapparition automatique nommee")

-- ── 4. /revive conserve, sans double reapparition ────────────────────────────
joueur.corps:Mourir()
local okr, rr = R.Revive(joueur, joueur)
ok(okr == false and rr:find("Encore", 1, true), "/revive trop tot : refuse (" .. tostring(rr) .. ")")
avancer(Narvos.Reapparition.DELAI_MIN_MS + 100)
egal(select(1, R.Revive(joueur, joueur)), true, "/revive apres le delai minimal : releve")
egal(#joueur.corps.respawns, 2, "une reapparition manuelle")
avancer(Narvos.Reapparition.DELAI_AUTO_MS)
egal(#joueur.corps.respawns, 2, "l'automatique du corps deja releve ne fait rien")

-- Mort, releve, remort AVANT l'echeance du premier minuteur : seul le second compte.
joueur.corps:Mourir()
avancer(Narvos.Reapparition.DELAI_MIN_MS + 100)
R.Revive(joueur, joueur)
avancer(1000)
joueur.corps:Mourir()
local avant = #joueur.corps.respawns
avancer(Narvos.Reapparition.DELAI_AUTO_MS - Narvos.Reapparition.DELAI_MIN_MS - 1000)
egal(#joueur.corps.respawns, avant, "le minuteur de la mort precedente ne releve pas la nouvelle")
avancer(Narvos.Reapparition.DELAI_AUTO_MS)
egal(#joueur.corps.respawns, avant + 1, "le minuteur de la nouvelle mort la releve, une fois")

-- Un administrateur releve un autre joueur tout de suite.
joueur.corps:Mourir()
egal(select(1, R.Revive(admin, joueur)), true, "/revive <joueur> par un administrateur : immediat")

-- ── 5. Zaap supprime : retour a la cite choisie au depart ───────────────────
egal(select(1, Z.Editer(admin, "Supprimer", "zaap_du_port")), true, "l'administrateur supprime le zaap")
egal(#declencheurs, 1, "(aucun nouveau declencheur)")
egal(t.valide, false, "le declencheur du zaap supprime est detruit")
egal(Z.ArriveePour(joueur), nil, "zaap supprime : plus d'arrivee")
egal(sessions[joueur].perso.zaap, "zaap_du_port", "la memoire du joueur n'est pas effacee (recreation possible)")
joueur.corps:Mourir()
ok(dernier_distant("Narvos:Mort").charge.lieu == foret.label, "panneau : retour a la cite (" .. tostring(dernier_distant("Narvos:Mort").charge.lieu) .. ")")
avancer(Narvos.Reapparition.DELAI_AUTO_MS + 100)
local der = joueur.corps.respawns[#joueur.corps.respawns]
ok(der.p == foret.arrivee, "releve SEUL a l'arrivee de la cite choisie au depart")

-- Corps detruit avant l'echeance : aucun minuteur ne le touche.
joueur.corps:Mourir()
local nb = #joueur.corps.respawns
joueur.corps.valide = false
avancer(Narvos.Reapparition.DELAI_AUTO_MS + 100)
egal(#joueur.corps.respawns, nb, "corps detruit : le minuteur lie ne s'execute pas")

-- ── 6. Edition : renommer, deplacer, aller ───────────────────────────────────
Z.Editer(admin, "Creer", "Zaap du marche")
egal(select(1, Z.Editer(admin, "Renommer", "zaap_du_marche", "Zaap de la place")), true, "renommer")
egal(Z.Liste()[1].nom, "Zaap de la place", "renomme dans la liste")
admin.corps.pos = Vector(base.X - 700, base.Y + 200, base.Z)
egal(select(1, Z.Editer(admin, "DeplacerIci", "zaap_du_marche")), true, "deplacer ici")
proche_de(declencheurs[#declencheurs].position.X, base.X - 700, "le declencheur suit le deplacement")
egal(select(1, Z.Editer(admin, "Aller", "zaap_du_marche")), true, "aller devant le zaap")
egal(select(1, Z.Editer(admin, "Aller", "inconnu")), false, "aller : zaap inconnu refuse")

-- Le reseau : un client ne passe que par les noms connus.
ok(type(recepteurs["Narvos:Zaap:Activer"]) == "function" and type(recepteurs["Narvos:Revive"]) == "function", "recepteurs reseau poses")
recepteurs["Narvos:Zaap:Activer"](joueur, "zaap_du_marche")
ok(dernier_distant("Narvos:Zaap:Refus") ~= nil, "activation hors cercle par le reseau : refus envoye au client")

return { reussis = reussis, echecs = echecs, messages = messages }
`);
} catch (e) {
  console.error("ERREUR LUA :", e.message);
  process.exit(1);
}
const resultat = { reussis: sortie.reussis, echecs: sortie.echecs, messages: sortie.messages };
lua.global.close();
for (const m of Object.values(resultat.messages || {})) console.error(m);
console.log(`zaaps-serveur : ${resultat.reussis} assertion(s) reussie(s), ${resultat.echecs} echec(s)`);
process.exitCode = resultat.echecs > 0 || resultat.reussis === 0 ? 1 : 0;