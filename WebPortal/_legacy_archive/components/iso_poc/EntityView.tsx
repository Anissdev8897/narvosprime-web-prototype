/**
 * EntityView.tsx - Wrapper qui rend une entite (joueur/monstre/PNJ) sur la grille
 * iso, avec selection ring, click handler et placement par cellule.
 *
 * - Convertit GridCell -> position monde via grid props
 * - Delegue le rendu visuel a Character3D (GLB + toon + outline)
 * - Affiche un anneau au sol (selection / hover)
 */

import { useMemo } from "react";
import * as THREE from "three";
import { Character3D } from "./Character3D";
import type { CombatEntity } from "./combat/CombatTypes";
import type { EntityDefinition } from "./combat/EntityDefinition";

export interface EntityViewProps {
  entity: CombatEntity;
  definition: EntityDefinition;
  /** Dimensions grille pour calcul position monde. */
  grid: { width: number; height: number; cellSize: number };
  selected?: boolean;
  hovered?: boolean;
  onSelect?: (entityId: string) => void;
  onRootReady?: (id: string, obj: THREE.Object3D) => void;
}

export function EntityView({
  entity,
  definition,
  grid,
  selected,
  hovered,
  onSelect,
  onRootReady,
}: EntityViewProps) {
  const worldPos = useMemo<[number, number, number]>(() => {
    const wx = (entity.cell.x - grid.width / 2 + 0.5) * grid.cellSize;
    const wz = (entity.cell.y - grid.height / 2 + 0.5) * grid.cellSize;
    return [wx, definition.model.yOffset ?? 0, wz];
  }, [entity.cell, grid, definition.model.yOffset]);

  const ringColor = useMemo(() => {
    if (selected) return "#ffd166";       // jaune fort
    if (hovered) return "#7df9ff";        // cyan AKARLYS
    if (definition.kind === "player") return "#7df9ff";
    if (definition.kind === "monster" || definition.kind === "elite" || definition.kind === "boss") {
      return "#ef4444";                   // rouge ennemi
    }
    return "#9ab8d4";
  }, [selected, hovered, definition.kind]);

  const ringScale = selected ? 1.05 : 0.95;
  const ringOpacity = selected ? 0.95 : hovered ? 0.65 : 0.4;

  const isDead = entity.isDead || entity.stats.hp <= 0;

  return (
    <group position={worldPos}>
      {/* Selection ring au sol */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerOver={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(entity.id);
        }}
      >
        <ringGeometry args={[grid.cellSize * 0.32 * ringScale, grid.cellSize * 0.42 * ringScale, 32]} />
        <meshBasicMaterial color={ringColor} transparent opacity={ringOpacity} side={THREE.DoubleSide} />
      </mesh>

      {/* Modele 3D */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(entity.id);
        }}
        // Effet "mort" : grise + position au sol
        scale={isDead ? 0.85 : 1}
      >
        <Character3D
          animations={definition.model.animations}
          state={isDead ? "death" : entity.isPlayer ? "idle" : "idle"}
          faction={definition.faction}
          rotationY={definition.model.rotationY ?? 0}
          scale={definition.model.scale ?? 1}
          onRootReady={(obj) => onRootReady?.(entity.id, obj)}
        />
      </group>

      {/* Tag nom + faction au-dessus de la tete (HUD 3D, sans HTML) */}
      {/* Implemente dans HudOverlay.tsx en 2D suivant la projection camera */}
    </group>
  );
}
