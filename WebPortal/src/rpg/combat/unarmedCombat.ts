// combat/unarmedCombat.ts — machine d'état du combo mains nues + calcul de dégâts (pur).
import type { ActionId } from "../types";
import { strikeForStep, type StrikeId } from "./unarmedStrikes";

export const COMBO_WINDOW_MS = 600; // fenêtre pour enchaîner le coup suivant
export const CHARGE_MS = 350;       // maintien (clic / F) au-delà → variante CHARGÉE du coup

export interface ComboState { step: number; lastHitAt: number; }
export function createCombo(): ComboState { return { step: 0, lastHitAt: -Infinity }; }

/** Avance le combo. `nowMs` = horloge (performance.now()). `rng` injectable (testable).
 *  Mute `state` en place et renvoie l'action à jouer + si c'est le finisher. */
export function advanceCombo(
  state: ComboState, nowMs: number, rng: () => number = Math.random,
): { action: ActionId; isFinisher: boolean; strike: StrikeId } {
  const within = nowMs - state.lastHitAt <= COMBO_WINDOW_MS;
  state.step = within && state.step < 3 ? state.step + 1 : 1;
  state.lastHitAt = nowMs;
  // `strike` porte la LATÉRALITÉ (jab_l / jab_r / kick_l…), `action` reste
  // l'ancien identifiant pour les appelants qui ne s'en servent pas encore.
  // Les deux sont dérivés du MÊME pas de combo — ils ne peuvent pas diverger.
  if (state.step === 1) return { action: "punch1", isFinisher: false, strike: strikeForStep(1, false, rng) };
  if (state.step === 2) return { action: "punch2", isFinisher: false, strike: strikeForStep(2, false, rng) };
  // FINISHER VARIÉ : uppercut / coup de pied retourné / enchaînement — le combo
  // ne se termine jamais deux fois pareil (fluidité + variété visuelle).
  const r = rng();
  const action: ActionId = r < 0.4 ? "punch3" : r < 0.75 ? "kick" : "punch_charged";

  // `strike` DÉRIVE de `action` — pas l'inverse, et surtout pas d'un SECOND
  // tirage. Deux tirages indépendants donnaient des couples incohérents :
  // « punch3 » annoncé avec « kick_l » joué, soit une animation d'uppercut et
  // des dégâts de coup de pied.
  //
  // Le CÔTÉ reste imposé par la parité du pas, jamais par le hasard : une série
  // « gauche gauche gauche » se lit comme une animation en boucle.
  const gauche = state.step % 2 === 1;
  const strike: StrikeId = action === "kick"
    ? (gauche ? "kick_l" : "kick_r")
    : (gauche ? "uppercut_l" : "uppercut_r");
  return { action, isFinisher: true, strike };
}

/** Dégât d'un coup mains nues. Faible ; finisher ×2. Échelle avec la puissance. */
export function unarmedDamage(puissance: number, isFinisher: boolean): number {
  const base = Math.round(5 + puissance * 0.4);
  return isFinisher ? base * 2 : base;
}
