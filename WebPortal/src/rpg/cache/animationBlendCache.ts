// ══════════════════════════════════════════════════════════════════════════════
// cache/animationBlendCache.ts — Cache pour les calculs de blend d'animation
//
// Les calculs de blend weights (solveLocomotion, blendWeightsForAngle, etc.)
// sont des fonctions pures appelées à chaque frame. La mémoïsation synchrone
// avec WeakMap évite de recalculer pour les mêmes entrées.
// ══════════════════════════════════════════════════════════════════════════════

import { memoizeSyncPure } from "./memoize";
import { EvictionStrategy } from "./types";

// ── Cache pour blendWeightsForAngle ─────────────────────────────────────────
// Fonction pure : angle → BlendWeight[]
// Appelée ~60 fois/s, l'angle ne change que de quelques degrés par frame.

export interface BlendWeightCache {
  dir: string;
  weight: number;
}

/**
 * Version mémoïsée de blendWeightsForAngle.
 * Le cache est limité à 64 entrées (angles possibles : 0-360° par pas de 0.1° max).
 */
export const cachedBlendWeightsForAngle = memoizeSyncPure(
  (angleDeg: number): BlendWeightCache[] => {
    const raw = ((angleDeg % 360) + 360) % 360;
    const slot = raw / 45;
    const lo = Math.floor(slot) % 8;
    const hi = (lo + 1) % 8;
    const t = slot - Math.floor(slot);

    const ORDER = [
      "forward", "forwardRight", "right", "backRight",
      "back", "backLeft", "left", "forwardLeft",
    ];

    if (t < 1e-4) return [{ dir: ORDER[lo], weight: 1 }];
    return [
      { dir: ORDER[lo], weight: 1 - t },
      { dir: ORDER[hi], weight: t },
    ];
  },
  { capacity: 360 },
);

// ── Cache pour solveLocomotion ──────────────────────────────────────────────
// Les entrées sont des combinaisons de {localX, localZ, speed, walkSpeed, runSpeed}.
// On arrondit pour augmenter le hit rate : la vitesse change continûment mais
// les différences < 0.01 m/s sont imperceptibles.

export interface LocomotionInputKey {
  localX: number;
  localZ: number;
  speed: number;
  walkSpeed: number;
  runSpeed: number;
}

/**
 * Génère une clé de cache pour les entrées de locomotion, avec arrondi.
 */
function locomotionKey(localX: number, localZ: number, speed: number, walkSpeed: number, runSpeed: number): string {
  return `${localX.toFixed(2)}|${localZ.toFixed(2)}|${speed.toFixed(2)}|${walkSpeed.toFixed(2)}|${runSpeed.toFixed(2)}`;
}

/**
 * Version mémoïsée de solveLocomotion.
 * Le cache est limité à 256 entrées (LRU implicite via le Map).
 */
export function createCachedSolveLocomotion(capacity = 256) {
  const cache = new Map<string, {
    gait: "idle" | "walk" | "run";
    weights: BlendWeightCache[];
    timeScale: number;
    runBlend: number;
  }>();

  return (localX: number, localZ: number, speed: number, walkSpeed: number, runSpeed: number) => {
    const key = locomotionKey(localX, localZ, speed, walkSpeed, runSpeed);
    const cached = cache.get(key);
    if (cached) return cached;

    // Calcul du résultat (copie de solveLocomotion)
    const moving = speed >= 0.3 && (localX !== 0 || localZ !== 0);

    interface LocoResult {
      gait: "idle" | "walk" | "run";
      weights: BlendWeightCache[];
      timeScale: number;
      runBlend: number;
    }

    let result: LocoResult;

    if (!moving) {
      result = { gait: "idle" as const, weights: [], timeScale: 1, runBlend: 0 };
    } else {
      const angle = (Math.atan2(localX, -localZ) * 180) / Math.PI;
      const weights = cachedBlendWeightsForAngle(angle);

      const runBlend = Math.min(1, Math.max(0, (speed - walkSpeed) / Math.max(0.001, runSpeed - walkSpeed)));
      const gait: "walk" | "run" = runBlend >= 0.5 ? "run" : "walk";
      const reference = gait === "run" ? runSpeed : walkSpeed;
      const timeScale = Math.min(1.8, Math.max(0.6, speed / Math.max(0.001, reference)));

      result = { gait, weights, timeScale, runBlend };
    }

    // Éviction LRU implicite du Map
    if (cache.size >= capacity) {
      const firstKey = cache.keys().next();
      if (!firstKey.done) cache.delete(firstKey.value);
    }

    cache.set(key, result);
    return result;
  };
}

/**
 * Cache global pour les calculs de locomotion (partagé par tous les personnages).
 * En production, les speeds de chaque personnage diffèrent → le cache est moins
 * efficace. On utilise une capacité plus grande (512).
 */
export const cachedSolveLocomotion = createCachedSolveLocomotion(512);

// ── Cache pour les opérations de boneMask ────────────────────────────────────

/**
 * En cours d'implémentation : mémoïse le résultat de `maskClipToBones`
 * qui est appelé pour chaque personnage à chaque changement de clips.
 */

export interface MaskClipKey {
  clipName: string;
  boneMaskType: string;
}

/**
 * Mémoïse la fonction de masquage d'os pour les animations.
 */
export const memoizedMaskClipToBones = memoizeSyncPure(
  (clipJson: string, maskType: string): string => {
    // Passe-plat : le vrai calcul est dans boneMask.ts
    // Cette fonction sert de placeholder pour intégration future.
    // En attendant, on retourne l'identité.
    return clipJson;
  },
  { capacity: 128 },
);
