// skeleton/UniversalCharacter.tsx — Composant R3F universel pour personnage humanoïde
//
// Remplace les 4 renderers spécialisés (HumanCharacter, MeshyPlayerCharacter,
// OwnAnimPlayerCharacter, AnimatedModularCharacter) par un seul point d'entrée
// capable de charger n'importe quel GLB humanoïde, détecter son squelette,
// retargeteer les animations et attacher armes/équipements.
//
// Usage :
//   <UniversalCharacter
//     modelPath="/models/assets_character/wraith/Wraith.glb"
//     animSource="/models/assets_character/wraith/animations/stripped/Ability_Q_Fire.glb"
//     playerPosition={posRef}
//     cameraState={stateRef}
//   />

import { memo, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import { AnimationController } from "../animation/AnimationController";
import { retargetClips } from "./UniversalRetargeter";
import { profileRig, buildBoneMap, bindPartToMaster } from "./SkeletonMapper";
import { detectConventionFromScene } from "./canonicalBones";
import type { RigConvention } from "./canonicalBones";
import type { SocketName, RigFamily } from "../weapons/weaponTypes";
import { RIG_PROFILES } from "../weapons/rigProfiles";
import { findBone } from "../weapons/findBone";
import type { PlayerState } from "../runtime/movement/playerState";

// ── Types ───────────────────────────────────────────────────────────────────

export interface UniversalCharacterProps {
  /** Chemin GLB du modèle (mesh + squelette). */
  modelPath: string;
  /** Chemin GLB optionnel pour les animations (si différent du modèle). */
  animSource?: string;
  /** Clips pré-chargés à injecter (ex: packs FBX déjà chargés via useFbxAnimationPack). */
  extraClips?: THREE.AnimationClip[];
  /** Parties additionnelles à greffer sur le squelette maître (tête, cheveux…). */
  parts?: string[];

  /** Ref position joueur (mise à jour par PlayerRig). */
  playerPosition?: React.MutableRefObject<THREE.Vector3>;
  /** Ref état joueur (vitesse, cast, jump…). */
  cameraState?: React.MutableRefObject<PlayerState>;
  /** Mort (joue l'anim death). */
  dead?: boolean;
  /** Arme dégainée (toggle les packs d'animation combat). */
  weaponDrawn?: boolean;

  /** Échelle globale du modèle. */
  scale?: number;
  /** Offset de yaw (PI = face caméra TPS par défaut). */
  yawOffset?: number;
  /** Callback quand le rig est prêt (convention détectée, group monté). */
  onReady?: (info: { convention: RigConvention; group: THREE.Group }) => void;
  /** Enfants rendus à l'intérieur du group (overlays, particles…). */
  children?: React.ReactNode;
}

// ── Mapping convention → RigFamily pour les sockets d'armes ─────────────────

function conventionToRigFamily(conv: RigConvention): RigFamily {
  if (conv === "mixamo") return "mixamo";
  if (conv === "quaternius" || conv === "unreal") return "quaternius";
  return "custom";
}

// ── Composant principal ─────────────────────────────────────────────────────

function UniversalCharacterImpl({
  modelPath,
  animSource,
  extraClips,
  parts,
  playerPosition,
  cameraState,
  dead = false,
  weaponDrawn = false,
  scale = 1,
  yawOffset = Math.PI,
  onReady,
  children,
}: UniversalCharacterProps) {
  const group = useRef<THREE.Group>(null!);
  const animCtrl = useRef<AnimationController | null>(null);
  const currentYaw = useRef(0);
  const deadRef = useRef(false);
  deadRef.current = dead;

  // ── Chargement modèle + anims ───────────────────────────────────────────
  const { scene } = useGLTF(modelPath);
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  const animGltf = animSource ? useGLTF(animSource) : null;
  const animClips = useMemo(() => {
    const base = animGltf?.animations ?? scene.animations ?? [];
    return extraClips ? [...extraClips, ...base] : base;
  }, [animGltf?.animations, scene.animations, extraClips]);

  // ── Détection convention + profil ───────────────────────────────────────
  const convention = useMemo(() => detectConventionFromScene(cloned), [cloned]);
  const rigFamily = useMemo(() => conventionToRigFamily(convention), [convention]);

  // ── Greffe des parties additionnelles ───────────────────────────────────
  useEffect(() => {
    if (!parts?.length) return;
    const masterBoneMap = buildBoneMap(cloned);
    // Les parties seront chargées par drei useGLTF en amont et passées ici.
    // Pour l'instant on laisse le mécanisme de greffe accessible via bindPartToMaster.
  }, [cloned, parts]);

  // ── Retarget clips → squelette du modèle ────────────────────────────────
  const retargetedClips = useMemo(() => {
    if (animClips.length === 0) return animClips;
    const sourceRoot = animGltf?.scene ?? undefined;
    return retargetClips(cloned, animClips, sourceRoot, {
      dropScale: true,
      trimTpose: false,
      excludeRoot: true,
    });
  }, [cloned, animClips, animGltf?.scene]);

  // ── Setup matériaux (ombres, clone isolation) ───────────────────────────
  useEffect(() => {
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (Array.isArray(m.material)) m.material = m.material.map((x) => x.clone());
      else if (m.material) m.material = (m.material as THREE.Material).clone();
    });
  }, [cloned]);

  // ── Animation controller ────────────────────────────────────────────────
  useEffect(() => {
    if (!group.current || retargetedClips.length === 0) {
      animCtrl.current = null;
      return;
    }
    animCtrl.current = new AnimationController(group.current, retargetedClips, {
      initial: "idle",
    });
    return () => animCtrl.current?.dispose();
  }, [retargetedClips, cloned]);

  // ── Ready callback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (group.current && onReady) {
      onReady({ convention, group: group.current });
    }
  }, [convention, onReady]);

  // ── Frame loop (position sync + animation drive) ────────────────────────
  useFrame((_, dt) => {
    if (!group.current) return;

    // Sync position
    if (playerPosition?.current) {
      const p = playerPosition.current;
      group.current.position.set(p.x, p.y, p.z);
    }

    // Sync yaw
    if (cameraState?.current) {
      const target = cameraState.current.yaw + yawOffset;
      currentYaw.current += (target - currentYaw.current) * Math.min(1, dt * 15);
      group.current.rotation.y = currentYaw.current;
    }

    // Drive animation
    if (!animCtrl.current) return;
    animCtrl.current.update(dt);

    if (deadRef.current) {
      animCtrl.current.play("death");
      return;
    }

    // Locomotion depuis cameraState
    if (cameraState?.current) {
      const st = cameraState.current;
      const speed = st.horizontalSpeed ?? 0;
      if (speed > 5) animCtrl.current.play("run");
      else if (speed > 0.5) animCtrl.current.play("walk");
      else animCtrl.current.play("idle");
      animCtrl.current.setLocomotionTimeScale(speed);
    }
  });

  return (
    <group ref={group} scale={scale}>
      <primitive object={cloned} />
      {children}
    </group>
  );
}

export const UniversalCharacter = memo(UniversalCharacterImpl);

// ── Hook utilitaire : détecte le rig d'un GLB pré-chargé ───────────────────

export function useRigConvention(path: string): RigConvention {
  const { scene } = useGLTF(path);
  return useMemo(() => detectConventionFromScene(scene), [scene]);
}

// ── Hook utilitaire : trouve un bone socket dans un rig auto-détecté ────────

export function useSocket(
  rigRoot: THREE.Object3D | null,
  socket: SocketName,
): THREE.Object3D | null {
  return useMemo(() => {
    if (!rigRoot) return null;
    const conv = detectConventionFromScene(rigRoot);
    const family = conventionToRigFamily(conv);
    const re = RIG_PROFILES[family]?.[socket];
    if (!re) return null;
    return findBone(rigRoot, re);
  }, [rigRoot, socket]);
}
