// forge/terrainData.ts — modèle de TERRAIN éditable (heightmap) + pinceau (pur, testable).
//
// Une grille (seg+1)×(seg+1) de hauteurs sur un plan size×size centré en (0,0). Le pinceau
// modifie les sommets dans un rayon monde : hausser/abaisser/lisser. La géométrie est
// reconstruite à partir de `heights` (TerrainMesh) ; persistée dans ForgeScene.terrain.
export type BrushMode = "raise" | "lower" | "smooth" | "paint";

export interface TerrainData {
  id?: string;        // identifiant (multi-terrains) — généré à la création
  size: number;       // côté du plan (m) — libre (jusqu'à plusieurs km)
  seg: number;        // nb de segments par côté → (seg+1)² sommets
  heights: number[];  // longueur (seg+1)² , hauteur Y par sommet
  color: string;      // couleur de base
  offset?: [number, number, number]; // position monde du terrain (déplaçable)
}

export function createTerrain(size = 120, seg = 64, color = "#3f6b3a", offset: [number, number, number] = [0, 0, 0]): TerrainData {
  return { id: "ter_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), size, seg, color, offset, heights: new Array((seg + 1) * (seg + 1)).fill(0) };
}

/** Index de grille (col i, row j) → indice plat. */
export const gridIndex = (seg: number, i: number, j: number): number => j * (seg + 1) + i;

/** Position MONDE (x,z) d'un sommet (i,j) — plan centré. */
export function vertexWorld(t: TerrainData, i: number, j: number): { x: number; z: number } {
  const half = t.size / 2;
  const step = t.size / t.seg;
  return { x: -half + i * step, z: -half + j * step };
}

/** Applique le pinceau au point monde (wx,wz). Renvoie un NOUVEAU tableau de hauteurs
 *  (immutable). radius en mètres, strength en mètres/coup. Atténuation gaussienne. */
export function applyBrush(
  t: TerrainData, wx: number, wz: number, mode: BrushMode, radius: number, strength: number,
): number[] {
  const h = t.heights.slice();
  const half = t.size / 2;
  const step = t.size / t.seg;
  // Fenêtre de sommets touchés (bornée au rayon).
  const ci = Math.round((wx + half) / step);
  const cj = Math.round((wz + half) / step);
  const r = Math.ceil(radius / step);
  for (let dj = -r; dj <= r; dj++) {
    for (let di = -r; di <= r; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i > t.seg || j > t.seg) continue;
      const v = vertexWorld(t, i, j);
      const dist = Math.hypot(v.x - wx, v.z - wz);
      if (dist > radius) continue;
      const fall = Math.exp(-(dist * dist) / (2 * (radius / 2.2) * (radius / 2.2))); // gaussienne
      const idx = gridIndex(t.seg, i, j);
      if (mode === "raise") h[idx] += strength * fall;
      else if (mode === "lower") h[idx] -= strength * fall;
      else if (mode === "smooth") {
        // moyenne des voisins → lissage
        let sum = 0, n = 0;
        for (const [ni, nj] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]] as const) {
          if (ni < 0 || nj < 0 || ni > t.seg || nj > t.seg) continue;
          sum += t.heights[gridIndex(t.seg, ni, nj)]; n++;
        }
        if (n) h[idx] += (sum / n - h[idx]) * fall * Math.min(1, strength);
      }
    }
  }
  return h;
}
