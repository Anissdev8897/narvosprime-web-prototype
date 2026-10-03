// verifier-un.mjs — compile un seul fichier Lua (sans l'exécuter). Sortie : code 0 = OK.
import fs from "node:fs";
import { createRequire } from "node:module";
const requis = createRequire("E:/narvosprime-web-prototype/");
const fengari = requis("fengari");
const f = process.argv[2];
if (!f || !fs.existsSync(f)) process.exit(2);
const L = fengari.lauxlib.luaL_newstate();
const code = fengari.lauxlib.luaL_loadbuffer(L, fengari.to_luastring(fs.readFileSync(f, "utf8")), null, fengari.to_luastring("f"));
process.exit(code === fengari.lua.LUA_OK ? 0 : 1);
