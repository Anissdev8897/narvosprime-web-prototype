// ══════════════════════════════════════════════════════════════════════════════
// macros.mjs — exécute les tests de Shared/Logic/Macros.lua.
//
//   node scripts/lua-harness/macros.mjs
//
// ── CE QUI REND CE HARNAIS PARTICULIER ───────────────────────────────────────
// Il injecte `MORPHS_REELS`, lu directement dans le GLB cuit
// (`base_morphable.glb`, clé `meshes[0].extras.targetNames`).
//
// Sans ça, les tests ne pourraient vérifier que la forme des noms produits —
// jamais leur EXISTENCE. Or c'est là qu'est le mode d'échec : `SetMorphTarget`
// sur un morph inexistant ne lève pas, le corps reste neutre, et on cherche la
// panne dans l'interface pendant que la faute est dans une chaîne de caractères.
//
// Si le GLB manque, le harnais s'arrête plutôt que de tester à vide : des tests
// qui passent sans rien vérifier sont pires que pas de tests.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";
const GLB =
  "E:/narvosprime-web-prototype/WebPortal/public/models/personnages/_body/base_morphable.glb";

if (!fs.existsSync(GLB)) {
  console.error(`ARRET : ${GLB} absent.`);
  console.error("Le regenerer avec : node scripts/narvos-morphs-vers-glb.mjs --apply");
  process.exit(1);
}

/** Noms de morph réellement présents dans le mesh. */
function morphsDuGlb(fichier) {
  const buf = fs.readFileSync(fichier);
  if (buf.toString("utf8", 0, 4) !== "glTF") throw new Error("pas un GLB : " + fichier);
  const len = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.toString("utf8", 20, 20 + len));
  const noms = gltf.meshes?.[0]?.extras?.targetNames;
  if (!Array.isArray(noms) || noms.length === 0) {
    throw new Error("le GLB ne porte pas de targetNames");
  }
  return noms;
}

const noms = morphsDuGlb(GLB);
console.log(`  ${noms.length} morph(s) lus dans le GLB cuit`);

const macros = fs.readFileSync(`${BASE}/Logic/Macros.lua`, "utf8");
const tests = fs.readFileSync(new URL("./macros-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

// Table d'appartenance plutôt que liste : les tests testent 630 noms, et un
// parcours linéaire à chaque fois rendrait la suite inutilement lente.
const table = noms.map((n) => `[${JSON.stringify(n)}] = true`).join(", ");

const script = `
MORPHS_REELS = { ${table} }

local Macros = (function()
${macros}
end)()

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