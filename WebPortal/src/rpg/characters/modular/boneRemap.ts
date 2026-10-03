// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/boneRemap.ts — Remappage d'indices de skin (logique PURE).
//
// LE PROBLÈME QUE ÇA RÉSOUT
// Un personnage modulaire assemble plusieurs SkinnedMesh (corps, veste, jean,
// bottes…) sur UN SEUL squelette. Or chaque GLB de pièce embarque son propre
// squelette, avec son propre NOMBRE et son propre ORDRE d'os :
//
//   corps  SK_fe_UE5_meta_body_muscular_IK ... 161 os
//   veste  SK_fe_meta_tal_nrw_leatherjack  ...  90 os
//   jean   SK_fe_meta_tal_nrw_pants_jeans  ... 159 os
//
// L'attribut `skinIndex` de chaque sommet pointe vers un index DANS LE
// SQUELETTE DE SA PIÈCE. Lier la veste au squelette du corps sans retoucher
// ces indices ferait pointer chaque sommet vers un os arbitraire — le maillage
// se déchirerait. Il faut donc traduire index-pièce → index-corps.
//
// CE QUI N'EST PAS TOUCHÉ : les POIDS (`skinWeight`), les positions de sommets,
// les normales. Seuls les INDICES changent. C'est ce qui rend l'opération
// non destructive : on redirige des pointeurs, on ne recalcule aucune influence.
//
// PRÉREQUIS VÉRIFIÉ EN AMONT : les pièces doivent partager la POSE DE BIND du
// corps. Mesuré sur le vestiaire BikerBundle → écart 0,0000 sur racine, bassin
// et main. Deux morphologies différentes (ex. Rampage vs Wraith) ne satisfont
// PAS ce prérequis et ne peuvent pas être mélangées — cf. bindPoseDelta().
// ══════════════════════════════════════════════════════════════════════════════

import { humanoidSlotOf, detectConvention, nearestAvailableAncestor } from "../../animation/humanoidBones";
import type { HumanoidSlot } from "../../animation/humanoidBones";

/** Index cible pour chaque os source. `-1` = aucun équivalent trouvé. */
export type BoneRemap = Int32Array;

export interface RemapReport {
  remap: BoneRemap;
  /** Os source sans correspondance dans le squelette cible. */
  unmatched: string[];
  /** Taux de correspondance (0..1) — sert de garde-fou avant de lier. */
  coverage: number;
  /**
   * Os résolus par REPLI D'ANCÊTRE, et non par correspondance directe.
   *
   * Ce ne sont pas des échecs — leurs sommets suivent le squelette. Mais c'est
   * une approximation : un poids destiné à `spine_04` atterrit sur `spine_03`.
   * Les exposer permet à l'appelant de le signaler plutôt que de le taire.
   */
  fallbacks: string[];
}

/**
 * Construit la table index-source → index-cible.
 *
 * Deux passes, dans cet ordre :
 *   1. nom EXACT (les pièces d'un même pack partagent la nomenclature)
 *   2. emplacement humanoïde canonique (couvre les paquets de conventions
 *      différentes : une veste Meshy sur un corps UE4)
 *
 * Un os source sans équivalent reçoit `-1` : les sommets qui en dépendent
 * devront être rabattus sur un os de repli (cf. applyRemapToSkinIndex).
 */
export function buildBoneRemap(sourceBones: string[], targetBones: string[]): RemapReport {
  // Convention déduite de CHAQUE squelette séparément : les noms spine01/02/03
  // existent dans les deux conventions avec des sens différents (chest chez
  // Meshy, spine chez UE). Sans cette levée d'ambiguïté, `spine_01` n'est
  // indexé sur aucun emplacement et toute la chaîne dorsale est perdue.
  const srcConv = detectConvention(sourceBones);
  const tgtConv = detectConvention(targetBones);

  const byName = new Map<string, number>();
  // Typé `HumanoidSlot` et non `string` : `nearestAvailableAncestor` remonte la
  // chaîne humanoïde et doit pouvoir interroger cette table.
  const bySlot = new Map<HumanoidSlot, number>();
  for (let i = 0; i < targetBones.length; i++) {
    const name = targetBones[i];
    if (!byName.has(name)) byName.set(name, i);
    const slot = humanoidSlotOf(name, tgtConv);
    if (slot && !bySlot.has(slot)) bySlot.set(slot, i);
  }

  const remap = new Int32Array(sourceBones.length).fill(-1);
  const unmatched: string[] = [];
  const fallbacks: string[] = [];
  let matched = 0;

  for (let i = 0; i < sourceBones.length; i++) {
    const name = sourceBones[i];
    let t = byName.get(name);
    const slot = t === undefined ? humanoidSlotOf(name, srcConv) : null;

    // 2. emplacement humanoïde exact
    if (t === undefined && slot) t = bySlot.get(slot);

    // 3. REPLI D'ANCÊTRE — le squelette d'accueil n'a pas cet emplacement, on
    //    remonte la chaîne. Un sommet pesé sur `spine_04` suit alors `spine_03`
    //    au lieu de voir son influence annulée et de s'effondrer.
    if (t === undefined && slot) {
      const anc = nearestAvailableAncestor(slot, bySlot);
      if (anc) {
        t = bySlot.get(anc);
        if (t !== undefined) fallbacks.push(name);
      }
    }

    if (t === undefined) { unmatched.push(name); continue; }
    remap[i] = t;
    matched++;
  }

  return {
    remap,
    unmatched,
    fallbacks,
    coverage: sourceBones.length === 0 ? 0 : matched / sourceBones.length,
  };
}

/**
 * Fraction du POIDS de skinning qui atterrit sur un os apparié.
 *
 * ── POURQUOI CE CHIFFRE ET PAS `RemapReport.coverage` ────────────────────────
 *
 * `coverage` compte des NOMS : `os appariés / os de la pièce`. Mesuré le
 * 02/08/2026 sur les 39 pièces découpées, ce critère rejetait 26 pièces… dont
 * `wraith/torso`, qui suit pourtant le squelette d'accueil à 100 %.
 *
 * L'explication : les héros Paragon embarquent 130 à 168 os, dont une majorité
 * de twist, correctifs et IK absents du mannequin UE5 — et qui ne portent
 * presque aucun poids. Compter des noms revenait à juger une pièce sur des os
 * qui ne déplacent aucun sommet.
 *
 *   pièce            os appariés   POIDS apparié
 *   wraith/torso         50 %          100,0 %
 *   samurai/head        100 %          100,0 %
 *   murdock/head         47 %           17,9 %   ← rig facial, vrai refus
 *
 * Ce chiffre-ci répond à la seule question qui compte : quelle part du maillage
 * va réellement suivre le squelette d'accueil.
 *
 * @param skinIndex 4 indices par sommet, dans la numérotation SOURCE
 * @param skinWeight 4 poids par sommet, alignés sur `skinIndex`
 */
export function weightedCoverage(
  skinIndex: ArrayLike<number>,
  skinWeight: ArrayLike<number>,
  remap: BoneRemap,
): number {
  let apparié = 0;
  let total = 0;
  for (let i = 0; i < skinIndex.length && i < skinWeight.length; i++) {
    const w = skinWeight[i];
    if (w <= 0) continue;
    total += w;
    const src = skinIndex[i];
    if (src < remap.length && remap[src] >= 0) apparié += w;
  }
  // Une pièce sans aucun poids n'est pas « parfaitement couverte » : elle est
  // inexploitable. Renvoyer 1 ferait passer un maillage vide pour un succès.
  return total > 0 ? apparié / total : 0;
}

/**
 * Applique le remappage à un attribut `skinIndex` (4 influences par sommet).
 *
 * Un index non résolu (`-1`) est rabattu sur `fallbackBone` ET son poids devra
 * être neutralisé par l'appelant — sinon le sommet serait tiré par un os
 * arbitraire. On préfère rabattre plutôt que laisser un index hors bornes, qui
 * provoquerait une lecture mémoire invalide côté GPU.
 *
 * Mute le tableau EN PLACE (l'appelant travaille déjà sur une copie clonée).
 * Retourne le nombre d'influences rabattues.
 */
export function applyRemapToSkinIndex(
  skinIndex: Uint16Array | Uint8Array | Float32Array,
  remap: BoneRemap,
  fallbackBone = 0,
): number {
  let dropped = 0;
  for (let i = 0; i < skinIndex.length; i++) {
    const src = skinIndex[i];
    const t = src < remap.length ? remap[src] : -1;
    if (t < 0) { skinIndex[i] = fallbackBone; dropped++; }
    else skinIndex[i] = t;
  }
  return dropped;
}

/**
 * Neutralise le poids des influences rabattues, pour que le sommet ne subisse
 * aucune traction parasite. À appeler APRÈS applyRemapToSkinIndex, sur les
 * MÊMES tableaux d'origine (d'où le paramètre `originalIndex`).
 *
 * Renormalise ensuite les 4 poids de chaque sommet à somme 1 — un sommet dont
 * on a annulé une influence verrait sinon son volume s'effondrer.
 */
export function zeroUnmatchedWeights(
  originalIndex: ArrayLike<number>,
  skinWeight: Float32Array,
  remap: BoneRemap,
): void {
  const INFLUENCES = 4;
  for (let v = 0; v < skinWeight.length; v += INFLUENCES) {
    let sum = 0;
    for (let k = 0; k < INFLUENCES; k++) {
      const src = originalIndex[v + k];
      const t = src < remap.length ? remap[src] : -1;
      if (t < 0) skinWeight[v + k] = 0;
      sum += skinWeight[v + k];
    }
    // Sans renormalisation, un sommet ayant perdu une influence rétrécit.
    if (sum > 0 && Math.abs(sum - 1) > 1e-6) {
      for (let k = 0; k < INFLUENCES; k++) skinWeight[v + k] /= sum;
    }
  }
}
