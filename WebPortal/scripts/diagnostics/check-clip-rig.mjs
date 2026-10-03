// ══════════════════════════════════════════════════════════════════════════════
// check-clip-rig.mjs — Un clip d'animation est-il jouable sur un squelette donné ?
//
// POURQUOI : un clip s'applique par NOM D'OS. Si le clip cible `spine_04` et que
// le rig n'a que `spine_01..03`, la piste est silencieusement ignorée — pas
// d'erreur, juste une pose partiellement fausse. Avant d'adopter un pack
// d'animation entier, il faut mesurer ce taux de recouvrement.
//
// Usage :
//   node scripts/check-clip-rig.mjs <rig.glb> <clip.glb>...
// Exemple :
//   node scripts/check-clip-rig.mjs public/models/assets_character/wraith/Wraith.glb \
//        public/models/divers/UTA/.../AnimSeq_Traversal_Movement_Walk_Forward.glb
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import path from "node:path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

const [rigPath, ...clipPaths] = process.argv.slice(2);
if (!rigPath || clipPaths.length === 0) {
  console.error("Usage: node scripts/check-clip-rig.mjs <rig.glb> <clip.glb>...");
  process.exit(1);
}

/** Noms de TOUS les nœuds du GLB — un clip peut cibler un nœud non-os (racine, socket). */
function nodeNames(doc) {
  return new Set(doc.getRoot().listNodes().map((n) => n.getName()).filter(Boolean));
}

const rigDoc = await io.read(rigPath);
const rigNodes = nodeNames(rigDoc);
const rigJoints = new Set(rigDoc.getRoot().listSkins().flatMap((s) => s.listJoints().map((j) => j.getName())));

console.log(`RIG ${path.basename(rigPath)} : ${rigNodes.size} nœuds, ${rigJoints.size} os de skin\n`);

let worst = 100;
for (const clipPath of clipPaths) {
  const doc = await io.read(clipPath);
  const anims = doc.getRoot().listAnimations();
  if (anims.length === 0) { console.log(`  ? ${path.basename(clipPath)} : AUCUNE animation`); continue; }

  // Une piste cible un nœud ; on collecte les nœuds distincts touchés par le clip.
  const targets = new Set();
  for (const anim of anims) {
    for (const ch of anim.listChannels()) {
      const n = ch.getTargetNode()?.getName();
      if (n) targets.add(n);
    }
  }

  const missing = [...targets].filter((t) => !rigNodes.has(t));
  const pct = targets.size === 0 ? 0 : Math.round(((targets.size - missing.length) / targets.size) * 100);
  worst = Math.min(worst, pct);

  const mark = missing.length === 0 ? "✓" : pct >= 90 ? "~" : "✗";
  console.log(
    `  ${mark} ${path.basename(clipPath)} : ${targets.size} os ciblés · ${missing.length} absent(s) · ${pct}% de recouvrement` +
    (anims.length > 1 ? ` · ${anims.length} animations` : ""),
  );
  if (missing.length > 0) console.log(`      absents : ${missing.slice(0, 14).join(", ")}${missing.length > 14 ? " …" : ""}`);
}

console.log(`\nRecouvrement minimum : ${worst}%`);
