// ══════════════════════════════════════════════════════════════════════════════
// ramassage.mjs — charge Logic/Ramassage.lua et Logic/ArmesInventaire.lua, puis
// leur applique ramassage-tests.lua.
//
//   node scripts/lua-harness/ramassage.mjs
//
// ── CE QU'IL PROUVE, ET POURQUOI IL EXISTE ───────────────────────────────────
// Le 2026-09-12, Hanibes signalait pour la troisième fois : « je ne peux pas
// stocker les armes ou les objets que je fais apparaître ». La mesure :
//
//     ArmesBase.ARMES   24 armes spawnables
//     Items.ITEM_DB     81 objets de sac
//     identifiants communs : ZÉRO
//
// Les deux catalogues sont GÉNÉRÉS, depuis des sources sans rapport, et aucun
// contrôle ne les confrontait. Une arme posée au sol n'était pas un objet.
//
// Ce harnais charge les VRAIS catalogues — pas des exemples — et refuse qu'une
// arme spawnable soit absente du sac. C'est le test qui aurait vu le défaut.
//
// ── POURQUOI LES DEUX MODULES SONT CHARGÉS ENSEMBLE ──────────────────────────
// `Ramassage` décide QUOI ramasser, `ArmesInventaire` décide ce qu'une arme VAUT
// dans le sac. Le défaut vivait précisément entre les deux : chacun pris seul
// était correct.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const ramassage = fs.readFileSync(`${BASE}/Logic/Ramassage.lua`, "utf8");
const armes = fs.readFileSync(`${BASE}/Logic/ArmesInventaire.lua`, "utf8");
const catalogueArmes = fs.readFileSync(`${BASE}/Catalogs/ArmesBase.lua`, "utf8");
const catalogueItems = fs.readFileSync(`${BASE}/Catalogs/Items.lua`, "utf8");
const tests = fs.readFileSync(new URL("./ramassage-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

// `ArmesBase` appelle des méthodes du moteur dans ses `configurer` — mais
// seulement à l'APPEL, jamais au chargement. Le catalogue se lit donc tel quel.
// En revanche il référence `Color(...)` et `Vector(...)` dans des corps de
// fonction : Lua ne les évalue pas ici, rien à simuler.
const script = `
local Ramassage = (function()
${ramassage}
end)()

local ArmesInventaire = (function()
${armes}
end)()

local ArmesBase = (function()
${catalogueArmes}
end)()

local Items = (function()
${catalogueItems}
end)()

VRAIES_ARMES = ArmesBase.ARMES
VRAIS_ITEMS = Items.ITEM_DB

${tests}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}