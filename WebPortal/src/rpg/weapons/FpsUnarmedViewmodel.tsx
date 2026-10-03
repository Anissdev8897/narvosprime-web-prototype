// weapons/FpsUnarmedViewmodel.tsx — viewmodel FPS pour les mains nues (bras squelettiques).
//
// Affiche SK_Mannequin_Arms.glb en overlay 1ʳᵉ personne quand le joueur est en
// vue FPS sans arme dégainée. Joue l'idle en boucle + déclenche les frappes
// (punch/kick) synchronisées avec l'attaque du joueur.
//
// Mêmes conventions que FpsWeaponViewmodel : depthTest off, renderOrder 999,
// bbox-normalize, camera-follow.
//
// MACHINE D'ÉTATS :
//   HIDDEN → RAISING (weaponDrawn: false→true) → IDLE
//   IDLE → FIRING (fireToken) → IDLE
//   IDLE → LOWERING (weaponDrawn: true→false) → HIDDEN
//
// FIX 2026-07-30 : Le GLB utilise des textures KTX2 avec alphaMode=MASK.
// Si l'alpha channel n'est pas préservé pendant la transcoding KTX2, le mesh
// devient invisible. On force alphaTest=0 et alphaMode=OPAQUE sur les matériaux
// clonés pour garantir la visibilité des bras.
// Fallback procédural (cylindres) si le GLB échoue à charger.

import React, { useEffect, useMemo, useRef, Suspense } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { FPS_ARMS_MESH } from "./shotgunFpsRegistry";

const VM_TARGET_HEIGHT = 1.2;
const OFFSET_FORWARD = -0.35;
const OFFSET_DOWN = -0.30;
const OFFSET_RIGHT = 0.15;

// ── Position rangée (bras baissés hors champ) ───────────────────────────
const HOLSTER_FORWARD = -0.35;
const HOLSTER_DOWN = -0.85;
const HOLSTER_RIGHT = 0.20;

useGLTF.preload(FPS_ARMS_MESH);

// ── Fallback procédural : deux cylindres pour simuler des bras ──────────
function FallbackArms() {
  const armGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.045, 0.7, 8), []);
  const armMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#d4a574",
    roughness: 0.7,
    metalness: 0.0,
    depthTest: false,
  }), []);

  return (
    <group>
      {/* Bras gauche */}
      <mesh geometry={armGeo} material={armMat} renderOrder={999}
        position={[-0.25, -0.35, -0.3]} rotation={[0.15, 0, 0.2]}
      />
      {/* Bras droit */}
      <mesh geometry={armGeo} material={armMat} renderOrder={999}
        position={[0.25, -0.35, -0.3]} rotation={[0.15, 0, -0.2]}
      />
      {/* Poings (sphères) */}
      <mesh renderOrder={999} position={[-0.25, -0.7, -0.35]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#c4956a" roughness={0.6} depthTest={false} />
      </mesh>
      <mesh renderOrder={999} position={[0.25, -0.7, -0.35]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#c4956a" roughness={0.6} depthTest={false} />
      </mesh>
    </group>
  );
}

// ── Erreur GLB → fallback procédural ─────────────────────────────────────
class ArmsErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <>{this.props.fallback}</>;
    return <>{this.props.children}</>;
  }
}

// ── États internes ───────────────────────────────────────────────────────
type AnimState = "hidden" | "raising" | "idle" | "firing" | "lowering";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, t);
}

// ── Composant principal (bras squelettiques GLB) ─────────────────────────
function ArmsModel({
  fireToken,
  weaponDrawn = false,
  onFireImpact,
}: {
  fireToken: number;
  weaponDrawn: boolean;
  onFireImpact?: () => void;
}) {
  const { camera } = useThree();
  const { scene, animations } = useGLTF(FPS_ARMS_MESH);

  // Clone + matériaux clonés avec corrections alpha.
  const { object, baseScale } = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      m.renderOrder = 999;

      const mats = (Array.isArray(m.material) ? m.material : [m.material]).filter(Boolean) as THREE.Material[];
      const clonedMats = mats.map((mat) => {
        const x = mat.clone();
        x.depthTest = false;
        x.depthWrite = true;
        // ── CORRECTION ALPHA : force le mode opaque pour éviter
        //     l'invisibilité si les textures KTX2 n'ont pas d'alpha valide ──
        if ("alphaTest" in x) (x as any).alphaTest = 0;
        if ("alphaMode" in x) (x as any).alphaMode = "OPAQUE";
        if ("transparent" in x) (x as any).transparent = false;
        (x as any).needsUpdate = true;
        return x;
      });

      m.material = Array.isArray(m.material) ? clonedMats : clonedMats[0];
    });
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    return { object: c, baseScale: VM_TARGET_HEIGHT / h };
  }, [scene]);

  const group = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object]);
  const idleAction = useRef<THREE.AnimationAction | null>(null);
  const strikeAction = useRef<THREE.AnimationAction | null>(null);
  const raiseAction = useRef<THREE.AnimationAction | null>(null);
  const lowerAction = useRef<THREE.AnimationAction | null>(null);

  const state = useRef<AnimState>("hidden");
  const striking = useRef(false);
  const hitFired = useRef(false);
  const lastToken = useRef(fireToken);
  const lastWeaponDrawn = useRef(weaponDrawn);

  useEffect(() => {
    const find = (...kws: string[]) =>
      animations.find((a) => kws.some((k) => a.name.toLowerCase().includes(k)));

    const idleClip = find("idle");
    if (idleClip) {
      idleAction.current = mixer.clipAction(idleClip);
    }
    const strikeClip = find("jab", "punch", "strike", "attack", "fire");
    if (strikeClip) {
      strikeAction.current = mixer.clipAction(strikeClip);
      strikeAction.current.setLoop(THREE.LoopOnce, 1);
      strikeAction.current.clampWhenFinished = true;
    }
    const raiseClip = find("raise", "draw", "fistsup", "combatpose");
    if (raiseClip) {
      raiseAction.current = mixer.clipAction(raiseClip);
      raiseAction.current.setLoop(THREE.LoopOnce, 1);
      raiseAction.current.clampWhenFinished = true;
    }
    const lowerClip = find("lower", "holster", "fistsdown", "relax");
    if (lowerClip) {
      lowerAction.current = mixer.clipAction(lowerClip);
      lowerAction.current.setLoop(THREE.LoopOnce, 1);
      lowerAction.current.clampWhenFinished = true;
    }

    // État initial
    if (weaponDrawn) {
      state.current = "idle";
      idleAction.current?.reset().play();
    } else {
      state.current = "hidden";
    }

    return () => { mixer.stopAllAction(); };
  }, [mixer, animations]);

  useFrame((_, dt) => {
    // ── Transition weaponDrawn ────────────────────────────────────────────
    if (weaponDrawn !== lastWeaponDrawn.current) {
      lastWeaponDrawn.current = weaponDrawn;
      if (weaponDrawn) {
        // Poings levés
        if (raiseAction.current) {
          state.current = "raising";
          idleAction.current?.fadeOut(0.05);
          raiseAction.current.reset();
          raiseAction.current.setEffectiveWeight(1);
          raiseAction.current.fadeIn(0.05);
          raiseAction.current.play();
          object.visible = true;
        } else {
          state.current = "idle";
          idleAction.current?.reset().fadeIn(0.15).play();
          object.visible = true;
        }
      } else {
        // Baisser la garde
        if (lowerAction.current) {
          state.current = "lowering";
          idleAction.current?.fadeOut(0.05);
          strikeAction.current?.fadeOut(0.05);
          lowerAction.current.reset();
          lowerAction.current.setEffectiveWeight(1);
          lowerAction.current.fadeIn(0.05);
          lowerAction.current.play();
        } else {
          state.current = "hidden";
          mixer.stopAllAction();
        }
      }
    }

    // ── Fire trigger ──────────────────────────────────────────────────────
    if (fireToken !== lastToken.current) {
      lastToken.current = fireToken;
      if (state.current === "idle") {
        const sa = strikeAction.current;
        if (sa) {
          idleAction.current?.fadeOut(0.05);
          sa.reset(); sa.setEffectiveWeight(1); sa.play();
          striking.current = true;
          hitFired.current = false;
          state.current = "firing";
        }
      }
    }

    mixer.update(dt);

    // ── Fin de strike ─────────────────────────────────────────────────────
    const s = state.current;
    if (s === "firing") {
      const sa = strikeAction.current;
      if (sa) {
        const dur = sa.getClip().duration || 1;
        const norm = sa.time / dur;
        if (!hitFired.current && norm >= 0.4) {
          hitFired.current = true;
          onFireImpact?.();
        }
        if (norm >= 0.95 || !sa.isRunning()) {
          striking.current = false;
          state.current = "idle";
          sa.fadeOut(0.05);
          idleAction.current?.reset().fadeIn(0.1).play();
        }
      }
    }

    // ── Fin de raise ──────────────────────────────────────────────────────
    if (s === "raising") {
      const ra = raiseAction.current;
      if (ra && (ra.time / (ra.getClip().duration || 0.5) >= 0.99 || !ra.isRunning())) {
        ra.fadeOut(0.05);
        state.current = "idle";
        idleAction.current?.reset().fadeIn(0.1).play();
      }
    }

    // ── Fin de lower ──────────────────────────────────────────────────────
    if (s === "lowering") {
      const la = lowerAction.current;
      if (la && (la.time / (la.getClip().duration || 0.5) >= 0.99 || !la.isRunning())) {
        la.fadeOut(0.05);
        state.current = "hidden";
        mixer.stopAllAction();
      }
    }

    // ── Visibilité ────────────────────────────────────────────────────────
    object.visible = s !== "hidden";

    // ── Positionnement ────────────────────────────────────────────────────
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);

    if (s === "lowering" && lowerAction.current) {
      const la = lowerAction.current;
      const dur = la.getClip().duration || 0.5;
      const norm = Math.min(1, la.time / dur);
      g.translateZ(lerp(OFFSET_FORWARD, HOLSTER_FORWARD, norm));
      g.translateY(lerp(OFFSET_DOWN, HOLSTER_DOWN, norm));
      g.translateX(lerp(OFFSET_RIGHT, HOLSTER_RIGHT, norm));
    } else if (s === "raising" && raiseAction.current) {
      const ra = raiseAction.current;
      const dur = ra.getClip().duration || 0.5;
      const norm = Math.min(1, ra.time / dur);
      g.translateZ(lerp(HOLSTER_FORWARD, OFFSET_FORWARD, norm));
      g.translateY(lerp(HOLSTER_DOWN, OFFSET_DOWN, norm));
      g.translateX(lerp(HOLSTER_RIGHT, OFFSET_RIGHT, norm));
    } else {
      g.translateZ(OFFSET_FORWARD);
      g.translateY(OFFSET_DOWN);
      g.translateX(OFFSET_RIGHT);
    }
  });

  return <group ref={group}><primitive object={object} scale={baseScale} /></group>;
}

// ── Wrapper avec fallback procédural ──────────────────────────────────────
export function FpsUnarmedViewmodel(props: {
  fireToken?: number;
  weaponDrawn?: boolean;
  onFireImpact?: () => void;
}) {
  return (
    <ArmsErrorBoundary fallback={<FallbackArms />}>
      <Suspense fallback={null}>
        <ArmsModel
          fireToken={props.fireToken ?? 0}
          weaponDrawn={props.weaponDrawn ?? false}
          onFireImpact={props.onFireImpact}
        />
      </Suspense>
    </ArmsErrorBoundary>
  );
}
