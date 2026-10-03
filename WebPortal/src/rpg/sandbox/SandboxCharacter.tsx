// ══════════════════════════════════════════════════════════════════════════════
// sandbox/SandboxCharacter.tsx — LE personnage du prototype (ÉTAPE 1).
//
// Un Wraith seul sur un plan, qui joue "idle" avec le VRAI système d'animation
// du jeu (AnimationController + les mêmes catalogues de clips), mais SANS le
// jeu : pas de playerState, pas d'archetypeStore, pas d'arme équipée, pas de
// recoilDispatcher, pas de playerAnimDebug. Le composant n'écrit dans AUCUN
// store du jeu — il consomme des modules en lecture seule.
//
// CHOIX DÉLIBÉRÉS, et pourquoi :
//   • on N'IMPORTE PAS OwnAnimCore/OwnAnimPlayerCharacter : ils tirent les
//     stores du jeu (archetypes, weapons, playerConfig). On réplique ici le
//     MÊME montage (clone SkeletonUtils → matériaux clonés → bbox → échelle
//     1,8 m → masque de l'arme intégrée → AnimationController) en ~80 lignes,
//     sans leurs dépendances. Si le montage jeu évolue, aligner ce fichier.
//   • remapToRig: true (et PAS avatarKey) : le remap adapte les pistes aux os
//     réels du modèle — même sécurité qu'en jeu — mais sans écrire dans
//     animClipStore, qui appartient au jeu.
//   • onEvent OMISE : dispatchAnimEvent = caméra/recul du jeu. Les events
//     d'animation sont simplement inactifs ici.
//   • AUCUN console.* sur le chemin nominal : le critère de fin d'ÉTAPE 1 est
//     « log vide ». Seul un ÉCHEC de chargement warn (en dev) — c'est un vrai
//     signal, pas du bruit.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { AnimationController } from "../animation/AnimationController";
import { renameClip } from "../animation/mixamoRetarget";
import { configureGLTFLoader } from "../loaders/sharedLoaders";
import { setBuiltinWeaponVisible } from "../characters/builtinWeaponMask";
import {
  SANDBOX_CHARACTER,
  SANDBOX_CLIP_JOBS,
  SANDBOX_CLIP_PATHS,
  SANDBOX_TARGET_HEIGHT,
} from "./sandboxAssets";

// Loader partagé (DRACO + KTX2, workers) — même pattern que le jeu.
const _clipLoader = new GLTFLoader();
configureGLTFLoader(_clipLoader);

/**
 * Charge tous les clips du manifeste : UN fetch par chemin unique, puis un
 * clip par job (renameClip pour les actions, clips bruts pour les Ability_*).
 * Publication UNIQUE à la fin : la scène est petite, le palier progressif du
 * jeu (penser aux 60 fichiers sur une map) n'apporte rien ici.
 */
function useSandboxClips(): THREE.AnimationClip[] | null {
  const [clips, setClips] = useState<THREE.AnimationClip[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const parChemin = new Map<string, THREE.AnimationClip[]>();
    let restants = SANDBOX_CLIP_PATHS.length;

    const assembler = () => {
      if (cancelled) return;
      const finaux: THREE.AnimationClip[] = [];
      for (const job of SANDBOX_CLIP_JOBS) {
        const anims = parChemin.get(job.path);
        if (!anims || anims.length === 0) continue;
        if (job.action) {
          finaux.push(renameClip(anims[0], job.action));
        } else {
          finaux.push(...anims);
        }
      }
      setClips(finaux);
    };

    for (const path of SANDBOX_CLIP_PATHS) {
      _clipLoader.load(
        path,
        (gltf) => {
          if (cancelled) return;
          parChemin.set(path, gltf.animations);
          if (--restants === 0) assembler();
        },
        undefined,
        (err) => {
          // Échec = vrai signal (le test d'existence garantit le disque ;
          // un échec ici = réseau, transcodage, corruption). Le seul log
          // que ce module s'autorise.
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[Sandbox] ÉCHEC chargement clip ${path} :`, err);
          }
          if (--restants === 0) assembler();
        },
      );
    }
    return () => { cancelled = true; };
  }, []);

  return clips;
}

export function SandboxCharacter() {
  const group = useRef<THREE.Group>(null);
  const ctrl = useRef<AnimationController | null>(null);
  const { scene } = useGLTF(SANDBOX_CHARACTER);
  const clips = useSandboxClips();

  // Montage identique au jeu : clone → ombres → matériaux clonés → bbox →
  // échelle normalisée. groundY pose les pieds à y = 0 (le pivot d'un GLB
  // Unreal n'est pas nécessairement sous la semelle).
  const { object, baseScale, groundY } = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      if (Array.isArray(m.material)) m.material = m.material.map((x) => x.clone());
      else if (m.material) m.material = (m.material as THREE.Material).clone();
    });
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    const s = SANDBOX_TARGET_HEIGHT / h;
    return { object: c, baseScale: s, groundY: -box.min.y * s };
  }, [scene]);

  // Arme intégrée (canon Paragon, 18 614 tris) masquée — comme en jeu.
  useEffect(() => {
    setBuiltinWeaponVisible(object, false);
  }, [object]);

  // Le contrôleur naît quand les clips sont là, et meurt avec le composant.
  useEffect(() => {
    if (!group.current || !clips || clips.length === 0) return;
    ctrl.current = new AnimationController(group.current, clips, {
      initial: "idle",
      remapToRig: true,
    });
    return () => { ctrl.current?.dispose(); ctrl.current = null; };
  }, [clips]);

  useFrame((_, dt) => ctrl.current?.update(dt));

  return (
    <group ref={group}>
      {/* Pas de clips, pas de rendu : une frame de T-pose ne doit jamais
          apparaître — c'est précisément le genre d'artefact que le prototype
          est censé débusquer, pas produire. */}
      {clips && (
        <primitive object={object} scale={baseScale} position={[0, groundY, 0]} />
      )}
    </group>
  );
}
