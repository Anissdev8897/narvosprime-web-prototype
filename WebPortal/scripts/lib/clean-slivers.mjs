// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/clean-slivers.mjs — Retire les triangles dégénérés et les « lames ».
//
// POURQUOI CE FICHIER EXISTE — mesuré sur halo_map.glb :
//
//   • Des triangles ÉTIRÉS (une arête très longue, une très courte) existent
//     DANS LA SOURCE Unreal, pas seulement après notre pipeline. Échantillon de
//     406 primitives : 8 lames sur 85 356 triangles, arête max 65 unités pour
//     une médiane de 0,30. En jeu, ce sont des plaques fines qui percent le sol.
//
//   • La quantification Draco ajoute des triangles ÉCRASÉS EN POINT quand elle
//     soude des sommets voisins : 10 105 sur un chunk de 292 538 triangles
//     (3,5 %). Invisibles au rendu, mais autant d'index transportés pour rien.
//
// `weld()` de gltf-transform NE LES RETIRE PAS — vérifié en 4.3.0 : il fusionne
// les sommets (399 610 → 386 392) et laisse triangles, dégénérés et lames
// strictement inchangés. La documentation qui affirme le contraire décrit une
// autre version. D'où ce nettoyage explicite.
//
// PRUDENCE ASSUMÉE : de la géométrie légitimement fine existe (câbles, tôles,
// garde-corps). On ne retire donc une lame que si elle cumule DEUX critères —
// un rapport d'aspect extrême ET une arête longue dans l'absolu. Une écharde de
// 2 cm sur une pièce de machine passe ; une plaque de 80 unités large de 15 cm
// ne passe pas.
// ══════════════════════════════════════════════════════════════════════════════

/** Seuils par défaut — conservateurs, cf. l'en-tête. */
export const SLIVER_DEFAULTS = {
  /** Rapport arête la plus longue / la plus courte au-delà duquel c'est une lame. */
  maxAspect: 500,
  /** …et seulement si l'arête longue dépasse cette taille, en unités monde. */
  minLongEdge: 8,
};

/** Longueur d'arête au carré entre deux sommets d'un tableau de positions. */
function edge2(pos, i, j) {
  const dx = pos[j] - pos[i];
  const dy = pos[j + 1] - pos[i + 1];
  const dz = pos[j + 2] - pos[i + 2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Filtre les triangles d'un Document glTF.
 *
 * Ne touche QUE l'index buffer : les sommets restent en place, donc rien ne
 * bouge visuellement à part la disparition des triangles retirés. Un `prune()`
 * ultérieur récupérera les sommets devenus orphelins.
 *
 * @returns {{ examined: number, degenerate: number, slivers: number }}
 */
export function cleanSlivers(doc, opts = {}) {
  const { maxAspect, minLongEdge } = { ...SLIVER_DEFAULTS, ...opts };
  const minLongEdge2 = minLongEdge * minLongEdge;
  let examined = 0;
  let degenerate = 0;
  let slivers = 0;

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      // Mode 4 = TRIANGLES. Les autres modes (points, lignes) n'ont pas d'aire
      // et ce filtre n'a aucun sens pour eux.
      if (prim.getMode() !== 4) continue;
      const posAcc = prim.getAttribute("POSITION");
      const idxAcc = prim.getIndices();
      if (!posAcc || !idxAcc) continue;

      const pos = posAcc.getArray();
      const idx = idxAcc.getArray();
      const kept = [];

      for (let t = 0; t + 2 < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const e1 = edge2(pos, a, b);
        const e2 = edge2(pos, b, c);
        const e3 = edge2(pos, c, a);
        examined++;

        const mx2 = Math.max(e1, e2, e3);
        const mn2 = Math.min(e1, e2, e3);

        // Écrasé en point : les trois sommets confondus. Ne rend rien.
        if (mx2 < 1e-12) { degenerate++; continue; }
        // Deux sommets confondus : aire nulle, ne rend rien non plus.
        if (mn2 < 1e-12) { degenerate++; continue; }

        // Lame : rapport d'aspect extrême ET longue dans l'absolu.
        if (mx2 > minLongEdge2 && mx2 / mn2 > maxAspect * maxAspect) {
          slivers++;
          continue;
        }

        kept.push(idx[t], idx[t + 1], idx[t + 2]);
      }

      if (kept.length !== idx.length) {
        // Réutilise le type d'index existant : repasser en Uint32 gonflerait le
        // fichier sans raison quand Uint16 suffisait.
        const Arr = idx.constructor;
        idxAcc.setArray(new Arr(kept));
      }
    }
  }

  return { examined, degenerate, slivers };
}
