// ══════════════════════════════════════════════════════════════════════════════
// vehicles/PilotableShip.tsx — Vaisseau pilotable (R3F)
//
// Deux comportements selon `isPiloted` :
//   • Idle  : hover animé sur le pad de dock, détection de proximité (embarquement).
//   • Piloté : position + orientation dictées par ShipController (chaque frame).
//
// NB : quand le vaisseau est piloté, TOUS les éléments de dock (pad, anneau,
// lumière, label) sont cachés — seul le modèle GLB suit le contrôleur.
// ══════════════════════════════════════════════════════════════════════════════

import { memo, useRef, useMemo, useEffect } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { applyAnisotropy } from "../sceneUtils";
import { qualityVariant } from "../../loaders/assetQuality";
import { collisionWorld } from "../CollisionWorld";
import type { ShipController } from "./ShipController";

// Hauteur de vol stationnaire au-dessus du pad (mode idle)
export const SHIP_HOVER_HEIGHT = 1.6;

// Facteur vitesse → timeScale du clip de rotation des roues. Vitesse SIGNÉE :
// + (avance) = roues vers l'avant, − (recule) = clip joué à l'envers = roues
// vers l'arrière. Réglé pour un visuel cohérent jusqu'à ~14 m/s.
const WHEEL_TIMESCALE = 0.4;

interface PilotableShipProps {
  id: string;
  shipPath: string;
  /** Centre du pad de dock au sol [x, y, z]. Le vaisseau y revient en mode idle. */
  dockPosition: [number, number, number];
  /** Orientation initiale du vaisseau (radians autour de Y). */
  dockYaw?: number;
  /**
   * Correction d'axe du modèle GLB [x, y, z] (radians).
   * Aligne le nez visuel du modèle sur le -Z local du groupe (= "avant" moteur).
   * Mesuré par analyse du maillage : chaque modèle est exporté avec son propre axe.
   */
  modelRotation?: [number, number, number];
  /** Échelle du modèle GLB (ignorée si targetSize est défini). */
  scale?: number;
  /** Normalise la plus grande dimension du modèle à cette taille (m) via bounding-box. */
  targetSize?: number;
  /** Couleur du pad et des effets lumineux + teinte par défaut des meshes sans texture. */
  color?: string;
  /** Nom du vaisseau affiché en billboard (null = pas de label). */
  label?: string;
  /** Référence vers le ShipController actif (null = mode idle). */
  controller: MutableRefObject<ShipController | null>;
  /** Ce vaisseau est-il actuellement piloté par le joueur ? */
  isPiloted: boolean;
  /** Position du joueur (détection de proximité). */
  playerPosition: MutableRefObject<THREE.Vector3>;
  /** Rayon de détection (m). Défaut : 5. */
  boardRadius?: number;
  /** Appelé quand le joueur entre/sort de la zone d'embarquement. */
  onBoardZone: (id: string, near: boolean) => void;
}

export const PilotableShip = memo(function PilotableShip({
  id, shipPath, dockPosition, dockYaw = 0, modelRotation = [0, 0, 0], scale = 1,
  targetSize,
  color = "#5bd6ff", label,
  controller, isPiloted, playerPosition,
  boardRadius = 5, onBoardZone,
}: PilotableShipProps) {
  // `animations` = tableau de clips embarqués dans le GLB. On l'utilise pour
  // jouer UNIQUEMENT l'idle (cf. AnimationMixer plus bas). Aucun autre clip
  // n'est branché — c'est la consigne stricte de l'utilisateur.
  // qualityVariant : résout vers la variante .med/.low selon settings.video.quality
  // (path identique au cache AssetPreloader → 0 re-téléchargement).
  const { scene, animations } = useGLTF(qualityVariant(shipPath));
  const { gl }   = useThree();

  // Clone + anisotropie + TEINTE PAR DÉFAUT des meshes sans texture (modèles
  // géométrie-seule → couleur du véhicule au lieu du gris). Matériaux clonés par
  // instance pour ne pas muter la source partagée du cache GLB.
  const cloned = useMemo(() => {
    const c = scene.clone();
    applyAnisotropy(c, gl.capabilities.getMaxAnisotropy());
    const tint = new THREE.Color(color);
    const tintMat = (mat: THREE.Material): THREE.Material => {
      const std = mat.clone() as THREE.MeshStandardMaterial;
      if (!std.map) { std.color = tint.clone(); std.metalness = 0.4; std.roughness = 0.55; }
      return std;
    };
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (Array.isArray(m.material)) m.material = m.material.map(tintMat);
      else if (m.material) m.material = tintMat(m.material);
      else m.material = new THREE.MeshStandardMaterial({ color: tint.clone(), metalness: 0.4, roughness: 0.55 });
    });
    return c;
  }, [scene, gl, color]);

  // Échelle effective : si targetSize défini, normalise la plus grande dimension du
  // modèle à targetSize (m) via la bounding-box → taille saine sans calibrage manuel.
  const fitScale = useMemo(() => {
    if (!targetSize) return scale;
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return targetSize / maxDim;
  }, [cloned, targetSize, scale]);

  const groupRef = useRef<THREE.Group>(null);
  const phase    = useRef(Math.random() * Math.PI * 2); // phase aléatoire → hover async
  const wasNear  = useRef(false);

  // ── Animation IDLE uniquement (vaisseau au repos / moteur qui tourne) ─────
  // Stratégie : on cherche un clip dont le nom contient "idle" (insensible à la
  // casse). Fallback : premier clip du GLB si rien ne matche. AUCUN autre clip
  // (run/death/etc.) n'est joué — c'est la demande explicite de l'utilisateur.
  // Le mixer joue en LoopRepeat infini et tourne aussi pendant le pilotage
  // (un moteur ne s'arrête pas quand l'avion bouge).
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  // Actions des roues (véhicule terrestre) : avant (Wheel_Spin) + arrière
  // (Wheel_Backward). null pour un vaisseau volant.
  const wheelFwdRef  = useRef<THREE.AnimationAction | null>(null);
  const wheelBackRef = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    if (!animations || animations.length === 0) {
      mixerRef.current = null; wheelFwdRef.current = null; wheelBackRef.current = null;
      return;
    }
    const mixer = new THREE.AnimationMixer(cloned);

    // ── Véhicule à ROUES : 2 clips dédiés pilotés par la vitesse ─────────────
    // Wheel_Spin = avancer, Wheel_Backward = reculer. On joue les deux en boucle
    // (poids 0) ; chaque frame on active celui qui correspond au sens de marche.
    const fwdClip  = animations.find((c) => /spin/i.test(c.name));
    const backClip = animations.find((c) => /back/i.test(c.name));
    const anyWheel = animations.find((c) => /wheel|spin|roue/i.test(c.name));
    if (fwdClip || backClip || anyWheel) {
      const setup = (clip: THREE.AnimationClip) => {
        const a = mixer.clipAction(clip);
        a.setLoop(THREE.LoopRepeat, Infinity);
        a.timeScale = 0;
        a.setEffectiveWeight(0);
        a.play();
        return a;
      };
      // fwd = Wheel_Spin (ou n'importe quel clip de roue en repli). back =
      // Wheel_Backward si présent, sinon null → repli timeScale signé sur fwd.
      wheelFwdRef.current  = setup(fwdClip ?? anyWheel!);
      wheelBackRef.current = backClip ? setup(backClip) : null;
    } else {
      // ── Vaisseau volant : idle en boucle (comportement existant) ──────────
      wheelFwdRef.current = null; wheelBackRef.current = null;
      const idleClip =
        animations.find((c) => c.name.toLowerCase().includes("idle")) ?? animations[0];
      const action = mixer.clipAction(idleClip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }

    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixerRef.current = null; wheelFwdRef.current = null; wheelBackRef.current = null;
    };
  }, [cloned, animations]);

  const [dx, , dz] = dockPosition; // y du pad (sol)
  const padY = dockPosition[1];

  useFrame((_, dt) => {
    // Roues du véhicule terrestre : on active le clip avant (Wheel_Spin) OU
    // arrière (Wheel_Backward) selon le sens de marche, vitesse de lecture ∝ la
    // vitesse réelle. Repli (1 seul clip) : timeScale signé.
    const fwdA  = wheelFwdRef.current;
    const backA = wheelBackRef.current;
    if (fwdA) {
      const v = (isPiloted && controller.current) ? controller.current.forwardSpeed : 0;
      if (backA) {
        fwdA.setEffectiveWeight(v >= -0.01 ? 1 : 0);
        fwdA.timeScale = Math.max(0, v) * WHEEL_TIMESCALE;
        backA.setEffectiveWeight(v < -0.01 ? 1 : 0);
        backA.timeScale = Math.max(0, -v) * WHEEL_TIMESCALE;
      } else {
        fwdA.setEffectiveWeight(1);
        fwdA.timeScale = v * WHEEL_TIMESCALE; // signé : avant + / arrière −
      }
    }
    // Avance le mixer d'animation. AVANT le reste → frame de rendu à jour.
    mixerRef.current?.update(dt);

    const g = groupRef.current;
    if (!g) return;

    if (isPiloted && controller.current) {
      const ctrl = controller.current;
      // ── Véhicule TERRESTRE : suivi de terrain ────────────────────────────
      // Raycast du sol sous la caisse → injecté dans le contrôleur (pur) chaque
      // frame pour qu'il pose le véhicule sur le terrain (gravité + snap).
      if (ctrl.isGround) {
        const p = ctrl.position;
        ctrl.setGroundBelow(collisionWorld.getGroundY(p.x, p.z, p.y + 3));
      }
      // ── Suit le contrôleur physique (position + orientation) ─────────────
      g.position.copy(ctrl.position);
      g.quaternion.copy(ctrl.quaternion);
    } else {
      // ── Mode idle : hover doux sur le pad ────────────────────────────────
      phase.current += dt * 0.55;
      g.position.set(
        dx,
        padY + SHIP_HOVER_HEIGHT + Math.sin(phase.current) * 0.13,
        dz,
      );
      // Rotation YXZ : yaw seul (pas de pitch/roll en idle)
      g.rotation.set(0, dockYaw, 0);

      // Détection de proximité pour l'invite d'embarquement
      const p  = playerPosition.current;
      const px = p.x - dx, pz = p.z - dz;
      const near = px * px + pz * pz < boardRadius * boardRadius;
      if (near !== wasNear.current) {
        wasNear.current = near;
        onBoardZone(id, near);
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[dx, padY + SHIP_HOVER_HEIGHT, dz]}
      rotation={[0, dockYaw, 0]}
    >
      {/* Modèle 3D du vaisseau — groupe interne = correction d'axe du nez.
          Le groupe parent porte l'orientation "logique" (avant = -Z, piloté ou
          au dock) ; ce groupe interne ne fait que tourner le maillage pour que
          son nez visuel pointe vers ce -Z. Les décorations de dock restent donc
          alignées sur l'orientation logique, pas sur l'axe brut du modèle. */}
      <group rotation={modelRotation}>
        <primitive object={cloned} scale={fitScale} />
      </group>

      {/* Décorations du dock — visibles uniquement en mode idle */}
      {!isPiloted && (
        <>
          {/* Disque de pad lumineux */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -SHIP_HOVER_HEIGHT + 0.01, 0]}
          >
            <circleGeometry args={[4, 48]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.12}
              depthWrite={false}
            />
          </mesh>

          {/* Bord du pad (tore fixe) */}
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, -SHIP_HOVER_HEIGHT + 0.05, 0]}
          >
            <torusGeometry args={[4, 0.08, 8, 64]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.2}
              roughness={0.3}
            />
          </mesh>

          {/* Lumière ambiante du dock */}
          <pointLight
            color={color}
            intensity={3.5}
            distance={12}
            position={[0, 0, 0]}
            decay={2}
          />

          {/* Label billboard (optionnel) */}
          {label && (
            <Billboard position={[0, 5, 0]}>
              <Text
                fontSize={0.44}
                color={color}
                outlineWidth={0.022}
                outlineColor="#000000"
                anchorX="center"
              >
                {label}
              </Text>
              <Text
                position={[0, -0.58, 0]}
                fontSize={0.19}
                color="#a0c8e8"
                outlineWidth={0.01}
                outlineColor="#000000"
                anchorX="center"
              >
                Approchez · E pour piloter
              </Text>
            </Billboard>
          )}
        </>
      )}
    </group>
  );
});
