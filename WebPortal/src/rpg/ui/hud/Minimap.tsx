// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/Minimap.tsx — Mini-carte Canvas 2D avec brouillard de guerre
//
// Utilise un canvas 2D (aucun rendu 3D) pour la minimap.
// Affiche :
//   - Fond sombre cerclé
//   - Brouillard de guerre (zones non découvertes)
//   - Joueur (flèche orientée)
//   - Entités à proximité (PNJ, ennemis, ressources)
//   - Marqueur Nord
// React.memo : ne se re-render que si les données de carte changent
// ══════════════════════════════════════════════════════════════════════════════

import { memo, useEffect, useRef } from "react";
import type { MapData, RadarEntity } from "./hudTypes";

export interface MinimapProps {
  /** Taille en pixels du canvas carré. */
  size?: number;
  /** Rayon de détection en mètres (du bord du canvas). */
  range?: number;
  /** Position du joueur dans le monde (x, z). */
  playerX: number;
  playerZ: number;
  /** Orientation du joueur (yaw en radians). */
  playerYaw: number;
  /** Entités à afficher sur la minimap. */
  entities?: RadarEntity[];
  /** Données de la carte (zones, découverte). */
  mapData?: MapData;
  /** Frame rate de mise à jour (ms). Défaut: 100 (10 fps). */
  intervalMs?: number;
}

const DEFAULT_SIZE = 160;
const DEFAULT_RANGE = 60;

/**
 * Mini-carte Canvas 2D avec brouillard de guerre.
 * Dessin throttlé à 10 Hz par défaut (pas de rendu par frame).
 * React.memo : ne se re-render que si les props changent.
 */
export const Minimap = memo(function Minimap({
  size = DEFAULT_SIZE,
  range = DEFAULT_RANGE,
  playerX,
  playerZ,
  playerYaw,
  entities = [],
  mapData,
  intervalMs = 100,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const C = size / 2;
    const scale = C / range;
    const fogColor = "rgba(4,6,12,0.85)";

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // ── Cercle de fond ──────────────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(C, C, C - 1, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = "rgba(6,10,18,0.72)";
      ctx.fillRect(0, 0, size, size);

      // ── Brouillard de guerre ────────────────────────────────────────────
      // Les zones non découvertes sont masquées par un cercle intérieur
      // qu'on réduit en fonction de la découverte.
      ctx.fillStyle = fogColor;

      // Cercles concentriques de distance
      ctx.strokeStyle = "rgba(59,130,246,0.15)";
      ctx.lineWidth = 0.5;
      [0.2, 0.5, 0.8].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(C, C, (C - 2) * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });

      // ── Entités ─────────────────────────────────────────────────────────
      for (const entity of entities) {
        const dx = (entity.position.x - playerX) * scale;
        const dz = (entity.position.z - playerZ) * scale;
        const distSq = dx * dx + dz * dz;

        // Hors du cercle de la minimap
        if (distSq > (C - 4) * (C - 4)) continue;

        // Brouillard de guerre : si la zone n'est pas découverte, on masque
        if (mapData && entity.type !== "PLAYER") {
          const isDiscovered = isAreaDiscovered(
            entity.position.x,
            entity.position.z,
            mapData
          );
          if (!isDiscovered) continue;
        }

        const ex = C + dx;
        const ez = C + dz;

        if (entity.isMoving) {
          // Entité mobile : cercle animé (pulsation)
          const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 1;
          ctx.beginPath();
          ctx.arc(ex, ez, 2.5 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = entityColor(entity);
          ctx.fill();
        } else {
          // Entité statique : carré
          ctx.fillStyle = entityColor(entity);
          ctx.fillRect(ex - 2, ez - 2, 4, 4);
        }
      }

      ctx.restore();

      // ── Bordure ──────────────────────────────────────────────────────────
      ctx.beginPath();
      ctx.arc(C, C, C - 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(91,214,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Joueur ───────────────────────────────────────────────────────────
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(-playerYaw);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fillStyle = "#5bd6ff";
      ctx.fill();
      ctx.restore();

      // ── Nord ─────────────────────────────────────────────────────────────
      ctx.fillStyle = "rgba(155,184,204,0.7)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("N", C, 11);
    };

    // Throttle à intervalMs
    const iv = setInterval(draw, intervalMs);
    draw(); // dessin immédiat

    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, range, playerX, playerZ, playerYaw, entities, mapData, intervalMs]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        pointerEvents: "none",
      }}
    />
  );
});
Minimap.displayName = "Minimap";

/** Couleur d'une entité sur la minimap selon son type. */
function entityColor(entity: RadarEntity): string {
  switch (entity.type) {
    case "PLAYER":
      return "#60a5fa";
    case "MONSTER":
      return "#ff5a5a";
    case "NPC":
      return "#7dff9a";
    case "VEHICLE":
      return "#fbbf24";
    case "RESOURCE":
      return "#7dff9a";
    case "STRUCTURE":
      return "#c9a8ff";
    default:
      return "#9ca3af";
  }
}

/** Vérifie si une zone du monde est découverte (brouillard de guerre). */
function isAreaDiscovered(
  wx: number,
  wz: number,
  mapData: MapData
): boolean {
  if (!mapData.discoveredAreas || mapData.discoveredAreas.size === 0)
    return false;

  // Vérifie si la position est dans une zone découverte
  for (const zone of mapData.zones) {
    if (!zone.discovered) continue;
    const { min, max } = zone.bounds;
    if (wx >= min.x && wx <= max.x && wz >= min.z && wz <= max.z) {
      return true;
    }
  }
  return false;
}
