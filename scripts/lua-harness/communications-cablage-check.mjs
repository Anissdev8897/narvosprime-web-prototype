// ══════════════════════════════════════════════════════════════════════════════
// communications-cablage-check.mjs — talkie-walkie, smartphone et digicode
// sont-ils BRANCHÉS, d'un bout à l'autre ?
//
//   node scripts/lua-harness/communications-cablage-check.mjs
//
// ── POURQUOI UN CONTRÔLE STATIQUE, EN PLUS DES 93 ASSERTIONS ─────────────────
// `communications.mjs` et `digicode.mjs` prouvent les DÉCISIONS (qui entend,
// qui écrit à qui, empreinte, blocage). Ils passeraient tous si aucun fichier du
// serveur ne les appelait — c'est exactement l'état où étaient les menottes le
// 2026-09-13. Ce contrôle prouve le CÂBLAGE :
//
//   1. les modules sont chargés (Shared/Index.lua, Server/Index.lua) et
//      configurés, la commande de chat est routée, les portes sont chargées ;
//   2. chaque événement que le serveur ENVOIE a un abonné client, chaque
//      événement que le client ENVOIE a un abonné serveur — des deux côtés
//      d'une frontière que rien d'autre ne vérifie ;
//   3. la touche du téléphone existe au catalogue ET chez le client, la porte
//      passe AVANT le ramassage dans l'interaction ;
//   4. la table `digicodes` porte chaque colonne que l'exécutant écrit, et la
//      garde de zone est LA MÊME que celle des props (pas une copie) ;
//   5. le catalogue des meshes est régénéré par la chaîne de cook et exclu du
//      verrou d'identité, comme les cinq autres catalogues choisis par chemin.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const PAQUETS = `${RACINE}/WebPortal/Server/nanos_world/packages`;

let reussis = 0;
let echecs = 0;
const ok = (condition, nom) => {
  if (condition) reussis++;
  else { echecs++; console.log(`  ECHEC  ${nom}`); }
};

/** Le code sans ses commentaires : un commentaire qui CITE un appel ne le pose pas. */
const sansCommentaires = (s) => s.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, "").replace(/--.*$/gm, "");
const lire = (chemin) => {
  if (!fs.existsSync(chemin)) { ok(false, `fichier présent : ${chemin}`); return ""; }
  return fs.readFileSync(chemin, "utf8");
};
const tous = (source, motif) => [...source.matchAll(motif)].map((m) => m[1]);

const shared = sansCommentaires(lire(`${PAQUETS}/narvos/Shared/Index.lua`));
const index = sansCommentaires(lire(`${PAQUETS}/narvos-map-proto/Server/Index.lua`));
const comms = sansCommentaires(lire(`${PAQUETS}/narvos-map-proto/Server/Communications.lua`));
const digicodeBrut = lire(`${PAQUETS}/narvos-map-proto/Server/Digicode.lua`);
const digicode = sansCommentaires(digicodeBrut);
const client = sansCommentaires(lire(`${PAQUETS}/narvos-map-proto/Client/Index.lua`));
const commandes = sansCommentaires(lire(`${PAQUETS}/narvos/Shared/Logic/Commandes.lua`));
const comptes = lire(`${PAQUETS}/narvos/Shared/Logic/Comptes.lua`);

// ── 1. Chargement et configuration ───────────────────────────────────────────
console.log("[chargement]");
for (const m of ["Logic/TexteChat.lua", "Logic/Radio.lua", "Logic/Telephone.lua", "Logic/Digicode.lua", "Catalogs/ObjetsDivers.lua"]) {
  ok(shared.includes(`Package.Require("${m}")`), `Shared/Index.lua charge ${m}`);
}
ok(shared.indexOf('Package.Require("Logic/TexteChat.lua")') < shared.indexOf('Package.Require("Logic/Radio.lua")'),
  "TexteChat est chargé AVANT Radio, qui le capture");
ok(/Package\.Require\("Server\/Communications\.lua"\)/.test(index), "Server/Index.lua charge Communications.lua");
ok(/Package\.Require\("Server\/Digicode\.lua"\)/.test(index), "Server/Index.lua charge Digicode.lua");
ok(/CommunicationsServeur\.Configurer\(\{[\s\S]*?grille\s*=[\s\S]*?est_admin\s*=[\s\S]*?nom\s*=/.test(index),
  "Communications reçoit le sac, les droits et le nom du personnage");
const confDigicode = index.match(/DigicodeServeur\.Configurer\(\{([\s\S]*?)\n\}\)/);
ok(confDigicode !== null, "Digicode est configuré");
for (const cle of ["base", "grille", "ecrire", "compte_de", "peut_editer_ici", "joueur_de", "est_admin"]) {
  ok(confDigicode !== null && new RegExp(`\\b${cle}\\s*=`).test(confDigicode[1]), `Digicode reçoit « ${cle} »`);
}
ok(/Narvos\.DigicodeServeur\.Charger\(\)/.test(index), "les portes en base sont chargées au démarrage");
ok(/COMMANDES\.radio = function/.test(index), "la commande /radio est routée");
ok(/COMMANDES\.digicode = function/.test(index), "la commande /digicode est routée");

// La garde de zone est NOMMÉE et partagée — une copie divergerait.
ok(/local function PeutEditerIci\(player, x, y, z\)/.test(index), "la garde des props est une fonction nommée");
ok(/PropsServeur\.UtiliserGarde\(PeutEditerIci\)/.test(index), "les props utilisent PeutEditerIci");
ok(confDigicode !== null && /peut_editer_ici\s*=\s*PeutEditerIci\b/.test(confDigicode[1]),
  "la porte à code utilise LA MÊME garde (PeutEditerIci)");
ok(/Zones\.PeutEditer\(/.test(index.match(/local function PeutEditerIci[\s\S]*?\nend/)?.[0] ?? ""),
  "PeutEditerIci consulte Zones.PeutEditer");

// ── 2. Les événements, des deux côtés ────────────────────────────────────────
console.log("[événements]");
const serveur = `${comms}\n${digicode}`;
const envoyesServeur = new Set(tous(serveur, /Events\.CallRemote\("([^"]+)"/g));
const ecoutesClient = new Set(tous(client, /Events\.SubscribeRemote\("([^"]+)"/g));
ok(envoyesServeur.size >= 5, `le serveur envoie au moins 5 événements (${envoyesServeur.size})`);
for (const e of envoyesServeur) ok(ecoutesClient.has(e), `serveur -> client ${e} : le client l'écoute`);

const ecoutesServeur = new Set(tous(serveur, /Events\.SubscribeRemote\("([^"]+)"/g));
const envoyesClient = new Set(tous(client, /Events\.CallRemote\("((?:Narvos:Telephone|Narvos:Digicode)[^"]*)"/g));
ok(ecoutesServeur.size >= 5, `le serveur écoute au moins 5 événements (${ecoutesServeur.size})`);
for (const e of ecoutesServeur) ok(envoyesClient.has(e), `client -> serveur ${e} : le client l'envoie`);
for (const e of envoyesClient) ok(ecoutesServeur.has(e), `client -> serveur ${e} : le serveur l'écoute`);

// ── 3. La touche et l'interaction ────────────────────────────────────────────
console.log("[touches]");
ok(/\{ id = "menu_telephone",/.test(commandes), "« menu_telephone » est au catalogue de touches");
const actionTel = client.match(/ACTIONS\.menu_telephone = function\(\)([\s\S]*?)\nend/);
ok(actionTel !== null, "le client définit ACTIONS.menu_telephone");
ok(actionTel !== null && /Events\.CallRemote\("Narvos:Telephone:Ouvrir",\s*Reliability\.Reliable/.test(actionTel[1]),
  "ACTIONS.menu_telephone demande l'ouverture au serveur, avec sa fiabilité");
const interagir = client.match(/ACTIONS\.interagir = function\(\)([\s\S]*?)\nend/);
ok(interagir !== null, "le client définit ACTIONS.interagir");
if (interagir) {
  const iPorte = interagir[1].indexOf('"Narvos:Digicode:Interagir"');
  const iRamasser = interagir[1].indexOf('"Narvos:Ramasser"');
  ok(iPorte >= 0, "l'interaction ouvre la porte à code proche");
  ok(iPorte >= 0 && iRamasser > iPorte, "la porte à code passe AVANT le ramassage (elle annonce sa touche)");
}
// Déclarée avant l'usage : un local lu avant sa déclaration vaut nil pour toujours.
const iDecl = client.indexOf("local digicode_proche = nil");
const iUsage = client.indexOf("ACTIONS.interagir = function()");
ok(iDecl >= 0 && iUsage > iDecl, "digicode_proche est déclaré AVANT ACTIONS.interagir");

// ── 4. La table et les colonnes écrites ──────────────────────────────────────
console.log("[base]");
const create = comptes.match(/CREATE TABLE IF NOT EXISTS digicodes \(([\s\S]*?)\n\s*\)\s*\n\s*\]==\]/);
ok(create !== null, "Comptes.Ouvrir crée la table digicodes");
const colonnes = new Set(create ? tous(create[1], /^\s*([a-z_]+)\s+(?:TEXT|INTEGER|REAL)/gm) : []);
const insert = digicode.match(/INSERT INTO digicodes \(([^)]+)\)/);
ok(insert !== null, "l'exécutant insère une porte");
for (const c of insert ? insert[1].split(",").map((x) => x.trim()) : []) {
  ok(colonnes.has(c), `la colonne insérée « ${c} » existe dans le CREATE`);
}
const select = digicode.match(/SELECT ([a-z_, ]+) FROM digicodes/);
ok(select !== null, "l'exécutant relit les portes");
for (const c of select ? select[1].split(",").map((x) => x.trim()) : []) {
  ok(colonnes.has(c), `la colonne relue « ${c} » existe dans le CREATE`);
}
// Le code en clair n'est JAMAIS écrit : aucune colonne « code ».
ok(!colonnes.has("code"), "la table n'a pas de colonne « code » (empreinte salée seulement)");
ok(!/COMMANDES\.digicode[\s\S]{0,400}%d%d%d%d/.test(index), "la commande /digicode ne lit pas de code dans le chat");

// ── 5. Le catalogue de meshes dans la chaîne ─────────────────────────────────
console.log("[chaîne]");
const verif = lire(`${RACINE}/scripts/narvos-verifier-catalogues.mjs`);
const bloc = verif.match(/const REGENERES_PAR_LA_CHAINE = new Set\(\[([\s\S]*?)\]\);/);
ok(bloc !== null && bloc[1].includes('"ObjetsDivers.lua"'), "ObjetsDivers.lua est hors verrou d'identité (régénéré par la chaîne)");
// La FORME de l'appel, guillemets ou non autour du chemin : `node "$RACINE/…mjs" --apply`.
const lanceLeGenerateur = (script) => /narvos-objets-divers-to-lua\.mjs"?\s+--apply/.test(script);
ok(lanceLeGenerateur(lire(`${RACINE}/.hermes/cook-lot3.sh`)), "le lot 3 régénère ObjetsDivers.lua après le pack");
ok(lanceLeGenerateur(lire(`${RACINE}/scripts/narvos-chaine-cook.sh`)),
  "la chaîne de cook générale régénère ObjetsDivers.lua après le pack");
ok(/Narvos\.ObjetsDivers\.PORTE/.test(digicode) && /ObjetsDivers\.Mesh\(Narvos\.Digicode\.OBJET\)/.test(digicode),
  "la porte pose le cadre, le battant ET le clavier du catalogue");
ok(/ObjetsDivers\.Mesh\(objet\)/.test(comms), "le talkie-walkie et le smartphone passent en main (EnMain)");

console.log("");
console.log(`${reussis} reussis, ${echecs} echec(s)`);
if (echecs > 0) process.exitCode = 1;