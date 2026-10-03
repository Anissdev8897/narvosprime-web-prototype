// ══════════════════════════════════════════════════════════════════════════════
// runtime/MonolithicMap.tsx — Charge et affiche un GLB monolithique avec cache
//
// Remplace StreamingPuzzleMap pour les maps où on veut charger le fichier
// source complet (ex: 3 Go) au lieu des chunks. La scène parsée est cachée
// en mémoire : quitter puis revenir sur la map = remontage instantané.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  loadMonolithicMap,
  getCachedScene,
  type MonolithicProgress,
} from "./loading/MonolithicMapCache";
import { collisionWorld } from "./CollisionWorld";

interface Props {
  url: string;
  offset?: [number, number, number];
  onChunkProgress?: (loaded: number, total: number) => void;
  onComplete?: () => void;
}

export function MonolithicMap({ url, offset, onChunkProgress, onComplete }: Props) {
  const [scene, setScene] = useState<THREE.Group | null>(
    () => getCachedScene(url) ?? null,
  );
  const completedRef = useRef(false);

  useEffect(() => {
    if (scene) return;
    let cancelled = false;

    loadMonolithicMap(url, (p: MonolithicProgress) => {
      if (cancelled) return;
      if (p.phase === "fetching") {
        const pct = Math.round(p.ratio * 100);
        onChunkProgress?.(pct, 100);
      } else if (p.phase === "parsing") {
        onChunkProgress?.(100, 100);
      }
    })
      .then((group) => {
        if (!cancelled) setScene(group);
      })
      .catch((err) => {
        console.error("[MonolithicMap] Échec chargement:", err);
        if (!cancelled && !completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      });

    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!scene) return;

    if (offset) scene.position.set(offset[0], offset[1], offset[2]);
    scene.updateMatrixWorld(true);
    collisionWorld.registerScene(scene);

    if (!completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }

    return () => { collisionWorld.clear(); };
  }, [scene]);

  if (!scene) return null;
  return <primitive object={scene} />;
}
