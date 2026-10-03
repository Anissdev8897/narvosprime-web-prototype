// ══════════════════════════════════════════════════════════════════════════════
// narvos-metahumain-to-lua.mjs — catalogue Lua des pièces MetaHuman du pont.
//
//   node scripts/narvos-metahumain-to-lua.mjs [--apply]
//
// Source : WebPortal/Server/adk/_pont-metahuman.json, écrit par
// scripts/adk-pont-metahuman.py (etape_porteur) — l'outil qui FABRIQUE les
// Blueprints est le seul à savoir lesquels existent. On ne recopie pas sa liste.
//
// Confrontation : Assets.toml (section [assets.blueprints]) et les fichiers
// CUITS du pont (ABP, retargeter, IK rigs). Une pièce n'est `cuit = true` que si
// son Blueprint est DÉCLARÉ et que l'Anim Blueprint qui l'anime est dans le
// pack : sans lui, le Blueprint apparaîtrait en T-pose, sans erreur.
//
// Sortie : WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/MetaHumain.lua
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const MANIFESTE = `${RACINE}/WebPortal/Server/adk/_pont-metahuman.json`;
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const PACK = `${RACINE}/WebPortal/Server/Assets/narvos`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/MetaHumain.lua`;
const APPLIQUER = process.argv.includes("--apply");

// Les règles de slots vivent ICI, une seule fois : le catalogue les porte, la
// logique les lit. Ordre = ordre de l'écran de création.
const SLOTS = ["corps", "haut", "bas", "pieds", "tenue"];
const LIBELLES_SLOTS = { corps: "Corps", haut: "Haut", bas: "Bas", pieds: "Chaussures", tenue: "Tenue complete" };
const REMPLACE = { tenue: ["haut", "bas"], haut: ["tenue"], bas: ["tenue"] };
const SLOT_CORPS = "corps";
const OS_ATTACHE = "root";
const GENRES = new Set(["F", "M", "*"]);

// Ce qui doit être CUIT pour qu'une pièce bouge (chemins relatifs au pack).
const PONT = ["ABP_NanosVersMetaHuman", "RTG_NanosVersMetaHuman", "IK_NanosMannequin", "IK_NarvosMetaHuman"]
  .map((n) => `Narvos/PontMetaHuman/${n}.uasset`);

const arret = (msg) => { console.error(`ARRÊT : ${msg}`); process.exit(1); };

if (!fs.existsSync(MANIFESTE)) arret(`${MANIFESTE} absent — lancer etape_porteur() dans l'éditeur.`);
if (!fs.existsSync(TOML)) arret(`${TOML} absent — construire le pack.`);

const manifeste = JSON.parse(fs.readFileSync(MANIFESTE, "utf8"));
const porteurs = manifeste.porteurs ?? [];
if (porteurs.length === 0) arret("aucun porteur dans le manifeste.");

// Assets.toml : sections indentées « [assets.x] », entrées « Cle = "Chemin" ».
const sections = new Map();
let courante = null;
for (const ligne of fs.readFileSync(TOML, "utf8").split(/\r?\n/)) {
  const s = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
  if (s) { courante = s[1]; sections.set(courante, sections.get(courante) ?? []); continue; }
  const e = ligne.match(/^\s*([A-Za-z0-9_\-]+)\s*=\s*"([^"]+)"/);
  if (e && courante) sections.get(courante).push({ cle: e[1], chemin: e[2] });
}
const cleDe = (section, suffixe) =>
  (sections.get(section) ?? []).find((x) => x.chemin.endsWith(suffixe))?.cle ?? null;

const manquants = PONT.filter((p) => !fs.existsSync(`${PACK}/${p}`));
const pontCuit = manquants.length === 0;
const invisible = cleDe("assets.materials", "/MetaCustom/Material/Mat_Invisible");

const vus = new Set();
const lignes = [];
let cuits = 0;
for (const p of porteurs) {
  if (vus.has(p.id)) arret(`identifiant en double : ${p.id}`);
  vus.add(p.id);
  if (!SLOTS.includes(p.slot)) arret(`${p.id} : slot inconnu « ${p.slot} »`);
  if (!GENRES.has(p.genre)) arret(`${p.id} : genre inconnu « ${p.genre} »`);
  if (!/^[a-z0-9_]+$/.test(p.id)) arret(`${p.id} : identifiant hors [a-z0-9_]`);
  const cle = cleDe("assets.blueprints", `/PontMetaHuman/${p.blueprint}`);
  const cuit = Boolean(cle) && pontCuit;
  if (cuit) cuits += 1;
  const libelle = String(p.libelle).replace(/"/g, "'");
  lignes.push(`    ${p.id} = { blueprint = "narvos::${cle ?? p.blueprint}", slot = "${p.slot}", `
    + `genre = "${p.genre}", label = "${libelle}", mesh = "${p.mesh}", cuit = ${cuit} },`);
}
lignes.sort();

const luaListe = (xs) => `{ ${xs.map((x) => `"${x}"`).join(", ")} }`;
const remplace = Object.entries(REMPLACE).map(([k, v]) => `${k} = ${luaListe(v)}`).join(", ");
const libelles = Object.entries(LIBELLES_SLOTS).map(([k, v]) => `${k} = "${v}"`).join(", ");

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- MetaHumain.lua — les pièces MetaHuman portées par le pont (retarget vivant).
--
-- FICHIER GÉNÉRÉ par scripts/narvos-metahumain-to-lua.mjs — ne pas éditer à la main.
-- Source : WebPortal/Server/adk/_pont-metahuman.json (scripts/adk-pont-metahuman.py).
--
-- ${porteurs.length} pièce(s), ${cuits} réellement posable(s) (Blueprint déclaré ET pont cuit).
-- Pont cuit : ${pontCuit ? "oui" : "NON — manque " + manquants.join(", ")}.
-- Porteur invisible : ${invisible ? "narvos::" + invisible : "Mat_Invisible ABSENT du pack"}.
--
-- Une pièce non cuite est REFUSÉE en la nommant (Logic/MetaHumain.lua) : un
-- Blueprint sur une référence morte n'apparaît pas, et ne lève rien.
-- ══════════════════════════════════════════════════════════════════════════════

local MetaHumain = {}

--- Slots, dans l'ordre de l'écran de création.
MetaHumain.SLOTS = ${luaListe(SLOTS)}
MetaHumain.SLOT_CORPS = "${SLOT_CORPS}"
MetaHumain.LIBELLES_SLOTS = { ${libelles} }

--- Ce qu'une pièce retire en arrivant (une tenue complète occupe haut et bas).
MetaHumain.REMPLACE = { ${remplace} }

--- Os du Character auquel chaque pièce s'attache : un nom d'os fait attacher au
--- MAILLAGE (le parent que le retarget copie), pas à la capsule.
MetaHumain.OS_ATTACHE = "${OS_ATTACHE}"

--- Matériau qui rend le mesh nanos invisible SANS l'empêcher d'être rendu.
MetaHumain.MATERIAU_INVISIBLE = ${invisible ? `"narvos::${invisible}"` : "nil"}

MetaHumain.PIECES = {
${lignes.join("\n")}
}

return MetaHumain
`;

console.log(`${porteurs.length} pièce(s), ${cuits} posable(s) ; pont cuit : ${pontCuit ? "oui" : "NON (" + manquants.length + " fichier(s) manquant(s))"} ; `
  + `Mat_Invisible : ${invisible ?? "ABSENT"}`);
if (!APPLIQUER) {
  console.log(`Simulation — rien écrit. Cible : ${SORTIE}. Ajouter --apply.`);
  process.exit(0);
}
fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, lua, "utf8");
console.log(`Écrit : ${SORTIE}`);