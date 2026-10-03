// pets/PetSummon.tsx — invocation de combat (allié temporaire).
//
// IA : cherche l'ennemi le plus proche dans aggroRange → le poursuit → le frappe
// (applyDamage, sur cooldown) ; sans cible, suit le joueur ; sinon idle. Disparaît
// au bout de lifetime. Réutilise AnimationController (idle/run/attack) + npcRegistry.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { AnimationController } from "../animation/AnimationController";
import { collisionWorld } from "../runtime/CollisionWorld";
import { npcRegistry, type NpcHandle } from "../npc/npcRegistry";
import type { PetSummonDef } from "./petSummons";

const FOLLOW_DIST = 4;   // distance de suivi du joueur (m)
const ARRIVE = 0.2;

interface Props {
  def: PetSummonDef;
  spawnPos: [number, number, number];
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  onExpire: () => void;
}

export function PetSummon({ def, spawnPos, playerPosition, onExpire }: Props) {
  const { scene, animations } = useGLTF(def.path);

  const { object, scale } = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    return { object: c, scale: def.targetSize / h };
  }, [scene, def.targetSize]);

  const group = useRef<THREE.Group>(null);
  const ctrl = useRef<AnimationController | null>(null);
  const pos = useRef(new THREE.Vector3(spawnPos[0], spawnPos[1], spawnPos[2]));
  const yaw = useRef(0);
  const life = useRef(def.lifetime);
  const atkCd = useRef(0);

  useEffect(() => {
    const gy = collisionWorld.getGroundY(spawnPos[0], spawnPos[2], spawnPos[1] + 20);
    if (gy !== null) pos.current.y = gy;
    if (group.current && animations.length > 0) {
      ctrl.current = new AnimationController(group.current, animations, { initial: "idle" });
    }
    return () => ctrl.current?.dispose();
  }, [animations, spawnPos]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // Durée de vie.
    life.current -= dt;
    if (life.current <= 0) { onExpire(); return; }
    atkCd.current = Math.max(0, atkCd.current - dt);

    // Cible = ennemi vivant le plus proche dans aggroRange.
    let target: NpcHandle | null = null;
    let bestD = Infinity;
    for (const e of npcRegistry.queryEnemiesInRadius(pos.current, def.aggroRange)) {
      const d = e.getPosition().distanceToSquared(pos.current);
      if (d < bestD) { bestD = d; target = e; }
    }

    let moving = false;
    let attacking = false;

    if (target) {
      const tp = target.getPosition();
      const dx = tp.x - pos.current.x, dz = tp.z - pos.current.z;
      const d = Math.hypot(dx, dz);
      yaw.current = THREE.MathUtils.lerp(yaw.current, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
      if (d > def.attackRange) {
        pos.current.x += (dx / d) * def.moveSpeed * dt;
        pos.current.z += (dz / d) * def.moveSpeed * dt;
        moving = true;
      } else if (atkCd.current <= 0) {
        target.applyDamage(def.damage);
        atkCd.current = def.attackCooldown;
        attacking = true;
      }
    } else {
      // Pas d'ennemi → suit le joueur.
      const pp = playerPosition.current;
      const dx = pp.x - pos.current.x, dz = pp.z - pos.current.z;
      const d = Math.hypot(dx, dz);
      if (d > FOLLOW_DIST) {
        pos.current.x += (dx / d) * def.moveSpeed * dt;
        pos.current.z += (dz / d) * def.moveSpeed * dt;
        yaw.current = THREE.MathUtils.lerp(yaw.current, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
        moving = true;
      }
    }

    if (moving) {
      const gy = collisionWorld.getGroundY(pos.current.x, pos.current.z, pos.current.y + 5);
      if (gy !== null) pos.current.y = gy;
    }

    // Animation : attaque (one-shot) prioritaire, sinon course/idle.
    const c = ctrl.current;
    if (c) {
      if (attacking) c.play("attack");
      else if (c.currentAction !== "attack") c.play(moving ? "run" : "idle");
      c.update(dt);
    }

    g.position.copy(pos.current);
    g.rotation.y = yaw.current;
  });

  return <group ref={group}><primitive object={object} scale={scale} /></group>;
}
