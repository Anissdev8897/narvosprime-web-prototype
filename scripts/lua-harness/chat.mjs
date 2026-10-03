// ══════════════════════════════════════════════════════════════════════════════
// chat.mjs — parité TS ↔ Lua du chat (chatStore).
//
//   node scripts/lua-harness/chat.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const RACINE = "E:/narvosprime-web-prototype";
const ESBUILD = `${RACINE}/WebPortal/node_modules/esbuild/bin/esbuild`;
const LUA = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;

// 1. TS : bundle chatStore.ts → chatStore (le singleton).
const tmp = path.join(os.tmpdir(), `chat-ts-${Date.now()}.mjs`);
execFileSync("node", [ESBUILD, `${RACINE}/WebPortal/src/rpg/chat/chatStore.ts`, "--bundle", "--format=esm", "--platform=node", `--outfile=${tmp}`]);
const ts = await import(pathToFileURL(tmp).href);

// 2. Séquence TS (singleton) : mêmes envois que côté Lua.
ts.chatStore.clear();
let handledTS = "";
ts.chatStore.registerCommand("help", (args) => { handledTS = "help:" + args; });
ts.chatStore.send("Alice", "  salut a tous  ");
ts.chatStore.send("Alice", "/help top");
ts.chatStore.send("Bob", "/inconnue");
ts.chatStore.pushSystem("info serveur");
ts.chatStore.pushAdmin("annonce");
ts.chatStore.pushError("erreur x");
const tsMsgs = ts.chatStore.getMessages();

// 3. Séquence + JSON en Lua (interop sûre). Messages sérialisés en [ {expediteur,texte,type} ].
const lua = await new LuaFactory().createEngine();
await lua.doString(`Chat = (function()\n${fs.readFileSync(`${LUA}/Logic/Chat.lua`, "utf8")}\nend)()`);
await lua.doString(`
CRT = Chat.Nouveau()
CRT = Chat.EnregistrerCommande(CRT, "help", function(args) LL = "help:" .. args end)
CRT = Chat.Envoyer(CRT, "Alice", "  salut a tous  ", "t1", 1).etat
CRT = Chat.Envoyer(CRT, "Alice", "/help top", "t2", 2).etat
CRT = Chat.Envoyer(CRT, "Bob", "/inconnue", "t3", 3).etat
CRT = Chat.Systeme(CRT, "info serveur", "t4", 4)
CRT = Chat.Admin(CRT, "annonce", "t5", 5)
CRT = Chat.Erreur(CRT, "erreur x", "t6", 6)
local function encs(s) return string.format("%q", s) end
local function encj(v)
  if type(v) ~= "table" then return "null" end
  local parts = {}
  for i = 1, #v do parts[i] = '{"expediteur":' .. encs(v[i].expediteur) .. ',"texte":' .. encs(v[i].texte) .. ',"type":' .. encs(v[i].type) .. '}' end
  return "[" .. table.concat(parts, ",") .. "]"
end
JSONM = encj(Chat.Messages(CRT))`);
const luaMsgs = JSON.parse(await lua.global.get("JSONM"));
const handledLua = await lua.global.get("LL");

let reussis = 0, echecs = 0, champs = 0;
const egal = (a, b, n) => { champs++; if (JSON.stringify(a) === JSON.stringify(b)) reussis++; else { echecs++; console.log(`  ECHEC ${n}  TS=${JSON.stringify(a)} Lua=${JSON.stringify(b)}`); } };

// Même nb de messages + contenu identique (expediteur/texte/type).
egal(tsMsgs.length, luaMsgs.length, "nb messages");
for (let i = 0; i < Math.min(tsMsgs.length, luaMsgs.length); i++) {
  egal([tsMsgs[i].sender, tsMsgs[i].text, tsMsgs[i].type], [luaMsgs[i].expediteur, luaMsgs[i].texte, luaMsgs[i].type], `msg${i}`);
}
// Dispatch de commande /help.
egal(handledTS, "help:top", "TS commande /help");
egal(handledLua, "help:top", "Lua commande /help");

console.log(`parité TS/Lua chat : ${reussis}/${champs} champs`);
lua.global.close();
if (echecs > 0) process.exitCode = 1;