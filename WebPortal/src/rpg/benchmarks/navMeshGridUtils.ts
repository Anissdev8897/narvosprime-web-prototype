// navMeshGridUtils.ts — Utilitaires de grille NavMesh (extraits de NavMeshBaker)
// Séparés pour être testables/benchmarkables sans dépendance WASM.
// En production, NavMeshBaker utilise ces mêmes calculs en interne.

export function computeGridDims(
  bounds: { min: { x: number; z: number }; max: { x: number; z: number } },
  cellSize: number,
) {
  const width = Math.ceil((bounds.max.x - bounds.min.x) / cellSize);
  const depth = Math.ceil((bounds.max.z - bounds.min.z) / cellSize);
  const total = width * depth;
  return { width, depth, total };
}

export function computeAdaptiveCellSize(
  bounds: { min: { x: number; z: number }; max: { x: number; z: number } },
  maxCells: number,
): number {
  const area = (bounds.max.x - bounds.min.x) * (bounds.max.z - bounds.min.z);
  return Math.sqrt(area / maxCells);
}
