// runtime/perf/distanceBand.ts — LOD par bandes de distance, partagé par le throttling
// raycast + anim des PNJ. On reçoit la distance AU CARRÉ (évite un sqrt par entité/frame).
export const Band = { NEAR: 0, MID: 1, FAR: 2 } as const;
export type BandT = (typeof Band)[keyof typeof Band];

// Seuils en mètres. NEAR couvre la portée d'aggro à distance (RANGED_AGGRO=30) + marge →
// le combat reste plein régime. MID = visible mais throttlé. FAR = gelé.
export const NEAR_MAX = 35;
export const MID_MAX = 60;
const NEAR2 = NEAR_MAX * NEAR_MAX;
const MID2 = MID_MAX * MID_MAX;

/** Bande LOD à partir d'une distance AU CARRÉ. */
export function distanceBand(distSq: number): BandT {
  if (distSq <= NEAR2) return Band.NEAR;
  if (distSq <= MID2) return Band.MID;
  return Band.FAR;
}
