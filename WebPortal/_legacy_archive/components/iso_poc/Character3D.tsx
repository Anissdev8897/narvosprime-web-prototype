/**
 * Character3D.tsx - Personnage 3D anime avec toon shading + outline faction.
 *
 * Charge plusieurs GLB (un par animation) via useGLTF, construit un
 * AnimationMixer avec toutes les actions, expose une API React pour passer
 * d'un etat anim a un autre (crossfade 200ms).
 *
 * Sprint 1: anim Idle/Walking/Running. Les autres (Attack, Cast, Hit, Death)
 * seront ajoutees plus tard via Mixamo retargete.
 */

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AnimationState, Faction } from "./combat/CombatTypes";
import { applyToonOutlineToObject } from "./ToonOutline";

export interface Character3DProps {
  /** Map des paths d'animation GLB par etat. */
  animations: Partial<Record<AnimationState, string>>;
  /** Etat anim courant. */
  state: AnimationState;
  /** Faction (couleur outline). */
  faction: Faction;
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  /** Crossfade en secondes pour transitions. */
  fadeSeconds?: number;
  /** Callback expose le THREE.Object3D root (pour camera follow). */
  onRootReady?: (obj: THREE.Object3D) => void;
}

export function Character3D({
  animations,
  state,
  faction,
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  fadeSeconds = 0.2,
  onRootReady,
}: Character3DProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Partial<Record<AnimationState, THREE.AnimationAction>>>({});
  const currentStateRef = useRef<AnimationState>(state);

  // Precharger tous les GLB requis (drei cache automatiquement)
  const animPaths = useMemo(
    () => Object.values(animations).filter(Boolean) as string[],
    [animations]
  );
  // useGLTF accepte un seul path ou un array selon la version. On charge le 1er
  // (anim de base) comme container pour le mesh + skeleton, puis on extrait les
  // animations de chaque autre fichier.
  const baseState: AnimationState = (state in animations ? state : (Object.keys(animations)[0] as AnimationState));
  const basePath = animations[baseState]!;
  const baseGltf = useGLTF(basePath);

  // Charge toutes les animations depuis tous les GLB connus
  // (drei n'expose pas de hook multi-load propre ici, on le fait imperativement)
  const allClips = useRef<Partial<Record<AnimationState, THREE.AnimationClip>>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const entries = await Promise.all(
        Object.entries(animations).map(async ([anim, path]) => {
          if (!path) return null;
          const gltf = await loader.loadAsync(path);
          // Premier clip = animation principale du fichier
          const clip = gltf.animations[0];
          return clip ? [anim as AnimationState, clip] as const : null;
        })
      );
      if (cancelled) return;
      const map: Partial<Record<AnimationState, THREE.AnimationClip>> = {};
      entries.forEach((entry) => {
        if (!entry) return;
        const [anim, clip] = entry;
        clip.name = anim;
        map[anim] = clip;
      });
      allClips.current = map;
      // Construire le mixer une fois que la scene base est montee + clips dispos
      buildMixer();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animPaths.join("|")]);

  function buildMixer() {
    if (!groupRef.current) return;
    // Cleanup ancien mixer
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    const root = groupRef.current.children[0];
    if (!root) return;
    const mixer = new THREE.AnimationMixer(root);
    mixerRef.current = mixer;
    const actions: Partial<Record<AnimationState, THREE.AnimationAction>> = {};
    Object.entries(allClips.current).forEach(([anim, clip]) => {
      if (!clip) return;
      const action = mixer.clipAction(clip);
      action.setLoop(
        anim === "attacking" || anim === "casting" || anim === "hit" || anim === "death"
          ? THREE.LoopOnce
          : THREE.LoopRepeat,
        Infinity
      );
      actions[anim as AnimationState] = action;
    });
    actionsRef.current = actions;
    // Demarrer la 1ere anim (state actuel)
    const initialAction = actions[currentStateRef.current] || actions[baseState];
    if (initialAction) {
      initialAction.reset().play();
    }
  }

  // Construire le toon-outlined mesh a partir du baseGltf
  const wrappedScene = useMemo(() => {
    const wrapped = applyToonOutlineToObject(baseGltf.scene, { faction });
    return wrapped;
  }, [baseGltf.scene, faction]);

  // Mount the wrapped scene dans groupRef
  useEffect(() => {
    if (!groupRef.current) return;
    // Clear children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }
    groupRef.current.add(wrappedScene);
    // Si les clips sont deja la, rebuild mixer
    if (Object.keys(allClips.current).length > 0) {
      buildMixer();
    }
    onRootReady?.(groupRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrappedScene]);

  // Reagir aux changements de state -> crossfade
  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions[state]) return;
    const prev = actions[currentStateRef.current];
    const next = actions[state];
    if (prev && prev !== next) {
      next!.reset();
      next!.fadeIn(fadeSeconds);
      next!.play();
      prev.fadeOut(fadeSeconds);
    } else if (next && !prev) {
      next.reset().play();
    }
    currentStateRef.current = state;
  }, [state, fadeSeconds]);

  useFrame((_, dt) => {
    mixerRef.current?.update(dt);
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale} />
  );
}

// Pre-cache hint for drei (useGLTF.preload)
Character3D.preload = (paths: string[]) => {
  paths.forEach((p) => useGLTF.preload(p));
};
