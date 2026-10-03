// weapons/FpsWeaponViewmodel.tsx — viewmodel FPS générique (arme en main).
//
// Overlay 1ʳᵉ personne : depthTest off, renderOrder 999, bbox-normalize,
// camera-follow, weapon sway spring, weapon bob.
//
// MACHINE D'ÉTATS D'ANIMATION :
//   IDLE → FIRING (attackToken) → IDLE
//   IDLE → RELOADING (reloadToken) → IDLE
//   IDLE → RAISING (weaponDrawn: false→true) → IDLE
//   IDLE → LOWERING (weaponDrawn: true→false) → HIDDEN
//   IDLE ↔ ADS_IDLE (right click)
//   ADS_IDLE → ADS_FIRING (attackToken + ADS) → ADS_IDLE
//
// Props optionnelles `externalIdleGlb` / `externalFireGlb` : chargent les
// clips d'animation depuis un GLB séparé (cas CG_ShotgunPack). Fallback
// sur les clips embarqués dans le weapon GLB.
//
// `animConfig` (ShotgunFpsAnimSet-like) : fournit les GLB d'animation
// complets (idleHip, idleAds, hipFire, adsFire, reload, raise, lower).

import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { WeaponSway } from "./weaponSway";
import { WeaponBob } from "./weaponBob";

// ── Position hip (défaut) ───────────────────────────────────────────────────
const VM_TARGET_HEIGHT = 0.6;
const OFFSET_FORWARD = -0.45;
const OFFSET_DOWN = -0.35;
const OFFSET_RIGHT = 0.2;

// ── Position ADS (centré, plus proche) ──────────────────────────────────────
const ADS_FORWARD = -0.30;
const ADS_DOWN = -0.28;
const ADS_RIGHT = 0.0;
const ADS_LERP_SPEED = 8;

// ── Position rangée (l'arme descend hors champ) ─────────────────────────────
const HOLSTER_FORWARD = -0.45;
const HOLSTER_DOWN = -0.80;
const HOLSTER_RIGHT = 0.3;

/** Configuration complète des animations FPS (issue du shotgunFpsRegistry). */
export interface FpsAnimConfig {
  idleHip?: string;
  idleAds?: string;
  hipFire?: string;
  adsFire?: string;
  reload?: string;
  raise?: string;
  lower?: string;
}

/** États internes de la machine d'états d'animation. */
type AnimState =
  | "hidden"       // arme rangée, invisible
  | "raising"      // animation de dégainé (raise)
  | "idle"         // idle hipfire
  | "ads_idle"     // idle ADS
  | "firing"       // tir hipfire (one-shot)
  | "ads_firing"   // tir ADS (one-shot)
  | "reloading"    // rechargement (one-shot)
  | "lowering";    // animation de rangement (lower)

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, t);
}

interface FpsWeaponViewmodelProps {
  weaponPath: string;
  fireToken?: number;
  reloadToken?: number;
  weaponDrawn?: boolean;
  onFireImpact?: () => void;
  onReloadComplete?: () => void;
  scale?: number;
  offsets?: { forward?: number; down?: number; right?: number };
  externalIdleGlb?: string;
  externalFireGlb?: string;
  /** Configuration complète des animations (chemins GLB séparés par action). */
  animConfig?: FpsAnimConfig;
  enableAds?: boolean;
}

export function FpsWeaponViewmodel({
  weaponPath,
  fireToken = 0,
  reloadToken = 0,
  weaponDrawn: weaponDrawnProp = true,
  onFireImpact,
  onReloadComplete,
  scale: scaleMult = 1,
  offsets,
  externalIdleGlb,
  externalFireGlb,
  animConfig,
  enableAds = true,
}: FpsWeaponViewmodelProps) {
  const { camera } = useThree();
  const { scene, animations } = useGLTF(weaponPath);

  // ── Charger les GLB d'animation externes ──────────────────────────────────
  const extIdlePath = externalIdleGlb ?? weaponPath;
  const extFirePath = externalFireGlb ?? weaponPath;
  const { animations: extIdleAnims } = useGLTF(extIdlePath);
  const { animations: extFireAnims } = useGLTF(extFirePath);

  // Animations spécifiques (GLB séparés)
  const adsIdlePath = animConfig?.idleAds ?? extIdlePath;
  const adsFirePath = animConfig?.adsFire ?? extFirePath;
  const reloadPath = animConfig?.reload ?? weaponPath;
  const raisePath  = animConfig?.raise  ?? weaponPath;
  const lowerPath  = animConfig?.lower  ?? weaponPath;

  const { animations: adsIdleAnims } = useGLTF(adsIdlePath);
  const { animations: adsFireAnims } = useGLTF(adsFirePath);
  const { animations: reloadAnims } = useGLTF(reloadPath);
  const { animations: raiseAnims }  = useGLTF(raisePath);
  const { animations: lowerAnims }  = useGLTF(lowerPath);

  const { object, baseScale } = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      m.renderOrder = 999;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).filter(Boolean) as THREE.Material[];
      m.material = Array.isArray(m.material)
        ? mats.map((mat) => { const x = mat.clone(); x.depthTest = false; return x; })
        : (() => { const x = mats[0].clone(); x.depthTest = false; return x; })();
    });
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    return { object: c, baseScale: VM_TARGET_HEIGHT / h };
  }, [scene]);

  const group = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object]);
  const sway = useMemo(() => new WeaponSway(), []);
  const bob = useMemo(() => new WeaponBob(), []);

  // ── Actions d'animation ──────────────────────────────────────────────────
  const idleAction    = useRef<THREE.AnimationAction | null>(null);
  const adsIdleAction = useRef<THREE.AnimationAction | null>(null);
  const fireAction    = useRef<THREE.AnimationAction | null>(null);
  const adsFireAction = useRef<THREE.AnimationAction | null>(null);
  const reloadAction  = useRef<THREE.AnimationAction | null>(null);
  const raiseAction   = useRef<THREE.AnimationAction | null>(null);
  const lowerAction   = useRef<THREE.AnimationAction | null>(null);

  // ── Machine d'états ──────────────────────────────────────────────────────
  const state = useRef<AnimState>("idle");
  const lastFireToken   = useRef(fireToken);
  const lastReloadToken = useRef(reloadToken);
  const lastWeaponDrawn = useRef(weaponDrawnProp);
  const hitFired        = useRef(false);
  const oneShotDone     = useRef(false);

  // ── ADS state ─────────────────────────────────────────────────────────────
  const adsHeld = useRef(false);
  const adsBlend = useRef(0);

  useEffect(() => {
    if (!enableAds) return;
    const onDown = (e: MouseEvent) => { if (e.button === 2) { e.preventDefault(); adsHeld.current = true; } };
    const onUp   = (e: MouseEvent) => { if (e.button === 2) adsHeld.current = false; };
    const onCtx  = (e: Event) => e.preventDefault(); // bloque menu contextuel
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("contextmenu", onCtx);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("contextmenu", onCtx);
      adsHeld.current = false;
    };
  }, [enableAds]);

  // ── Résolution des clips ──────────────────────────────────────────────────
  useEffect(() => {
    const find = (pool: THREE.AnimationClip[], ...kws: string[]) =>
      pool.find((a) => kws.some((k) =>
        a.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(k.toLowerCase().replace(/[^a-z0-9]/g, ""))
      ));

    const hasExtIdle = externalIdleGlb && extIdleAnims !== animations;
    const hasExtFire = externalFireGlb && extFireAnims !== animations;

    // Idle hip
    const idleClip = (hasExtIdle ? find(extIdleAnims, "idle") : null)
                   ?? find(animations, "idle");
    if (idleClip) {
      idleAction.current = mixer.clipAction(idleClip);
    }

    // Idle ADS
    const adsIdleClip = find(adsIdleAnims, "idle", "ads", "aim")
                      ?? idleAction.current?.getClip() ?? null;
    if (adsIdleClip && adsIdleClip !== idleAction.current?.getClip()) {
      adsIdleAction.current = mixer.clipAction(adsIdleClip);
    } else {
      adsIdleAction.current = null; // fallback: même clip que hip
    }

    // Fire hip
    const fireClip = (hasExtFire ? find(extFireAnims, "fire", "shoot", "gunshot", "atk", "attack", "swing") : null)
                   ?? find(animations, "fire", "shoot", "atk", "attack", "swing");
    if (fireClip) {
      fireAction.current = mixer.clipAction(fireClip);
      fireAction.current.setLoop(THREE.LoopOnce, 1);
      fireAction.current.clampWhenFinished = true;
    }

    // Fire ADS
    const adsFireClip = find(adsFireAnims, "fire", "shoot", "gunshot", "adsfire");
    if (adsFireClip && adsFireClip !== fireClip) {
      adsFireAction.current = mixer.clipAction(adsFireClip);
      adsFireAction.current.setLoop(THREE.LoopOnce, 1);
      adsFireAction.current.clampWhenFinished = true;
    } else {
      adsFireAction.current = null; // fallback: même que hipfire
    }

    // Reload
    const reloadClip = find(reloadAnims, "reload", "loading", "reloading", "tacreload");
    if (reloadClip) {
      reloadAction.current = mixer.clipAction(reloadClip);
      reloadAction.current.setLoop(THREE.LoopOnce, 1);
      reloadAction.current.clampWhenFinished = true;
    }

    // Raise (dégainer)
    const raiseClip = find(raiseAnims, "raise", "draw", "equip", "gunraise");
    if (raiseClip) {
      raiseAction.current = mixer.clipAction(raiseClip);
      raiseAction.current.setLoop(THREE.LoopOnce, 1);
      raiseAction.current.clampWhenFinished = true;
    }

    // Lower (ranger)
    const lowerClip = find(lowerAnims, "lower", "holster", "unequip", "gunlower");
    if (lowerClip) {
      lowerAction.current = mixer.clipAction(lowerClip);
      lowerAction.current.setLoop(THREE.LoopOnce, 1);
      lowerAction.current.clampWhenFinished = true;
    }

    // Démarrer idle
    if (weaponDrawnProp) {
      state.current = "idle";
      idleAction.current?.reset().play();
    } else {
      state.current = "hidden";
    }

    return () => { mixer.stopAllAction(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixer, animations, extIdleAnims, extFireAnims, externalIdleGlb, externalFireGlb,
      adsIdlePath, adsFirePath, reloadPath, raisePath, lowerPath]);

  // ── Fondu entre deux actions ──────────────────────────────────────────────
  const crossfadeTo = (
    from: THREE.AnimationAction | null,
    to: THREE.AnimationAction | null,
    duration = 0.1,
  ) => {
    from?.fadeOut(duration);
    if (to) {
      to.reset();
      to.setEffectiveWeight(1);
      to.fadeIn(duration);
      to.play();
    }
  };

  const hipFwd = offsets?.forward ?? OFFSET_FORWARD;
  const hipDwn = offsets?.down    ?? OFFSET_DOWN;
  const hipRgt = offsets?.right   ?? OFFSET_RIGHT;
  const finalScale = baseScale * scaleMult;

  const euler = useMemo(() => new THREE.Euler(), []);

  useFrame((_, dt) => {
    const s = state.current;

    // ── Détection weaponDrawn change (holster / draw) ──────────────────────
    if (weaponDrawnProp !== lastWeaponDrawn.current) {
      lastWeaponDrawn.current = weaponDrawnProp;
      if (weaponDrawnProp) {
        // Dégainer
        if (raiseAction.current) {
          state.current = "raising";
          crossfadeTo(idleAction.current, raiseAction.current, 0.05);
        } else {
          state.current = "idle";
          idleAction.current?.reset().fadeIn(0.15).play();
        }
      } else {
        // Ranger
        if (lowerAction.current) {
          state.current = "lowering";
          const from = s === "ads_idle" ? (adsIdleAction.current ?? idleAction.current) : idleAction.current;
          crossfadeTo(from, lowerAction.current, 0.05);
        } else {
          state.current = "hidden";
          mixer.stopAllAction();
        }
      }
    }

    // ── Détection reloadToken ───────────────────────────────────────────────
    if (reloadToken !== lastReloadToken.current) {
      lastReloadToken.current = reloadToken;
      if (s !== "hidden" && s !== "lowering" && reloadAction.current) {
        state.current = "reloading";
        const from = s === "ads_idle" ? (adsIdleAction.current ?? idleAction.current) : idleAction.current;
        adsFireAction.current?.fadeOut(0.05);
        fireAction.current?.fadeOut(0.05);
        crossfadeTo(from, reloadAction.current, 0.08);
        oneShotDone.current = false;
      }
    }

    // ── Détection fireToken ─────────────────────────────────────────────────
    if (fireToken !== lastFireToken.current) {
      lastFireToken.current = fireToken;
      if (s === "reloading") {
        // Tir interrompt le rechargement → revenir à idle d'abord
        reloadAction.current?.fadeOut(0.05);
        idleAction.current?.reset().fadeIn(0.1).play();
        state.current = "idle";
      }
      if (s === "idle" || s === "ads_idle") {
        if (s === "ads_idle" && adsFireAction.current) {
          state.current = "ads_firing";
          adsIdleAction.current?.fadeOut(0.05);
          adsFireAction.current.reset();
          adsFireAction.current.setEffectiveWeight(1);
          adsFireAction.current.play();
        } else if (fireAction.current) {
          state.current = "firing";
          idleAction.current?.fadeOut(0.05);
          fireAction.current.reset();
          fireAction.current.setEffectiveWeight(1);
          fireAction.current.play();
        }
        hitFired.current = false;
      }
    }

    // ── Mise à jour du mixer ────────────────────────────────────────────────
    mixer.update(dt);

    // ── Fin de one-shot (fire / reload / raise / lower) ────────────────────
    if (s === "firing" || s === "ads_firing") {
      const fa = s === "ads_firing" ? adsFireAction.current : fireAction.current;
      if (fa) {
        const dur = fa.getClip().duration || 1;
        const norm = fa.time / dur;
        if (!hitFired.current && norm >= 0.3) {
          hitFired.current = true;
          onFireImpact?.();
        }
        if (norm >= 0.95 || !fa.isRunning()) {
          // Retour à l'idle approprié
          if (adsHeld.current) {
            state.current = "ads_idle";
            fa.fadeOut(0.05);
            const target = adsIdleAction.current ?? idleAction.current;
            target?.reset().fadeIn(0.1).play();
          } else {
            state.current = "idle";
            fa.fadeOut(0.05);
            idleAction.current?.reset().fadeIn(0.1).play();
          }
        }
      }
    }

    if (s === "reloading") {
      const ra = reloadAction.current;
      if (ra) {
        const dur = ra.getClip().duration || 1;
        const norm = ra.time / dur;
        if (!oneShotDone.current && norm >= 0.9) {
          oneShotDone.current = true;
          onReloadComplete?.();
        }
        if (norm >= 0.99 || !ra.isRunning()) {
          ra.fadeOut(0.05);
          state.current = adsHeld.current ? "ads_idle" : "idle";
          const target = (adsHeld.current ? adsIdleAction.current : null) ?? idleAction.current;
          target?.reset().fadeIn(0.1).play();
        }
      }
    }

    if (s === "raising") {
      const ra = raiseAction.current;
      if (ra && (ra.time / (ra.getClip().duration || 1) >= 0.99 || !ra.isRunning())) {
        ra.fadeOut(0.05);
        state.current = "idle";
        idleAction.current?.reset().fadeIn(0.1).play();
      }
    }

    if (s === "lowering") {
      const la = lowerAction.current;
      if (la && (la.time / (la.getClip().duration || 1) >= 0.99 || !la.isRunning())) {
        la.fadeOut(0.05);
        state.current = "hidden";
        mixer.stopAllAction();
      }
    }

    // ── Transition ADS (idle ↔ ads_idle) ───────────────────────────────────
    if (s === "idle" && adsHeld.current && adsIdleAction.current) {
      crossfadeTo(idleAction.current, adsIdleAction.current, 0.15);
      state.current = "ads_idle";
    } else if (s === "ads_idle" && !adsHeld.current) {
      crossfadeTo(adsIdleAction.current, idleAction.current, 0.15);
      state.current = "idle";
    }

    // ── Sway ────────────────────────────────────────────────────────────────
    euler.setFromQuaternion(camera.quaternion, "YXZ");
    sway.update(euler.y, euler.x, dt);
    const swayOff = sway.getOffset();

    // ── Bob (réduit pendant ADS) ────────────────────────────────────────────
    bob.update(camera.position, dt);
    const bobOff = bob.getOffset();

    // ── ADS blend ───────────────────────────────────────────────────────────
    const adsTarget = adsHeld.current ? 1 : 0;
    adsBlend.current = lerp(adsBlend.current, adsTarget, ADS_LERP_SPEED * dt);
    const a = adsBlend.current;

    const fwd = lerp(hipFwd, ADS_FORWARD, a);
    const dwn = lerp(hipDwn, ADS_DOWN, a);
    const rgt = lerp(hipRgt, ADS_RIGHT, a);
    const bobMult = 1 - a;

    // ── Visibilité ──────────────────────────────────────────────────────────
    object.visible = s !== "hidden";

    // ── Positionnement ──────────────────────────────────────────────────────
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);

    // Holster animation: l'arme descend progressivement
    if (s === "lowering" && lowerAction.current) {
      const la = lowerAction.current;
      const dur = la.getClip().duration || 0.5;
      const norm = Math.min(1, la.time / dur);
      const hFwd = lerp(hipFwd, HOLSTER_FORWARD, norm);
      const hDwn = lerp(hipDwn, HOLSTER_DOWN, norm);
      const hRgt = lerp(hipRgt, HOLSTER_RIGHT, norm);
      g.translateZ(hFwd);
      g.translateY(hDwn);
      g.translateX(hRgt);
    } else if (s === "raising" && raiseAction.current) {
      const ra = raiseAction.current;
      const dur = ra.getClip().duration || 0.5;
      const norm = Math.min(1, ra.time / dur);
      const hFwd = lerp(HOLSTER_FORWARD, hipFwd, norm);
      const hDwn = lerp(HOLSTER_DOWN, hipDwn, norm);
      const hRgt = lerp(HOLSTER_RIGHT, hipRgt, norm);
      g.translateZ(hFwd);
      g.translateY(hDwn);
      g.translateX(hRgt);
    } else {
      g.translateZ(fwd);
      g.translateY(dwn);
      g.translateX(rgt);
      g.translateX(swayOff.x * (1 - a * 0.7));
      g.translateY(swayOff.y * (1 - a * 0.7));
      g.translateX(bobOff.x * bobMult);
      g.translateY(bobOff.y * bobMult);
    }
  });

  return <group ref={group}><primitive object={object} scale={finalScale} /></group>;
}
