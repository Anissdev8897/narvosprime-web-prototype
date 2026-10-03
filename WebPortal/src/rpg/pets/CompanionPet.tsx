// pets/CompanionPet.tsx — compagnon permanent (pas de lifetime, a des PV, gagne de l'XP).
//
// Différences vs PetSummon :
// - Pas de timer de disparition (permanent tant que le joueur est en jeu).
// - A des PV → peut mourir → respawn après cooldown.
// - Stats scalent avec le niveau (petStore).
// - Callback onKill pour distribuer l'XP au pet.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { AnimationController } from "../animation/AnimationController";
import { collisionWorld } from "../runtime/CollisionWorld";
import { npcRegistry, type NpcHandle } from "../npc/npcRegistry";
import { type CompanionDef, companionHp, companionDamage } from "./petSummons";

const FOLLOW_DIST = 3.5;

interface Props {
  def: CompanionDef;
  level: number;
  spawnPos: [number, number, number];
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  onKill: (xp: number) => void;
}

export function CompanionPet({ def, level, spawnPos, playerPosition, onKill }: Props) {
  const { scene, animations } = useGLTF(def.path);

  const { object, scale } = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    return { object: c, scale: def.targetSize / h };
  }, [scene, def.targetSize]);

  const maxHp = companionHp(def, level);
  const damage = companionDamage(def, level);

  const group = useRef<THREE.Group>(null);
  const ctrl = useRef<AnimationController | null>(null);
  const pos = useRef(new THREE.Vector3(spawnPos[0], spawnPos[1], spawnPos[2]));
  const yaw = useRef(0);
  const atkCd = useRef(0);
  const hp = useRef(maxHp);
  const dead = useRef(false);
  const respawnTimer = useRef(0);
  const hpRatio = useRef(1);

  useEffect(() => {
    hp.current = maxHp;
    hpRatio.current = 1;
  }, [maxHp]);

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

    // Mort → cooldown respawn.
    if (dead.current) {
      respawnTimer.current -= dt;
      g.visible = false;
      if (respawnTimer.current <= 0) {
        dead.current = false;
        hp.current = maxHp;
        hpRatio.current = 1;
        const pp = playerPosition.current;
        pos.current.set(pp.x + 2, pp.y, pp.z + 2);
        const gy = collisionWorld.getGroundY(pos.current.x, pos.current.z, pos.current.y + 10);
        if (gy !== null) pos.current.y = gy;
        g.visible = true;
      }
      return;
    }

    atkCd.current = Math.max(0, atkCd.current - dt);

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
      } else {
        // En mêlée → le pet attaque ET l'ennemi riposte.
        if (atkCd.current <= 0) {
          target.applyDamage(damage);
          atkCd.current = def.attackCooldown;
          attacking = true;
          if (target.getHpFraction() <= 0) {
            onKill(10 + level * 2);
          }
        }
        // Riposte ennemie (dégâts réduits, simulés).
        hp.current -= 4 * dt;
        hpRatio.current = Math.max(0, hp.current / maxHp);
        if (hp.current <= 0) {
          dead.current = true;
          respawnTimer.current = def.respawnCooldown;
          return;
        }
      }
    } else {
      const pp = playerPosition.current;
      const dx = pp.x - pos.current.x, dz = pp.z - pos.current.z;
      const d = Math.hypot(dx, dz);
      if (d > FOLLOW_DIST) {
        pos.current.x += (dx / d) * def.moveSpeed * dt;
        pos.current.z += (dz / d) * def.moveSpeed * dt;
        yaw.current = THREE.MathUtils.lerp(yaw.current, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
        moving = true;
      }
      // Téléportation si trop loin (>30m).
      if (d > 30) {
        pos.current.set(pp.x + 2, pp.y, pp.z + 2);
      }
    }

    if (moving) {
      const gy = collisionWorld.getGroundY(pos.current.x, pos.current.z, pos.current.y + 5);
      if (gy !== null) pos.current.y = gy;
    }

    const c = ctrl.current;
    if (c) {
      if (attacking) c.play("attack");
      else if (c.currentAction !== "attack") c.play(moving ? "run" : "idle");
      c.update(dt);
    }

    g.position.copy(pos.current);
    g.rotation.y = yaw.current;
  });

  return (
    <group ref={group}>
      <primitive object={object} scale={scale} />
      {/* Barre de vie au-dessus du compagnon */}
      <Html position={[0, def.targetSize + 0.3, 0]} center style={{ pointerEvents: "none" }}>
        <div style={{
          width: 48, height: 5, background: "rgba(0,0,0,0.6)", borderRadius: 3, overflow: "hidden",
        }}>
          <div style={{
            width: `${hpRatio.current * 100}%`, height: "100%",
            background: hpRatio.current > 0.5 ? "#4ade80" : hpRatio.current > 0.25 ? "#facc15" : "#ef4444",
            transition: "width 0.2s",
          }} />
        </div>
        <div style={{
          color: "#a3e635", fontSize: 9, textAlign: "center", textShadow: "0 1px 3px #000",
          marginTop: 1, whiteSpace: "nowrap",
        }}>
          {def.label} Nv.{level}
        </div>
      </Html>
    </group>
  );
}
