// ══════════════════════════════════════════════════════════════════════════════
// narvos-stager-pack-uasset.mjs — poser un pack `.uasset` dans l'ADK, dossier
// par dossier, selon un manifeste. N'ouvre pas l'éditeur.
//
//   node scripts/narvos-stager-pack-uasset.mjs <manifeste>            (essai)
//   node scripts/narvos-stager-pack-uasset.mjs <manifeste> --apply    (copie)
//
// ── POURQUOI UN STAGER, ET PAS UN IMPORT ─────────────────────────────────────
// `adk-import-narvos.py` importe des GLB par Interchange. Les packs achetés sur
// Fab, eux, sont déjà du contenu Unreal : 975 `.uasset` pour « Survival Crafting
// Stations ». Il n'y a rien à importer — il faut les POSER dans Content/ et
// laisser l'éditeur les remettre à la version du projet à la première ouverture.
//
// ── POURQUOI DOSSIER PAR DOSSIER ─────────────────────────────────────────────
// Tout ce qui finit sous `/Game/Narvos/` part au cook, et le pack que le client
// télécharge pèse déjà 71 Go. Un pack contient toujours une démo, des niveaux et
// des widgets qui ne servent à rien chez nous (l'UI de nanos est en WebUI). Le
// manifeste dit ce qu'on garde ET ce qu'on écarte, avec la raison — un tri écrit
// se relit, un tri fait à la main se réinvente à chaque pack.
//
// ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────────────
// Il ne promeut rien sous `Narvos/` : c'est `adk-promouvoir-packs.py`, éditeur
// fermé, qui le fait en réécrivant les référents. Il ne plafonne pas les
// textures non plus (`adk-plafonner-textures.py`). Un stager qui ferait tout
// serait un script qu'on n'ose plus relancer.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const manifeste = process.argv[2];
const APPLIQUER = process.argv.includes("--apply");

if (!manifeste || !fs.existsSync(manifeste)) {
  console.error("Usage : node scripts/narvos-stager-pack-uasset.mjs <manifeste.json> [--apply]");
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(manifeste, "utf8"));
const ADK = "E:/narvosprime-web-prototype/WebPortal/Server/adk/Content";

if (!fs.existsSync(plan.source)) {
  console.error(`ARRÊT : source introuvable — ${plan.source}`);
  process.exit(1);
}

// Le dossier d'accueil : /Game/<X> devient Content/<X>.
const cible = path.join(ADK, plan.destination_staging.replace(/^\/Game\//, ""));

console.log(`pack        : ${plan.pack}`);
console.log(`source      : ${plan.source}`);
console.log(`destination : ${cible}`);
console.log("");

function copier(depuis, vers) {
  let fichiers = 0;
  let octets = 0;
  const pile = [[depuis, vers]];
  while (pile.length) {
    const [d, v] = pile.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const src = path.join(d, e.name);
      const dst = path.join(v, e.name);
      if (e.isDirectory()) { pile.push([src, dst]); continue; }
      fichiers++;
      octets += fs.statSync(src).size;
      if (!APPLIQUER) continue;
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      // ⚠ On n'écrase JAMAIS : un asset déjà posé peut avoir été resauvé par
      // l'éditeur à la version du projet, et le remplacer par l'original le
      // ferait régresser sans un mot.
      if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    }
  }
  return { fichiers, octets };
}

const mo = (o) => (o / 1048576).toFixed(1) + " Mo";

let totalFichiers = 0;
let totalOctets = 0;

for (const garde of plan.garde) {
  const depuis = path.join(plan.source, garde.dossier);
  if (!fs.existsSync(depuis)) {
    console.log(`  ABSENT  ${garde.dossier}`);
    continue;
  }
  const r = copier(depuis, path.join(cible, garde.dossier));
  totalFichiers += r.fichiers;
  totalOctets += r.octets;
  console.log(`  ${APPLIQUER ? "copié " : "à copier"}  ${garde.dossier.padEnd(18)}`
    + `${String(r.fichiers).padStart(5)} fichier(s)  ${mo(r.octets).padStart(10)}`
    + `   ${garde.pourquoi}`);
}

console.log("");
for (const e of plan.ecarte) {
  console.log(`  ÉCARTÉ  ${e.dossier.padEnd(18)}${String(e.uasset ?? "?").padStart(5)} fichier(s)`
    + `   ${e.pourquoi}`);
}

console.log("");
console.log(`${APPLIQUER ? "COPIÉ" : "À COPIER"} : ${totalFichiers} fichier(s), ${mo(totalOctets)}`);
if (plan.plafond_textures) {
  console.log("");
  console.log("⚠ AVANT DE PROMOUVOIR, PLAFONNER LES TEXTURES :");
  console.log(`  ${plan.plafond_textures.pourquoi}`);
  console.log(`  python scripts/ue-remote.py --fichier scripts/adk-plafonner-textures.py`);
}
if (!APPLIQUER) {
  console.log("");
  console.log("Essai — rien n'a été copié. Relancer avec --apply.");
}