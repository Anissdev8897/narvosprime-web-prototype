// professions/BucheronAxeViewmodel.tsx — viewmodel 1ʳᵉ personne du bûcheron (bras + hache).
//
// Affiché pendant la coupe d'un arbre (vue FPS forcée). Suit la caméra (overlay
// devant l'écran, depthTest désactivé → ne s'enfonce pas dans le décor). Joue
// l'idle en boucle ; à chaque frappe (swingToken), joue axe_ATK(hit) et déclenche
// onImpact() à la FRAME D'IMPACT de la hache (synchronise son + récolte).
//
// Échelle normalisée par bounding-box (modèle FBX d'échelle source inconnue) ;
// offsets caméra réglables ci-dessous si le cadrage doit être ajusté.
import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const AXE_PATH = "/models/nature/fps_hache_bucheron/bucheron_axe.glb";
/** Fraction de l'anim de coupe où la hache touche le bois (déclenche l'impact). */
const HIT_AT = 0.45;
/** Hauteur cible du viewmodel (m) — normalisation par bbox. */
const VM_TARGET_HEIGHT = 1.6;
/** Offsets en espace caméra (devant / bas / droite). Régler si le cadrage cloche. */
const OFFSET_FORWARD = -0.55;
const OFFSET_DOWN = -0.42;
const OFFSET_RIGHT = 0.16;

useGLTF.preload(AXE_PATH);

export function BucheronAxeViewmodel({ swingToken, onImpact }: { swingToken: number; onImpact: () => void }) {
  const { camera } = useThree();
  const { scene, animations } = useGLTF(AXE_PATH);

  // Clone + matériaux clonés (depthTest off → dessine PAR-DESSUS le monde sans clipping).
  const { object, scale } = useMemo(() => {
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
    return { object: c, scale: VM_TARGET_HEIGHT / h };
  }, [scene]);

  const group = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object]);
  const idleAction = useRef<THREE.AnimationAction | null>(null);
  const chopAction = useRef<THREE.AnimationAction | null>(null);
  const chopping = useRef(false);
  const hitFired = useRef(false);
  const lastToken = useRef(swingToken);

  useEffect(() => {
    const find = (...kws: string[]) => animations.find((a) => kws.some((k) => a.name.toLowerCase().includes(k)));
    const idleClip = find("idle");
    const chopClip = find("atk1(hit)", "atk1", "atk");
    if (idleClip) { idleAction.current = mixer.clipAction(idleClip); idleAction.current.play(); }
    if (chopClip) {
      chopAction.current = mixer.clipAction(chopClip);
      chopAction.current.setLoop(THREE.LoopOnce, 1);
      chopAction.current.clampWhenFinished = true;
    }
    return () => { mixer.stopAllAction(); };
  }, [mixer, animations]);

  useFrame((_, dt) => {
    // Nouvelle frappe → relance l'anim de coupe depuis le début.
    if (swingToken !== lastToken.current) {
      lastToken.current = swingToken;
      const chop = chopAction.current;
      if (chop) {
        idleAction.current?.fadeOut(0.05);
        chop.reset(); chop.setEffectiveWeight(1); chop.play();
        chopping.current = true; hitFired.current = false;
      }
    }
    mixer.update(dt);

    // Détection de l'impact (frame (hit)) → callback unique par coupe.
    const chop = chopAction.current;
    if (chopping.current && chop) {
      const dur = chop.getClip().duration || 1;
      const norm = chop.time / dur;
      if (!hitFired.current && norm >= HIT_AT) { hitFired.current = true; onImpact(); }
      if (norm >= 0.99 || !chop.isRunning()) {
        chopping.current = false;
        idleAction.current?.reset().fadeIn(0.1).play();
      }
    }

    // Suit la caméra : positionné devant l'écran (overlay 1ʳᵉ personne).
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
    g.translateZ(OFFSET_FORWARD);
    g.translateY(OFFSET_DOWN);
    g.translateX(OFFSET_RIGHT);
  });

  return <group ref={group}><primitive object={object} scale={scale} /></group>;
}
