// ══════════════════════════════════════════════════════════════════════════════
// check-bone-axes.mjs — Quel axe LOCAL allonge un os ?
//
// Mettre un os à l'échelle sur le mauvais axe l'ÉPAISSIT au lieu de l'allonger.
// L'axe long d'un os est celui qui porte la translation de son ENFANT : dans un
// squelette, un os « pointe » vers le suivant.
//
// Usage : node scripts/check-bone-axes.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const P = "public/models/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_UE5_meta_body.glb";

// parent → enfant qui donne la direction
const PAIRES = [
  ["clavicle_l", "upperarm_l"],
  ["clavicle_r", "upperarm_r"],
  ["upperarm_l", "lowerarm_l"],
  ["lowerarm_l", "hand_l"],
  ["spine_01", "spine_02"],
  ["spine_02", "spine_03"],
];

const doc = await io.read(P);
const parNom = new Map();
for (const n of doc.getRoot().listNodes()) parNom.set(n.getName(), n);

const AXES = ["x", "y", "z"];
console.log("os          → enfant       translation locale        axe long");
console.log("─".repeat(72));

for (const [parent, enfant] of PAIRES) {
  const e = parNom.get(enfant);
  if (!e) { console.log(`${parent.padEnd(12)}→ ${enfant.padEnd(13)} ENFANT ABSENT`); continue; }
  const t = e.getTranslation();
  let iMax = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(t[i]) > Math.abs(t[iMax])) iMax = i;
  const dom = Math.abs(t[iMax]);
  const total = Math.abs(t[0]) + Math.abs(t[1]) + Math.abs(t[2]);
  const part = total > 0 ? (100 * dom) / total : 0;
  console.log(
    `${parent.padEnd(12)}→ ${enfant.padEnd(13)} ` +
    `[${t.map((v) => v.toFixed(2).padStart(7)).join(" ")}]  ` +
    `${AXES[iMax]}  (${part.toFixed(0)} %)`,
  );
}