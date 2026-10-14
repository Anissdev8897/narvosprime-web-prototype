import { RACINE_DEPOT } from "./_racine.mjs";
// zaaps.mjs — harnais de Logic/Zaaps.lua (points de sauvegarde, purs) branché sur
// les VRAIES règles de Logic/Teleports.lua, et du catalogue Catalogs/Zaaps.lua.
//
//   node scripts/lua-harness/zaaps.mjs
//
// Prouve les RÈGLES (création, bornes, arrivée après la mort) et l'aller-retour
// du fichier écrit par le jeu. L'activation réelle (déclencheur, touche, base) est
// prouvée par zaaps-serveur.mjs ; ce qu'on VOIT ne se lit qu'en jeu.
import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const SHARED = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const zaaps = fs.readFileSync(`${SHARED}/Logic/Zaaps.lua`, "utf8");
const teleports = fs.readFileSync(`${SHARED}/Logic/Teleports.lua`, "utf8");
const catalogue = fs.readFileSync(`${SHARED}/Catalogs/Zaaps.lua`, "utf8");

const lua = await new LuaFactory().createEngine();
let reussis = 0;
let echecs = 0;
lua.global.set("verifier", (cond, msg) => {
  if (cond) reussis += 1;
  else { echecs += 1; console.error("ECHEC :", msg); }
});
lua.global.set("ZAAPS_TEXTE", zaaps);
lua.global.set("TELEPORTS_TEXTE", teleports);
lua.global.set("CATALOGUE_TEXTE", catalogue);

const script = `
Package = { Require = function(p) error("Package.Require inattendu : " .. tostring(p)) end }
Narvos = { Teleports = load(TELEPORTS_TEXTE)() }
local Z = load(ZAAPS_TEXTE)()

-- Le catalogue livre se relit sans refus.
local reel = load(CATALOGUE_TEXTE)()
local l0, r0 = Z.Charger(reel)
verifier(type(reel.LISTE) == "table" and #r0 == 0 and #l0 == #reel.LISTE, "catalogue livre : se relit sans refus")

-- Creer : rayon propre aux zaaps, jamais de destination.
local l1, id1 = Z.Creer({}, { nom = "Zaap d'Akarlys", monde = "capitale", x = 1000, y = -2000, z = 90, yaw = 90,
    vers = "ailleurs", dest = { monde = "foret", x = 0, y = 0, z = 0 } })
verifier(l1 ~= nil and id1 == "zaap_d_akarlys", "creer : identifiant tire du nom (" .. tostring(id1) .. ")")
verifier(l1[1].rayon == Z.RAYON_DEFAUT, "creer : rayon par defaut des zaaps (" .. tostring(l1[1].rayon) .. ")")
verifier(l1[1].rayon ~= Narvos.Teleports.RAYON_DEFAUT, "le rayon d'un zaap n'est PAS celui d'un teleport")
verifier(l1[1].vers == nil and l1[1].dest == nil, "creer : un zaap ne mene nulle part (vers/dest retires)")
local l2, id2 = Z.Creer(l1, { nom = "Zaap d'Akarlys", monde = "capitale", x = 0, y = 0, z = 0 })
verifier(id2 == "zaap_d_akarlys_2" and #l1 == 1 and #l2 == 2, "creer : identifiant unique, liste d'origine intacte")
verifier(Z.Creer({}, { nom = "", monde = "capitale", x = 0, y = 0, z = 0 }) == nil, "creer : nom vide refuse")
verifier(Z.Creer({}, { nom = "x", monde = "capitale", x = 0/0, y = 0, z = 0 }) == nil, "creer : NaN refuse")
verifier(Z.Creer({}, { nom = "x", monde = "../etc", x = 0, y = 0, z = 0 }) == nil, "creer : monde invalide refuse")
verifier(Z.Creer({}, nil) == nil, "creer : champs absents refuses")
local lr = Z.Creer({}, { nom = "Grand", monde = "capitale", x = 0, y = 0, z = 0, rayon = 5 })
verifier(lr[1].rayon == Narvos.Teleports.RAYON_MIN, "creer : rayon borne par les regles communes")
local champs = { nom = "Source", monde = "capitale", x = 1, y = 2, z = 3 }
Z.Creer({}, champs)
verifier(champs.rayon == nil, "creer : les champs de l'appelant ne sont pas modifies")

-- Identifiants : la forme que la base accepte.
verifier(Z.IdValide("zaap_nord") == "zaap_nord", "IdValide : cle acceptee")
verifier(Z.IdValide("") == nil and Z.IdValide(nil) == nil and Z.IdValide(7) == nil, "IdValide : vide / absent / nombre refuses")
verifier(Z.IdValide("x'; DROP TABLE personnages; --") == nil, "IdValide : injection refusee")
verifier(Z.IdValide(string.rep("a", Z.ID_MAX + 1)) == nil, "IdValide : trop long refuse")
local long_nom = string.rep("Tres long nom de zaap ", 5)
local _, id_long = Z.Creer({}, { nom = long_nom, monde = "capitale", x = 0, y = 0, z = 0 })
verifier(Z.IdValide(id_long) ~= nil, "un identifiant CREE tient toujours dans la base (" .. tostring(id_long) .. ")")

-- Renommer / Deplacer / Supprimer.
local ln = Z.Renommer(l2, id1, "Zaap du port")
verifier(ln[1].nom == "Zaap du port" and ln[1].id == id1 and l2[1].nom == "Zaap d'Akarlys", "renommer : id stable, immutable")
verifier(Z.Renommer(l2, "absent", "x") == nil, "renommer : zaap inconnu")
local ld = Z.Deplacer(l2, id1, { monde = "foret", x = 5, y = 6, z = 7, yaw = 180 })
verifier(ld[1].monde == "foret" and ld[1].x == 5 and l2[1].x == 1000, "deplacer : nouvelle position, immutable")
verifier(Z.Deplacer(l2, id1, { monde = "foret", x = 1e12, y = 0, z = 0 }) == nil, "deplacer : hors bornes refuse")
local ls = Z.Supprimer(l2, id1)
verifier(#ls == 1 and ls[1].id == id2 and #l2 == 2, "supprimer : retire, immutable")
verifier(Z.Supprimer(l2, "absent") == nil, "supprimer : zaap inconnu")

-- Arrivee apres la mort : devant le zaap, dans l'axe de son lacet.
local a = Z.Arrivee(l1, id1)   -- yaw 90 : +Y
verifier(a and a.monde == "capitale", "arrivee : meme monde")
verifier(math.abs(a.x - 1000) < 0.001 and math.abs(a.y - (-2000 + Z.RECUL_ARRIVEE)) < 0.001 and a.z == 90,
    "arrivee : RECUL_ARRIVEE devant, dans l'axe du lacet (" .. tostring(a.x) .. ", " .. tostring(a.y) .. ")")
verifier(a.yaw == 90, "arrivee : regarde dans le sens du zaap")
local a0 = Z.Arrivee(Z.Creer({}, { nom = "Est", monde = "capitale", x = 0, y = 0, z = 0, yaw = 0 }), "est")
verifier(math.abs(a0.x - Z.RECUL_ARRIVEE) < 0.001 and math.abs(a0.y) < 0.001, "arrivee : lacet 0 -> +X")
local dist = math.sqrt((a.x - 1000) ^ 2 + (a.y + 2000) ^ 2)
verifier(dist < l1[1].rayon, "arrivee : dans le cercle d'activation (l'invite rappelle le zaap)")
verifier(Z.Arrivee(l1, "absent") == nil, "arrivee : zaap inconnu -> nil")
verifier(select(2, Z.Arrivee(l1, "absent")):find("absent") ~= nil, "arrivee : la raison nomme l'identifiant")

-- Aller-retour du fichier : ce que le jeu ecrit, le jeu le relit a l'identique.
local fichier = Z.Catalogue(l2)
verifier(fichier:find("Zaaps.LISTE", 1, true) ~= nil and fichier:find("2 zaap(s)", 1, true) ~= nil, "catalogue : en-tete et compte")
verifier(fichier:find("vers =", 1, true) == nil and fichier:find("dest =", 1, true) == nil, "catalogue : aucune destination ecrite")
local relu, refus = Z.Charger(load(fichier)())
verifier(#refus == 0 and #relu == 2, "catalogue : relu sans refus")
local r1 = Z.Trouver(relu, id1)
verifier(r1 and r1.nom == "Zaap d'Akarlys" and r1.x == 1000 and r1.y == -2000 and r1.yaw == 90 and r1.rayon == Z.RAYON_DEFAUT,
    "catalogue : champs identiques apres relecture")
verifier(Z.Catalogue(l2) == Z.Catalogue({ l2[2], l2[1] }), "catalogue : ordre stable (diff lisible)")
local piege = Z.Creer({}, { nom = 'Guillemet " et ]] fin', monde = "capitale", x = 0, y = 0, z = 0 })
local relu_piege = Z.Charger(load(Z.Catalogue(piege))())
verifier(relu_piege[1] and relu_piege[1].nom == 'Guillemet " et ]] fin', "catalogue : nom avec guillemets et crochets relu intact")

-- Chargement defensif.
local sale = { LISTE = {
    { id = "ok_1", nom = "Bon", monde = "capitale", x = 0, y = 0, z = 0, yaw = 0, rayon = 300 },
    { id = "sans_nom", monde = "capitale", x = 0, y = 0, z = 0 },
    { id = "ok_1", nom = "Doublon", monde = "capitale", x = 0, y = 0, z = 0 },
    { id = string.rep("b", 50), nom = "Trop long", monde = "capitale", x = 0, y = 0, z = 0 },
    { id = "avec_vers", nom = "Vers", monde = "capitale", x = 0, y = 0, z = 0, vers = "ok_1" },
    "pas une table",
} }
local propre, refus_sale = Z.Charger(sale)
verifier(#propre == 2 and propre[1].id == "ok_1" and propre[2].id == "avec_vers", "charger : seules les entrees valides restent")
verifier(propre[2].vers == nil, "charger : un 'vers' de fichier est retire")
verifier(#refus_sale == 4, "charger : chaque ecart est NOMME (" .. tostring(#refus_sale) .. ")")
verifier(#Z.Charger(nil) == 0 and #Z.Charger({}) == 0, "charger : catalogue absent -> liste vide")
`;

try {
  await lua.doString(script);
} catch (e) {
  echecs += 1;
  console.error("ERREUR LUA :", e.message);
}
lua.global.close();
console.log(`zaaps : ${reussis} assertion(s) reussie(s), ${echecs} echec(s)`);
process.exitCode = echecs > 0 || reussis === 0 ? 1 : 0;