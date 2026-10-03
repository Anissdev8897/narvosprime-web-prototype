// ══════════════════════════════════════════════════════════════════════════════
// vehicules.mjs — la voiture ROULANTE, prouvée hors du jeu.
//
//   node scripts/lua-harness/vehicules.mjs
//
// Quatre preuves, dans l'ordre de la mission :
//   1. LA CLASSE est définie et câblée : VehicleWheeled.Inherit dans
//      Server/Voitures.lua, requis par Server/Index.lua, Logic/Voitures.lua
//      câblé dans Shared/Index.lua, commande /vehicule et abonnement distant
//      présents ;
//   2. CHAQUE MESH référencé existe dans Assets.toml (lu ici, section par
//      section : SK_ → skeletal_meshes, SM_ → static_meshes, S_ → sounds) et
//      le NOMBRE de voitures du catalogue égale le nombre de SK_ City_Traffic_Pro
//      déclarés — une relation, pas un nombre recopié ;
//   3. LE MAPPING D'OS résout sur la convention City_Traffic_Pro (wasmoon,
//      vehicules-tests.lua : OsVehicules.Resoudre sur la table de noms mesurée
//      dans les .uasset cuits) ;
//   4. LE HANDLER est abonné : COMMANDES.vehicule dans Server/Index.lua et
//      Events.SubscribeRemote("Narvos:DemanderVehicule") dans Server/Voitures.lua.
//
// ⚠ Un harnais qui ne trouve pas sa cible doit ÉCHOUER : existsSync + contenu
// non vide + REUSSIS >= 1 relu côté JS, `error()` côté Lua si 0 test.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const PACKAGE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos`;
const PROTO = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos-map-proto`;
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;

let reussisJs = 0;
let echecsJs = 0;
const okJs = (condition, nom) => {
  if (condition) reussisJs++;
  else { echecsJs++; console.error(`  ECHEC  ${nom}`); }
};

// ── Les cibles doivent exister, non vides ────────────────────────────────────
const CIBLES = [
  `${PACKAGE}/Shared/Logic/Voitures.lua`,
  `${PROTO}/Server/Voitures.lua`,
  `${PACKAGE}/Shared/Catalogs/Vehicles.lua`,
  `${PACKAGE}/Shared/Logic/OsVehicules.lua`,
  `${PROTO}/Server/Index.lua`,
  `${PACKAGE}/Shared/Index.lua`,
  TOML,
  new URL("./vehicules-tests.lua", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
];
let manquante = false;
for (const c of CIBLES) {
  if (!fs.existsSync(c)) { console.error(`CIBLE ABSENTE : ${c}`); manquante = true; }
  else if (fs.readFileSync(c, "utf8").trim().length === 0) { console.error(`CIBLE VIDE : ${c}`); manquante = true; }
}
if (manquante) process.exit(1);

const lire = (c) => fs.readFileSync(c, "utf8");
// Les commentaires sont retirés avant de chercher un câblage : une ligne
// commentée est exactement l'état qui a tué le serveur le 2026-09-08 (visible
// à la lecture, inexécutable). Même discipline que cablage-check.mjs.
const codeSeul = (s) => s.replace(/^\s*--.*$/gm, "");

console.log("[1. la classe est définie et câblée]");

const serveurVoitures = codeSeul(lire(`${PROTO}/Server/Voitures.lua`));
okJs(serveurVoitures.includes("VehicleWheeled.Inherit("), "Server/Voitures.lua définit la classe (VehicleWheeled.Inherit)");
okJs(serveurVoitures.includes("self.Super:Constructor("), "le constructeur appelle Super (patron default-vehicles)");
okJs(serveurVoitures.includes("self:SetWheel("), "les roues sont posées (SetWheel)");
okJs(serveurVoitures.includes("self:SetEngineSetup("), "le moteur est réglé (SetEngineSetup)");
okJs(serveurVoitures.includes("self:SetSteeringSetup("), "la direction est réglée (SetSteeringSetup)");
okJs(serveurVoitures.includes("self:SetDifferentialSetup("), "le différentiel est réglé (SetDifferentialSetup)");
okJs(serveurVoitures.includes("EnterVehicle("), "la montée conducteur est gérée (EnterVehicle)");

const indexShared = codeSeul(lire(`${PACKAGE}/Shared/Index.lua`));
okJs(indexShared.includes('Narvos.Voitures = Package.Require("Logic/Voitures.lua")'),
  "Logic/Voitures.lua est câblé dans Shared/Index.lua");

const indexServeur = codeSeul(lire(`${PROTO}/Server/Index.lua`));
okJs(indexServeur.includes('Narvos.VoituresServeur = Package.Require("Server/Voitures.lua")'),
  "Server/Voitures.lua est requis par Server/Index.lua");

console.log("[2. chaque mesh référencé existe dans Assets.toml]");

// Inventaire du pack, SECTION PAR SECTION : une clé déclarée dans la mauvaise
// section est un asset du mauvais type — refusé en silence par le constructeur.
const nosTypes = new Map();
{
  let section = null;
  for (const ligne of lire(TOML).split("\n")) {
    const s = ligne.match(/^\s*\[assets\.([a-z_]+)\]/);
    if (s) { section = s[1]; continue; }
    const m = ligne.match(/^\s*([^\s=[]+)\s*=\s*"([^"]+)"/);
    if (m && section) nosTypes.set(m[1], { section, chemin: m[2] });
  }
}
okJs(nosTypes.size > 0, "Assets.toml lu et non vide");

const catalogue = lire(`${PACKAGE}/Shared/Catalogs/Vehicles.lua`);
// Les entrées VOITURES_NANOS du catalogue GÉNÉRÉ.
const entrees = [...catalogue.matchAll(
  /id = "([^"]+)",\s*\n\s*label = "[^"]*",\s*\n\s*asset = "narvos::([^"]+)",\s*\n\s*son_moteur = "narvos::([^"]+)",\s*\n\s*son_klaxon = "narvos::([^"]+)",\s*\n\s*plaque = "narvos::([^"]+)"/g
)];
okJs(entrees.length >= 1, `le catalogue généré porte ${entrees.length} voiture(s) VOITURES_NANOS`);

const typeAttendu = (cle) =>
  cle.startsWith("SK_") ? "skeletal_meshes" : cle.startsWith("SM_") ? "static_meshes" : cle.startsWith("S_") ? "sounds" : null;

let references = 0;
for (const [, id, sk, moteur, klaxon, plaque] of entrees) {
  for (const cle of [sk, moteur, klaxon, plaque]) {
    references++;
    const trouve = nosTypes.get(cle);
    okJs(trouve !== undefined, `${id} : narvos::${cle} existe dans Assets.toml`);
    if (trouve) {
      const attendu = typeAttendu(cle);
      okJs(!attendu || trouve.section === attendu,
        `${id} : narvos::${cle} est en [assets.${trouve.section}] (attendu ${attendu})`);
    }
  }
}
okJs(references >= 1, `${references} références contrôlées (la garde ne compte pas vert sur zéro cible)`);

// Le NOMBRE du catalogue égale le nombre de SK_ City_Traffic_Pro déclarés —
// la garde du générateur ne peut pas avoir exclu une voiture cuite sans qu'on
// le voie ici. Une relation, pas un « 12 » recopié.
const skCuits = [...nosTypes.values()].filter(
  (t) => t.section === "skeletal_meshes" && /City_Traffic_Pro\/Cars\/Meshes\/Skeletal_Meshes\/SK_/.test(t.chemin)
).length;
okJs(entrees.length === skCuits,
  `le catalogue couvre les SK_ cuits (${entrees.length} entrées, ${skCuits} SK_ City_Traffic_Pro déclarés)`);

console.log("[2 bis. les motos : le catalogue couvre les corps cuits]");

// Le bloc MOTOS_NANOS du catalogue généré, et SEULEMENT lui : les voitures ont la
// même forme de champs, les mélanger fausserait les deux comptes.
// ⚠ `= {}` sur une ligne (catalogue vide) ne doit pas laisser l'expression courir
// jusqu'à la PROCHAINE accolade fermante du fichier — elle avalerait les voitures.
const blocMotos = /Vehicles\.MOTOS_NANOS = \{\}/.test(catalogue)
  ? ""
  : (catalogue.match(/Vehicles\.MOTOS_NANOS = \{\n([\s\S]*?)\n\}/) || [null, ""])[1];
okJs(/Vehicles\.MOTOS_NANOS = \{/.test(catalogue), "le catalogue généré déclare Vehicles.MOTOS_NANOS (même vide)");
const motos = [...blocMotos.matchAll(
  /id = "([^"]+)",\s*\n\s*label = "[^"]*",\s*\n\s*asset = "narvos::([^"]+)",\s*\n\s*son_moteur = "narvos::([^"]+)"/g
)];
for (const [, id, sk, moteur] of motos) {
  for (const [cle, attendu] of [[sk, "skeletal_meshes"], [moteur, "sounds"]]) {
    const trouve = nosTypes.get(cle);
    okJs(trouve !== undefined, `${id} : narvos::${cle} existe dans Assets.toml`);
    if (trouve) okJs(trouve.section === attendu, `${id} : narvos::${cle} est en [assets.${trouve.section}] (attendu ${attendu})`);
  }
}
// LA RELATION : autant de motos au catalogue que de corps de moto déclarés. Avant
// le cook, 0 = 0 ; après, la garde du générateur ne peut pas en perdre une en
// silence. Un compte en dur (« 3 ») se périmerait au premier pack de motos.
const corpsMotosCuits = [...nosTypes.entries()].filter(
  ([cle, t]) => t.section === "skeletal_meshes" && /RidableMotorBikes_Advanced\/Meshes\/Bikes\/[^/]+\/SkeletalMeshes\/LOD0\/SK_[A-Za-z]+_Body_LOD0$/.test(t.chemin)
).length;
okJs(motos.length === corpsMotosCuits,
  `le catalogue couvre les corps de moto cuits (${motos.length} entrée(s), ${corpsMotosCuits} corps déclaré(s))`);

console.log("[3. le mapping d'os résout (wasmoon)]");

const osvehicules = lire(`${PACKAGE}/Shared/Logic/OsVehicules.lua`);
const voitures = lire(`${PACKAGE}/Shared/Logic/Voitures.lua`);
const tests = lire(new URL("./vehicules-tests.lua", import.meta.url));

const lua = await new LuaFactory().createEngine();

// Narvos injecté : les captures `(Narvos and Narvos.X) or Package.Require` des
// modules se résolvent SANS Package.Require — inexistant hors du serveur.
// `Vector` est stubbé : RouesPour ne fait que le transporter dans ses args.
const script = `
Narvos = {}
OsVehicules = (function()
${osvehicules}
end)()
Vehicles = (function()
${catalogue}
end)()
Narvos.OsVehicules = OsVehicules
Narvos.Vehicles = Vehicles
Vector = function(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end

Voitures = (function()
${voitures}
end)()

${tests}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  const reussis = lua.global.get("REUSSIS");
  if (process.exitCode !== 1 && (!reussis || reussis < 1)) {
    console.error("AUCUNE ASSERTION EXECUTEE — le harnais ne prouve rien.");
    process.exitCode = 1;
  }
  lua.global.close();
}

console.log("[4. le handler est abonné]");

okJs(indexServeur.includes("COMMANDES.vehicule = function("), "la commande /vehicule est enregistrée");
okJs(indexServeur.includes("vehicule = true,"), "/vehicule est derrière le drapeau commandes_dev (DEV_COMMANDES)");
okJs(serveurVoitures.includes('Events.SubscribeRemote("Narvos:DemanderVehicule"'),
  "Events.SubscribeRemote(\"Narvos:DemanderVehicule\") est abonné");
okJs(serveurVoitures.includes('Player.Subscribe("Destroy"'), "la purge à la déconnexion est abonnée");

// ── Bilan ─────────────────────────────────────────────────────────────────────
const total = reussisJs + (process.exitCode === 1 ? 0 : 0);
console.log("");
if (echecsJs > 0) {
  console.error(`${echecsJs} contrôle(s) JS en échec.`);
  process.exitCode = 1;
}
if (reussisJs < 1) {
  console.error("AUCUN CONTROLE JS EXECUTE — le harnais ne prouve rien.");
  process.exitCode = 1;
}
console.log(`vehicules.mjs :: ${reussisJs} controle(s) JS reussis, ${echecsJs} echec(s)`);