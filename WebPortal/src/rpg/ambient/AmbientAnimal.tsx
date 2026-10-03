// ambient/AmbientAnimal.tsx — un animal ambiant (décor vivant, sans combat).
//
// IA d'errance simple : idle ↔ marche vers un point proche du domicile, en boucle.
// Joue ses anims passives (idle/walk, ou fly pour les volants). Snap au sol. Aucun
// PV, aucune interaction de combat, pas dans npcRegistry → purement visuel.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { collisionWorld } from "../runtime/CollisionWorld";
import type { AmbientAnimalDef } from "./ambientAnimals";

const WANDER_RADIUS = 6;     // rayon d'errance autour du domicile (m)
const WALK_SPEED = 1.1;      // m/s
const FLY_SPEED = 1.8;
const FLY_HEIGHT = 2.6;      // hauteur de vol au-dessus du sol (m)
const ARRIVE_DIST = 0.4;     // distance d'arrivée au point cible
const IDLE_MIN = 2.5, IDLE_MAX = 6; // durée idle aléatoire (s)

interface Props {
  def: AmbientAnimalDef;
  /** Position de spawn / domicile (centre de la zone d'errance). */
  home: [number, number, number];
}

export function AmbientAnimal({ def, home }: Props) {
  // UN SEUL appel useGLTF, sur un tableau : les clips en fichiers séparés
  // (convention UE) sont chargés dans la même passe. Un appel conditionnel
  // casserait l'ordre des hooks entre animaux avec et sans fichiers séparés.
  const paths = useMemo(
    () => [def.path, def.idleClipPath, def.walkClipPath].filter(Boolean) as string[],
    [def.path, def.idleClipPath, def.walkClipPath],
  );
  const gltfs = useGLTF(paths);
  const scene = gltfs[0].scene;
  // Clips embarqués + ceux des fichiers annexes, dans l'ordre des `paths`.
  const animations = useMemo(() => gltfs.flatMap((g) => g.animations), [gltfs]);
  const extraIdle = def.idleClipPath ? gltfs[1]?.animations[0] : undefined;
  const extraWalk = def.walkClipPath
    ? gltfs[def.idleClipPath ? 2 : 1]?.animations[0]
    : undefined;

  const { object, scale } = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; } });
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    return { object: c, scale: def.targetSize / h };
  }, [scene, def.targetSize]);

  const group = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object]);
  const idleAction = useRef<THREE.AnimationAction | null>(null);
  const walkAction = useRef<THREE.AnimationAction | null>(null);

  // État d'errance (refs → pas de re-render).
  const pos = useRef(new THREE.Vector3(home[0], home[1], home[2]));
  const target = useRef(new THREE.Vector3(home[0], home[1], home[2]));
  const phase = useRef<"idle" | "walk">("idle");
  const idleTimer = useRef(IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN));
  const yaw = useRef(Math.random() * Math.PI * 2);
  const bob = useRef(Math.random() * Math.PI * 2); // phase de flottement (volants)
  const grounded = useRef(false);

  useEffect(() => {
    const find = (...kws: string[]) => animations.find((a) => kws.some((k) => a.name.toLowerCase().includes(k)));
    const byName = (n?: string) => (n ? animations.find((a) => a.name === n) : undefined);
    // Priorité : fichier séparé > nom exact > recherche par mot-clé.
    // Le nom exact rattrape les exports Mixamo dont le clip s'appelle
    // "Armature|Armature|…|mixamo.com|Layer0" — invisible pour `find`.
    const idleClip = extraIdle ?? byName(def.idleClipName)
      ?? (def.flying ? find("fly") : find("iddle", "idle"));
    const walkClip = extraWalk ?? byName(def.walkClipName) ?? find("walk", "walking");
    if (idleClip) { idleAction.current = mixer.clipAction(idleClip); idleAction.current.play(); }
    if (walkClip) { walkAction.current = mixer.clipAction(walkClip); }
    if (!idleClip && !walkClip && process.env.NODE_ENV !== "production") {
      console.warn(`[AmbientAnimal] "${def.id}" : aucun clip trouvé → maillage figé.`);
    }
    return () => { mixer.stopAllAction(); };
  }, [mixer, animations, def, extraIdle, extraWalk]);

  // Snap au sol initial.
  useEffect(() => {
    const gy = collisionWorld.getGroundY(home[0], home[2], home[1] + 30);
    if (gy !== null) { pos.current.y = gy; grounded.current = true; }
  }, [home]);

  const pickTarget = () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * WANDER_RADIUS;
    target.current.set(home[0] + Math.cos(a) * r, pos.current.y, home[2] + Math.sin(a) * r);
  };

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    mixer.update(dt);

    if (def.flying) {
      // Vol : dérive lente vers une cible + flottement vertical.
      const dx = target.current.x - pos.current.x;
      const dz = target.current.z - pos.current.z;
      const d = Math.hypot(dx, dz);
      if (d < ARRIVE_DIST) { pickTarget(); }
      else {
        pos.current.x += (dx / d) * FLY_SPEED * dt;
        pos.current.z += (dz / d) * FLY_SPEED * dt;
        yaw.current = Math.atan2(dx, dz);
      }
      bob.current += dt * 2;
      const gy = collisionWorld.getGroundY(pos.current.x, pos.current.z, pos.current.y + 30);
      const base = (gy ?? pos.current.y) + FLY_HEIGHT;
      g.position.set(pos.current.x, base + Math.sin(bob.current) * 0.25, pos.current.z);
      g.rotation.y = yaw.current;
      return;
    }

    if (def.wander && walkAction.current) {
      if (phase.current === "idle") {
        idleTimer.current -= dt;
        if (idleTimer.current <= 0) {
          pickTarget();
          phase.current = "walk";
          idleAction.current?.fadeOut(0.2);
          walkAction.current.reset().fadeIn(0.2).play();
        }
      } else {
        const dx = target.current.x - pos.current.x;
        const dz = target.current.z - pos.current.z;
        const d = Math.hypot(dx, dz);
        if (d < ARRIVE_DIST) {
          phase.current = "idle";
          idleTimer.current = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
          walkAction.current.fadeOut(0.2);
          idleAction.current?.reset().fadeIn(0.2).play();
        } else {
          pos.current.x += (dx / d) * WALK_SPEED * dt;
          pos.current.z += (dz / d) * WALK_SPEED * dt;
          yaw.current = THREE.MathUtils.lerp(yaw.current, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
          const gy = collisionWorld.getGroundY(pos.current.x, pos.current.z, pos.current.y + 5);
          if (gy !== null) pos.current.y = gy;
        }
      }
    }

    g.position.copy(pos.current);
    g.rotation.y = yaw.current;
  });

  return <group ref={group}><primitive object={object} scale={scale} /></group>;
}
