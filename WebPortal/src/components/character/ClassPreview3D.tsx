/**
 * ClassPreview3D.tsx — Aperçu 3D d'un personnage selon sa classe.
 *
 * Modèle : GLB chargé par `useGLTF(path)`, préchauffé sur WRAITH_BASE.
 * (Le commentaire d'origine citait `Sorceres_hi_poly/Breathing Idle.fbx` —
 *  ce pack a été supprimé du disque, et le composant n'a jamais lu de FBX.)
 * Toutes les classes partagent ce mesh ; seules la teinte (tint) et la couleur
 * d'accent varient. Aucun prop externe ne contrôle le choix du modèle.
 */

import React, { Component, Suspense, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { MURDOCK_BASE, WRAITH_BASE } from "../../rpg/characters/avatarAssets";
import { applyBodyTint } from "../../rpg/characters/bodyParts";
import { useBodyTints } from "../../rpg/characters/bodyTintStore";
import { FallbackEnvironment } from "../../rpg/runtime/lighting/FallbackEnvironment";
import { RendererRegistrar } from "../../rpg/loaders/RendererRegistrar";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import { CLASSES } from "../../rpg/classes/classes";
import { ELEMENTS } from "../../rpg/elements/elements";
import type { ClassId } from "../../rpg/types";

// ── Error boundary R3F ──────────────────────────────────────────────────────
interface EBState { error: boolean }
class R3fErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  EBState
> {
  constructor(props: any) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

// ── Silhouette géométrique (fallback si modèle manquant) ───────────────────
function CharacterSilhouette({ color }: { color: string }) {
  const mat = { color, emissive: color, emissiveIntensity: 0.4 };
  return (
    <group position={[0, -0.1, 0]}>
      <mesh position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.42, 0.6, 0.22]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[-0.28, 1.1, 0]}>
        <boxGeometry args={[0.14, 0.52, 0.14]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[0.28, 1.1, 0]}>
        <boxGeometry args={[0.14, 0.52, 0.14]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[-0.13, 0.4, 0]}>
        <boxGeometry args={[0.18, 0.65, 0.18]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[0.13, 0.4, 0]}>
        <boxGeometry args={[0.18, 0.65, 0.18]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.3, 0.45, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}


// ── Aperçu 3D teinté pour la sélection de personnage ────────────────────────
function SorcererPreview({ tint, modelPath }: { tint: string; modelPath?: string }) {
  const path = modelPath || MURDOCK_BASE;
  const { scene } = useGLTF(path);
  const bodyTints = useBodyTints(); // couleurs par-partie (bandes Y) — aperçu live
  const obj = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    const s = 1.8 / h;
    c.scale.setScalar(s);
    c.position.y = -box.min.y * s; // pieds au sol
    const col = new THREE.Color(tint || "#ffffff");
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      m.castShadow = true; m.receiveShadow = true;
      const recolor = (mat: THREE.Material) => { const k = mat.clone(); const st = k as THREE.MeshStandardMaterial; if (st.color) st.color.copy(col); return k; };
      m.material = Array.isArray(m.material) ? m.material.map(recolor) : recolor(m.material);
      applyBodyTint(m, bodyTints); // teinte par-partie sur les vertex-colors
    });
    return c;
  }, [scene, tint, bodyTints]);
  return <primitive object={obj} />;
}

// ── Scène intérieure : vrai Sorcier teinté, repli silhouette si chargement échoue ──
function ClassScene({
  emissiveColor, tint,
}: {
  classId: ClassId;
  emissiveColor: string;
  tint?: string;
  noRotate?: boolean;
}) {
  return (
    <R3fErrorBoundary fallback={<CharacterSilhouette color={emissiveColor} />}>
      <Suspense fallback={<CharacterSilhouette color={emissiveColor} />}>
        <SorcererPreview tint={tint ?? "#ffffff"} />
      </Suspense>
    </R3fErrorBoundary>
  );
}

// ── Props publiques ──────────────────────────────────────────────────────────
interface ClassPreview3DProps {
  classId: ClassId;
  /** Override la couleur emissive (défaut : element.emissive). */
  accentColor?: string;
  /** Désactiver l'auto-rotation. */
  noRotate?: boolean;
  /** Teinte de couleur (hex). Défaut : outfitColor de la classe. */
  tint?: string;
}

// ── Composant public ─────────────────────────────────────────────────────────
export function ClassPreview3D({
  classId,
  accentColor,
  noRotate = false,
  tint,
}: ClassPreview3DProps) {
  const cls     = CLASSES[classId];
  const element = ELEMENTS[cls.element];
  const color   = accentColor ?? element.emissive ?? cls.outfitEmissive;

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 1.6, 3.8], near: 0.1, far: 60, fov: 38 }}
      >
        <RendererRegistrar />
        {/* Éclairage studio */}
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[3, 6, 4]}
          intensity={1.4}
          color="#fff8e7"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-2, 3, -3]} intensity={0.5} color="#a8c5ff" />
        <pointLight position={[0, 2.5, 1.5]} color={color} intensity={1.5} distance={10} />

        <FallbackEnvironment preset="city" />

        <ClassScene classId={classId} emissiveColor={color} tint={tint} noRotate={noRotate} />

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 2.1}
          autoRotate={!noRotate}
          autoRotateSpeed={2.0}
          target={[0, 0.9, 0]}
        />
      </Canvas>
    </div>
  );
}

/** Précharge le mesh Wraith pour éviter le pop-in au 1er aperçu de sélection. */
export function preloadCharacterPreviews() {
  try { useGLTF.preload(WRAITH_BASE); } catch { /* asset absent → ignoré */ }
}
