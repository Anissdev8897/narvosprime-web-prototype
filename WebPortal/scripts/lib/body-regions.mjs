// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/body-regions.mjs — À quelle partie du corps appartient ce morceau ?
//
// Logique PURE, sans glTF ni Three.js : elle transforme des NOMS en régions.
// C'est le cœur de la découpe automatique des personnages, et la raison pour
// laquelle elle est testable sans charger un seul modèle.
//
// ── DEUX CHEMINS, MESURÉS SUR LES VRAIS FICHIERS (02/08/2026) ────────────────
//
//   modèle    os   primitives  matériaux  segmentation d'auteur
//   Murdock   154      12          12     Body · Head · Arms · Legs      ← fine
//   Boris     168      15          13     Torso · Arms · Legs · Hair     ← fine
//   Steel     131       9           9     Skin · UpperBody · LowerBody   ← moyenne
//   Wraith    155       4           4     Upperbody · Lowerbody          ← PAS de tête
//   Echo      134      21           1     WorldGridMaterial              ← aucune
//
// Quand l'auteur a déjà séparé son personnage (Murdock, Boris), sa découpe est
// MEILLEURE que tout algorithme : elle suit les intentions de modélisation, sans
// couture. On la prend telle quelle — `regionFromMaterial`.
//
// Quand il ne l'a pas fait (Wraith n'a pas de tête distincte, Echo n'a qu'un
// matériau), il faut segmenter la géométrie. L'os DOMINANT de chaque sommet —
// celui dont le poids de skinning est le plus fort — donne sa région sans
// aucune intervention artistique : c'est déjà ce que le rig encode.
// `regionFromBone` fait cette traduction.
//
// ⚠ Ces deux fonctions ne DÉCOUPENT rien. Elles classent. Le découpage vit dans
// `extract-body-parts.mjs`, qui les appelle — la séparation existe pour que la
// règle de classement reste vérifiable sans pipeline.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Régions anatomiques produites par la découpe.
 *
 * Alignées sur les `BodySlot` de `src/rpg/characters/modular/bodySlots.ts` : une
 * pièce extraite doit pouvoir entrer directement dans un emplacement existant,
 * sans table de correspondance intermédiaire.
 */
export const REGIONS = ["head", "hair", "torso", "arms", "hands", "legs", "feet", "accessory"];

/** Région par défaut quand rien ne tranche : le torse est le plus gros volume. */
export const FALLBACK_REGION = "torso";

// ── Chemin A : le nom du matériau ────────────────────────────────────────────
//
// L'ordre COMPTE. « upperbody » doit être testé avant « body », sinon un
// `M_Wraith_Upperbody` tomberait dans le torse par le motif générique alors
// qu'on veut le reconnaître explicitement. De même « lowerbody » avant « body ».
const MATERIAL_RULES = [
  [/hair|beard|fur\b/i, "hair"],
  // `teeth|tongue|eye|lash|brow` : ces morceaux sont livrés comme des matériaux
  // SÉPARÉS (mesuré : `M_SteelTeeth`, `M_Steel_EyeRefractive_Inst`, `M_TearLine`,
  // `MI_eyelashes_dark`). Sans eux, ils tombaient dans le repli « torse » et une
  // paire d'yeux se retrouvait cousue au buste. Le chemin par os les classait
  // déjà correctement — les deux chemins doivent s'accorder, sinon la région
  // d'un morceau dépendrait de la façon dont son modèle a été exporté.
  [/head|face|skull|teeth|tooth|tongue|eye|lash|brow|tear|helm(et)?\b/i, "head"],
  [/backpack|bag|cape|cloak|wing/i, "accessory"],
  [/hand|glove|finger|palm/i, "hands"],
  [/foot|feet|boot|shoe|toe/i, "feet"],
  [/arm|sleeve|shoulder|pauldron|bracer/i, "arms"],
  [/leg|thigh|calf|pant|trouser|greave/i, "legs"],
  [/upperbody|torso|chest|jacket|vest|coat|shirt/i, "torso"],
  [/lowerbody|hip|pelvis|belt|skirt/i, "legs"],
  [/body|skin/i, "torso"],
];

/**
 * Région déduite du nom de matériau, ou `null` si le nom n'apprend rien.
 *
 * `null` est un résultat UTILE : il fait basculer l'appelant sur la segmentation
 * par os. `WorldGridMaterial` (le placeholder d'Unreal, cf. Echo) ou un
 * `Material.001` ne doivent surtout pas être classés au hasard en torse.
 */
export function regionFromMaterial(name) {
  if (!name || /^(worldgrid|default|material|standardmaterial|lambert|phong)/i.test(name)) return null;
  for (const [re, region] of MATERIAL_RULES) if (re.test(name)) return region;
  return null;
}

// ── Chemin B : le nom de l'os dominant ───────────────────────────────────────
//
// Conventions couvertes : UE (`upperarm_l`, `thigh_r`, `ball_l`), Mixamo/Meshy
// (`LeftArm`, `RightUpLeg`, `LeftToeBase`), avec ou sans préfixe `mixamorig:`.
// Tous les héros mesurés sont en convention UE, mais le pack Biker et les clips
// Mixamo cohabitent dans le projet — les deux doivent passer.
const BONE_RULES = [
  [/^(head|neck|jaw|eye|face|teeth|tongue)/i, "head"],
  [/hair|beard|ponytail/i, "hair"],
  [/(hand_[lr]|hand[lr]?$|^(left|right)hand)|(thumb|index|middle|ring|pinky)/i, "hands"],
  [/(ball_[lr]|foot_[lr]|toe)|^(left|right)(foot|toebase)/i, "feet"],
  [/(upperarm|lowerarm|clavicle|shoulder)|^(left|right)(arm|forearm|shoulder)/i, "arms"],
  [/(thigh|calf|shin)|^(left|right)(upleg|leg)$/i, "legs"],
  [/(spine|chest|pelvis|hips|root)/i, "torso"],
];

/** Région déduite d'un nom d'os, ou `null` si l'os n'est pas anatomique. */
export function regionFromBone(name) {
  if (!name) return null;
  const clean = name.replace(/^mixamorig:?/i, "");
  for (const [re, region] of BONE_RULES) if (re.test(clean)) return region;
  return null;
}

/**
 * Un modèle est-il DÉJÀ segmenté de façon exploitable par ses matériaux ?
 *
 * Critère : au moins deux régions ANATOMIQUES distinctes reconnues. Un seul
 * matériau nommé (Echo) ou un unique `M_Xxx_Body` ne suffit pas — on n'aurait
 * rien découpé, juste renommé le modèle entier.
 *
 * `accessory` ne compte pas : un modèle « corps + sac à dos » n'est pas segmenté
 * anatomiquement pour autant, et c'est le cas de Wraith.
 */
export function isPreSegmented(materialNames) {
  const anat = new Set();
  for (const n of materialNames ?? []) {
    const r = regionFromMaterial(n);
    if (r && r !== "accessory") anat.add(r);
  }
  return anat.size >= 2;
}
