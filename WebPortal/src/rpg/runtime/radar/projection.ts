// WebPortal/src/rpg/runtime/radar/projection.ts
// Projection pure : coordonnées MONDE (XZ, m) → coordonnées CANVAS (px).
// Origine monde (0,0) → centre du canvas. Mappage linéaire borné par `arenaRadius`.

export interface RadarPoint {
  x: number;            // px (origine = coin haut-gauche du canvas)
  y: number;            // px
  inBounds: boolean;    // true si dans le cercle de l'arène
}

/**
 * Projette des coordonnées monde XZ vers le canvas radar.
 * @param worldX X dans le monde (m). Mappé sur l'axe X du canvas.
 * @param worldZ Z dans le monde (m). Mappé sur l'axe Y du canvas (convention RTS).
 * @param arenaRadius rayon de l'arène (m) — le bord du canvas correspond à ce rayon.
 * @param radarSize taille (carrée) du canvas (px).
 */
export function worldToRadar(
  worldX: number, worldZ: number,
  arenaRadius: number, radarSize: number,
): RadarPoint {
  const center = radarSize / 2;
  const pxPerMeter = center / arenaRadius;       // ratio px par mètre monde
  const x = center + worldX * pxPerMeter;
  const y = center + worldZ * pxPerMeter;
  const inBounds = Math.hypot(worldX, worldZ) <= arenaRadius;
  return { x, y, inBounds };
}
