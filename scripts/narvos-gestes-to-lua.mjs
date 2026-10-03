// ══════════════════════════════════════════════════════════════════════════════
// narvos-gestes-to-lua.mjs — les gestes PROPRES à une famille de PNJ (attaque,
// réaction par côté, cri), choisis par CHEMIN dans Assets.toml.
//
//   node scripts/narvos-gestes-to-lua.mjs [--apply]
//
// Produit `Shared/Catalogs/Gestes.lua`, lu par `narvos-map-proto/Server/Ia.lua`
// (le coup) et `Server/Combat.lua` (la réaction au coup reçu).
//
// ── POURQUOI ─────────────────────────────────────────────────────────────────
// Mesure du 2026-09-13 : les infectés frappaient avec la chaîne de Freeflow — un
// zombie qui porte des coups de sabre. Le lot 3 cuit les animations d'AI Behavior
// System RETARGETÉES sur le Mannequin UE4 (squelette de nanos) : attaques gauche et
// droite, réactions avant/arrière/gauche/droite, cri. Elles sont sous
// `Narvos/AIBehaviorSystem/Retarget/Zombie/` ; leurs noms (`HitReact_Front`…)
// existent dans d'autres packs, et une clé est un RANG (CLAUDE.md) : on part du
// CHEMIN, jamais du nom.
//
// Une famille dont un geste manque n'est PAS écrite : Ia.lua et Combat.lua
// gardent alors leurs gestes génériques. Aucune référence morte.
//
// ⚠ À lancer APRÈS `nanos-build-asset-pack.mjs --apply`.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Gestes.lua`;
const APPLY = process.argv.includes("--apply");

/** Par famille de Spawnables : le dossier cuit et les NOMS DE FICHIER qu'on y attend. */
const FAMILLES = {
  Infectes: {
    dossier: "Narvos/AIBehaviorSystem/Retarget/Zombie/",
    attaques: ["ZombieAttack_Left", "ZombieAttack_Right"],
    reactions: { avant: "HitZombie_Front", arriere: "HitZombie_Back", gauche: "HitZombie_Left", droite: "HitZombie_Right" },
    cri: "ZombieScream",
  },
};

if (!fs.existsSync(TOML)) {
  console.error(`ARRÊT : ${TOML} absent — le pack n'est pas construit.`);
  process.exit(1);
}

// ── Chemin -> clé, section [assets.animations] ───────────────────────────────
// Les clés peuvent être QUOTÉES (`"X+Y" = …`) : le builder quote ce qu'une clé nue
// n'accepte pas (voir narvos-anims-to-lua.mjs, 75 animations perdues le 04/09).
const cleParChemin = new Map();
{
  let dans = false;
  for (const ligne of fs.readFileSync(TOML, "utf8").split(/\r?\n/)) {
    const section = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) { dans = section[1] === "assets.animations"; continue; }
    if (!dans) continue;
    const m = ligne.match(/^\s*(?:"([^"]+)"|([^\s=#"]+))\s*=\s*"([^"]+)"\s*$/);
    if (m) cleParChemin.set(m[3], m[1] ?? m[2]);
  }
}
const cle = (dossier, fichier) => {
  const k = cleParChemin.get(dossier + fichier);
  return k ? `narvos::${k}` : null;
};

const ecrites = [];
const lignes = [];
for (const [famille, f] of Object.entries(FAMILLES)) {
  const attaques = f.attaques.map((n) => cle(f.dossier, n));
  const reactions = Object.fromEntries(Object.entries(f.reactions).map(([cote, n]) => [cote, cle(f.dossier, n)]));
  const cri = cle(f.dossier, f.cri);
  const manquants = [
    ...f.attaques.filter((_, i) => !attaques[i]),
    ...Object.entries(f.reactions).filter(([cote]) => !reactions[cote]).map(([, n]) => n),
    ...(cri ? [] : [f.cri]),
  ];
  if (manquants.length > 0) {
    console.log(`  ${famille.padEnd(10)} NON ECRITE — absents sous ${f.dossier} : ${manquants.join(", ")}`);
    lignes.push(`-- ${famille} : NON ECRITE — absents de ${f.dossier} : ${manquants.join(", ")}`);
    continue;
  }
  console.log(`  ${famille.padEnd(10)} ${attaques.join(", ")} | ${Object.values(reactions).join(", ")} | ${cri}`);
  ecrites.push(famille);
  lignes.push([
    `    ${famille} = {`,
    `        attaques = { ${attaques.map((a) => JSON.stringify(a)).join(", ")} },`,
    `        reactions = {`,
    ...Object.entries(reactions).map(([cote, a]) => `            ${cote} = ${JSON.stringify(a)},`),
    `        },`,
    `        cri = ${JSON.stringify(cri)},`,
    `    },`,
  ].join("\n"));
}

if (!APPLY) {
  console.log(`\nSimulation — rien écrit. Ajouter --apply pour produire :\n  ${SORTIE}`);
  process.exit(0);
}

const familles = lignes.filter((l) => !l.startsWith("--")).join("\n");
const absentes = lignes.filter((l) => l.startsWith("--")).join("\n");
const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- Gestes.lua — les gestes propres a une famille de PNJ, par CHEMIN dans le pack.
--
-- FICHIER GENERE par scripts/narvos-gestes-to-lua.mjs depuis Assets.toml.
-- Ne pas editer a la main : regenerer apres chaque construction du pack.
--
-- ${ecrites.length} famille(s) ecrite(s)${ecrites.length ? " : " + ecrites.join(", ") : ""}. Une famille absente garde les
-- gestes generiques (chaine Freeflow, ACB_Hurt) dans Ia.lua et Combat.lua.
${absentes}
-- ══════════════════════════════════════════════════════════════════════════════

local Gestes = {}

--- Par famille de Spawnables : attaques (alternees), reactions par cote, cri.
Gestes.FAMILLES = {
${familles}
}

--- Les gestes d'une famille, ou nil.
---@param famille any
---@return table|nil
function Gestes.De(famille)
    if (type(famille) ~= "string") then return nil end
    return Gestes.FAMILLES[famille]
end

return Gestes
`;
fs.writeFileSync(SORTIE, lua);
console.log(`\nécrit : ${SORTIE}`);