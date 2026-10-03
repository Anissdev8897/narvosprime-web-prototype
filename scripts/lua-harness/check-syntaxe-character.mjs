// check-syntaxe-character.mjs — syntax-check rapide du Character.lua modifié
import fs from "node:fs";
import { LuaFactory } from "wasmoon";

const BASE = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const fichier = BASE + "WebPortal/Server/nanos_world/packages/narvos/Shared/Logic/Character.lua";
const src = fs.readFileSync(fichier, "utf8");

const factory = new LuaFactory();
const engine = await factory.createEngine();
const json = JSON.stringify(src);
const ok = await engine.doString(`local f, e = load(${json})\nreturn e == nil and (f ~= nil)`);
console.log(ok ? "SYNTAXE OK" : "SYNTAXE ERREUR");
if (!ok) {
  const err = await engine.doString(`local f, e = load(${json})\nreturn tostring(e)`);
  console.log("ERREUR:", err);
}