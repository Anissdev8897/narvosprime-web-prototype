import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// menottes-cablage-check.mjs — les menottes sont-elles BRANCHÉES, d'un bout à
// l'autre ?
//
//   node scripts/lua-harness/menottes-cablage-check.mjs
//
// ── POURQUOI UN CONTRÔLE STATIQUE, EN PLUS DES 110 ASSERTIONS ────────────────
// `Logic/Menottes.lua` était prouvé depuis septembre, et AUCUN fichier du serveur
// ne l'appelait (mesure du 2026-09-13). Ses tests passaient tous : ils prouvent la
// décision, jamais qu'on la consulte. Ce contrôle-ci prouve le CÂBLAGE :
//
//   1. chaque capacité perdue (`CAPACITES`) est refusée par au moins un
//      gestionnaire serveur — sinon un menotté la garde, en silence ;
//   2. chaque garde nomme une capacité DÉCLARÉE — `Refuse(player, "inventaires")`
//      lirait `Drapeaux["inventaires"]` = nil et laisserait TOUT passer ;
//   3. la touche existe (catalogue de commandes), le client l'envoie, le serveur
//      l'écoute ; le son diffusé par le serveur a un abonné client.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const PAQUETS = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";
const LOGIQUE = `${PAQUETS}/narvos/Shared/Logic/Menottes.lua`;
const COMMANDES = `${PAQUETS}/narvos/Shared/Logic/Commandes.lua`;
const SERVEUR = `${PAQUETS}/narvos-map-proto/Server`;
const CLIENT = `${PAQUETS}/narvos-map-proto/Client/Index.lua`;

let reussis = 0;
let echecs = 0;
const ok = (condition, nom) => {
  if (condition) reussis++;
  else { echecs++; console.log(`  ECHEC  ${nom}`); }
};

/** Le code sans ses commentaires : un commentaire qui CITE une garde ne la pose pas. */
const sansCommentaires = (s) => s.replace(/--\[\[[\s\S]*?\]\]/g, "").replace(/--.*$/gm, "");

// ── 1. Les capacités déclarées ───────────────────────────────────────────────
const logique = sansCommentaires(fs.readFileSync(LOGIQUE, "utf8"));
const bloc = logique.match(/Menottes\.CAPACITES = \{([^}]*)\}/);
ok(bloc !== null, "Menottes.CAPACITES est lisible");
const capacites = bloc ? [...bloc[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
ok(capacites.length > 0, "au moins une capacité déclarée");

// ── 2. Les gardes posées côté serveur ────────────────────────────────────────
const gardes = new Map();   // capacité -> [fichier:ligne]
for (const nom of fs.readdirSync(SERVEUR).filter((f) => f.endsWith(".lua"))) {
  const lignes = fs.readFileSync(path.join(SERVEUR, nom), "utf8").split("\n");
  lignes.forEach((ligne, i) => {
    const code = ligne.replace(/--.*$/, "");
    for (const m of code.matchAll(/MenottesServeur\.Refuse\(\s*player\s*,\s*"([^"]+)"\s*\)/g)) {
      if (!gardes.has(m[1])) gardes.set(m[1], []);
      gardes.get(m[1]).push(`${nom}:${i + 1}`);
    }
  });
}

for (const [cap, lieux] of gardes) {
  ok(capacites.includes(cap), `la garde « ${cap} » nomme une capacité déclarée (${lieux.join(", ")})`);
}
for (const cap of capacites) {
  ok(gardes.has(cap), `la capacité « ${cap} » est refusée par au moins un gestionnaire`);
}

// ── 3. La touche, l'événement, le son ────────────────────────────────────────
const index = sansCommentaires(fs.readFileSync(`${SERVEUR}/Index.lua`, "utf8"));
ok(/Package\.Require\("Server\/Menottes\.lua"\)/.test(index), "Server/Index.lua charge l'exécutant");
ok(/Events\.SubscribeRemote\("Narvos:Menotter"/.test(index), "le serveur écoute Narvos:Menotter");
ok(/MenottesServeur\.Configurer\(/.test(index), "l'exécutant reçoit le sac et les droits");
ok(/Menottes\.Configurer\(\{\s*animation_menotte\s*=/.test(index), "la clé d'animation est injectée dans le module");

const commandes = sansCommentaires(fs.readFileSync(COMMANDES, "utf8"));
ok(/\{ id = "menotter",/.test(commandes), "la commande « menotter » est au catalogue de touches");

const client = sansCommentaires(fs.readFileSync(CLIENT, "utf8"));
const action = client.match(/ACTIONS\.menotter = function\(\)([\s\S]*?)\nend/);
ok(action !== null, "le client définit ACTIONS.menotter");
ok(action !== null && /Events\.CallRemote\("Narvos:Menotter",\s*Reliability\.Reliable/.test(action[1]),
  "ACTIONS.menotter envoie Narvos:Menotter, avec sa fiabilité");

const executant = sansCommentaires(fs.readFileSync(`${SERVEUR}/Menottes.lua`, "utf8"));
const diffuses = [...executant.matchAll(/BroadcastRemote\w*\("([^"]+)"/g)].map((m) => m[1]);
ok(diffuses.length > 0, "l'exécutant diffuse au moins un événement");
for (const e of diffuses) {
  ok(new RegExp(`Events\\.SubscribeRemote\\("${e.replace(/[:]/g, "\\:")}"`).test(client),
    `le client écoute ${e}`);
}

console.log("");
console.log(`${reussis} reussi(s), ${echecs} echec(s) — ${capacites.length} capacité(s), ${[...gardes.values()].flat().length} garde(s)`);
if (echecs > 0) process.exitCode = 1;