// ══════════════════════════════════════════════════════════════════════════════
// combat/spellDamage.ts — Modèle de dégâts des sorts d'archétype (% des PV joueur).
//
// Décision projet : les sorts signature infligent un POURCENTAGE des PV max DU
// JOUEUR, ajusté par sa puissance et la défense de l'ennemi touché.
//
//   dégâts = pct × PV_max_joueur × (1 + atk/100) × 100/(100+def)   [× 1.5 si crit]
//
// • pct           : 0.15 = 15% (Mage/Archer), 0.20 (Guerrier), 0.25 (Spatial)…
// • atkFactor     : +1% de dégâts par point de puissance (cohérent avec calcDamage).
// • mitigation    : la défense ennemie réduit les dégâts (jamais en-dessous de 0).
// Pur & déterministe (crit fourni par l'appelant) → entièrement testable.
// ══════════════════════════════════════════════════════════════════════════════

export interface ArchetypeDamageInput {
  /** Fraction des PV max du joueur (0.15 = 15%). */
  pctPlayerHp: number;
  /** PV max du joueur (base du calcul). */
  playerMaxHp: number;
  /** Puissance/attackPower du joueur (+1% par point). */
  playerAtk: number;
  /** Défense de l'ennemi touché (atténuation). 0 si inconnue. */
  enemyDefense?: number;
  /** Coup critique (×1.5). */
  crit?: boolean;
}

export function calcArchetypeDamage(i: ArchetypeDamageInput): number {
  const pct = Math.max(0, i.pctPlayerHp);
  const base = pct * Math.max(0, i.playerMaxHp);
  const atkFactor = 1 + Math.max(0, i.playerAtk ?? 0) / 100;
  const def = Math.max(0, i.enemyDefense ?? 0);
  const mitigation = 100 / (100 + def); // 0..1 (def=0 → 1, def=100 → 0.5)
  const dmg = base * atkFactor * mitigation;
  return Math.round(i.crit ? dmg * 1.5 : dmg);
}
