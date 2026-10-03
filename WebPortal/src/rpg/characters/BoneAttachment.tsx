// characters/BoneAttachment.tsx — attache un GLB ARBITRAIRE à un OS nommé du rig.
//
// Sert au Forge Personnages : casque (socket Head), cape (Spine), accessoire en main
// (RightHand/LeftHand). Réutilise le patron de WeaponSocket : un nœud-socket sous l'os
// qui ANNULE l'échelle monde du rig → l'asset vit en mètres, puis offset pos/rot/scale.
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { findBone, boneWorldScale } from "../weapons/findBone";
import { RIG_PROFILES } from "../weapons/rigProfiles";
import type { RigFamily, SocketName } from "../weapons/weaponTypes";

export interface CharAttachment {
  id: string;
  socket: SocketName;                 // Head | Spine | RightHand | LeftHand
  path: string;                        // GLB (models_index)
  offsetPos: [number, number, number]; // mètres
  offsetRot: [number, number, number]; // euler radians
  scale: number;                       // multiplicateur
}

export function BoneAttachment({ rigRoot, family, attach }: {
  rigRoot: THREE.Object3D; family: RigFamily; attach: CharAttachment;
}) {
  const { scene } = useGLTF(attach.path);
  const clone = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const re = RIG_PROFILES[family]?.[attach.socket] ?? RIG_PROFILES.mixamo[attach.socket];
    const bone = findBone(rigRoot, re);
    if (!bone) { console.warn(`[BoneAttachment] os introuvable pour socket ${attach.socket}`); return; }
    const k = boneWorldScale(bone) || 1;
    const socket = new THREE.Object3D();
    socket.scale.setScalar(1 / k);                 // annule l'échelle du rig → mètres
    socket.position.set(...attach.offsetPos);
    socket.rotation.set(...attach.offsetRot);
    clone.scale.setScalar(attach.scale);
    clone.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    socket.add(clone);
    bone.add(socket);
    return () => { bone.remove(socket); };
  }, [rigRoot, family, attach.socket, attach.path, attach.offsetPos, attach.offsetRot, attach.scale, clone]);

  return null; // l'attache vit dans le graphe three (sous l'os), pas dans l'arbre React
}
