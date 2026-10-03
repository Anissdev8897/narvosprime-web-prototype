// ══════════════════════════════════════════════════════════════════════════════
// strip-anim-meshes.mjs — Retire la géométrie des GLB d'ANIMATION.
//
// POURQUOI
// Les packs d'animation exportés depuis Unreal embarquent le personnage entier :
// mesh skinné, matériaux et textures, dans CHAQUE fichier de clip. Mesuré sur
// `FPP_combat_fists/No_Rootmotion` : 521 Mo pour 55 clips, soit 9,4 Mo par
// animation (1 mesh, 2 primitives, 5 textures, 1 skin par fichier).
//
// Brancher un tel pack sur le joueur rechargerait le même personnage 43 fois —
// freeze garanti, et perte de contexte GPU sur une machine déjà limite (cf.
// `narvos-mesh-pipeline` : la VRAM ne dépend pas du poids du fichier).
//
// Three.js lie les pistes d'animation aux NŒUDS par leur nom. Le mesh, le skin,
// les matériaux et les textures ne servent donc à RIEN dans un fichier de clip :
// seuls comptent la hiérarchie d'os et les pistes.
//
// ⚠️ ON NE PRUNE JAMAIS LES NŒUDS.
// `prune()` supprime les nœuds « vides » — or ici les nœuds vides SONT le
// squelette, la seule chose qu'on veuille garder. Le pruning est donc restreint
// explicitement aux types géométriques. Même piège que pour les points
// d'attache d'armes des personnages (cf. CLAUDE.md).
//
// USAGE
//   node scripts/strip-anim-meshes.mjs <dossier> [--out <dossier>] [--dry-run]
//
// Sans --out, les fichiers sont réécrits EN PLACE après sauvegarde dans
// `<dossier>/_full_backup/`.
// ══════════════════════════════════════════════════════════════════════════════

// NOTE : on n'importe QUE `@gltf-transform/core`. `@gltf-transform/functions`
// (qui fournit `prune()`) tire `sharp`, un binaire natif cassé sur cette
// machine — et dont on n'a aucun besoin ici, puisqu'on ne touche à aucune
// image. Le nettoyage des accesseurs orphelins se fait donc à la main, ce qui
// a l'avantage d'être explicite : on ne peut pas supprimer un nœud par erreur.
import { NodeIO } from "@gltf-transform/core";
import { readdirSync, mkdirSync, copyFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const args = process.argv.slice(2);
const srcDir = args[0];
const outIdx = args.indexOf("--out");
const outDir = outIdx !== -1 ? args[outIdx + 1] : null;
const dryRun = args.includes("--dry-run");

if (!srcDir) {
  console.error("Usage : node scripts/strip-anim-meshes.mjs <dossier> [--out <dossier>] [--dry-run]");
  process.exit(1);
}

const io = new NodeIO();
const mo = (n) => (n / 1048576).toFixed(2);

/** Vide un document de toute géométrie, ne laissant que os + pistes. */
async function stripDocument(doc) {
  const root = doc.getRoot();

  // Détacher AVANT de disposer : un nœud qui pointe encore sur un mesh disposé
  // laisserait une référence morte dans le graphe.
  for (const node of root.listNodes()) {
    node.setMesh(null);
    node.setSkin(null);
  }
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const skin of root.listSkins()) skin.dispose();
  for (const mat of root.listMaterials()) mat.dispose();
  for (const tex of root.listTextures()) tex.dispose();

  // Nettoyage des accesseurs devenus orphelins (positions, normales, UV, poids
  // de skin…). Les accesseurs des PISTES d'animation gardent un parent — leur
  // sampler — et survivent donc à ce filtre. Aucun nœud n'est touché.
  for (const acc of root.listAccessors()) {
    const vivants = acc.listParents().filter((p) => p.propertyType !== "Root");
    if (vivants.length === 0) acc.dispose();
  }
  return doc;
}

const files = readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith(".glb"));
if (files.length === 0) {
  console.error(`Aucun .glb dans ${srcDir}`);
  process.exit(1);
}

const backupDir = join(srcDir, "_full_backup");
if (!dryRun && !outDir && !existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
if (!dryRun && outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });

let totalBefore = 0;
let totalAfter = 0;
let clipsPerdus = 0;

for (const file of files) {
  const src = join(srcDir, file);
  const before = statSync(src).size;
  totalBefore += before;

  const doc = await io.read(src);
  const nbAnims = doc.getRoot().listAnimations().length;
  const nbNodes = doc.getRoot().listNodes().length;

  if (nbAnims === 0) {
    console.warn(`  ⚠ ${file} — AUCUNE animation, ignoré (ce n'est pas un fichier de clip)`);
    clipsPerdus++;
    continue;
  }

  await stripDocument(doc);

  const nodesApres = doc.getRoot().listNodes().length;
  const animsApres = doc.getRoot().listAnimations().length;

  // GARDE-FOU : perdre des nœuds ou des animations casse la liaison des pistes.
  if (nodesApres !== nbNodes || animsApres !== nbAnims) {
    console.error(
      `  ✗ ${file} — REFUSÉ : nœuds ${nbNodes}→${nodesApres}, anims ${nbAnims}→${animsApres}`,
    );
    clipsPerdus++;
    continue;
  }

  const bytes = await io.writeBinary(doc);
  totalAfter += bytes.byteLength;

  const gain = (100 * (1 - bytes.byteLength / before)).toFixed(1);
  console.log(`  ${file} — ${mo(before)} → ${mo(bytes.byteLength)} Mo (−${gain}%) · ${nodesApres} os, ${animsApres} anim`);

  if (dryRun) continue;

  const dest = outDir ? join(outDir, basename(file)) : src;
  if (!outDir) copyFileSync(src, join(backupDir, file)); // original archivé
  const { writeFileSync } = await import("node:fs");
  writeFileSync(dest, Buffer.from(bytes));
}

console.log("\n═══════════════════════════════════════════");
console.log(`Fichiers   : ${files.length - clipsPerdus} traités, ${clipsPerdus} ignorés`);
console.log(`Avant      : ${mo(totalBefore)} Mo`);
console.log(`Après      : ${mo(totalAfter)} Mo`);
if (totalBefore > 0) {
  console.log(`Réduction  : −${(100 * (1 - totalAfter / totalBefore)).toFixed(1)} %`);
}
if (dryRun) console.log("\n(--dry-run : aucun fichier écrit)");
else if (!outDir) console.log(`\nOriginaux archivés dans ${backupDir}`);
