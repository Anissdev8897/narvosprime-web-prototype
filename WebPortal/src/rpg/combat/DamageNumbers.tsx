// combat/DamageNumbers.tsx — CHIFFRES DE DÉGÂTS flottants (pool, zéro mount par hit).
//
// Draine damageEvents chaque frame et anime un pool fixe de billboards texte : montée
// 1,1 s + fondu. Aucune création/destruction React par coup (slots réutilisés) → coût
// constant même en farm intensif. Couleurs : blanc (hit), orange + gros (crit), rouge
// (dégâts subis), vert (soin).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import type * as THREE from "three";
import { damageEvents, type DamageEvent, type DamageKind } from "./damageEvents";

const POOL = 24;
const LIFE = 1.1;        // s
const RISE = 1.6;        // m de montée sur la durée

interface Slot { active: boolean; t: number; x: number; y: number; z: number; amount: number; kind: DamageKind; }

const COLOR: Record<DamageKind, string> = {
  hit: "#ffffff", crit: "#ffb547", player_hurt: "#ff5a5a", heal: "#7dff9a",
};

export function DamageNumbers() {
  const slots = useMemo<Slot[]>(
    () => Array.from({ length: POOL }, () => ({ active: false, t: 0, x: 0, y: 0, z: 0, amount: 0, kind: "hit" as DamageKind })),
    [],
  );
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const textRefs = useRef<(THREE.Mesh | null)[]>([]);
  const drainBuf = useRef<DamageEvent[]>([]);
  const nextSlot = useRef(0);

  useFrame((_, dt) => {
    // 1. Nouveaux événements → slots (round-robin : écrase le plus ancien si plein).
    const evts = damageEvents.drain(drainBuf.current);
    for (const e of evts) {
      const s = slots[nextSlot.current];
      nextSlot.current = (nextSlot.current + 1) % POOL;
      s.active = true; s.t = 0;
      // Jitter horizontal léger → deux hits rapprochés ne se superposent pas.
      s.x = e.x + (Math.random() - 0.5) * 0.6;
      s.y = e.y + 2.2;
      s.z = e.z + (Math.random() - 0.5) * 0.6;
      s.amount = Math.max(1, Math.round(e.amount));
      s.kind = e.kind;
    }
    // 2. Animation des slots actifs (montée + fondu), repositionnement direct (pas de re-render).
    for (let i = 0; i < POOL; i++) {
      const s = slots[i];
      const g = groupRefs.current[i];
      if (!g) continue;
      if (!s.active) { g.visible = false; continue; }
      s.t += dt;
      if (s.t >= LIFE) { s.active = false; g.visible = false; continue; }
      const k = s.t / LIFE;
      g.visible = true;
      g.position.set(s.x, s.y + RISE * k, s.z);
      const txt = textRefs.current[i] as (THREE.Mesh & { text?: string; fillOpacity?: number; color?: string; fontSize?: number }) | null;
      if (txt) {
        txt.text = String(s.amount);
        txt.color = COLOR[s.kind];
        txt.fontSize = s.kind === "crit" ? 0.55 : 0.34;
        txt.fillOpacity = 1 - k * k; // fondu ease-in
        (txt as unknown as { sync?: () => void }).sync?.();
      }
    }
  });

  return (
    <>
      {slots.map((_, i) => (
        <Billboard key={i} ref={(g) => { groupRefs.current[i] = g; }} visible={false}>
          <Text
            ref={(t) => { textRefs.current[i] = t as unknown as THREE.Mesh; }}
            fontSize={0.34}
            color="#ffffff"
            outlineWidth={0.02}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
          >
            0
          </Text>
        </Billboard>
      ))}
    </>
  );
}
