// ══════════════════════════════════════════════════════════════════════════════
// narvos-dependances-moteur.mjs — le pack cuit dépend-il de contenu MOTEUR ou de
// PLUGIN qu'il n'embarque pas ?
//
//   node scripts/narvos-dependances-moteur.mjs
//
// ── LE DÉFAUT QU'IL FERME (vu en jeu le 2026-09-13) ───────────────────────────
// La Forge entière au DAMIER. 13 304 instances de matériau cuites avaient pour
// parent `/InterchangeAssets/gltf/MaterialInstances/MI_Default_Opaque_DS` : du
// contenu du plugin d'import glTF, hors `Narvos/`, donc hors pack. Le client nanos a
// SA copie de ce plugin, mais d'origine ; la nôtre (M_Default resauvé le 2026-09-05)
// porte d'autres usages. Une instance consulte les usages de son matériau de base :
// celui du client → matériau par défaut.
//
// `narvos-imports-casses.mjs` ne lisait que les chemins `/Game/` : 15 500 paquets
// dépendaient du plugin et aucun contrôle ne le voyait. Celui-ci lit TOUS les points
// de montage cités par les paquets cuits.
//
// ── CE QUI EST PERMIS ──────────────────────────────────────────────────────────
//   /Game/        notre pack (et /Game/NanosWorld/, le pack de base)
//   /Script/      classes natives
//   /Engine/      contenu moteur de base — SIGNALÉ (compté), pas bloquant : c'est
//                 la dépendance normale de tout pack
// Tout AUTRE point de montage (plugins : /InterchangeAssets/, /MetaHuman/,
// /ControlRig/…) est une dépendance à une copie que le client possède PEUT-ÊTRE, dans
// une AUTRE version. Le script les liste par montage, avec des exemples, et ÉCHOUE
// sur les montages déclarés dangereux (MONTAGES_BLOQUANTS).
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const PACK = "E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos/Narvos";
const PERMIS = new Set(["Game", "Script", "Engine", "Temp", "Memory", "Config"]);
/** Montages dont on SAIT qu'ils cassent le rendu s'ils ne sont pas dans le pack. */
const MONTAGES_BLOQUANTS = new Set(["InterchangeAssets"]);
/** Notre copie volontaire du plugin (redirect /InterchangeAssets/ -> /Game/Narvos/Interchange/).
 *  ⚠ Le dossier ne porte PAS le nom du montage : avec un redirect par sous-chaine, une cible
 *  qui contient la source se reapplique a son resultat (/Game/Narvos/Game/Narvos/...,
 *  mesure le 2026-09-13). Garde : lua-harness/redirects-idempotents-check.mjs. */
const COPIES = ["Interchange"];

if (!fs.existsSync(PACK)) {
  console.error(`ARRET : ${PACK} absent — le pack n'est pas construit.`);
  process.exit(1);
}

const parMontage = new Map();   // montage -> { paquets: Set, exemples: [] }
let paquets = 0;

function parcourir(dossier) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) { parcourir(p); continue; }
    if (!e.name.endsWith(".uasset")) continue;
    const relatif = path.relative(PACK, p).replace(/\\/g, "/");
    // Notre copie du plugin cite legitimement son propre nom d'origine.
    if (COPIES.some((c) => relatif.startsWith(c + "/"))) continue;
    paquets++;
    const texte = fs.readFileSync(p).toString("latin1");
    const vus = new Set();
    for (const m of texte.matchAll(/\/([A-Za-z][A-Za-z0-9_]{1,60})\/[A-Za-z0-9_]/g)) {
      const montage = m[1];
      if (PERMIS.has(montage) || vus.has(montage)) continue;
      // Un segment de chemin interne (`/Game/X/Materials/…`) apparaît aussi comme
      // `/Materials/…` : on ne garde que ce qui SUIT un séparateur de début de chaîne
      // de référence (octet non alphanumérique avant le `/`).
      const avant = texte.charCodeAt(m.index - 1);
      if ((avant >= 48 && avant <= 57) || (avant >= 65 && avant <= 90) || (avant >= 97 && avant <= 122) || avant === 95) continue;
      vus.add(montage);
      if (!parMontage.has(montage)) parMontage.set(montage, { paquets: new Set(), exemples: [] });
      const f = parMontage.get(montage);
      f.paquets.add(relatif);
      if (f.exemples.length < 3) f.exemples.push(relatif);
    }
  }
}
parcourir(PACK);

// Un « montage » qui n'apparaît qu'une poignée de fois sans être un plugin connu est
// souvent un morceau de texte : on n'affiche que ceux qui ressemblent à des références.
const lignes = [...parMontage.entries()]
  .filter(([m, f]) => MONTAGES_BLOQUANTS.has(m) || f.paquets.size >= 3)
  .sort((a, b) => b[1].paquets.size - a[1].paquets.size);

console.log(`Dependances hors /Game/ /Script/ /Engine/ dans ${paquets} paquet(s) cuit(s) de Narvos/`);
let bloquants = 0;
for (const [m, f] of lignes.slice(0, 25)) {
  const bloque = MONTAGES_BLOQUANTS.has(m);
  if (bloque) bloquants += f.paquets.size;
  console.log(`  ${bloque ? "BLOQUANT" : "signale "}  /${m}/  ${f.paquets.size} paquet(s)  ex. ${f.exemples.join(" | ")}`);
}
console.log("");
if (bloquants > 0) {
  console.log(`${bloquants} paquet(s) dependent d'un montage BLOQUANT : leur rendu dependra de la copie du CLIENT.`);
  process.exitCode = 1;
} else {
  console.log("Aucune dependance a un montage bloquant.");
}