// ══════════════════════════════════════════════════════════════════════════════
// combat/CombatHandler.ts — Logique de combat unifiée
//
// Centralise les fonctions de combat extraites de RpgGameWorld.tsx :
//   • createAutoAttackHandler — auto-attack (arc/gun/staff/mêlée)
//   • createUnarmedStrikeHandler — combo mains nues / coup chargé / kick
//   • Combat utilities (dégâts, combos, roll)
//
// Réexporte depuis les modules spécialisés pour offrir une API unique.
// ══════════════════════════════════════════════════════════════════════════════

// ── Handlers (factory closures, extraits de RpgGameWorld) ──────────────────
export {
  createAutoAttackHandler,
  createUnarmedStrikeHandler,
} from "../runtime/combat/AutoAttackSystem";
export type {
  AutoAttackDeps,
  UnarmedStrikeDeps,
} from "../runtime/combat/AutoAttackSystem";

// ── Combo mains nues ──────────────────────────────────────────────────────
export {
  createCombo,
  advanceCombo,
  COMBO_WINDOW_MS,
  CHARGE_MS,
} from "./unarmedCombat";
export type { ComboState } from "./unarmedCombat";
export { strikeDamage } from "./unarmedStrikes";
export type { StrikeId } from "./unarmedStrikes";

// ── Dégâts ─────────────────────────────────────────────────────────────────
export { rollDamage } from "./rollDamage";
export { damageEvents } from "./damageEvents";

// ── Effets de statut & réactions ──────────────────────────────────────────
export { npcHitReact } from "./npcHitReact";
export type { HitReactKind } from "./npcHitReact";
export { statusEffects } from "./statusEffects";

// ── Munitions ──────────────────────────────────────────────────────────────
export { ammoStore } from "./ammoStore";
