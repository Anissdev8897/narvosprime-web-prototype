// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/quantize-morph.mjs — Deltas morph en int16 normalisé.
//
// Logique PURE (tableaux typés uniquement, zéro glTF).
//
// ── POURQUOI PAS `quantize()` DE GLTF-TRANSFORM ──────────────────────────────
//
// `quantize()` ramène les positions dans un volume unitaire et compense en
// posant l'échelle inverse sur le NŒUD. Or la spec glTF impose d'IGNORER la
// transform d'un nœud portant un mesh skinné (le skinning passe par les
// matrices d'os et la bindMatrix). Sur nos pièces — toutes skinnées — la
// compensation serait donc perdue et le maillage sortirait à la mauvaise
// échelle. On quantifie donc uniquement les CIBLES MORPH, à la main, sans
// jamais toucher à la géométrie de base ni aux transforms.
//
// ── POURQUOI ÇA TIENT ────────────────────────────────────────────────────────
//
// Un accesseur SHORT normalisé se relit `max(v / 32767, -1)` : la plage utile
// est [-1, 1]. Mesuré sur les pièces produites le 02/08/2026 :
//
//   POSITION  max 0,0257 (tête) · 0,0422 (torse) · 0,1318 (bras)   → large marge
//   NORMAL    max 1,0079                                            → dépasse de 0,79 %
//
// Les positions passent sans aucune perte notable : à 0,13 d'amplitude, le pas
// de quantification vaut 1/32767 ≈ 3,05e-5, soit 0,02 % de l'amplitude utile.
//
// Les normales sont ÉCRÊTÉES à 1,0. L'erreur maximale est donc 0,0079 sur une
// composante de vecteur unitaire — environ 0,45° d'écart d'ombrage, et seulement
// sur les valeurs extrêmes. C'est un compromis assumé, pas une opération neutre.
//
// ⚠ L'appelant DOIT déclarer `KHR_mesh_quantization` sur le document. Sans
// l'extension, un accesseur SHORT normalisé pour POSITION est hors spec, et un
// lecteur strict refusera le fichier. Three.js la supporte (`GLTFLoader.js:516`).
// ══════════════════════════════════════════════════════════════════════════════

/** Valeur maximale d'un SHORT normalisé, telle que définie par la spec glTF. */
export const INT16_MAX = 32767;

/**
 * Convertit des deltas flottants en int16 normalisé, avec écrêtage à [-1, 1].
 *
 * L'écrêtage est explicite et non silencieux : `quantizeNormalized` renvoie
 * aussi le nombre de valeurs écrêtées, pour que l'appelant puisse le remonter
 * au lieu de dégrader le rendu sans le dire.
 *
 * @param {ArrayLike<number>} src
 * @returns {{array: Int16Array, clipped: number}}
 */
export function quantizeNormalized(src) {
  const out = new Int16Array(src.length);
  let clipped = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v > 1 || v < -1) clipped++;
    out[i] = Math.round(Math.max(-1, Math.min(1, v)) * INT16_MAX);
  }
  return { array: out, clipped };
}

/**
 * Relecture d'un int16 normalisé, exactement comme le fait un lecteur glTF.
 *
 * Existe pour que les tests puissent vérifier l'aller-retour au lieu de
 * supposer que l'encodage est correct.
 */
export function dequantizeNormalized(src) {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = Math.max(src[i] / INT16_MAX, -1);
  return out;
}

/** Amplitude maximale d'un tableau — sert à décider si l'écrêtage va mordre. */
export function maxAbs(src) {
  let m = 0;
  for (let i = 0; i < src.length; i++) {
    const v = Math.abs(src[i]);
    if (v > m) m = v;
  }
  return m;
}
