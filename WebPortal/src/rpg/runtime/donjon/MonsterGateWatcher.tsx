// runtime/donjon/MonsterGateWatcher.tsx — surveille les ennemis vivants du donjon.
//
// Compte (throttlé ~4 Hz) les PNJ ennemis VIVANTS hors-boss via npcRegistry.
// Détecte la transition « il y avait des mobs → 0 vivant » → onCleared() (ouvre le mur).
// Reporte aussi le nombre courant via onAliveMobs (HUD). Aucun rendu.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { npcRegistry } from "../../npc/npcRegistry";

interface Props {
  /** ids des PNJ rang Boss (exclus du décompte). */
  bossIds: React.MutableRefObject<Set<string>>;
  onAliveMobs: (n: number) => void;
  onCleared: () => void;
}

export function MonsterGateWatcher({ bossIds, onAliveMobs, onCleared }: Props) {
  const acc = useRef(0);
  const sawMobs = useRef(false);
  const last = useRef(-1);

  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;

    let n = 0;
    for (const h of npcRegistry.all()) {
      if (h.role === "enemy" && h.isAlive() && !bossIds.current.has(h.id)) n++;
    }

    if (n > 0) {
      sawMobs.current = true;
    } else if (sawMobs.current) {
      sawMobs.current = false;
      onCleared(); // salle nettoyée → ouvre le mur du boss
    }
    if (n !== last.current) { last.current = n; onAliveMobs(n); }
  });

  return null;
}
