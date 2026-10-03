// verifier-lua.mjs — compile (sans exécuter) chaque .lua d'un dossier avec fengari.
//   node verifier-lua.mjs <dossier> [--detail]
// Un fichier qui porte encore un marqueur « [TROU » est déclaré INCOMPLET : sa
// syntaxe ne veut rien dire tant que les lignes manquantes n'ont pas été retrouvées.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const requis = createRequire("E:/narvosprime-web-prototype/");
const fengari = requis("fengari");
const { lua, lauxlib, luaL_newstate } = { ...fengari, ...fengari.lauxlib, ...fengari.lua };

const racine = process.argv[2];
const detail = process.argv.includes("--detail");
if (!racine || !fs.existsSync(racine)) {
  console.error("usage : node verifier-lua.mjs <dossier>");
  process.exit(1);
}

function lister(dir, sortie = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) lister(p, sortie);
    else if (e.name.endsWith(".lua")) sortie.push(p);
  }
  return sortie;
}

const fichiers = lister(racine);
let ok = 0, ko = 0, troues = 0;
const echecs = [];

for (const f of fichiers) {
  const texte = fs.readFileSync(f, "utf8");
  if (texte.includes("[TROU")) { troues += 1; continue; }
  const L = fengari.lauxlib.luaL_newstate();
  const code = fengari.lauxlib.luaL_loadbuffer(
    L, fengari.to_luastring(texte), null, fengari.to_luastring(path.basename(f)));
  if (code === fengari.lua.LUA_OK) ok += 1;
  else {
    ko += 1;
    const msg = fengari.lua.lua_tojsstring(L, -1);
    echecs.push(`${path.relative(racine, f)} :: ${msg}`);
  }
}

console.log(`${fichiers.length} fichier(s) .lua — ${ok} compilent, ${ko} en échec, ${troues} incomplets (trous)`);
if (detail) for (const e of echecs) console.log("  KO", e);
