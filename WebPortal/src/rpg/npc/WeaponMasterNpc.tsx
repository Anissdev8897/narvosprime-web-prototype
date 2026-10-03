// ══════════════════════════════════════════════════════════════════════════════
// npc/WeaponMasterNpc.tsx — PNJ « Maître d'Armes » (sélection de classe / archétype)
//
// Même patron que MerchantNpc : modèle Meshy + anim idle canonique, label, regarde
// le joueur, signale la proximité. À l'interaction (E, géré par RpgGameWorld), il
// ouvre le panneau des archétypes au lieu d'une boutique.
// ══════════════════════════════════════════════════════════════════════════════

import { memo, useEffect, useMemo, useRef } from "react";
import { useGLTF, Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import { getNpcModelPath } from "../loaders/assetManifest";
import { AnimationController } from "../animation/AnimationController";
import { collisionWorld } from "../runtime/CollisionWorld";
import { audioManager, NPC_VOICES } from "../../utils/AudioManager";

const ACCENT = "#ff7a3c";              // orange martial (thème archétype ⚔️)
const INTERACT_RANGE = 3.2;
// Modèle martial + anims canoniques partagées (mapping de noms fiable).
const MODEL_FOLDER = "soldat_mercenaire";
const ANIM_SOURCE = getNpcModelPath("soldat_humain");
useGLTF.preload(getNpcModelPath(MODEL_FOLDER));

interface Props {
  id: string;
  position: [number, number, number];
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  /** Signale l'entrée/sortie de la zone d'interaction (E → ouvre les archétypes). */
  onProximity: (id: string, near: boolean) => void;
}

function WeaponMasterNpcImpl({ id, position, playerPosition, onProximity }: Props) {
  const { scene } = useGLTF(getNpcModelPath(MODEL_FOLDER));
  const { animations: refAnims } = useGLTF(ANIM_SOURCE);
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  const group = useRef<THREE.Group>(null);
  const animCtrl = useRef<AnimationController | null>(null);
  const currentYaw = useRef(0);
  const snapped = useRef(false);
  const wasNear = useRef(false);
  const voiceCooldown = useRef(0);

  useEffect(() => {
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; }
    });
    if (refAnims.length > 0 && group.current) {
      animCtrl.current = new AnimationController(group.current, refAnims, { initial: "idle" });
      return () => animCtrl.current?.dispose();
    }
  }, [cloned, refAnims]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    animCtrl.current?.update(dt);

    // Snap au sol une fois (nœud rendu après l'assemblage de la map).
    if (!snapped.current) {
      const gy = collisionWorld.getGroundY(position[0], position[2], position[1] + 50);
      if (gy !== null) { g.position.set(position[0], gy, position[2]); snapped.current = true; }
    }

    // Regard vers le joueur + détection de proximité.
    const pp = playerPosition.current;
    const dx = pp.x - position[0];
    const dz = pp.z - position[2];
    const dist = Math.hypot(dx, dz);
    if (dist < 6 && dist > 0.1) {
      const targetYaw = Math.atan2(dx, dz);
      currentYaw.current = THREE.MathUtils.lerp(currentYaw.current, targetYaw, 1 - Math.exp(-6 * dt));
      g.rotation.y = currentYaw.current;
    }
    const near = dist < INTERACT_RANGE;
    if (near !== wasNear.current) {
      wasNear.current = near;
      onProximity(id, near);
      const now = performance.now();
      if (now - voiceCooldown.current > 6000) {
        voiceCooldown.current = now;
        const clip = near ? NPC_VOICES.greet : NPC_VOICES.farewell;
        audioManager.playVoice(clip, pp.x, pp.z, position[0], position[2]);
      }
    }
  });

  return (
    <group ref={group} position={position} dispose={null}>
      <primitive object={cloned} />
      <Billboard position={[0, 2.7, 0]}>
        <Text fontSize={0.26} color={ACCENT} outlineWidth={0.014} outlineColor="#000000" anchorX="center">
          ⚔️ Maître d'Armes
        </Text>
        <Text position={[0, -0.28, 0]} fontSize={0.16} color="#d6d3d1" outlineWidth={0.01} outlineColor="#000000" anchorX="center">
          Choisis ta voie
        </Text>
      </Billboard>
    </group>
  );
}

export const WeaponMasterNpc = memo(WeaponMasterNpcImpl);
