// ══════════════════════════════════════════════════════════════════════════════
// components/inventory/InventoryGrid.tsx — Grille d'inventaire drag & drop
//
// Grille N×M où chaque item occupe gridW × gridH cellules.
// Drag & drop pour déplacer, clic droit pour options.
// Tooltip au survol.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback } from "react";
import type { GridState } from "../../rpg/items/gridInventory";
import type { ItemInstance } from "../../rpg/items/ItemDefinition";
import type { ItemDefinition, ItemStats } from "../../rpg/items/ItemDefinition";
import { ITEM_DB } from "../../rpg/items/itemCatalog";
import { RARITY_COLORS } from "../../rpg/items/ItemDefinition";
import { ItemTooltip } from "./ItemTooltip";

interface InventoryGridProps {
  grid: GridState;
  onMoveItem: (uid: string, newX: number, newY: number) => boolean;
  onEquipItem?: (uid: string) => void;
  onDropItem?: (uid: string) => void;
  /** Stats équipées pour comparaison dans le tooltip */
  equippedStats?: ItemStats;
  /** Size d'une cellule en px */
  cellSize?: number;
}

export function InventoryGrid({
  grid,
  onMoveItem,
  onEquipItem,
  onDropItem,
  equippedStats,
  cellSize = 56,
}: InventoryGridProps) {
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ItemInstance | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{
    uid: string;
    x: number;
    y: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const gap = 3;
  const gridWidth = grid.cols * (cellSize + gap) + gap;

  const handleDragStart = useCallback((uid: string) => {
    setDragItem(uid);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragItem || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (cellSize + gap));
      const y = Math.floor((e.clientY - rect.top) / (cellSize + gap));

      // Trouver l'instance pour connaître sa taille
      const inst = grid.instances.find((i) => i.uid === dragItem);
      if (inst) {
        // Centrer le drop sur l'item (décaler de la moitié de sa taille)
        const offsetX = Math.max(0, Math.floor((inst.gridW ?? 1) / 2));
        const offsetY = Math.max(0, Math.floor((inst.gridH ?? 1) / 2));
        const finalX = Math.max(0, x - offsetX);
        const finalY = Math.max(0, y - offsetY);
        onMoveItem(dragItem, finalX, finalY);
      }

      setDragItem(null);
    },
    [dragItem, grid, onMoveItem, cellSize]
  );

  const handleMouseEnter = useCallback((inst: ItemInstance, e: React.MouseEvent) => {
    setHoveredItem(inst);
    setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (hoveredItem) {
      setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 });
    }
  }, [hoveredItem]);

  const handleMouseLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, uid: string) => {
    e.preventDefault();
    setContextMenu({ uid, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Fond de grille (quadrillage)
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      cells.push(
        <div
          key={`cell-${x}-${y}`}
          style={{
            position: "absolute",
            left: x * (cellSize + gap) + gap,
            top: y * (cellSize + gap) + gap,
            width: cellSize,
            height: cellSize,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 3,
            pointerEvents: "none",
          }}
        />
      );
    }
  }

  // Items placés
  const itemElements = grid.instances.map((inst) => {
    const def = ITEM_DB[inst.itemId];
    if (!def) return null;

    const w = (inst.gridW ?? def.gridW ?? 1) * (cellSize + gap) - gap;
    const h = (inst.gridH ?? def.gridH ?? 1) * (cellSize + gap) - gap;
    const rarityColor = def.color ?? RARITY_COLORS[def.rarity];

    return (
      <div
        key={inst.uid}
        draggable
        onDragStart={() => handleDragStart(inst.uid)}
        onMouseEnter={(e) => handleMouseEnter(inst, e)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => handleContextMenu(e, inst.uid)}
        style={{
          position: "absolute",
          left: inst.gridX * (cellSize + gap) + gap,
          top: inst.gridY * (cellSize + gap) + gap,
          width: w,
          height: h,
          background: `rgba(0,0,0,0.6)`,
          border: `1px solid ${rarityColor}88`,
          borderRadius: 5,
          cursor: "grab",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontSize: inst.quantity > 1 ? 20 : 28,
          userSelect: "none",
          opacity: dragItem === inst.uid ? 0.4 : 1,
          transition: "opacity 0.15s",
          boxShadow: `inset 0 0 8px ${rarityColor}22`,
          overflow: "hidden",
        }}
        title=""
      >
        <span style={{ lineHeight: 1 }}>{def.icon}</span>
        {inst.quantity > 1 && (
          <span style={{
            position: "absolute",
            bottom: 2,
            right: 4,
            fontSize: 10,
            fontWeight: 800,
            color: "#e2e8f0",
            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          }}>
            ×{inst.quantity}
          </span>
        )}
      </div>
    );
  });

  const hoveredDef = hoveredItem ? ITEM_DB[hoveredItem.itemId] : undefined;

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={gridRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={closeContextMenu}
        style={{
          position: "relative",
          width: gridWidth,
          height: grid.rows * (cellSize + gap) + gap,
          background: "rgba(0,0,0,0.3)",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {cells}
        {itemElements}
      </div>

      {/* Tooltip */}
      {hoveredDef && hoveredItem && (
        <ItemTooltip
          def={hoveredDef}
          compareStats={equippedStats}
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        />
      )}

      {/* Menu contextuel */}
      {contextMenu && (
        <>
          <div
            onClick={closeContextMenu}
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
          />
          <div
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 9999,
              background: "rgba(15, 12, 25, 0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "4px 0",
              fontFamily: "monospace",
              fontSize: 12,
              backdropFilter: "blur(8px)",
              minWidth: 140,
            }}
          >
            {onEquipItem && (
              <ContextMenuItem label="Équiper" onClick={() => { onEquipItem(contextMenu.uid); closeContextMenu(); }} />
            )}
            {onDropItem && (
              <ContextMenuItem label="Jeter" onClick={() => { onDropItem(contextMenu.uid); closeContextMenu(); }} color="#f87171" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ContextMenuItem({
  label,
  onClick,
  color,
}: {
  label: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "6px 14px",
        cursor: "pointer",
        color: color ?? "#e2e8f0",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {label}
    </div>
  );
}
