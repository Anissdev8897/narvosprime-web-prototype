/**
 * HeroPreview3D.tsx — Aperçu 3D temps réel d'un héros.
 *
 * Remplace l'ancien Character3DPreview avec :
 *   - Source : GLB merged Meshy AI (1 seul fichier au lieu de 3)
 *   - Animation idle automatique + animation hover (walking)
 *   - Caméra orbit auto-rotation (auto-rotate stoppé au hover)
 *   - Lumières studio (key + fill + rim) pour un rendu propre
 *   - Outline shader (faction-color) pour le look "card"
 *   - Suspense + fallback propre
 *
 * Architecture compatible FPS :
 *   Le ViewModelFPS / MeshyArmsViewModel utilisent ce MÊME GLB merged en jeu.
 *   Donc ce qu'on voit ici = ce que le joueur aura en jeu (rig + anims identiques).
 */

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import type { HeroDef } from "./heroes-catalog";
import { getHeroModelPath } from "./heroes-catalog";

interface HeroPreview3DProps {
  hero: HeroDef;
  /** Anim à forcer (par défaut idle, hover = walking). */
  forceAnim?: "idle" | "walking" | "running" | "aim";
  /** Couleur de l'outline en HEX (par défaut couleur faction primary). */
  outlineColor?: string;
  /** Couleur de fond (null = transparent). */
  bgColor?: string | null;
  /** Désactiver l'auto-rotation. */
  noRotate?: boolean;
  /** Scale supplémentaire appliqué au mesh. */
  scale?: number;
}

function HeroMesh({
  hero,
  anim,
  outlineColor,
}: {
  hero: HeroDef;
  anim: keyof HeroDef["animations"];
  outlineColor: string;
}) {
  const gltf = useGLTF(getHeroModelPath(hero));
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  // Clone le squelette pour éviter de partager le mixer entre multiples instances
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(gltf.scene);

    // Cleanup : retirer les Icospheres debug Meshy
    const toRemove: THREE.Object3D[] = [];
    clone.traverse((obj) => {
      if (obj.name.toLowerCase().includes("icosphere")) {
        toRemove.push(obj);
      }
    });
    toRemove.forEach((o) => o.parent?.remove(o));

    // Outline shell (BackSide mesh légèrement scaled up)
    const outlineColorObj = new THREE.Color(outlineColor);
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        // Skip si déjà un outline ou un sub-mesh d'outline
        if (mesh.userData.isOutlineHull) return;
        const hullMat = new THREE.MeshBasicMaterial({
          color: outlineColorObj,
          side: THREE.BackSide,
        });
        const hull = new THREE.Mesh(mesh.geometry, hullMat);
        hull.scale.setScalar(1.025);
        hull.renderOrder = -1;
        hull.userData.isOutlineHull = true;
        mesh.add(hull);
      }
    });
    return clone;
  }, [gltf.scene, outlineColor]);

  // Setup mixer + actions
  useEffect(() => {
    if (!clonedScene || gltf.animations.length === 0) return;
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;

    const animName = hero.animations[anim] ?? hero.animations.idle;
    const clip =
      gltf.animations.find((c) => c.name === animName) ??
      gltf.animations.find((c) => c.name.toLowerCase().includes(animName.toLowerCase())) ??
      gltf.animations[0];

    if (clip) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.reset().fadeIn(0.2).play();
      currentActionRef.current = action;
    }

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [clonedScene, gltf.animations, hero, anim]);

  useFrame((_, dt) => {
    mixerRef.current?.update(dt);
  });

  return (
    <primitive
      object={clonedScene}
      scale={hero.previewScale ?? 1.0}
      position={[0, hero.previewYOffset ?? -1, 0]}
    />
  );
}

export function HeroPreview3D({
  hero,
  forceAnim,
  outlineColor,
  bgColor = null,
  noRotate = false,
  scale = 1.0,
}: HeroPreview3DProps) {
  const [hovered, setHovered] = useState(false);
  const finalOutline = outlineColor ?? hero.uiColors.primary;
  const currentAnim = forceAnim ?? (hovered ? "walking" : "idle");

  return (
    <div
      className="w-full h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: bgColor === null }}
        camera={{ position: [0, 1.4, 3.5], near: 0.1, far: 50, fov: 35 }}
        onCreated={({ scene }) => {
          scene.background = bgColor ? new THREE.Color(bgColor) : null;
        }}
      >
        {/* Lighting studio (key + fill + rim) */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[3, 5, 4]}
          intensity={1.4}
          color="#fff8e7"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-3, 3, -2]} intensity={0.6} color="#a8c5ff" />
        <directionalLight position={[0, 2, -5]} intensity={0.8} color={finalOutline} />

        <Suspense fallback={null}>
          <group scale={scale}>
            <HeroMesh hero={hero} anim={currentAnim} outlineColor={finalOutline} />
          </group>
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 3.2}
          maxPolarAngle={Math.PI / 2.2}
          autoRotate={!noRotate && !hovered}
          autoRotateSpeed={1.5}
          target={[0, 0.3, 0]}
        />
      </Canvas>
    </div>
  );
}
