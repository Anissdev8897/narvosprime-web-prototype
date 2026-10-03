// spells/BossAoeZone.tsx — zone d'AoE de boss TÉLÉGRAPHIÉE (à esquiver).
//
// Cycle : windup (le disque se remplit dans l'anneau) → détonation (flash +
// dégâts si le joueur est dans le rayon + screen shake) → expire.
// Violet = ultime du boss · Rouge = cercle de déflagration (enrage).
// Mirror du cycle de vie d'activeSpells : spawn (état RpgGameWorld) → animate
// (ce composant via useFrame) → onExpire (retrait de la liste).
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { screenShake } from "../runtime/screenShake";
import { npcRegistry } from "../npc/npcRegistry";
import { cameraRecoil } from "../camera/CameraRecoilController";
import { recoilProfileStore } from "../camera/recoilProfileStore";

export interface BossAoe {
  id: string;
  /** Centre monde [x, y, z] (y au sol). */
  pos: [number, number, number];
  radius: number;
  kind: "ultimate" | "deflagration";
  /** Durée d'avertissement (s) avant la détonation. */
  windup: number;
  /** Dégâts infligés à la détonation (au joueur, ou aux ennemis si targetEnemies). */
  damage: number;
  /** true = AoE du JOUEUR → frappe les ENNEMIS du rayon. Défaut (false) = AoE boss → frappe le joueur. */
  targetEnemies?: boolean;
  /** Teinte personnalisée (défaut : violet ultime / rouge déflagration). */
  color?: string;
}

const TMP_CENTER = new THREE.Vector3();

const FLASH = 0.3; // durée du flash post-détonation (s)

interface Props {
  aoe: BossAoe;
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  onDamage: (damage: number) => void;
  onExpire: (id: string) => void;
}

export function BossAoeZone({ aoe, playerPosition, onDamage, onExpire }: Props) {
  const fill = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const detonated = useRef(false);
  const color = aoe.color ?? (aoe.kind === "ultimate" ? "#9d4edd" : "#ff3b3b");

  useFrame((_, dt) => {
    elapsed.current += dt;

    if (!detonated.current) {
      // ── Phase windup : le disque se remplit (0 → rayon) ──────────────────
      const t = Math.min(1, elapsed.current / aoe.windup);
      if (fill.current) {
        const s = Math.max(0.001, aoe.radius * t);
        fill.current.scale.set(s, s, s);
        (fill.current.material as THREE.MeshBasicMaterial).opacity = 0.16 + 0.26 * t;
      }
      if (elapsed.current >= aoe.windup) {
        detonated.current = true;
        if (aoe.targetEnemies) {
          // AoE JOUEUR : frappe les ennemis encore dans le rayon (esquivable).
          TMP_CENTER.set(aoe.pos[0], aoe.pos[1], aoe.pos[2]);
          for (const e of npcRegistry.queryEnemiesInRadius(TMP_CENTER, aoe.radius)) e.applyDamage(aoe.damage);
        } else {
          // AoE BOSS : frappe le joueur s'il est dans le rayon.
          const p = playerPosition.current;
          const dx = p.x - aoe.pos[0];
          const dz = p.z - aoe.pos[2];
          if (dx * dx + dz * dz <= aoe.radius * aoe.radius) {
            onDamage(aoe.damage);
            // Impact de boss : recul caméra "boss_slam" (Animation-Event-like, mais
            // déclenché par l'événement gameplay = détonation qui touche le joueur).
            const slam = recoilProfileStore.get("boss_slam");
            if (slam) cameraRecoil.applyRecoil(slam);
          }
        }
        screenShake.add(aoe.kind === "ultimate" ? 0.45 : 0.25);
      }
    } else {
      // ── Phase flash : éclat blanc qui s'estompe ──────────────────────────
      const ft = (elapsed.current - aoe.windup) / FLASH;
      if (flash.current) {
        (flash.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - ft));
      }
      if (elapsed.current - aoe.windup >= FLASH) onExpire(aoe.id);
    }
  });

  return (
    <group position={aoe.pos}>
      {/* anneau de contour (zone de danger, taille finale fixe) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[aoe.radius * 0.9, aoe.radius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* disque de remplissage (scale animé pendant le windup) */}
      <mesh ref={fill} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[0.001, 0.001, 0.001]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* flash de détonation */}
      <mesh ref={flash} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[aoe.radius, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
