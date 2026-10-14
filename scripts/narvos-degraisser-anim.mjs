// ══════════════════════════════════════════════════════════════════════════════
// narvos-degraisser-anim.mjs — retire textures et matériaux d'un GLB d'animation.
//
//   node scripts/narvos-degraisser-anim.mjs <dossier|fichier> <sortie> [--apply]
//
// ── LE PROBLÈME, MESURÉ ───────────────────────────────────────────────────────
// Certains packs livrent leurs animations avec un aperçu texturé embarqué, en
// KTX2. Le GLB déclare alors `KHR_texture_basisu` dans **extensionsRequired**, et
// la spec glTF impose au lecteur de refuser LE FICHIER ENTIER dans ce cas.
// Interchange obéit :
//
//     Not all required extensions are supported. (KHR_texture_basisu)
//     There was no data to import in the provided source data.
//
// Ce n'est donc PAS « la texture est ignorée, l'animation passe » — rien ne
// passe. Mesuré le 2026-09-03 : 68 animations refusées, dont TOUTES les boucles
// assises du pack WW100, c'est-à-dire celles qui servent réellement.
//
// ── LA CORRECTION ─────────────────────────────────────────────────────────────
// On retire images, textures et matériaux. Une animation n'en a aucun besoin :
// elle ne porte que des pistes d'os. L'extension disparaît avec eux, et
// Interchange accepte le fichier.
//
// Effet de bord bienvenu : ces GLB pèsent l'essentiel de leur poids en textures.
// Le pack WW100 fait 1,1 Go dont presque tout est de l'image inutile.
//
// ── ⚠ NE PAS APPLIQUER À UN PERSONNAGE ────────────────────────────────────────
// Ce script détruit l'apparence. Il ne doit toucher QUE des fichiers
// d'animation. Il refuse d'ailleurs tout GLB qui ne contient aucune animation —
// c'est le garde-fou qui empêche de dégraisser un mesh par erreur.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "../WebPortal/node_modules/@gltf-transform/core/dist/index.js";
import { ALL_EXTENSIONS } from "../WebPortal/node_modules/@gltf-transform/extensions/dist/index.js";

const cible = process.argv[2];
const sortie = process.argv[3];
const APPLY = process.argv.includes("--apply");

if (!cible || !sortie) {
  console.error("Usage : node scripts/narvos-degraisser-anim.mjs <dossier|fichier> <sortie> [--apply]");
  process.exit(1);
}
if (!fs.existsSync(cible)) {
  console.error(`Introuvable : ${cible}`);
  process.exit(1);
}

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

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  ${fichiers.length} GLB à examiner`);
console.log("");

let traites = 0;
let intacts = 0;
let refuses = 0;
let octetsAvant = 0;
let octetsApres = 0;

for (const f of fichiers) {
  let doc;
  try {
    doc = await io.read(f);
  } catch (err) {
    console.log(`  ILLISIBLE ${path.basename(f)} — ${err.message.split("\n")[0]}`);
    refuses++;
    continue;
  }

  const root = doc.getRoot();

  // ⚠ GARDE-FOU : pas d'animation, pas de dégraissage. C'est ce qui empêche de
  // détruire l'apparence d'un personnage passé ici par erreur.
  if (root.listAnimations().length === 0) {
    console.log(`  REFUSÉ    ${path.basename(f)} — aucune animation (mesh ?)`);
    refuses++;
    continue;
  }

  const nTex = root.listTextures().length;
  const nMat = root.listMaterials().length;

  if (nTex === 0 && nMat === 0) {
    intacts++;
    continue;
  }

  for (const t of root.listTextures()) t.dispose();
  for (const m of root.listMaterials()) m.dispose();

  // ⚠ RETIRER AUSSI LES EXTENSIONS. Supprimer textures et matériaux ne suffit
  // PAS : gltf-transform garde les objets `Extension` enregistrés sur le
  // document, et `KHR_texture_basisu` reste déclaré dans `extensionsRequired`
  // même quand plus rien ne l'utilise. Interchange refuse alors toujours le
  // fichier entier — mesuré le 2026-09-03, le premier dégraissage n'avait
  // débloqué aucun import.
  //
  // On garde les extensions qui touchent la GÉOMÉTRIE : les retirer casserait
  // le maillage ou les poids de skinning, dont l'animation a besoin.
  const A_GARDER = new Set([
    "KHR_mesh_quantization",
    "KHR_draco_mesh_compression",
    "EXT_meshopt_compression",
  ]);

  for (const ext of root.listExtensionsUsed()) {
    if (!A_GARDER.has(ext.extensionName)) ext.dispose();
  }

  const destination = path.join(sortie, path.relative(racine, f));
  const avant = fs.statSync(f).size;
  octetsAvant += avant;

  if (APPLY) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await io.write(destination, doc);
    octetsApres += fs.statSync(destination).size;
  }

  traites++;
  if (traites <= 5) {
    console.log(`  DÉGRAISSÉ ${path.basename(f)}  (${nTex} texture(s), ${nMat} matériau(x))`);
  }
}

console.log("");
console.log(`  ${traites} dégraissé(s), ${intacts} déjà sans texture, ${refuses} refusé(s)`);

if (APPLY && traites > 0) {
  const mo = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(`  poids : ${mo(octetsAvant)} Mo → ${mo(octetsApres)} Mo`);
  console.log("");
  console.log(`  écrit sous : ${sortie}`);
} else if (!APPLY) {
  console.log("");
  console.log("Rien écrit.");
}