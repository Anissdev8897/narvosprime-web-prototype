// ══════════════════════════════════════════════════════════════════════════════
// check-eye-and-slider-bones.mjs — Deux défauts rapportés en jeu.
//
// 1. La couleur des yeux ne change sur AUCUN genre. `applyTint` ne teinte que le
//    matériau nommé `EYE_MATERIAL` ("Eyes") — s'il porte un autre nom dans les
//    corps Biker, la teinte ne s'applique à rien, sans erreur.
//
// 2. Les curseurs de silhouette n'ont aucun effet côté HOMME. Ils mettent à
//    l'échelle des os nommés ; un nom absent est ignoré silencieusement.
//
// Usage : node scripts/check-eye-and-slider-bones.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const B = "public/models/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta";

const CORPS = [
  ["Homme", `${B}/Male/Bodyparts/SK_ma_UE5_meta_body.glb`],
  ["Femme", `${B}/Female/Bodyparts/SK_fe_UE5_meta_body_muscular_IK.glb`],
];

// Doit rester aligné sur PROPORTION_DEFS (bodyProportions.ts).
const OS_CURSEURS = [
  "clavicle_l", "clavicle_r",
  "spine_01", "spine_02",
  "upperarm_l", "upperarm_r",
  "lowerarm_l", "lowerarm_r",
];

for (const [nom, p] of CORPS) {
  const doc = await io.read(p);

  console.log(`\n═══ ${nom} ═══`);

  const mats = doc.getRoot().listMaterials().map((m) => m.getName());
  console.log(`matériaux (${mats.length}) : ${mats.join(", ")}`);
  const yeux = mats.filter((m) => /eye|iris|oeil/i.test(m));
  console.log(`  → candidats « yeux » : ${yeux.length ? yeux.join(", ") : "AUCUN ⚠"}`);

  const skin = doc.getRoot().listSkins()[0];
  const os = new Set(skin ? skin.listJoints().map((j) => j.getName()) : []);
  const manquants = OS_CURSEURS.filter((b) => !os.has(b));
  console.log(`os des curseurs : ${OS_CURSEURS.length - manquants.length}/${OS_CURSEURS.length} présents`);
  if (manquants.length) console.log(`  → MANQUANTS ⚠ : ${manquants.join(", ")}`);
}
