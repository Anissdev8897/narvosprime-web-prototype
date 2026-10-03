// ══════════════════════════════════════════════════════════════════════════════
// runtime/vehicles/ShipDestructionWatcher.tsx — Détection destruction véhicule
//
// Composant R3F invisible qui surveille le shipController. Quand
// `ctrl.destroyed === true`, déclenche :
//   1) capture la position pour le VFX d'explosion (overlay parent)
//   2) callback onDestroyed (parent fait auto-exit + dégâts résiduels joueur)
//
// Latch unique : ne se redéclenche qu'une fois par cycle de vie du ship.
// ══════════════════════════════════════════════════════════════════════════════

import { useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShipController } from "./ShipController";

interface Props {
  shipControllerRef: MutableRefObject<ShipController | null>;
  /** Appelé une fois quand le véhicule est détruit. Le parent gère le reste. */
  onDestroyed: (pos: [number, number, number]) => void;
}

export function ShipDestructionWatcher({ shipControllerRef, onDestroyed }: Props) {
  /** True après le 1er déclenchement — empêche les multi-trigger sur le même ship. */
  const triggered = useRef(false);

  useFrame(() => {
    const ctrl = shipControllerRef.current;
    if (!ctrl) {
      // Plus de ship → reset le latch pour le prochain véhicule
      if (triggered.current) triggered.current = false;
      return;
    }
    if (triggered.current) return;
    if (ctrl.destroyed) {
      triggered.current = true;
      onDestroyed([ctrl.position.x, ctrl.position.y, ctrl.position.z]);
    }
  });

  return null;
}
