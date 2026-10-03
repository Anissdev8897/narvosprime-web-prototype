// ══════════════════════════════════════════════════════════════════════════════
// strip-anim-glb.mjs — Extrait les ANIMATIONS d'un GLB en jetant tout le reste.
//
// POURQUOI : les packs d'animation Unreal réexportent le mesh complet du
// personnage dans CHAQUE clip. Un clip du pack UTA pèse ~10 Mo dont ~99,5 % de
// mesh, de skin et de textures qui ne servent à rien : au runtime, le clip est
// appliqué au squelette du JOUEUR, pas à celui embarqué dans le fichier.
//
// Mesuré sur ce projet : wraith/animations/Ability_E.glb = 11,15 Mo, sa version
// dépouillée = 0,40 Mo. Facteur ~28. Charger les 20 clips de locomotion coûte
// donc ~8 Mo au lieu de ~200 Mo.
//
// CE QU'ON GARDE : la hiérarchie de nœuds (les os) et les animations.
// CE QU'ON JETTE : meshes, skins, matériaux, textures, images.
//
// La hiérarchie d'os est INDISPENSABLE — une piste d'animation cible un nœud par
// NOM. Sans les nœuds, `listChannels()` pointe dans le vide et le clip est perdu.
// C'est pour ça qu'on ne peut pas se contenter d'un `prune()`.
//
// Usage :
//   node scripts/strip-anim-glb.mjs <sortie/> <entrée.glb>...
//   node scripts/strip-anim-glb.mjs <sortie/> --from=liste.txt
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { mkdirSync, statSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith("--"));
const positional = argv.filter((a) => !a.startsWith("--"));
const [outDir, ...inputs] = positional;

const fromFlag = flags.find((f) => f.startsWith("--from="));
if (fromFlag) {
  const listed = (await readFile(fromFlag.slice(7), "utf8"))
    .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  inputs.push(...listed);
}

if (!outDir || inputs.length === 0) {
  console.error("Usage: node scripts/strip-anim-glb.mjs <sortie/> <entrée.glb>... | --from=liste.txt");
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

mkdirSync(outDir, { recursive: true });
const MB = (b) => (b / 1048576).toFixed(2);

let totalIn = 0, totalOut = 0, done = 0, skipped = 0, failed = 0;

for (const input of inputs) {
  const name = path.basename(input);
  const dest = path.join(outDir, name);

  if (!existsSync(input)) { console.warn(`  ? ${name} : introuvable`); skipped++; continue; }
  const sizeIn = statSync(input).size;

  try {
    const doc = await io.read(input);
    const root = doc.getRoot();

    if (root.listAnimations().length === 0) {
      console.warn(`  ? ${name} : aucune animation, ignoré`);
      skipped++;
      continue;
    }

    // Ordre imposé par les dépendances du graphe glTF : un Node référence un Mesh
    // et un Skin ; disposer le Node en premier laisserait les Mesh orphelins mais
    // toujours écrits. On détache donc d'abord, on dispose ensuite.
    for (const node of root.listNodes()) {
      node.setMesh(null);
      node.setSkin(null);
    }
    for (const mesh of root.listMeshes()) mesh.dispose();
    for (const skin of root.listSkins()) skin.dispose();
    for (const mat of root.listMaterials()) mat.dispose();
    for (const tex of root.listTextures()) tex.dispose();

    // `prune()` est volontairement ÉVITÉ : il supprimerait les nœuds désormais
    // vides — c'est-à-dire TOUS les os, puisqu'ils ne portent plus de mesh. Les
    // pistes d'animation cibleraient alors des nœuds inexistants.
    // Les accessors devenus inutiles sont éliminés par l'écriture elle-même.

    await io.write(dest, doc);
    const sizeOut = statSync(dest).size;
    totalIn += sizeIn; totalOut += sizeOut; done++;

    const anims = root.listAnimations().length;
    console.log(`  ✓ ${name} : ${MB(sizeIn)} → ${MB(sizeOut)} MB (÷${(sizeIn / sizeOut).toFixed(0)}) · ${anims} clip(s) · ${root.listNodes().length} os`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name} : ${String(err.message ?? err).split("\n")[0]}`);
  }
}

console.log(`\n[strip] ${done} dépouillés, ${skipped} ignorés, ${failed} échecs`);
if (done > 0) {
  console.log(`[strip] ${MB(totalIn)} → ${MB(totalOut)} MB (÷${(totalIn / totalOut).toFixed(0)})`);
}
