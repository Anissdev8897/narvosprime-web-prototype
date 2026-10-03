// check-traversee.mjs — syntax-check Lua 5.4 (wasmoon) des fichiers modifiés.
// Usage : node scripts/lua-harness/check-traversee.mjs
import { readFileSync } from "node:fs";
import { LuaFactory } from "wasmoon";

const FICHIERS = [
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Traversee.lua",
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/Traversee.lua",
];

const factory = new LuaFactory();
const engine = await factory.createEngine();

let echecs = 0;
for (const chemin of FICHIERS) {
  const src = readFileSync(chemin, "utf8");
  const json = JSON.stringify(src);
  // load() renvoie nil + message d'erreur si la syntaxe est invalide
  const res = await engine.doString(
    `local f, e = load(${json})\nif e then return "ERREUR: " .. e end\nreturn "OK"`
  );
  const statut = res === "OK" ? "VERT" : "ROUGE";
  if (statut === "ROUGE") echecs++;
  console.log(`${statut} ${chemin.split("/").pop()} : ${res}`);
}
console.log(`${FICHIERS.length - echecs} fichier(s) OK, ${echecs} echec(s)`);