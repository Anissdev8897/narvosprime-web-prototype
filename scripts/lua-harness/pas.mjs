// ══════════════════════════════════════════════════════════════════════════════
// pas.mjs — les bruits de pas : de la surface touchée à une clé du pack.
//
//   node scripts/lua-harness/pas.mjs
//
// ── DEUX MOITIÉS, ET LA SECONDE EST LA PLUS IMPORTANTE ────────────────────────
// 1. wasmoon exécute `Logic/Audio.lua` contre les VRAIS catalogues (`Sons.lua`
//    écrit à la main, `Pas.lua` généré). Il prouve la décision : quelle
//    catégorie, quel seau, quelle clé, et les refus.
// 2. JS confronte chaque clé du catalogue à `Assets.toml`. C'est la moitié que
//    Lua ne peut pas faire — et c'est là que se cache le défaut le plus discret
//    du projet : `Sound("narvos::cle_inexistante")` ne joue rien et ne lève
//    RIEN. Ni erreur Lua, ni avertissement moteur. Le joueur marche en silence
//    et personne n'apprend jamais pourquoi.
//
// ⚠ Le contrôle refuse le zéro cible : un catalogue vide rendrait ce harnais
// vert par vacuité, ce qui est exactement le contraire de ce qu'on lui demande.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const BASE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;

const audio = fs.readFileSync(`${BASE}/Logic/Audio.lua`, "utf8");
const sons = fs.readFileSync(`${BASE}/Catalogs/Sons.lua`, "utf8");
const pas = fs.readFileSync(`${BASE}/Catalogs/Pas.lua`, "utf8");
const tests = fs.readFileSync(new URL("./pas-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
local Audio = (function()
${audio}
end)()

local Sons = (function()
${sons}
end)()

local Pas = (function()
${pas}
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

// ── La moitié JS : chaque clé existe-t-elle vraiment dans le pack cuit ? ──────
console.log("[7. chaque cle du catalogue existe dans Assets.toml]");

if (!fs.existsSync(TOML)) {
  console.error(`  ECHEC : ${TOML} est absent — impossible de verifier les cles.`);
  process.exit(1);
}

// Les clés déclarées dans [assets.sounds]. On borne la lecture à cette section :
// une clé de mesh homonyme ferait passer un son inexistant pour présent.
const lignes = fs.readFileSync(TOML, "utf8").split("\n");
const debut = lignes.findIndex((l) => l.trim() === "[assets.sounds]");
if (debut < 0) {
  console.error("  ECHEC : section [assets.sounds] introuvable dans Assets.toml.");
  process.exit(1);
}
const declarees = new Set();
for (let i = debut + 1; i < lignes.length; i++) {
  const l = lignes[i];
  if (/^\s*\[/.test(l)) break;                 // section suivante
  const m = /^\s*([A-Za-z0-9_\-]+)\s*=/.exec(l);
  if (m) declarees.add(m[1]);
}

// Les clés que le catalogue promet.
//
// ⚠ On ne ramasse PAS toutes les chaînes du fichier : `Pas.CATEGORIES` en
// contient 25 qui sont des noms de catégorie, pas des clés d'asset. Un premier
// jet les a comptées et a déclaré 25 clés mortes — 25 faux positifs qui
// auraient pu faire « corriger » un catalogue sain. On ne lit que les LIGNES DE
// SEAU, les seules qui portent des clés.
const source = fs.readFileSync(`${BASE}/Catalogs/Pas.lua`, "utf8");
const promises = [];
for (const ligne of source.split("\n")) {
  if (!/^\s*(marche|course|chute|autre)\s*=\s*\{/.test(ligne)) continue;
  for (const m of ligne.matchAll(/"([A-Za-z0-9_\-]+)"/g)) promises.push(m[1]);
}

const cles = [...new Set(promises)];
if (cles.length === 0) {
  console.error("  ECHEC : le catalogue ne promet AUCUNE cle — rien n'a ete verifie.");
  process.exit(1);
}

const mortes = cles.filter((c) => !declarees.has(c));
console.log(`  ${declarees.size} son(s) declare(s) dans le pack, ${cles.length} cle(s) promise(s).`);

if (mortes.length > 0) {
  for (const c of mortes.slice(0, 20)) {
    console.error(`  ECHEC : "${c}" n'est pas dans [assets.sounds] — Sound() serait MUET.`);
  }
  if (mortes.length > 20) console.error(`  … et ${mortes.length - 20} autre(s).`);
  console.error(`\npas.mjs :: ${mortes.length} cle(s) morte(s).`);
  process.exit(1);
}

console.log(`\npas.mjs :: ${cles.length} controle(s) JS reussis, 0 echec(s)`);
if (rouge) process.exit(1);