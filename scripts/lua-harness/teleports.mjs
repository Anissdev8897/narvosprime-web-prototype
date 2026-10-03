import { RACINE_DEPOT } from "./_racine.mjs";
// teleports.mjs — harnais de Logic/Teleports.lua (points de téléportation, purs)
// et du catalogue Catalogs/Teleports.lua (relu par le jeu ET par l'éditeur).
//
//   node scripts/lua-harness/teleports.mjs
//
// Prouve les RÈGLES et l'aller-retour du fichier ; le passage réel (déclencheur,
// SetLocation) ne se voit qu'en jeu — journal « [TP] … ».
import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const SHARED = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const logique = fs.readFileSync(`${SHARED}/Logic/Teleports.lua`, "utf8");
const catalogue = fs.readFileSync(`${SHARED}/Catalogs/Teleports.lua`, "utf8");

const factory = new LuaFactory();
const lua = await factory.createEngine();
let reussis = 0;
let echecs = 0;
lua.global.set("verifier", (cond, msg) => {
  if (cond) reussis += 1;
  else { echecs += 1; console.error("ECHEC :", msg); }
});
lua.global.set("CATALOGUE_TEXTE", catalogue);

const script = `
local T = (function()
${logique}
end)()

-- Le catalogue livre se charge et ne refuse rien.
local reel = load(CATALOGUE_TEXTE)()
local l0, r0 = T.Charger(reel)
verifier(type(reel.LISTE) == "table" and #r0 == 0, "catalogue livre : se relit sans refus")

-- Noms et identifiants.
verifier(T.NettoyerNom("  Tour\\tNord  ") == "TourNord", "nom : controles et blancs retires")
verifier(T.NettoyerNom("   ") == nil and T.NettoyerNom(nil) == nil and T.NettoyerNom(12) == nil, "nom vide refuse")
verifier(utf8.len(T.NettoyerNom(string.rep("é", 80))) == T.NOM_MAX, "nom tronque en CARACTERES, UTF-8 intact")
verifier(T.Slug("Entrée de la Tour !") == "entree_de_la_tour", "slug : accents et ponctuation")
verifier(T.Slug("!!!") == "tp", "slug vide -> tp")

-- Creer.
local l, id = T.Creer({}, { nom = "Entree tour", monde = "tower", x = 100, y = 200, z = 10, yaw = 90 })
verifier(l ~= nil and id == "entree_tour" and #l == 1 and l[1].rayon == T.RAYON_DEFAUT, "creer : id, rayon par defaut")
local l2, id2 = T.Creer(l, { nom = "Entree tour", monde = "tower", x = 0, y = 0, z = 0 })
verifier(id2 == "entree_tour_2" and #l == 1 and #l2 == 2, "creer : id unique, liste d'origine intacte")
verifier(T.Creer({}, { nom = "x", monde = "tower", x = 0 / 0, y = 0, z = 0 }) == nil, "creer : NaN refuse")
verifier(T.Creer({}, { nom = "x", monde = "tower", x = 1e9, y = 0, z = 0 }) == nil, "creer : hors bornes refuse")
-- La Megastructure est a 103,9 km de l'origine et n'a pas de decalage : ses
-- coordonnees locales SONT ses coordonnees monde. Un point pose a son arrivee
-- doit etre accepte.
verifier(T.Creer({}, { nom = "m", monde = "megastructure", x = -8511120, y = 10387420, z = 150100 }) ~= nil,
  "creer : un point a l'arrivee de la Megastructure est accepte")
verifier(T.Creer({}, { nom = "x", monde = "", x = 0, y = 0, z = 0 }) == nil, "creer : monde vide refuse")
verifier(T.Creer({}, { nom = "x", monde = "../x", x = 0, y = 0, z = 0 }) == nil, "creer : monde invalide refuse")
local lr = T.Creer({}, { nom = "r", monde = "tower", x = 0, y = 0, z = 0, rayon = 99999 })
verifier(lr[1].rayon == T.RAYON_MAX, "creer : rayon borne")
verifier(T.Creer({}, { nom = "y", monde = "tower", x = 0, y = 0, z = 0, yaw = 270 })[1].yaw == -90, "yaw normalise")

-- Renommer / Deplacer.
local ln = T.Renommer(l2, "entree_tour", "Porte de la tour")
verifier(ln[1].nom == "Porte de la tour" and ln[1].id == "entree_tour" and l2[1].nom == "Entree tour", "renommer : id stable, immutable")
verifier(T.Renommer(l2, "absent", "a") == nil, "renommer : point inconnu")
local ld = T.Deplacer(l2, "entree_tour", { monde = "tower", x = 5, y = 6, z = 7, yaw = 0 })
verifier(ld[1].x == 5 and l2[1].x == 100, "deplacer")

-- Destinations.
local sans, pourquoi = T.Destination(l2, "entree_tour")
verifier(sans == nil and pourquoi:find("pas encore de destination") ~= nil, "sans destination : refus nomme")
local lp = T.DefinirDestination(l2, "entree_tour", { monde = "tower", x = 900, y = 900, z = 50, yaw = 180 })
local d = T.Destination(lp, "entree_tour")
verifier(d and d.x == 900 and d.yaw == -180, "destination position libre")
verifier(T.DefinirDestination(l2, "entree_tour", { vers = "entree_tour" }) == nil, "vers soi-meme refuse")
verifier(T.DefinirDestination(l2, "entree_tour", { vers = "inconnu" }) == nil, "vers inconnu refuse")
local lv = T.DefinirDestination(l2, "entree_tour", { vers = "entree_tour_2" })
local dv = T.Destination(lv, "entree_tour")
verifier(dv and math.abs(dv.x - (T.RAYON_DEFAUT + T.RECUL_ARRIVEE)) < 1e-6 and dv.y == 0, "vers un point : arrivee DEVANT lui, hors du cercle")

-- Lier.
local ll, retour = T.Lier(lp, "entree_tour")
local pr = T.Trouver(ll, retour)
local ps = T.Trouver(ll, "entree_tour")
verifier(pr and pr.vers == "entree_tour" and ps.vers == retour and ps.dest == nil and pr.x == 900, "lier depuis une position : paire creee")
local l3, r3 = T.Lier(lv, "entree_tour")
verifier(r3 == "entree_tour_2" and T.Trouver(l3, "entree_tour_2").vers == "entree_tour", "lier depuis un point : il pointe en retour")
verifier(select(2, T.Lier(ll, "entree_tour")) == "deja relies", "lier deux fois : refus nomme")
verifier(T.Lier(l2, "entree_tour") == nil, "lier sans destination : refus")

-- Supprimer nettoie les liens.
local ls = T.Supprimer(ll, retour)
verifier(#ls == #ll - 1 and T.Trouver(ls, "entree_tour").vers == nil, "supprimer : liens vers lui effaces")

-- Aller-retour du fichier.
local texte = T.Catalogue(ll)
local relu, refus = T.Charger(load(texte)())
verifier(#refus == 0 and #relu == #ll, "catalogue : aller-retour sans perte")
verifier(T.Trouver(relu, retour).vers == "entree_tour", "catalogue : les liens survivent")
verifier(T.Catalogue(ll) == T.Catalogue(T.Copier(ll)), "catalogue deterministe")
local bizarre = T.Creer({}, { nom = 'Guillemet " et \\\\ antislash', monde = "tower", x = 1, y = 2, z = 3 })
local rb = T.Charger(load(T.Catalogue(bizarre))())
verifier(rb[1].nom == 'Guillemet " et \\\\ antislash', "catalogue : nom echappe (%q) et relu tel quel")

-- Charger ecarte l'invalide et le lien pendant.
local mal, rm = T.Charger({ LISTE = {
  { id = "a", nom = "A", monde = "tower", x = 0, y = 0, z = 0, vers = "zz" },
  { id = "a", nom = "doublon", monde = "tower", x = 0, y = 0, z = 0 },
  { id = "b c", nom = "espace", monde = "tower", x = 0, y = 0, z = 0 },
  { id = "c", nom = "C", monde = "tower", x = "1", y = 0, z = 0 },
  "pas une table",
} })
verifier(#mal == 1 and mal[1].vers == nil and #rm == 5, "charger : 4 entrees ecartees + 1 lien pendant, tous NOMMES")
`;

try {
  await lua.doString(script);
} catch (e) {
  echecs += 1;
  console.error("ERREUR LUA :", e.message);
} finally {
  lua.global.close();
}

console.log(`${reussis} reussi(s), ${echecs} echec(s)`);
if (echecs > 0 || reussis === 0) process.exitCode = 1;