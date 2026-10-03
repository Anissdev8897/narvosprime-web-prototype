// ══════════════════════════════════════════════════════════════════════════════
// narvos-armes-base-to-lua.mjs — les armes du pack de BASE, lues dans le package
// officiel, jamais recopiees.
//
//   node scripts/narvos-armes-base-to-lua.mjs           # simulation
//   node scripts/narvos-armes-base-to-lua.mjs --apply   # ecrit Catalogs/ArmesBase.lua
//
// ── D'OU VIENT LA DONNEE ──────────────────────────────────────────────────────
// `game-mod/default-weapons-master/Shared/Index.lua` : le package officiel de
// nanos, 20 armes, chacune une classe `Weapon.Inherit` dont le constructeur
// enchaine des `self:SetXxx(...)`. Ces reglages (transformations de mains,
// sons, animations, particules) ne se devinent pas — une main mal posee donne
// une arme qui flotte a cote du poing. `Logic/Weapons.lua` en avait recopie
// TROIS a la main. Les dix-sept autres restaient invisibles au joueur.
//
// ── CE QUE LE GENERATEUR EXTRAIT ──────────────────────────────────────────────
// Par classe : le nom affiche, la categorie, le mesh du `Super:Constructor`, et
// la liste EXACTE des `self:SetXxx(...)` du constructeur, reecrits `arme:`. On
// n'interprete pas les arguments : `Vector(...)`, `Color(...)`,
// `HandlingMode.X` sont du Lua valide a l'execution, on les transporte tels
// quels.
//
// ⚠ Une ligne `self:` qui n'a pas cette forme exacte n'est PAS avalee : elle
// est RAPPORTEE et l'arme est exclue. Une arme a moitie configuree (sans son
// animation de tir, par exemple) se tient dans la main et ne tire pas — pire
// qu'une arme absente.
//
// ── LE MESH EST VERIFIE SUR LE DISQUE ─────────────────────────────────────────
// Le package officiel et le client installe ne sont pas forcement de la meme
// version. Un `nanos-world::SK_X` que le client n'a pas ne leve rien : l'arme
// n'apparait pas. Chaque mesh est confronte au contenu Steam ; absent = exclu,
// motive.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const SOURCE = RACINE + "/WebPortal/Server/nanos_world/game-mod/default-weapons-master/Shared/Index.lua";
const CONTENU_NANOS = process.env.NANOS_CONTENT
  || "D:/steam/steamapps/common/nanos-world-playtest/NanosWorld/Content/NanosWorld";
const SORTIE = RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/ArmesBase.lua";
const APPLIQUER = process.argv.includes("--apply");

if (!fs.existsSync(SOURCE)) {
  console.error("ARRET : " + SOURCE + " est absent.");
  process.exit(1);
}
if (!fs.existsSync(CONTENU_NANOS)) {
  console.error("ARRET : contenu nanos introuvable : " + CONTENU_NANOS);
  console.error("        (definir NANOS_CONTENT si l'install Steam est ailleurs)");
  process.exit(1);
}

// Tous les .uasset du contenu de base, par nom — pour verifier chaque mesh.
const surDisque = new Set();
(function descendre(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) descendre(p);
    else if (e.name.endsWith(".uasset")) surDisque.add(e.name.slice(0, -7));
  }
})(CONTENU_NANOS);

const texte = fs.readFileSync(SOURCE, "utf8");

// ── Decoupage par classe ─────────────────────────────────────────────────────
// Chaque arme commence par `NanosWorldWeapons.<Id> = Weapon.Inherit(`. On
// decoupe la-dessus ; le constructeur qui suit appartient a la meme arme.
const blocs = texte.split(/(?=NanosWorldWeapons\.[A-Za-z0-9_]+ = Weapon\.Inherit\()/).slice(1);

const retenues = [];
const exclues = [];

for (const bloc of blocs) {
  const id = /^NanosWorldWeapons\.([A-Za-z0-9_]+) = Weapon\.Inherit\(/.exec(bloc)[1];
  const nom = /\bname\s*=\s*"([^"]+)"/.exec(bloc);
  const cat = /\bcategory\s*=\s*"([^"]+)"/.exec(bloc);
  // ⚠ Pas `[^)]*?` : le constructeur contient `Vector()` et `Rotator()` AVANT le
  // mesh, et le premier `)` arretait la lecture. 28 classes sur 28 ressortaient
  // « entete illisible » a la premiere execution.
  const mesh = /Super:Constructor\([\s\S]*?"(nanos-world::[A-Za-z0-9_]+)"/.exec(bloc);

  if (!nom || !cat || !mesh) {
    exclues.push([id, "entete illisible (name / category / mesh)"]);
    continue;
  }

  const cleMesh = mesh[1].split("::")[1];
  if (!surDisque.has(cleMesh)) {
    exclues.push([id, "mesh " + cleMesh + " ABSENT du contenu Steam installe"]);
    continue;
  }

  // Les reglages : uniquement les lignes `self:SetXxx(...)` completes sur UNE
  // ligne. Toute autre ligne `self:` est un cas qu'on ne sait pas transporter.
  const reglages = [];
  let suspect = null;
  for (const ligne of bloc.split("\n")) {
    const l = ligne.trim();
    if (!l.startsWith("self:")) continue;
    const m = /^self:(Set[A-Za-z0-9_]+)\((.*)\)\s*$/.exec(l);
    if (!m) { suspect = l; break; }
    reglages.push("arme:" + m[1] + "(" + m[2] + ")");
  }
  if (suspect) {
    exclues.push([id, "ligne non transportable : " + suspect.slice(0, 70)]);
    continue;
  }
  if (reglages.length === 0) {
    exclues.push([id, "aucun reglage self:Set... trouve"]);
    continue;
  }

  retenues.push({
    id: id.toLowerCase(),
    label: nom[1],
    categorie: cat[1],
    mesh: mesh[1],
    reglages,
  });
}

// ⚠ Zero cible = ROUGE.
if (retenues.length === 0) {
  console.error("ARRET : aucune arme retenue.");
  for (const [id, r] of exclues) console.error("  exclue " + id + " : " + r);
  process.exit(1);
}

console.log(retenues.length + " arme(s) retenue(s), " + exclues.length + " exclue(s), sur " + blocs.length + " classe(s).");
for (const [id, r] of exclues) console.log("  exclue  " + id + " : " + r);
for (const a of retenues) console.log("  " + a.id.padEnd(14) + a.categorie.padEnd(10) + a.label.padEnd(20) + a.reglages.length + " reglage(s)");

// ── Rendu ─────────────────────────────────────────────────────────────────────
const entrees = retenues.map((a) => {
  const corps = a.reglages.map((r) => "            " + r).join("\n");
  return [
    "    {",
    "        id = \"" + a.id + "\", label = \"" + a.label.replace(/"/g, "'") + "\",",
    "        categorie = \"" + a.categorie + "\", mesh = \"" + a.mesh + "\",",
    "        configurer = function(arme)",
    corps,
    "        end,",
    "    },",
  ].join("\n");
});

const contenu = [
  "-- " + "=".repeat(77),
  "-- Shared/Catalogs/ArmesBase.lua — FICHIER GENERE par",
  "-- scripts/narvos-armes-base-to-lua.mjs. Toute edition a la main sera ecrasee.",
  "--",
  "-- Source : game-mod/default-weapons-master/Shared/Index.lua (package officiel",
  "-- nanos, " + blocs.length + " classes). Les reglages de chaque arme — mains, sons, animations,",
  "-- particules — sont transportes TELS QUELS depuis le constructeur officiel.",
  "-- Chaque mesh a ete verifie present dans le contenu Steam installe.",
  "--",
  "-- " + retenues.length + " arme(s) retenue(s), " + exclues.length + " exclue(s) :",
  ...exclues.map(([id, r]) => "--   exclue " + id + " : " + r),
  "--",
  "-- Consomme par Logic/Weapons.lua via Weapons.Configurer(Narvos.ArmesBase).",
  "-- " + "=".repeat(77),
  "",
  "local ArmesBase = {}",
  "",
  "ArmesBase.ARMES = {",
  entrees.join("\n"),
  "}",
  "",
  "return ArmesBase",
  "",
].join("\n");

if (!APPLIQUER) {
  console.log("\n(simulation — relancer avec --apply pour ecrire " + SORTIE + ")");
  process.exit(0);
}

fs.writeFileSync(SORTIE, contenu, "utf8");
console.log("\nECRIT : " + SORTIE + " (" + (contenu.length / 1024).toFixed(1) + " ko)");

// Le generateur VERIFIE le cablage, il n'ecrit pas dans Index.lua.
const index = RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Index.lua";
if (fs.readFileSync(index, "utf8").includes('Package.Require("Catalogs/ArmesBase.lua")')) {
  console.log("Shared/Index.lua : Narvos.ArmesBase est cable.");
} else {
  console.error("\nATTENTION : Narvos.ArmesBase n'est PAS cable dans Shared/Index.lua.");
  console.error('    Narvos.ArmesBase = Package.Require("Catalogs/ArmesBase.lua")');
  process.exit(1);
}