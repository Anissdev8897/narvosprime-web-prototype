// ══════════════════════════════════════════════════════════════════════════════
// runtime/vehicles/ShipFlightUI.tsx — Composants de vol spatial extractés
// de RpgGameWorld.tsx (god-component). Regroupe les déclencheurs de transition
// atmosphérique, de télémetrie, et la limite spatiale.
//
// Extraits le 21 juillet 2026 — réduire RpgGameWorld de ~88 lignes.
// ══════════════════════════════════════════════════════════════════════════════

import { useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { collisionWorld } from "../CollisionWorld";
import { MAPS } from "../../loaders/assetManifest";
import type { ShipController } from "./ShipController";

// ── Planètes en hub orbital (positions identiques à SpaceEnvironment) ─────────
export const SPACE_PLANETS: { pos: THREE.Vector3; map: keyof typeof MAPS; range: number }[] = [
  { pos: new THREE.Vector3(-46, 10, -70), map: "forge", range: 28 },
  { pos: new THREE.Vector3(52, 14, -80),  map: "tower", range: 28 },
];

// ── Télémétrie du vaisseau (maj ~5×/s pour le HUD) ───────────────────────────
export interface ShipTelemetryState {
  speed: number;
  altitude: number;
  canExit: boolean;
  /** True si on est proche d'un sol valide → atterrissage sûr (vs saut en l'air) */
  nearGround: boolean;
  inSpace: boolean;
  stabilized: boolean;
  /** Ratio PV véhicule 0..1 (1 = full, 0 = détruit). 1 si véhicule invincible. */
  hpRatio: number;
  /** Le véhicule a-t-il des PV trackés (= peut être détruit) ? */
  hasHp: boolean;
}

export function ShipTelemetry({ shipControllerRef, isPiloting, onUpdate }: {
  shipControllerRef: MutableRefObject<ShipController | null>;
  isPiloting: boolean;
  onUpdate: (t: ShipTelemetryState) => void;
}) {
  const tick = useRef(0);
  useFrame(() => {
    if (!isPiloting || !shipControllerRef.current) return;
    if (++tick.current % 12 !== 0) return; // ~5 fps à 60 fps
    const ctrl = shipControllerRef.current;

    // Raycast sol sous le ship → injecté dans le controller pour canExit.
    // Le raycast démarre 1m au-dessus du ship pour ne pas hit son propre mesh
    // (en théorie le ship n'est pas dans colliders, mais sécurité).
    // Filtre par normale haute → ignore les murs verticaux.
    const groundY = collisionWorld.getGroundY(
      ctrl.position.x, ctrl.position.z,
      ctrl.position.y + 1, // depuis juste au-dessus du ship vers le bas
    );
    ctrl.setGroundBelow(groundY);

    onUpdate({
      speed:      Math.round(ctrl.speed),
      altitude:   Math.round(ctrl.position.y),
      canExit:    ctrl.canExit,
      nearGround: ctrl.isNearGround,
      inSpace:    ctrl.inSpace,
      stabilized: ctrl.stabilized,
      hpRatio:    ctrl.hpRatio,
      hasHp:      ctrl.hasHp,
    });
  });
  return null;
}

// ── Déclencheur de percée atmosphérique (sol → orbital) ──────────────────────
// Quand le vaisseau monte au-dessus de 300 m en dehors du hub spatial,
// le joueur perce l'atmosphère et voyage vers l'orbital.
export function ShipAtmosphereTrigger({ shipControllerRef, isPiloting, isSpaceMap, onLaunch }: {
  shipControllerRef: MutableRefObject<ShipController | null>;
  isPiloting: boolean;
  isSpaceMap: boolean;
  onLaunch: () => void;
}) {
  const fired = useRef(false);
  useFrame(() => {
    if (!isPiloting || isSpaceMap) { fired.current = false; return; }
    if (!shipControllerRef.current || fired.current) return;
    if (shipControllerRef.current.position.y > 300) {
      fired.current = true;
      onLaunch();
    }
  });
  return null;
}

// ── Déclencheur d'atterrissage (orbital → planète) ───────────────────────────
// En hub orbital, approcher une planète déclenche l'atterrissage.
export function SpaceLandingTrigger({ shipControllerRef, isPiloting, isSpaceMap, onLand }: {
  shipControllerRef: MutableRefObject<ShipController | null>;
  isPiloting: boolean;
  isSpaceMap: boolean;
  onLand: (map: keyof typeof MAPS) => void;
}) {
  const fired = useRef(false);
  useFrame(() => {
    if (!isPiloting || !isSpaceMap) { fired.current = false; return; }
    if (!shipControllerRef.current || fired.current) return;
    const sp = shipControllerRef.current.position;
    for (const p of SPACE_PLANETS) {
      if (sp.distanceTo(p.pos) < p.range) {
        fired.current = true;
        onLand(p.map);
        break;
      }
    }
  });
  return null;
}

// ── Limite spatiale (hub orbital) — DÉSACTIVÉE ────────────────────────────────
// Anciennement : clampait joueur + vaisseau à SPACE_BOUNDARY_RADIUS m du centre.
// Maintenant : le joueur peut s'aventurer à l'infini. SPACE_BOUNDARY_RADIUS reste
// utilisé comme zone "active" (combat IA, événements procéduraux, radar) mais
// n'enforce plus de barrière physique.
//
// Si tu veux ré-activer (ex: pour des modes de jeu compétitifs), il suffit de
// décommenter le bloc dans le useFrame ci-dessous.
export function SpatialBoundary({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  playerPosition,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shipControllerRef,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onHit,
}: {
  playerPosition: MutableRefObject<THREE.Vector3>;
  shipControllerRef: MutableRefObject<ShipController | null>;
  onHit: () => void;
}) {
  // Vide intentionnellement : no clamp = exploration libre à l'infini.
  // L'univers est étendu (Stars + DeepSkySphere) pour donner le sentiment d'infini.
  return null;
}
