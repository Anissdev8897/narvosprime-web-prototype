// forge/chunkStream.ts — partitionnement spatial des objets d'une map éditeur en CELLULES
// (chunks runtime) + sélection des cellules ACTIVES selon la position joueur (pur, testable).
//
// Permet de ne charger QUE les objets proches du joueur (mémoire bornée sur grandes maps) et
// de décharger les lointains → "chargement dynamique selon la position". Aucune dépendance
// Three : le rendu/dispose vit dans ForgeBuiltMap.

/** Clé de cellule (col,row) pour un point monde (x,z) et une taille de cellule. */
export function cellKey(x: number, z: number, size: number): string {
  return `${Math.floor(x / size)},${Math.floor(z / size)}`;
}

/** Regroupe les objets par cellule (selon leur pos XZ). */
export function chunkObjects<T extends { pos: [number, number, number] }>(objs: T[], size: number): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const o of objs) {
    const k = cellKey(o.pos[0], o.pos[2], size);
    const arr = m.get(k);
    if (arr) arr.push(o); else m.set(k, [o]);
  }
  return m;
}

/** Cellules dont le centre est à portée du joueur (rayon de chargement). */
export function activeCells(px: number, pz: number, size: number, radius: number): Set<string> {
  const set = new Set<string>();
  const r = Math.ceil((radius + size) / size);
  const ci = Math.floor(px / size), cj = Math.floor(pz / size);
  const half = size * 0.5;
  for (let dj = -r; dj <= r; dj++) {
    for (let di = -r; di <= r; di++) {
      const cx = ci + di, cz = cj + dj;
      const centerX = cx * size + half, centerZ = cz * size + half;
      // marge ~demi-diagonale → une cellule partiellement dans le rayon reste chargée.
      if (Math.hypot(centerX - px, centerZ - pz) <= radius + half * 1.42) set.add(`${cx},${cz}`);
    }
  }
  return set;
}
