/**
 * TileGrid.tsx - Grille de cellules iso pour le combat tactique.
 *
 * Sprint 1: rendu visuel grille + highlights (reachable / attackable / aoe).
 * Sprint 3: integration avec useCombatStore pour les selections.
 *
 * La grille est en coordonnees logiques (x, y entiers) avec espacement uniforme.
 * Position monde = [x * cellSize, 0, y * cellSize].
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { GridCell } from "./combat/CombatTypes";

const COLOR_BASE = new THREE.Color("#3a4856");
const COLOR_REACHABLE = new THREE.Color("#3b82f6");      // bleu  (PM)
const COLOR_ATTACKABLE = new THREE.Color("#f59e0b");     // ambre (portee sort)
const COLOR_AOE = new THREE.Color("#ef4444");            // rouge (zone d'effet)
const COLOR_HOVER = new THREE.Color("#fbbf24");          // jaune

export interface TileGridProps {
  width: number;
  height: number;
  cellSize?: number;
  reachable?: GridCell[];
  attackable?: GridCell[];
  aoe?: GridCell[];
  hovered?: GridCell | null;
  onCellHover?: (cell: GridCell | null) => void;
  onCellClick?: (cell: GridCell) => void;
}

function isInList(cells: GridCell[] | undefined, x: number, y: number) {
  if (!cells) return false;
  return cells.some((c) => c.x === x && c.y === y);
}

export function TileGrid({
  width,
  height,
  cellSize = 1,
  reachable,
  attackable,
  aoe,
  hovered,
  onCellHover,
  onCellClick,
}: TileGridProps) {
  // Genere la mesh des cellules
  const cells = useMemo(() => {
    const arr: { key: string; x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        arr.push({ key: `${x}-${y}`, x, y });
      }
    }
    return arr;
  }, [width, height]);

  return (
    <group>
      {cells.map(({ key, x, y }) => {
        const isReachable = isInList(reachable, x, y);
        const isAttackable = isInList(attackable, x, y);
        const isAoe = isInList(aoe, x, y);
        const isHovered = hovered?.x === x && hovered?.y === y;

        let color = COLOR_BASE;
        let opacity = 0.18;
        if (isAoe) {
          color = COLOR_AOE;
          opacity = 0.55;
        } else if (isAttackable) {
          color = COLOR_ATTACKABLE;
          opacity = 0.4;
        } else if (isReachable) {
          color = COLOR_REACHABLE;
          opacity = 0.35;
        }
        if (isHovered) {
          color = COLOR_HOVER;
          opacity = 0.7;
        }

        const worldX = (x - width / 2 + 0.5) * cellSize;
        const worldZ = (y - height / 2 + 0.5) * cellSize;
        return (
          <mesh
            key={key}
            position={[worldX, 0.01, worldZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              onCellHover?.({ x, y });
            }}
            onPointerOut={() => onCellHover?.(null)}
            onClick={(e) => {
              e.stopPropagation();
              onCellClick?.({ x, y });
            }}
          >
            <planeGeometry args={[cellSize * 0.94, cellSize * 0.94]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} />
          </mesh>
        );
      })}
    </group>
  );
}
