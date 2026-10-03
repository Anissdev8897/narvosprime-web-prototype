// ══════════════════════════════════════════════════════════════════════════════
// narvos-pas-to-lua.mjs — le catalogue des BRUITS DE PAS, lu dans le pack cuit.
//
//   node scripts/narvos-pas-to-lua.mjs           # simulation
//   node scripts/narvos-pas-to-lua.mjs --apply   # ecrit le catalogue
//
// ── POURQUOI UN GENERATEUR, ALORS QUE `Sons.lua` EXISTE DEJA ──────────────────
// `Catalogs/Sons.lua` porte `PAS_COMPTE` : le NOMBRE d'echantillons par
// categorie, porte depuis le TS. Ces comptes sont justes (verifies contre le
// pack le 2026-09-10) — et ils ne suffisent pas.
//
// `Sound(location, asset)` veut une CLE d'Assets.toml, pas un compte. Or la cle
// n'est pas derivable de la categorie :
//
//     armor    -> crystal_foot1      (le prefixe n'est PAS la categorie)
//     brush    -> brush_through1     (l'action n'est pas "walk")
//     water    -> water_through1  ET  water_through10_2  (deux dossiers)
//
// Fabriquer "<categorie>_walk<n>" marcherait pour bluntwood et echouerait en
// silence pour armor, brush, leaves, water — un son introuvable ne leve rien,
// il ne joue simplement pas. C'est le mode d'echec muet que tout ce projet
// combat. Les cles se LISENT dans le pack.
//
// ── CE QUE LE NOM DU FICHIER PORTE EN PLUS ────────────────────────────────────
// Les 490 echantillons nomment leur ACTION : `_walk`, `_run`, `_land`, et un
// reste (`_through`, `_foot`, `_hard`, `_wander`). On les range par action :
// l'executant choisit alors selon l'allure reelle du personnage au lieu de
// tirer au hasard dans un sac ou marcher et courir sont melanges.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const TOML = RACINE + "/WebPortal/Server/Assets/narvos/Assets.toml";
const SORTIE = RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Pas.lua";
const APPLIQUER = process.argv.includes("--apply");

if (!fs.existsSync(TOML)) {
  console.error("ARRET : " + TOML + " est absent — le pack n'a jamais ete cuit.");
  process.exit(1);
}

// ── Lecture ───────────────────────────────────────────────────────────────────
// On ne lit QUE les entrees WAV : les CUE sont des SoundCue Unreal, un autre
// format d'asset, et le constructeur `Sound` attend un SoundPath. Les melanger
// donnerait des cles qui existent et ne jouent pas.
const MOTIF = /^\s*([A-Za-z0-9_\-]+)\s*=\s*"(Narvos\/Footsteps_Sound_Effects_Pro\/WAV\/([^/]+)\/[^"]+)"/;

// `Water_stereofix` est le meme materiau que `Water` : le pack a separe une
// correction stereo, pas une surface. Les fondre evite une categorie fantome
// qu'aucune regle de `Sons.PAS_REGLES` ne nommera jamais.
const FUSIONS = { water_stereofix: "water" };

function action(cle) {
  const c = cle.toLowerCase();
  if (c.includes("_walk")) return "marche";
  if (c.includes("_run")) return "course";
  if (c.includes("_land")) return "chute";
  return "autre";
}

const parCategorie = new Map();
let entrees = 0;

for (const ligne of fs.readFileSync(TOML, "utf8").split("\n")) {
  const m = MOTIF.exec(ligne);
  if (!m) continue;
  const cle = m[1];
  let cat = m[3].toLowerCase();
  cat = FUSIONS[cat] || cat;
  if (!parCategorie.has(cat)) {
    parCategorie.set(cat, { marche: [], course: [], chute: [], autre: [] });
  }
  parCategorie.get(cat)[action(cle)].push(cle);
  entrees++;
}

// ⚠ Zero cible = ROUGE. Un catalogue vide qui s'ecrit sans rien dire est pire
// qu'une erreur : il rend le harnais vert par vacuite.
if (entrees === 0) {
  console.error("ARRET : aucune entree Footsteps_Sound_Effects_Pro/WAV dans Assets.toml.");
  console.error("        Le pack ne porte pas les pas — rien a generer.");
  process.exit(1);
}

const categories = [...parCategorie.keys()].sort();

// Une categorie sans AUCUN echantillon ne doit pas exister dans le catalogue :
// l'executant y tirerait dans le vide.
const vides = categories.filter((c) => {
  const b = parCategorie.get(c);
  return b.marche.length + b.course.length + b.chute.length + b.autre.length === 0;
});
if (vides.length > 0) {
  console.error("ARRET : categorie(s) sans echantillon : " + vides.join(", "));
  process.exit(1);
}

// ── Rendu ─────────────────────────────────────────────────────────────────────
function listeLua(cles) {
  if (cles.length === 0) return "{}";
  return "{ " + cles.map((c) => '"' + c + '"').join(", ") + " }";
}

const blocs = categories.map((cat) => {
  const b = parCategorie.get(cat);
  const total = b.marche.length + b.course.length + b.chute.length + b.autre.length;
  return [
    "    -- " + cat + " : " + total + " echantillon(s)",
    "    " + cat + " = {",
    "        marche = " + listeLua(b.marche) + ",",
    "        course = " + listeLua(b.course) + ",",
    "        chute  = " + listeLua(b.chute) + ",",
    "        autre  = " + listeLua(b.autre) + ",",
    "    },",
  ].join("\n");
});

const repartition = categories
  .map((c) => {
    const b = parCategorie.get(c);
    return "--   " + c.padEnd(16) +
      String(b.marche.length).padStart(4) + " marche" +
      String(b.course.length).padStart(5) + " course" +
      String(b.chute.length).padStart(5) + " chute" +
      String(b.autre.length).padStart(5) + " autre";
  })
  .join("\n");

const contenu = [
  "-- " + "=".repeat(77),
  "-- Shared/Catalogs/Pas.lua — FICHIER GENERE par scripts/narvos-pas-to-lua.mjs.",
  "-- Toute edition a la main sera ecrasee au prochain --apply.",
  "--",
  "-- Source : les entrees [assets.sounds] du pack cuit, dossier",
  "-- Narvos/Footsteps_Sound_Effects_Pro/WAV/<Categorie>/. Les cles sont LUES,",
  "-- jamais fabriquees : le prefixe d'un fichier n'est pas sa categorie",
  "-- (armor -> crystal_foot1) et l'action varie (_walk, _run, _land, _through).",
  "--",
  "-- " + entrees + " echantillon(s), " + categories.length + " categorie(s) :",
  repartition,
  "-- " + "=".repeat(77),
  "",
  "local Pas = {}",
  "",
  "Pas.CATEGORIES = { " + categories.map((c) => '"' + c + '"').join(", ") + " }",
  "",
  "--- categorie -> { marche, course, chute, autre } : listes de CLES Assets.toml.",
  "--- L'appelant prefixe par le pack (\"narvos::\") — le catalogue ne connait pas",
  "--- le nom du pack, c'est une decision de deploiement, pas de donnee.",
  "Pas.PAR_CATEGORIE = {",
  blocs.join("\n"),
  "}",
  "",
  "return Pas",
  "",
].join("\n");

console.log(entrees + " echantillon(s) lus, " + categories.length + " categorie(s).");
console.log(repartition.replace(/^--   /gm, "  "));

if (!APPLIQUER) {
  console.log("\n(simulation — relancer avec --apply pour ecrire " + SORTIE + ")");
  process.exit(0);
}

fs.writeFileSync(SORTIE, contenu, "utf8");
console.log("\nECRIT : " + SORTIE + " (" + (contenu.length / 1024).toFixed(1) + " ko)");

// ⚠ Le generateur N'ECRIT PAS dans Shared/Index.lua — il VERIFIE. Un generateur
// qui reecrit l'index a deja efface des cablages voisins (incident 2026-09-08).
const index = RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Index.lua";
const src = fs.readFileSync(index, "utf8");
if (src.includes('Package.Require("Catalogs/Pas.lua")')) {
  console.log("Shared/Index.lua : Narvos.Pas est cable.");
} else {
  console.error("\nATTENTION : Narvos.Pas n'est PAS cable dans Shared/Index.lua.");
  console.error("Le catalogue existe et n'existe pas en jeu. Ajouter a la main :");
  console.error('    Narvos.Pas = Package.Require("Catalogs/Pas.lua")');
  process.exit(1);
}