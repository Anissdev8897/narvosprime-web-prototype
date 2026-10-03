const MAPS_ROOT = "/models/Maps";

/**
 * 8 chunks spatiaux pour forge_map — générés par puzzle-chunks.mjs :
 * flatten → bucketing spatial k-d tree (XZ) → prune/dedup/join → draco,
 * puis textures converties en KTX2 par assets-to-ktx2.mjs.
 *
 * Dossier `chunks_v3` : découpé depuis le GLB RÉIMPORTÉ le 28/07 (7 965 nodes,
 * 2 061 154 triangles, 7 188 matériaux — contre 12 996 / 2 435 643 / 12 965 pour
 * l'export précédent). Généré par `scripts/rebuild-map-chunks.mjs`, qui enchaîne
 * toute la chaîne dans le bon ordre.
 *
 * Vérifié après génération : couverture 100,0 %, `spatial: true` avec 8 centres
 * distincts, 0,00 % de triangles d'aire nulle résiduels, 9 985 textures KTX2
 * toutes en dimensions multiples de 4.
 *
 * Historique — `chunks` (v1) ne contenait que 87,2 % des triangles et était
 * buckété par NOMBRE DE SOMMETS et non par position : chaque chunk portait des
 * objets dispersés sur toute la carte, si bien qu'un chunk absent trouait la
 * carte entière au lieu d'une région. `chunks_v2` a corrigé ça mais découpait
 * l'export précédent.
 *
 * Ce sont des chemins COMPLETS, pas des noms de fichiers : `ForgeMapBackdrop`
 * les passe directement au loader.
 */
export const FORGE_CHUNKS: string[] = Array.from({ length: 8 }, (_, i) => {
  const id = String(i + 1).padStart(2, "0");
  return `${MAPS_ROOT}/forge_map/chunks_v3/chunk_${id}.glb`;
});
