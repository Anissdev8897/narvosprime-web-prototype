// ══════════════════════════════════════════════════════════════════════════════
// input/InputTriggers.ts — Déclencheurs d'input (EnhancedInput-like)
//
// Évaluent quand une action doit être déclenchée selon le pattern de pression.
// Chaque trigger reçoit l'état brut de la touche + les timestamps, et produit
// un TriggerOutput.
// ══════════════════════════════════════════════════════════════════════════════

import { ETriggerType, type TriggerConfig, type TriggerOutput, type InputActionValue } from './types';

/** État interne partagé pour tous les triggers d'une action. */
export interface TriggerEvaluatorState {
  /** Timestamp de début de pression en cours (ms). */
  pressStart: number;
  /** Timestamp du dernier relâchement (ms). */
  lastRelease: number;
  /** Timestamp de l'avant-dernier relâchement (ms) — pour double-tap. */
  prevRelease: number;
  /** Compteur de pulses émis (pour Pulse). */
  pulseCount: number;
  /** Timestamp du dernier pulse émis (ms). */
  lastPulseTime: number;
  /** La touche était-elle pressée la frame précédente ? */
  wasPressed: boolean;
  /** La touche est-elle pressée cette frame ? */
  isPressed: boolean;
}

export function createTriggerState(): TriggerEvaluatorState {
  return {
    pressStart: 0,
    lastRelease: 0,
    prevRelease: 0,
    pulseCount: 0,
    lastPulseTime: 0,
    wasPressed: false,
    isPressed: false,
  };
}

/**
 * Met à jour l'état brut du trigger.
 * Appelé une fois par frame avant l'évaluation.
 */
export function updateTriggerState(
  s: TriggerEvaluatorState,
  now: number,
  keyPressed: boolean,
): void {
  s.wasPressed = s.isPressed;
  s.isPressed = keyPressed;

  if (keyPressed && !s.wasPressed) {
    // Front montant (nouvelle pression)
    s.pressStart = now;
    s.prevRelease = s.lastRelease;
  }
  if (!keyPressed && s.wasPressed) {
    // Front descendant (relâchement)
    s.lastRelease = now;
  }
}

/**
 * Évalue un trigger et retourne le résultat.
 */
export function evaluateTrigger(
  s: TriggerEvaluatorState,
  config: TriggerConfig,
  now: number,
  rawValue: InputActionValue,
): TriggerOutput {
  const zero: TriggerOutput = { triggered: false, value: false, elapsed: 0, intensity: 0 };

  switch (config.type) {
    case ETriggerType.Pressed:
      return evaluatePressed(s, now, rawValue);

    case ETriggerType.Hold:
      return evaluateHold(s, config, now, rawValue);

    case ETriggerType.Tap:
      return evaluateTap(s, config, now, rawValue);

    case ETriggerType.DoubleTap:
      return evaluateDoubleTap(s, config, now, rawValue);

    case ETriggerType.Pulse:
      return evaluatePulse(s, config, now, rawValue);

    case ETriggerType.Released:
      return evaluateReleased(s, now, rawValue);

    default:
      return zero;
  }
}

/** Pressed : se déclenche immédiatement au front montant, retourne true puis false. */
function evaluatePressed(
  s: TriggerEvaluatorState,
  _now: number,
  rawValue: InputActionValue,
): TriggerOutput {
  const triggered = s.isPressed && !s.wasPressed;
  const value = triggered ? rawValue : (typeof rawValue === 'boolean' ? false : 0);
  return { triggered, value, elapsed: triggered ? 1 : 0, intensity: triggered ? 1 : 0 };
}

/** Released : se déclenche au relâchement. */
function evaluateReleased(
  s: TriggerEvaluatorState,
  _now: number,
  rawValue: InputActionValue,
): TriggerOutput {
  const triggered = !s.isPressed && s.wasPressed;
  return { triggered, value: rawValue, elapsed: triggered ? 1 : 0, intensity: triggered ? 1 : 0 };
}

/** Hold : se déclenche après avoir maintenu la touche pendant `holdTimeMs`. */
function evaluateHold(
  s: TriggerEvaluatorState,
  config: TriggerConfig,
  now: number,
  rawValue: InputActionValue,
): TriggerOutput {
  const holdTime = config.holdTimeMs ?? 500;
  if (!s.isPressed) {
    return { triggered: false, value: false, elapsed: 0, intensity: 0 };
  }
  const heldDuration = now - s.pressStart;
  const triggered = heldDuration >= holdTime;
  const intensity = Math.min(heldDuration / holdTime, 1);
  return {
    triggered,
    value: triggered ? rawValue : false,
    elapsed: heldDuration,
    intensity,
  };
}

/** Tap : se déclenche si press → release dans `tapWindowMs`. */
function evaluateTap(
  s: TriggerEvaluatorState,
  config: TriggerConfig,
  now: number,
  rawValue: InputActionValue,
): TriggerOutput {
  const tapWindow = config.tapWindowMs ?? 300;
  // Détecte un relâchement rapide
  if (!s.isPressed && s.wasPressed) {
    const heldDuration = s.lastRelease - s.pressStart;
    const triggered = heldDuration <= tapWindow;
    return {
      triggered,
      value: triggered ? rawValue : false,
      elapsed: heldDuration,
      intensity: triggered ? 1 : 0,
    };
  }
  return { triggered: false, value: false, elapsed: 0, intensity: 0 };
}

/** DoubleTap : se déclenche si deux taps rapides successifs dans la fenêtre. */
function evaluateDoubleTap(
  s: TriggerEvaluatorState,
  config: TriggerConfig,
  now: number,
  rawValue: InputActionValue,
): TriggerOutput {
  const tapWindow = config.tapWindowMs ?? 300;
  // Détecte un relâchement qui complète un double tap
  if (!s.isPressed && s.wasPressed) {
    const durationPress = s.lastRelease - s.pressStart;
    if (durationPress <= tapWindow) {
      const gapBetweenPresses = s.pressStart - s.prevRelease;
      if (s.prevRelease > 0 && gapBetweenPresses <= tapWindow) {
        return {
          triggered: true,
          value: rawValue,
          elapsed: gapBetweenPresses,
          intensity: 1,
        };
      }
    }
  }
  return { triggered: false, value: false, elapsed: 0, intensity: 0 };
}

/** Pulse : se déclenche périodiquement tant que la touche est maintenue. */
function evaluatePulse(
  s: TriggerEvaluatorState,
  config: TriggerConfig,
  now: number,
  rawValue: InputActionValue,
): TriggerOutput {
  const interval = config.pulseIntervalMs ?? 200;
  if (!s.isPressed) {
    s.pulseCount = 0;
    s.lastPulseTime = 0;
    return { triggered: false, value: false, elapsed: 0, intensity: 0 };
  }
  // Premier pulse immédiat au front montant
  if (s.isPressed && !s.wasPressed) {
    s.pulseCount = 1;
    s.lastPulseTime = now;
    return { triggered: true, value: rawValue, elapsed: now - s.pressStart, intensity: 1 };
  }
  // Pulses suivants à l'intervalle
  if (now - s.lastPulseTime >= interval) {
    s.pulseCount++;
    s.lastPulseTime = now;
    return { triggered: true, value: rawValue, elapsed: now - s.pressStart, intensity: 1 };
  }
  return { triggered: false, value: false, elapsed: now - s.pressStart, intensity: 0 };
}
