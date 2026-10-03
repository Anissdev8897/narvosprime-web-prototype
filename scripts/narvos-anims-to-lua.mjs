// ══════════════════════════════════════════════════════════════════════════════
// narvos-anims-to-lua.mjs — construit le catalogue d'animations Lua depuis le
// pack cuit.
//
//   node scripts/narvos-anims-to-lua.mjs [--apply]
//
// POURQUOI DEPUIS `Assets.toml` ET PAS DEPUIS LES GLB SOURCES : les noms que le
// Lua doit écrire sont ceux que le pack EXPOSE, pas ceux des fichiers d'origine.
// `nanos-build-asset-pack.mjs` renomme les doublons (`X`, `X_2`, `X_3`) parce
// qu'un nom doit être unique dans le manifeste. Générer depuis les sources
// donnerait des noms que le moteur ne connaît pas — et l'erreur ne se verrait
// qu'en jeu, sur une animation qui ne part pas.
//
// Le regroupement en variantes est fait CÔTÉ LUA (`Logic/Animations.lua`,
// fonction `Grouper`), pas ici : une seule implémentation de la convention de
// nommage, testée par `scripts/lua-harness/anims.mjs`. La dupliquer en JS
// garantirait qu'elles divergent.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const PACK = "E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos/Assets.toml";
const SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Animations.lua";

const APPLY = process.argv.includes("--apply");

if (!fs.existsSync(PACK)) {
  console.error(`Assets.toml introuvable : ${PACK}`);
  console.error("Construire d'abord le pack : node scripts/nanos-build-asset-pack.mjs --apply");
  process.exit(1);
}

const toml = fs.readFileSync(PACK, "utf8");

/**
 * Extrait les noms d'une section `[assets.<nom>]`.
 *
 * Analyse volontairement naïve : le fichier est GÉNÉRÉ par nous, sa forme est
 * connue et stable. Tirer une dépendance TOML pour lire notre propre sortie
 * serait disproportionné.
 */
const sectionNoms = (section) => {
  const debut = toml.indexOf(`[assets.${section}]`);
  if (debut < 0) return [];
  const suite = toml.indexOf("\n    [assets.", debut + 1);
  const bloc = toml.slice(debut, suite < 0 ? undefined : suite);

  const noms = [];
  for (const ligne of bloc.split(/\r?\n/)) {
    // Deux formes de clé, et il faut lire les DEUX.
    //
    // ⚠ Le 2026-09-04, ce filtre ne connaissait que `[A-Za-z0-9_]` : il a perdu
    // 75 animations sur 3 216 — 49 nommées avec un `-` (RobotGirl, présentes
    // dans le pack depuis des semaines) et 26 avec un `+` (AimOffset). Elles
    // étaient cuites, montées, déclarées — et invisibles au Lua, sans un mot.
    //
    // `-` est légal dans une clé TOML nue, `+` non : le builder quote donc les
    // secondes. Un lecteur qui ignore les clés quotées reproduit exactement la
    // panne qu'on vient de corriger côté écriture.
    const m = ligne.match(/^\s{8}(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))\s*=/);
    if (m) noms.push(m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2]);
  }
  return noms;
};

const animations = sectionNoms("animations");

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  pack   : ${PACK}`);
console.log(`  sortie : ${SORTIE}`);
console.log("");
console.log(`  ${animations.length} animation(s) exposée(s) par le pack`);

if (animations.length === 0) {
  console.log("");
  console.log("Aucune animation dans le pack — rien à générer.");
  console.log("Vérifier que les GLB d'animation ont bien été importés puis cuits.");
  process.exit(0);
}

// Aperçu du regroupement, calculé ici UNIQUEMENT pour le rapport : c'est le Lua
// qui fera foi à l'exécution.
const apercu = new Map();
for (const nom of animations) {
  let reste = nom;
  const mMode = reste.match(/^(.*)_(IP|RM)$/);
  if (mMode) reste = mMode[1];
  const mVar = reste.match(/^(.*)_(\d{1,2}|[A-Z])$/);
  if (mVar) reste = mVar[1];
  apercu.set(reste, (apercu.get(reste) ?? 0) + 1);
}
const multi = [...apercu].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
console.log(`  ${apercu.size} action(s), dont ${multi.length} à prises multiples`);
for (const [base, n] of multi.slice(0, 8)) console.log(`      ${String(n).padStart(3)} × ${base}`);

// ⚠ Un compte élevé sur une action de LOCOMOTION (`ThirdPersonRun_Anim` ×13)
// n'est pas un jeu de prises : c'est le suffixe de DÉDUPLICATION que
// `nanos-build-asset-pack.mjs` ajoute quand plusieurs packs portent une
// animation homonyme (`X`, `X_2`, `X_3`…). Il a exactement la forme d'un
// suffixe de variante, et `Grouper` les confond.
//
// Sans conséquence à l'exécution — ces copies sont identiques, en tirer une au
// hasard donne le même résultat — mais le chiffre du rapport, lui, ment. Les
// vraies prises se reconnaissent à leur base d'ACTION (`ACB_Attack_01`,
// `ACB_Hurt_Knockback`), pas de locomotion.
const suspects = multi.filter(([b, n]) => n > 5 && /(_Anim|Idle|Walk|Run|Jump)/i.test(b));
if (suspects.length) {
  console.log("");
  console.log(`  ⚠ ${suspects.length} action(s) au compte gonflé par la déduplication de noms,`);
  console.log("    pas par de vraies prises — voir le commentaire dans ce script.");
}

if (!APPLY) {
  console.log("");
  console.log("Rien écrit.");
  process.exit(0);
}

const lignes = [
  "-- Généré depuis Server/Assets/narvos/Assets.toml par",
  "-- scripts/narvos-anims-to-lua.mjs — ne pas éditer à la main.",
  "--",
  "-- Ce fichier ne contient qu'une LISTE PLATE de noms. Le regroupement en",
  "-- variantes (base / prise / mode IP-RM) est fait par Logic/Animations.lua,",
  "-- pour que la convention de nommage n'existe qu'à un seul endroit.",
  "",
  "local Animations = {}",
  "",
  "Animations.NOMS = {",
  ...animations.sort().map((n) => `    "${n}",`),
  "}",
  "",
  "return Animations",
  "",
];

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, lignes.join("\n"));

console.log("");
console.log(`Écrit : ${animations.length} noms, ${(fs.statSync(SORTIE).size / 1024).toFixed(1)} ko`);