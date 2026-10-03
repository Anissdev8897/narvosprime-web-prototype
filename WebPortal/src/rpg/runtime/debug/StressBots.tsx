// runtime/debug/StressBots.tsx — spawn N NPC-bots autour du joueur pour le stress-test.
// Réutilise <Npc> (broadphase + projectiles + raycast + anim exercés à l'échelle).
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import type { SpellDef } from "../../spells/SpellDef";
import type { ElementId } from "../../types";
import type { BossAoe } from "../../spells/BossAoeZone";
import { Npc } from "../../npc/Npc";
import { useStress } from "./stressStore";

const BOT_FOLDER = "soldat_humain";   // biped à anims partagées (léger, fiable)
const RING_R = 22;                     // rayon d'apparition (dans la portée d'aggro)

interface Props {
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  origin: [number, number, number];
  onHitPlayer: (damage: number, element?: ElementId) => void;
  onNpcCast: (spell: SpellDef, origin: THREE.Vector3, dir: THREE.Vector3) => void;
  onDeath: (xp: number) => void;
  onBossAoe: (aoe: BossAoe) => void;
}

export function StressBots({ playerPosition, origin, onHitPlayer, onNpcCast, onDeath, onBossAoe }: Props) {
  const { count, behavior } = useStress();
  // `origin` est recréé à chaque render parent → on le SNAPSHOT au (re)spawn (quand `count`
  // change) pour ne dépendre que de `count` : les bots forment un anneau FIXE au point où on
  // les a spawnés (pas de régénération/téléportation à chaque re-render du parent).
  const originRef = useRef(origin);
  const bots = useMemo(() => {
    originRef.current = origin;
    const o = originRef.current;
    const arr: { id: string; pos: [number, number, number] }[] = [];
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / Math.max(1, count);
      const r = RING_R + (i % 5);
      arr.push({ id: `stressbot_${i}`, pos: [o[0] + Math.cos(a) * r, o[1], o[2] + Math.sin(a) * r] });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (count <= 0) return null;
  return (
    <>
      {bots.map((b) => (
        <Npc
          key={b.id}
          id={b.id}
          folder={BOT_FOLDER}
          position={b.pos}
          level={1}
          playerPosition={playerPosition}
          onHitPlayer={onHitPlayer}
          onNpcCast={behavior === "shoot" ? onNpcCast : undefined}
          zoneId="stress"
          onDeath={onDeath}
          onBossAoe={onBossAoe}
        />
      ))}
    </>
  );
}
