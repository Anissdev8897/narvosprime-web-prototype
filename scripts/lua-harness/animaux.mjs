// ══════════════════════════════════════════════════════════════════════════════
// animaux.mjs — les compagnons : état, catalogue généré, codec, et le refus.
//
//   node scripts/lua-harness/animaux.mjs
//
// ── DEUX MOITIÉS ──────────────────────────────────────────────────────────────
// 1. wasmoon exécute `Logic/Animaux.lua` (l'état) et `Logic/Roster.lua` (le
//    codec) contre le VRAI `Catalogs/Animaux.lua` généré. `Roster` est chargé
//    entier parce que le codec y vit et qu'en extraire une copie ferait
//    exactement ce que ce dépôt combat depuis cinq incidents.
// 2. JS confronte le catalogue à la SOURCE sur disque : autant d'espèces que de
//    dossiers d'espèce, et chaque FBX cité existe. Un catalogue qui promet un
//    fichier absent ne se verrait qu'au moment de l'import ADK.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const BASE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;
const SOURCE =
  RACINE +
  "/WebPortal/public/asset_game/moteur_unity/jsuko_extrait/Assets/JSAllAnimals";

const animaux = fs.readFileSync(`${BASE}/Logic/Animaux.lua`, "utf8");
const roster = fs.readFileSync(`${BASE}/Logic/Roster.lua`, "utf8");
const catalogue = fs.readFileSync(`${BASE}/Catalogs/Animaux.lua`, "utf8");
const tests = fs.readFileSync(new URL("./animaux-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
-- Structures nanos reduites a ce que ces modules en font. Roster construit des
-- couleurs et lit une base ; ici on ne touche ni l'une ni l'autre.
-- (Aucun accent grave dans ce bloc : il vit dans un litteral gabarit JS, ou un
--  accent grave termine la chaine. Sixieme occurrence sur ce depot.)
function Vector(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end
function Color(r, g, b, a) return { R = r or 0, G = g or 0, B = b or 0, A = a or 1 } end
Console = { Log = function() end, Warn = function() end, Error = function() end }

-- Roster emploie le repli documente (Narvos and Narvos[nom]) or Package.Require.
-- Ce repli est un filet pour les harnais, PAS une voie de chargement en jeu (il
-- creerait une seconde table) : on le sert donc, sans rien charger, puisque les
-- tests ne touchent ni au catalogue de classes ni a la base.
Package = { Require = function() return {} end, Export = function() end }
Narvos = Narvos or {}

local Animaux = (function()
${animaux}
end)()

local Roster = (function()
${roster}
end)()

local Catalogue = (function()
${catalogue}
end)()

${tests}
`;

let rouge = false;
try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  rouge = true;
} finally {
  lua.global.close();
}

// ── La moitié JS : le catalogue correspond-il au disque ? ────────────────────
console.log("[7. le catalogue correspond a la source sur disque]");

if (!fs.existsSync(SOURCE)) {
  // ⚠ Pas un échec du catalogue : la source n'est pas extraite sur cette
  // machine. On le dit, on ne rend pas vert pour autant.
  console.error(`  ARRET : ${SOURCE} est absent — extraction non faite.`);
  console.error("  python scripts/unity-extraire-package.py <paquet> --appliquer");
  process.exit(1);
}

/** Dossiers d'espèce = ceux portant un sous-dossier `Models`, hors `Old/`. */
function especes(racine) {
  const out = [];
  (function descendre(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(d, e.name);
      if (e.name === "Models") out.push(path.dirname(p));
      else descendre(p);
    }
  })(racine);
  return out.filter((p) => !/[\\/]Old([\\/]|$)/.test(p));
}

const surDisque = especes(SOURCE);
const cites = [...catalogue.matchAll(/source = "([^"]+)"/g)].map((m) => m[1]);

if (cites.length === 0) {
  console.error("  ECHEC : le catalogue ne cite AUCUNE source — rien n'a ete verifie.");
  process.exit(1);
}

let echecs = 0;

// ⚠ Le compte, pas seulement l'existence. Une espèce ajoutée au pack et absente
// du catalogue ne se verrait jamais : elle n'est citée nulle part, donc aucun
// contrôle d'existence ne la cherche. C'est le même angle mort que
// `modules-orphelins-check` a comblé côté Lua.
if (cites.length !== surDisque.length) {
  console.error(
    `  ECHEC : ${surDisque.length} dossier(s) d'espece sur disque, ` +
      `${cites.length} cite(s) dans le catalogue. Regenerer.`
  );
  echecs++;
}

for (const rel of cites) {
  const p = path.join(SOURCE, rel);
  if (!fs.existsSync(p)) {
    console.error(`  ECHEC : ${rel} — cite par le catalogue, absent du disque.`);
    echecs++;
  }
}

console.log(
  `  ${surDisque.length} dossier(s) d'espece, ${cites.length} FBX cite(s), ` +
    `${echecs} ecart(s).`
);

// ── 7. Chaque animation promise existe-t-elle dans le pack cuit ? ────────────
//
// ⚠ C'est la moitie que Lua ne peut pas faire, et c'est celle qui compte :
// `PlayAnimation("narvos::cle_inexistante")` ne leve RIEN. La bete reste figee,
// aucun message nulle part. Meme mode d'echec que `Sound` sur un son absent.
console.log("[8. chaque animation promise existe dans Assets.toml]");

const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const clesPromises = [
  ...new Set(
    [...catalogue.matchAll(/anims = \{([^}]*)\}/g)]
      .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
  ),
];
const reposPromis = [...catalogue.matchAll(/repos = "([^"]+)"/g)].map((m) => m[1]);

if (!fs.existsSync(TOML)) {
  console.error(`  ARRET : ${TOML} est absent.`);
  process.exit(1);
}

const lignesToml = fs.readFileSync(TOML, "utf8").split("\n");
const debutAnims = lignesToml.findIndex((l) => l.trim() === "[assets.animations]");
const declarees = new Set();
if (debutAnims >= 0) {
  for (let i = debutAnims + 1; i < lignesToml.length; i++) {
    if (/^\s*\[/.test(lignesToml[i])) break;
    const m = /^\s*([A-Za-z0-9_\-]+)\s*=/.exec(lignesToml[i]);
    if (m) declarees.add(m[1]);
  }
}

const mortes = clesPromises.filter((c) => !declarees.has(c));
const reposMorts = reposPromis.filter((c) => !declarees.has(c));

console.log(
  `  ${declarees.size} animation(s) declaree(s) dans le pack, ` +
    `${clesPromises.length} promise(s) par le catalogue, ` +
    `${reposPromis.length} repos.`
);

for (const c of mortes.slice(0, 15)) {
  console.error(`  ECHEC : "${c}" absente de [assets.animations] — PlayAnimation serait MUET.`);
}
if (mortes.length > 15) console.error(`  … et ${mortes.length - 15} autre(s).`);
for (const c of reposMorts.slice(0, 10)) {
  console.error(`  ECHEC : repos "${c}" absent du pack — le compagnon resterait fige.`);
}

if (mortes.length + reposMorts.length > 0) {
  console.error(`\nanimaux.mjs :: ${mortes.length + reposMorts.length} cle(s) morte(s).`);
  process.exit(1);
}

if (echecs > 0) {
  console.error(`\nanimaux.mjs :: ${echecs} echec(s).`);
  process.exit(1);
}
console.log(`\nanimaux.mjs :: ${cites.length} controle(s) JS reussis, 0 echec(s)`);
if (rouge) process.exit(1);