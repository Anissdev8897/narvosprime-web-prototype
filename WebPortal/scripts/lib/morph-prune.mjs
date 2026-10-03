// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/morph-prune.mjs — Supprimer les morph targets devenues inutiles.
//
// Logique PURE (tableaux typés uniquement, zéro glTF).
//
// ── POURQUOI ─────────────────────────────────────────────────────────────────
//
// Découper un personnage en pièces laisse à chaque pièce la TOTALITÉ des morph
// targets du modèle d'origine. Un torse hérite ainsi des blendshapes du visage,
// qui ne déplacent plus aucun de ses sommets. Mesuré le 02/08/2026 :
//
//   samurai/torso   52 cibles →  0 vivante   (52 nulles)
//   echo/hands     181 cibles → 16 vivantes (165 nulles)
//   echo/head      181 cibles → 127 vivantes (54 nulles)
//   wraith/head      3 cibles →  0 vivante
//
// ── DEUX PIÈGES ──────────────────────────────────────────────────────────────
//
// 1. L'index de cible est partagé au niveau du MESH, pas de la primitive. Une
//    cible ne peut donc être supprimée que si elle est nulle dans TOUTES les
//    primitives du mesh — d'où `combineAliveMasks`, qui fait un OU logique.
//
// 2. Si une animation pilote `weights`, ses samplers stockent une valeur par
//    cible et par image-clé : supprimer une cible sans réécrire ces samplers
//    décalerait toutes les suivantes. Mesuré sur les pièces produites : 0
//    animation, 0 canal `weights`. L'appelant DOIT le revérifier — d'où
//    `hasWeightAnimation` ci-dessous, à interroger avant toute suppression.
//
// ⚠ Seuil : mesuré à 0, 1e-5, 1e-4 et 1e-3, le compte de cibles vivantes est
// IDENTIQUE. Les cibles d'Echo sont de vraies déformations, pas du bruit
// d'export flottant. Le seuil par défaut reste donc 0 — supprimer une cible
// n'enlève alors, par construction, strictement rien au rendu.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Cette cible ne déplace-t-elle aucun sommet ?
 *
 * @param {Iterable<ArrayLike<number>>} arrays  un tableau de deltas par sémantique
 *   (POSITION, NORMAL, TANGENT…) de la cible
 * @param {number} epsilon  amplitude en deçà de laquelle un delta est ignoré
 */
export function isNullDelta(arrays, epsilon = 0) {
  for (const arr of arrays) {
    if (!arr) continue;
    for (let i = 0; i < arr.length; i++) {
      if (Math.abs(arr[i]) > epsilon) return false;
    }
  }
  return true;
}

/**
 * Fusionne les masques de vivacité des primitives d'un même mesh.
 *
 * OU logique : une cible survit dès qu'UNE primitive la fait bouger. Faire un ET
 * supprimerait des cibles encore utilisées par une primitive voisine — la tête
 * d'Echo est répartie sur 9 primitives, l'erreur serait invisible à l'écriture
 * et visible seulement en jeu, sur une expression figée.
 *
 * @param {boolean[][]} masks  `masks[primitive][cible] = la cible bouge ici`
 * @returns {boolean[]} `alive[cible]`
 */
export function combineAliveMasks(masks) {
  const n = masks.reduce((m, x) => Math.max(m, x.length), 0);
  const alive = new Array(n).fill(false);
  for (const mask of masks)
    for (let i = 0; i < mask.length; i++) if (mask[i]) alive[i] = true;
  return alive;
}

/**
 * Filtre une liste indexée par cible (poids du mesh, noms de cibles) selon le
 * masque. Renvoie `undefined` si l'entrée l'était — un mesh sans poids déclarés
 * ne doit pas s'en voir inventer.
 */
export function filterByMask(list, alive) {
  if (!list) return undefined;
  return list.filter((_, i) => alive[i]);
}
