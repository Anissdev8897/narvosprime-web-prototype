// pnj-anims.mjs — BLOQUANT. Prouve que l'animation passée aux CharacterSimple
// du Spawner est (1) non vide, (2) une référence qui EXISTE dans le pack cuit,
// (3) du même squelette que le mesh (règle du même dossier, cf. en-tête de
// pnj-squelettes.mjs), et que la table couvre exactement les entrées « simple »
// du catalogue — ni trou, ni doublon, ni reste d'un copier-coller.
//
// Le fond (quel clip est le VRAI idle) est mesuré par pnj-anims-verif.mjs ;
// ce contrôle-ci verrouille la référence et la couverture à chaque chantier.

import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(process.cwd());
const SPAWNER = path.join(RACINE, "WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Spawner.lua");
const SPAWNABLES = path.join(RACINE, "WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Spawnables.lua");
const TOML = path.join(RACINE, "WebPortal/Server/Assets/narvos/Assets.toml");

let echecs = 0;
const KO = (m) => { echecs++; console.log("  KO       " + m); };
const OK = (m) => console.log("  OK       " + m);

// ── 1. Spawner.lua : la table et l'appel ────────────────────────────────────

const spawner = fs.readFileSync(SPAWNER, "utf8");

const blocTable = spawner.match(/Spawner\.ANIM_REPOS = \{(.*?)\n\}/s);
if (!blocTable) { KO("Spawner.ANIM_REPOS introuvable"); process.exit(1); }
const repos = {};
for (const m of blocTable[1].matchAll(/(\w+) = "([^"]+)"/g)) {
    if (repos[m[1]]) KO(`doublon dans ANIM_REPOS : ${m[1]}`);
    repos[m[1]] = m[2];
}

const blocBloques = spawner.match(/Spawner\.ANIM_BLOQUES = \{(.*?)\}/s);
const bloques = blocBloques
    ? [...blocBloques[1].matchAll(/(\w+) = true/g)].map(m => m[1])
    : [];

console.log("[1. l'argument passé à PlayAnimation est non vide]");
const appel = spawner.match(/entite:PlayAnimation\(Catalogue\.PACK \.\. "::" \.\. anim, "", true\)/);
if (appel) OK("PlayAnimation(Catalogue.PACK .. \"::\" .. anim, \"\", true) — référence packée, en boucle");
else KO("appel PlayAnimation attendu introuvable dans Spawner.lua");
const vide = spawner.match(/PlayAnimation\(""/);
if (vide) KO("un PlayAnimation(\"\") subsiste");
else OK("aucun PlayAnimation avec une chaîne vide");

// ── 2. Couverture exacte des entrées « simple » ─────────────────────────────

console.log("[2. ANIM_REPOS + ANIM_BLOQUES = exactement les entrées simple]");
const spawnables = fs.readFileSync(SPAWNABLES, "utf8").split("\n")
    .filter(l => l.includes("simple = true"))
    .map(l => l.match(/id = "([^"]+)"/)[1]);

for (const id of spawnables) {
    const dansRepos = id in repos;
    const dansBloques = bloques.includes(id);
    if (dansRepos && dansBloques) KO(`${id} est dans ANIM_REPOS ET ANIM_BLOQUES`);
    else if (!dansRepos && !dansBloques) KO(`${id} (simple) n'est ni animé ni déclaré bloqué`);
}
for (const id of Object.keys(repos)) {
    if (!spawnables.includes(id)) KO(`${id} est dans ANIM_REPOS sans être une entrée simple du catalogue`);
}
for (const id of bloques) {
    if (!spawnables.includes(id)) KO(`${id} est dans ANIM_BLOQUES sans être une entrée simple du catalogue`);
}
if (echecs === 0) OK(`${Object.keys(repos).length} animés + ${bloques.length} bloqués = ${spawnables.length} simples, couverture exacte`);

// ── 3. Chaque référence existe dans le pack, sur le même squelette ──────────

console.log("[3. référence existante dans Assets.toml, même dossier que le mesh]");
const sections = {}; let courante = null;
for (const ligne of fs.readFileSync(TOML, "utf8").split("\n")) {
    const s = ligne.match(/^\s*\[assets\.(\w+)\]/);
    if (s) { courante = s[1]; sections[courante] = sections[courante] || {}; continue; }
    const e = ligne.match(/^\s*([A-Za-z0-9_\-]+) = "([^"]+)"/);
    if (e && courante) sections[courante][e[1]] = e[2];
}
const dossierDe = (p) => p.split("/").slice(0, -1).join("/");
const meshParId = {};
for (const l of fs.readFileSync(SPAWNABLES, "utf8").split("\n")) {
    if (!l.includes("simple = true")) continue;
    meshParId[l.match(/id = "([^"]+)"/)[1]] = l.match(/asset = "([^"]+)"/)[1];
}

let verifies = 0;
for (const [id, anim] of Object.entries(repos)) {
    const cheminAnim = (sections.animations || {})[anim];
    if (!cheminAnim) { KO(`${id} : « ${anim} » absent de [assets.animations]`); continue; }
    const cheminMesh = (sections.skeletal_meshes || {})[meshParId[id]];
    if (!cheminMesh) { KO(`${id} : mesh « ${meshParId[id]} » absent de [assets.skeletal_meshes]`); continue; }
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]