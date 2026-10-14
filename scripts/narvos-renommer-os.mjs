// ══════════════════════════════════════════════════════════════════════════════
// narvos-renommer-os.mjs — renomme des os dans des GLB, sans rien toucher d'autre.
//
//   node scripts/narvos-renommer-os.mjs <dossier|fichier> <sortie> Root=root [...] [--apply]
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// Unreal apparie les os par leur NOM de nœud à l'import. Une seule majuscule
// suffit à casser l'appariement : le pack SciFi_Trooper_Set nomme sa racine
// `Root` là où SKEL_Mannequin l'appelle `root`, et 38 de ses 94 pièces portables
// sortaient en `REPARENTE` — non pas parce que leur squelette diffère, mais
// parce que `root` était introuvable et que tout ce qui en pendait semblait donc
// rattaché ailleurs.
//
// Mesuré le 2026-09-03 : hors cette majuscule, les 68 os et TOUTE la hiérarchie
// sont identiques à la référence.
//
// ── CE QUE CE SCRIPT NE FAIT PAS ──────────────────────────────────────────────
// Il ne retargete rien. Renommer un os ne déplace aucun sommet et ne recalcule
// aucun poids : c'est une correction d'ÉTIQUETTE, valable uniquement quand la
// structure est déjà bonne. Le vérifier AVANT :
//
//   node scripts/narvos-skeleton-compat.mjs <dossier> --detail
//
// Si le verdict est `INTERCALE` ou `ETRANGER`, ce script ne servira à rien — le
// problème est ailleurs.
//
// ── GARDE-FOU ─────────────────────────────────────────────────────────────────
// Le script REFUSE de renommer vers un nom déjà pris : deux os homonymes dans un
// même squelette produiraient un appariement arbitraire, et le défaut ne se
// verrait qu'à l'écran.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "../WebPortal/node_modules/@gltf-transform/core/dist/index.js";
import { ALL_EXTENSIONS } from "../WebPortal/node_modules/@gltf-transform/extensions/dist/index.js";

const args = process.argv.slice(2).filter((a) => a !== "--apply");
const APPLY = process.argv.includes("--apply");

const cible = args[0];
const sortie = args[1];
const paires = args.slice(2).filter((a) => a.includes("="));

if (!cible || !sortie || paires.length === 0) {
  console.error("Usage : node scripts/narvos-renommer-os.mjs <dossier|fichier> <sortie> Ancien=Nouveau [...] [--apply]");
  console.error("Exemple : … SciFi_Trooper_Set _os_renommes Root=root --apply");
  process.exit(1);
}
if (!fs.existsSync(cible)) {
  console.error(`Introuvable : ${cible}`);
  process.exit(1);
}

const RENOMMAGE = new Map(paires.map((p) => {
  const [de, vers] = p.split("=");
  return [de, vers];
}));

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
for (const [de, vers] of RENOMMAGE) console.log(`  ${de} -> ${vers}`);
console.log("");

// ── Collecte ──────────────────────────────────────────────────────────────────

const fichiers = [];
const collecter = (p) => {
  const st = fs.statSync(p);
  if (st.isFile()) {
    if (p.toLowerCase().endsWith(".glb")) fichiers.push(p);
    return;
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) collecter(path.join(p, e.name));
};
collecter(cible);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const racine = fs.statSync(cible).isDirectory() ? cible : path.dirname(cible);

let touches = 0;
let intacts = 0;
let refuses = 0;

for (const f of fichiers) {
  let doc;
  try {
    doc = await io.read(f);
  } catch (err) {
    console.log(`  ILLISIBLE ${path.basename(f)} — ${err.message.split("\n")[0]}`);
    refuses++;
    continue;
  }

  const noeuds = doc.getRoot().listNodes();
  const noms = new Set(noeuds.map((n) => n.getName()));

  // ⚠ Refuser une collision. Renommer `Root` en `root` alors qu'un `root` existe
  // déjà donnerait deux os homonymes, et l'appariement à l'import deviendrait
  // arbitraire — un défaut qui ne se verrait qu'à l'écran.
  let collision = null;
  for (const [de, vers] of RENOMMAGE) {
    if (noms.has(de) && noms.has(vers)) collision = `${de} et ${vers} coexistent`;
  }
  if (collision) {
    console.log(`  REFUSÉ    ${path.basename(f)} — ${collision}`);
    refuses++;
    continue;
  }

  let n = 0;
  for (const noeud of noeuds) {
    const nouveau = RENOMMAGE.get(noeud.getName());
    if (nouveau) {
      noeud.setName(nouveau);
      n++;
    }
  }

  if (n === 0) {
    intacts++;
    continue;
  }

  const destination = path.join(sortie, path.relative(racine, f));
  if (APPLY) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await io.write(destination, doc);
  }

  touches++;
  if (touches <= 5) console.log(`  RENOMMÉ   ${path.basename(f)}  (${n} os)`);
}

console.log("");
console.log(`  ${touches} renommé(s), ${intacts} sans occurrence, ${refuses} refusé(s)`);

if (APPLY && touches > 0) {
  console.log("");
  console.log(`  écrit sous : ${sortie}`);
  console.log("");
  console.log("  Vérifier AVANT d'importer :");
  console.log(`    node scripts/narvos-skeleton-compat.mjs ${sortie}`);
} else if (!APPLY) {
  console.log("");
  console.log("Rien écrit.");
}