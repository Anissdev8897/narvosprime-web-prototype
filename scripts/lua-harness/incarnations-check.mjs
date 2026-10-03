// ══════════════════════════════════════════════════════════════════════════════
// incarnations-check.mjs — qui joue les marchands, et le peut-il ?
//
//   node scripts/lua-harness/incarnations-check.mjs
//
// `Server/Index.lua` distribue les rôles de marchand (`INCARNATION_MARCHANDS`)
// parmi les entrées de `Spawnables.lua`. Cette table relie DEUX catalogues
// GÉNÉRÉS : un renommage d'un côté ou de l'autre la casse sans une erreur — le
// marchand retombe sur son corps du web, un `Meshy_AI_*` gris à ×100. C'est
// exactement ce que Hanibes a vu le 2026-09-10 (« très grands, pas leur
// texture »), et la raison d'être de la table.
//
// Ce contrôle refuse :
//   · une clé qui n'est pas un marchand de `Merchants.lua` ;
//   · un marchand de `Merchants.lua` SANS incarnation (il redeviendrait un géant) ;
//   · une incarnation absente de `Spawnables.lua` ;
//   · une incarnation `simple` — `CharacterSimple` sans Animation Blueprint :
//     une statue, alors que le corps sait marcher sous `Character` ;
//   · une incarnation à `echelle` ≠ 1 — un corps de pack Unreal est déjà en cm ;
//   · une incarnation dont l'asset n'est pas une clé de `[assets.skeletal_meshes]`.
//
// ⚠ ON LIT LE TEXTE, PAS UNE VM — même raison que les autres gardes : charger
// les modules tirerait catalogues et assets pour comparer des chaînes.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const PKG = `${RACINE}/WebPortal/Server/nanos_world/packages`;
const INDEX = `${PKG}/narvos-map-proto/Server/Index.lua`;
const MERCHANTS = `${PKG}/narvos/Shared/Catalogs/Merchants.lua`;
const SPAWNABLES = `${PKG}/narvos/Shared/Catalogs/Spawnables.lua`;
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;

const lire = (p) => fs.readFileSync(p, "utf8");

// ── La distribution ──────────────────────────────────────────────────────────
const index = lire(INDEX);
const debut = index.indexOf("local INCARNATION_MARCHANDS = {");
if (debut < 0) {
  console.error("ROUGE : INCARNATION_MARCHANDS introuvable dans Server/Index.lua");
  process.exit(1);
}
const bloc = index.slice(debut, index.indexOf("\n}", debut));
const distribution = [...bloc.matchAll(/^\s*([A-Za-z0-9_]+)\s*=\s*"([^"]+)"/gm)]
  .map(([, marchand, pnj]) => ({ marchand, pnj }));

// ── Les marchands (entrées de premier niveau : 8 espaces d'indentation) ─────
const marchands = [...lire(MERCHANTS).matchAll(/^ {8}id = "([^"]+)",/gm)].map((m) => m[1]);

// ── Les spawnables ───────────────────────────────────────────────────────────
const entrees = new Map();
for (const m of lire(SPAWNABLES).matchAll(/^\s*\{ id = "([^"]+)", asset = "([^"]+)",(.*)\},?\s*$/gm)) {
  const [, id, asset, reste] = m;
  const echelle = /echelle = ([0-9.]+)/.exec(reste);
  entrees.set(id, {
    asset,
    simple: /simple = true/.test(reste),
    echelle: echelle ? Number(echelle[1]) : 1,
  });
}

// ── Les SkeletalMesh déclarés dans le pack ──────────────────────────────────
const sk = new Set();
{
  let section = "";
  for (const ligne of lire(TOML).split("\n")) {
    const tete = /^\s*\[([^\]]+)\]/.exec(ligne);
    if (tete) { section = tete[1]; continue; }
    if (section !== "assets.skeletal_meshes") continue;
    const cle = /^\s*([A-Za-z0-9_]+)\s*=/.exec(ligne);
    if (cle) sk.add(cle[1]);
  }
}

// ── Contrôles ────────────────────────────────────────────────────────────────
let reussis = 0;
const echecs = [];
const ok = (condition, message) => { if (condition) reussis++; else echecs.push(message); };

// Un lecteur qui ne lit RIEN rendrait tous les contrôles vides — et verts.
ok(distribution.length > 0, "distribution vide (format de INCARNATION_MARCHANDS change ?)");
ok(marchands.length > 0, "Merchants.lua : aucun marchand lu (format change ?)");
ok(entrees.size > 0, "Spawnables.lua : aucune entree lue (format change ?)");
ok(sk.size > 0, "Assets.toml : aucun SkeletalMesh lu");

const distribues = new Set(distribution.map((d) => d.marchand));
for (const { marchand, pnj } of distribution) {
  ok(marchands.includes(marchand), `${marchand} : n'est pas un marchand de Merchants.lua`);
  const e = entrees.get(pnj);
  ok(Boolean(e), `${marchand} -> ${pnj} : absent de Spawnables.lua`);
  if (!e) continue;
  ok(!e.simple, `${marchand} -> ${pnj} : entree simple (CharacterSimple = statue)`);
  ok(e.echelle === 1, `${marchand} -> ${pnj} : echelle ${e.echelle}, attendu 1`);
  ok(sk.has(e.asset), `${marchand} -> ${pnj} : ${e.asset} absent de [assets.skeletal_meshes]`);
}
for (const m of marchands) {
  ok(distribues.has(m), `${m} : marchand sans incarnation — il redeviendrait un corps du web`);
}

if (echecs.length > 0) {
  for (const e of echecs) console.log("  ECHEC  " + e);
  console.log(`${reussis} réussi(s), ${echecs.length} echec(s)`);
  process.exit(1);
}
console.log(`${reussis} réussi(s) — ${distribution.length} marchand(s) incarne(s), `
  + "tous en Character, a l'echelle 1, sur un SkeletalMesh declare.");