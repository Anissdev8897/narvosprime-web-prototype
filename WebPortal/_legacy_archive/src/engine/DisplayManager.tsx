import React, { ReactNode } from 'react';

/**
 * DisplayManager.tsx
 * Manages the global rendering order of entities in the isometric world.
 * Follows Dofus logic: Sorting by screen Y-coordinate.
 */

export interface RenderableEntity {
  id: string;
  screenX: number;
  screenY: number;
  content: ReactNode;
  zIndexOffset?: number; // For special offsets (e.g., flying entities)
}

interface DisplayManagerProps {
  entities: RenderableEntity[];
}

export const DisplayManager: React.FC<DisplayManagerProps> = ({ entities }) => {
  // Global Y-Sorting logic
  // Dofus sorts everything by Y. Tiles are at the bottom, entities above them.
  // Within the same Y, we keep original order or Use X as secondary sort.
  const sortedEntities = [...entities].sort((a, b) => {
    if (a.screenY !== b.screenY) {
      return a.screenY - b.screenY;
    }
    return a.screenX - b.screenX; // Secondary sort by X for stability
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
      {sortedEntities.map((entity) => (
        <div
          key={entity.id}
          style={{
            position: 'absolute',
            left: `${entity.screenX}px`,
            top: `${entity.screenY}px`,
            zIndex: Math.floor(entity.screenY * 100) + (entity.zIndexOffset || 0),
            pointerEvents: 'auto',
          }}
        >
          {entity.content}
        </div>
      ))}
    </div>
  );
};
