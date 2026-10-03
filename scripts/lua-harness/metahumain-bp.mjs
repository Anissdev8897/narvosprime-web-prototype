// ══════════════════════════════════════════════════════════════════════════════
// metahumain-bp.mjs — charge Server/MetaHumainBP.lua avec le VRAI catalogue
// Modular et le VRAI Assets.toml, puis lui applique metahumain-bp-tests.lua.
//
//   node scripts/lua-harness/metahumain-bp.mjs
//
// ── CE QU'IL PROUVE, ET POURQUOI IL EXISTE ───────────────────────────────────
// Le 2026-09-13, le contrôle « Citations Lua » du vérificateur a trouvé dans ce
// fichier trois Blueprints porteurs écrits en dur — `BP_Playable_MH`,
// `BP_MH_Male_Playable`, `BP_MH_Playable_Female1` — dont AUCUN n'est dans
// Assets.toml. La création était passée aux Blueprints à parent natif
// (`BP_MH_Male`, `BP_MH_Female`, champ `blueprint` du catalogue) ; la table
// locale, elle, n'avait pas suivi, et `/mhbp poser` posait un Blueprint absent.
//
// Le correctif lit le catalogue (`MetaHumainBP.PorteurDe`). Ce harnais refuse
// qu'un porteur rendu ne soit pas DÉCLARÉ dans le pack : c'est la question que
// la table en dur ne posait jamais.
//
// ── CE QU'IL SIMULE ───────────────────────────────────────────────────────────
// Le module appelle `Rotator(0, -90, 0)` au chargement ; rien d'autre du moteur
// n'est touché hors des fonctions. `Rotator` est donc la seule simulation.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const PAQUETS = `${RACINE}/WebPortal/Server/nanos_world/packages`;
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;

const module = fs.readFileSync(`${PAQUETS}/narvos-map-proto/Server/MetaHumainBP.lua`, "utf8");
const modular = fs.readFileSync(`${PAQUETS}/narvos/Shared/Catalogs/Modular.lua`, "utf8");
const tests = fs.readFileSync(new URL("./metahumain-bp-tests.lua", import.meta.url), "utf8");

// Les Blueprints DÉCLARÉS, lus dans la section [assets.blueprints] du pack.
if (!fs.existsSync(TOML)) {
  console.error(`ARRET : ${TOML} absent — pack non construit`);
  process.exit(1);
}
const declares = [];
let section = null;
for (const ligne of fs.readFileSync(TOML, "utf8").split("\n")) {
  const s = ligne.match(/^\s*\[assets\.([a-z_]+)\]/);
  if (s) { section = s[1]; continue; }
  const m = ligne.match(/^\s*([^\s=[]+)\s*=\s*"/);
  if (m && section === "blueprints") declares.push(m[1]);
}
if (declares.length === 0) {
  console.error("ARRET : aucun Blueprint lu dans Assets.toml — le motif est perime");
  process.exit(1);
}

const lua = await new LuaFactory().createEngine();

// `Character.Subscribe("Destroy")` (2026-09-14) : le module nettoie le MetaHuman
// d'un personnage détruit. Le harnais garde les abonnements pour les déclencher.
const script = `
function Rotator(p, y, r) return { Pitch = p, Yaw = y, Roll = r } end
ABONNEMENTS_CHARACTER = {}
Character = { Subscribe = function(evenement, fn) ABONNEMENTS_CHARACTER[evenement] = fn end }

local Modular = (function()
${modular}
end)()

DECLARES = {}
for _, nom in ipairs(${JSON.stringify(declares).replace(/^\[/, "{").replace(/\]$/, "}")}) do
    DECLARES[nom] = true
end

Narvos = { Modular = Modular }

local function Charger()
${module}
end

MetaHumainBP = Charger()
VRAI_MODULAR = Modular
CHARGER = Charger

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