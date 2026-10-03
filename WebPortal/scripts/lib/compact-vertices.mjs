// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/compact-vertices.mjs — Ne garder que les sommets réellement utilisés.
//
// Logique PURE (tableaux typés uniquement, zéro glTF) : c'est le cœur de la
// compaction, et la raison pour laquelle elle est vérifiable sans charger un GLB.
//
// ── POURQUOI ─────────────────────────────────────────────────────────────────
//
// Découper un personnage en réécrivant seulement l'INDEX laisse tous les
// sommets du corps entier dans chaque pièce. Mesuré le 02/08/2026 sur les GLB
// produits :
//
//   echo/torso   17 576 / 101 565 sommets utiles (17 %)   →  429 Mo
//   echo/head    13 975 /  42 291 sommets utiles (33 %)   →  178 Mo
//   murdock/head  1 604 /   3 228 sommets utiles (50 %)   →   13 Mo
//
// Le coût n'est pas le maillage : Echo porte 181 morph targets, et CHAQUE cible
// stocke un delta par sommet. Le poids est donc `sommets × cibles`. Compacter
// les sommets divise les deux d'un coup.
//
// ⚠ Ne PAS confondre avec `draco()`, interdit sur ces assets (cf. CLAUDE.md) :
// Draco réordonne les sommets et désaligne les morph targets. Ici on réordonne
// aussi — mais on réécrit les cibles morph avec la même permutation, dans le
// même passage. C'est ce qui rend l'opération sûre là où Draco ne l'est pas.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Plan de compaction déduit d'un buffer d'index.
 *
 * Les nouveaux indices sont attribués dans l'ordre de PREMIÈRE APPARITION, pas
 * dans l'ordre croissant des anciens : les sommets d'un même triangle se
 * retrouvent voisins en mémoire, ce qui est le classement que veut le cache de
 * sommets du GPU. C'est gratuit ici, autant le prendre.
 *
 * @param {ArrayLike<number>} indices  index de triangles (anciens numéros)
 * @param {number} vertexCount         taille des attributs source
 * @returns {{remap: Int32Array, used: Uint32Array, count: number}}
 *   `remap[ancien] = nouveau` (-1 si le sommet n'est plus référencé),
 *   `used[nouveau] = ancien` (la permutation à appliquer aux attributs),
 *   `count` = nombre de sommets conservés.
 */
export function compactionPlan(indices, vertexCount) {
  const remap = new Int32Array(vertexCount).fill(-1);
  let count = 0;
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i];
    if (v < vertexCount && remap[v] === -1) remap[v] = count++;
  }

  const used = new Uint32Array(count);
  for (let old = 0; old < vertexCount; old++) {
    const ni = remap[old];
    if (ni >= 0) used[ni] = old;
  }
  return { remap, used, count };
}

/**
 * Applique la permutation à un attribut (position, normale, poids de skinning,
 * delta de morph target…).
 *
 * Le tableau de sortie garde le TYPE du tableau source : un `JOINTS_0` en
 * Uint16 doit rester en Uint16, et un poids normalisé en Uint8 doit rester en
 * Uint8 — repasser en Float32 changerait la sémantique de l'accesseur.
 *
 * @param {ArrayLike<number> & {constructor: any}} src
 * @param {number} elementSize  composants par élément (3 pour VEC3, 4 pour VEC4…)
 * @param {Uint32Array} used    `used[nouveau] = ancien`
 */
export function gatherElements(src, elementSize, used) {
  const out = new src.constructor(used.length * elementSize);
  for (let i = 0; i < used.length; i++) {
    const s = used[i] * elementSize;
    const d = i * elementSize;
    for (let k = 0; k < elementSize; k++) out[d + k] = src[s + k];
  }
  return out;
}

/**
 * Traduit un buffer d'index vers la nouvelle numérotation.
 *
 * Sortie en Uint32 systématiquement : après compaction le nombre de sommets ne
 * peut que baisser, mais choisir Uint16 « parce que ça rentre » obligerait à
 * vérifier la borne à chaque appel. glTF accepte Uint32, et le gain de 2 octets
 * par index est sans commune mesure avec les morph targets qu'on vient de
 * diviser.
 */
export function remapIndices(indices, remap) {
  const out = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) out[i] = remap[indices[i]];
  return out;
}
