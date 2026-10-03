// combat/rollDamage.ts — jet de COUP CRITIQUE (pur). La stat critique existait
// (classe + équipement + talents) mais AUCUN jet n'était fait — elle devient réelle.
export const CRIT_MULT = 1.75;

/** Jet de dégâts : `critPct` en POURCENT (0-100, la convention d'effectiveStats). */
export function rollDamage(
  base: number, critPct: number, rng: () => number = Math.random,
): { amount: number; isCrit: boolean } {
  const isCrit = rng() < Math.max(0, Math.min(100, critPct)) / 100;
  return { amount: isCrit ? Math.round(base * CRIT_MULT) : Math.round(base), isCrit };
}
