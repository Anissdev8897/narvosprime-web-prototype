// ══════════════════════════════════════════════════════════════════════════════
// narvos-map-to-lua.mjs — extrait la liste des meshes d'une map depuis le pack.
//
//   node scripts/narvos-map-to-lua.mjs [--map forge_map] [--apply]
//
// POURQUOI : Interchange importe un GLB de map en 12 987 StaticMesh SÉPARÉS et
// ne crée AUCUN Level. Rien ne les fait donc apparaître ; il faut les spawner
// depuis le Lua, et pour cela connaître leurs noms.
//
// Les transforms sont CUITES dans les sommets (`bake_meshes = True` par défaut,
// vérifié par adk-probe-pipeline.py) : chaque mesh porte déjà sa position monde.
// D'où un spawn à Vector(0,0,0) — leur donner une position les déplacerait deux
// fois.
//
// Comme pour les animations, la source est `Assets.toml` et pas les fichiers du
// cook : ce sont les noms EXPOSÉS que le Lua doit écrire, et le constructeur de
// pack renomme les doublons.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const PACK = "E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos/Assets.toml";
const SORTIE_DIR = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs";

const iMap = process.argv.indexOf("--map");
const MAP = iMap >= 0 ? process.argv[iMap + 1] : "forge_map";

// Dossier du pack où vivent les meshes. Il change selon la façon dont la map a
// été importée : `Maps/forge_map` pour le GLB monolithique, `chunks_unreal`
// pour la version découpée et jointe. Le nom logique de la map (--map) reste
// celui du catalogue Lua, indépendamment de l'endroit où sont les fichiers.
const iPrefixe = process.argv.indexOf("--prefixe");
const PREFIXE = iPrefixe >= 0 ? process.argv[iPrefixe + 1] : `Maps/${MAP}`;

const APPLY = process.argv.includes("--apply");

if (!fs.existsSync(PACK)) {
  console.error(`Assets.toml introuvable : ${PACK}`);
  process.exit(1);
}

const toml = fs.readFileSync(PACK, "utf8");

// ⚠ SE LIMITER À `[assets.static_meshes]`. Les matériaux de la map vivent sous
// le MÊME chemin `Narvos/Maps/<map>/` : un motif qui ratisse tout le fichier en
// ramène 25 952 au lieu de 12 987, et la moitié seraient des matériaux qu'un
// `StaticMesh()` refuserait — un par un, en pleine boucle de spawn.
const debut = toml.indexOf("[assets.static_meshes]");
if (debut < 0) {
  console.error("Section [assets.static_meshes] absente d'Assets.toml.");
  process.exit(1);
}
const suite = toml.indexOf("\n    [assets.", debut + 1);
const bloc = toml.slice(debut, suite < 0 ? undefined : suite);

// Chaque ligne exposée a la forme :  <nom> = "Narvos/<préfixe>/<chemin>"
// On garde le NOM (clé de gauche) : c'est lui que le Lua passera en
// `narvos::<nom>`.
const motif = new RegExp(`^\\s{8}([A-Za-z0-9_\\-]+)\\s*=\\s*"Narvos/${PREFIXE}/`, "gm");

const noms = [];
let m;
while ((m = motif.exec(bloc)) !== null) noms.push(m[1]);

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  map    : ${MAP}`);
console.log(`  chemin : Narvos/${PREFIXE}/`);
console.log(`  ${noms.length} mesh(es) exposé(s) par le pack`);

if (noms.length === 0) {
  console.log("");
  console.log("Rien trouvé. Vérifier que la map a été importée puis cuite,");
  console.log("et que le pack a été reconstruit (nanos-build-asset-pack.mjs --apply).");
  process.exit(1);
}

// ⚠ Les noms commencent souvent par un TIRET (`-000_001`) : Interchange dérive
// le nom d'asset du nom de nœud glTF, et l'exportateur Blender préfixe ainsi.
// En Lua ce n'est pas un identifiant valide, donc le catalogue les stocke dans
// une SÉQUENCE de chaînes et jamais comme clés de table.
const avecTiret = noms.filter((n) => n.startsWith("-")).length;
console.log(`  dont ${avecTiret} commençant par un tiret (stockés en chaînes, jamais en clés)`);

if (!APPLY) {
  console.log("");
  console.log("Rien écrit.");
  process.exit(0);
}

const sortie = path.join(SORTIE_DIR, `Map_${MAP}.lua`);

const lignes = [
  `-- Généré depuis Server/Assets/narvos/Assets.toml par`,
  `-- scripts/narvos-map-to-lua.mjs --map ${MAP} — ne pas éditer à la main.`,
  "--",
  "-- Liste des meshes composant la map. Leurs transforms sont CUITES dans les",
  "-- sommets : les spawner à Vector(0,0,0) les remet exactement en place.",
  "",
  "local Map = {}",
  "",
  `Map.NOM = "${MAP}"`,
  "",
  "Map.MESHES = {",
  ...noms.sort().map((n) => `    "${n}",`),
  "}",
  "",
  "return Map",
  "",
];

fs.mkdirSync(SORTIE_DIR, { recursive: true });
fs.writeFileSync(sortie, lignes.join("\n"));

console.log("");
console.log(`Écrit : ${sortie}`);
console.log(`  ${noms.length} noms, ${(fs.statSync(sortie).size / 1024).toFixed(0)} ko`);