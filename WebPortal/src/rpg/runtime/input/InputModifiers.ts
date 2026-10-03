// ══════════════════════════════════════════════════════════════════════════════
// input/InputModifiers.ts — Modificateurs d'input (EnhancedInput-like)
//
// Modifient la valeur brute d'une entrée avant qu'elle n'atteigne le trigger.
// Enchaînables : la sortie d'un modificateur est l'entrée du suivant.
// ══════════════════════════════════════════════════════════════════════════════

import type { InputActionValue, ModifierConfig } from './types';
import { EModifierType } from './types';

/**
 * Remappe une magnitude au-dessus du seuil vers [0, 1].
 *
 * Deux protections que la formule brute `(mag - t) / (1 - t)` n'avait pas :
 *  - `t = 1` (zone morte totale) divisait par ZÉRO → `Infinity` propagé jusque
 *    dans la vélocité du joueur. Un seul `Infinity` dans une position suffit à
 *    faire disparaître tout le rendu (cf. l'épisode NaN caméra du 31/07).
 *  - une entrée hors de [-1, 1] — un pad mal calibré, un axe brut non normalisé —
 *    ressortait amplifiée au lieu d'être saturée.
 *
 * La sortie est donc toujours finie et bornée à 1, quelles que soient les entrées.
 */
function remapAboveDeadZone(mag: number, threshold: number): number {
  const t = Math.min(Math.max(threshold, 0), 1);
  const denom = Math.max(1 - t, 1e-6);
  return Math.min((mag - t) / denom, 1);
}

/**
 * Applique une zone morte à une valeur 1D.
 * En dessous du seuil → 0 ; au-dessus → remapé linéairement entre 0 et 1.
 */
function applyDeadZone1D(value: number, threshold: number): number {
  const abs = Math.abs(value);
  if (abs <= threshold) return 0;
  return Math.sign(value) * remapAboveDeadZone(abs, threshold);
}

/**
 * Applique une zone morte à une valeur 2D [x, y].
 * La magnitude radiale est comparée au seuil.
 */
function applyDeadZone2D(value: [number, number], threshold: number): [number, number] {
  const [x, y] = value;
  const mag = Math.hypot(x, y);
  if (mag <= threshold) return [0, 0];
  const scale = remapAboveDeadZone(mag, threshold) / mag;
  return [x * scale, y * scale];
}

/**
 * Applique une zone morte à une valeur 3D [x, y, z].
 */
function applyDeadZone3D(value: [number, number, number], threshold: number): [number, number, number] {
  const [x, y, z] = value;
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag <= threshold) return [0, 0, 0];
  const scale = remapAboveDeadZone(mag, threshold) / mag;
  return [x * scale, y * scale, z * scale];
}

/** Applique la configuration de zone morte selon la forme de la valeur. */
function applyDeadZone(value: InputActionValue, threshold: number): InputActionValue {
  if (typeof value === 'number') return applyDeadZone1D(value, threshold);
  if (Array.isArray(value)) {
    if (value.length === 2) return applyDeadZone2D(value as [number, number], threshold);
    if (value.length === 3) return applyDeadZone3D(value as [number, number, number], threshold);
  }
  return value;
}

/** Multiplie une valeur par un facteur. */
function applyScalar(value: InputActionValue, factor: number): InputActionValue {
  if (typeof value === 'number') return value * factor;
  if (typeof value === 'boolean') return factor > 0 ? value : !value;
  if (Array.isArray(value)) return value.map((v) => v * factor) as InputActionValue;
  return value;
}

/** Négation : multiplie par -1 (ou inverse un booléen). */
function applyNegate(value: InputActionValue): InputActionValue {
  if (typeof value === 'number') return -value;
  if (typeof value === 'boolean') return !value;
  if (Array.isArray(value)) return value.map((v) => -v) as InputActionValue;
  return value;
}

/**
 * Swizzle : réorganise les axes.
 * Exemple : swizzleOrder=[1,0,2] sur [x,y,z] → [y,x,z]
 * Pour 2D, [1,0] → [y,x]
 */
function applySwizzle(value: InputActionValue, order: number[]): InputActionValue {
  if (!Array.isArray(value)) return value;
  const arr = value as number[];
  const result = order.map((i) => arr[i] ?? 0);
  if (result.length <= 1) return result[0] ?? 0;
  if (result.length === 2) return [result[0], result[1]] as [number, number];
  return [result[0], result[1], result[2]] as [number, number, number];
}

/**
 * Chaîne de modificateurs : applique chaque modificateur dans l'ordre à la valeur.
 */
export function applyModifiers(
  value: InputActionValue,
  modifiers: ModifierConfig[],
): InputActionValue {
  let result = value;
  for (const mod of modifiers) {
    switch (mod.type) {
      case EModifierType.DeadZone:
        result = applyDeadZone(result, mod.threshold ?? 0.1);
        break;
      case EModifierType.Scalar:
        result = applyScalar(result, mod.factor ?? 1);
        break;
      case EModifierType.Negate:
        result = applyNegate(result);
        break;
      case EModifierType.Swizzle:
        if (mod.swizzleOrder) result = applySwizzle(result, mod.swizzleOrder);
        break;
    }
  }
  return result;
}
