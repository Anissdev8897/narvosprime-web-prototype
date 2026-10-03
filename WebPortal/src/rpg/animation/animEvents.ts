// ══════════════════════════════════════════════════════════════════════════════
// animation/animEvents.ts — Table d'Animation Events (équivalent Unity Notify).
//
// Three.js ne sait PAS embarquer d'events dans un clip FBX/GLB. On les externalise
// ici, indexés par ActionId (idle/cast/attack/…), au TEMPS NORMALISÉ 0..1 du clip
// (robuste au timeScale). L'AnimationController les déclenche quand le playhead du
// MIXER franchit `at` → frame-exact, sans timer global.
//
// ➜ Ajouter un déclenchement = une ligne ici. AUCUN code système à modifier.
// ══════════════════════════════════════════════════════════════════════════════

import type { ActionId } from "../types";

export type AnimEventType = "recoil" | "impact" | "sfx" | "vfx";

export interface AnimEvent {
  /** Position dans le clip, NORMALISÉE 0..1 (0 = début, 1 = fin). */
  at: number;
  type: AnimEventType;
  /** Charge utile : pour "recoil"/"impact" = id d'un CameraRecoilProfile. */
  payload?: string;
}

/** Events par action. `at` = fraction du clip (ex: 0.35 = 35% de l'animation). */
export const ANIM_EVENTS: Partial<Record<ActionId, AnimEvent[]>> = {
  cast:     [{ at: 0.35, type: "recoil", payload: "spell_fire" }],
  ultimate: [{ at: 0.45, type: "recoil", payload: "spell_aoe" }],
  attack:   [{ at: 0.30, type: "recoil", payload: "melee_heavy" }],
  // Exemples futurs (décommenter/ajuster quand les clips sont mappés) :
  // hit:    [{ at: 0.05, type: "recoil", payload: "boss_slam" }],
};

export function eventsForAction(action: ActionId): AnimEvent[] {
  return ANIM_EVENTS[action] ?? [];
}
