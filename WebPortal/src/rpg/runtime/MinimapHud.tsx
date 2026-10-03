// runtime/MinimapHud.tsx — minimap canvas 2D (AUCUN rendu 3D → zéro coût GPU).
//
// Dessin à 10 Hz (interval 100 ms, pas par frame) : disque sombre, Nord fixe, joueur
// au centre (flèche orientée yaw), ennemis vivants (rouge), nœuds de récolte dispo
// (vert), portails (losange violet). Échelle fixe : 60 m → bord. Toggle touche M
// (rebindable — Réglages → Touches).
import { useEffect, useRef } from "react";
import type * as THREE from "three";
import { npcRegistry } from "../npc/npcRegistry";
import { harvestRegistry } from "../professions/harvestRegistry";
import { portalStore } from "./donjon/portalStore";
import type { PlayerState } from "./movement/playerState";

const SIZE = 160;
const RANGE = 60; // m → rayon de la minimap

interface Props {
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  cameraState: React.MutableRefObject<PlayerState>;
  mapId: string;
}

export function MinimapHud({ playerPosition, cameraState, mapId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const iv = window.setInterval(() => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      const C = SIZE / 2;
      const scale = C / RANGE;
      const p = playerPosition.current;

      ctx.clearRect(0, 0, SIZE, SIZE);
      // Disque de fond + cerclage.
      ctx.beginPath(); ctx.arc(C, C, C - 1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(6,10,18,0.72)"; ctx.fill();
      ctx.strokeStyle = "rgba(91,214,255,0.45)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save();
      ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.clip();

      const dot = (wx: number, wz: number, color: string, r: number) => {
        const dx = (wx - p.x) * scale, dz = (wz - p.z) * scale;
        if (dx * dx + dz * dz > (C - 4) * (C - 4)) return;
        ctx.beginPath(); ctx.arc(C + dx, C + dz, r, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      };

      // Ennemis vivants (rouge) — broadphase, pas de scan global coûteux.
      npcRegistry.forEachEnemyInRadius(p, RANGE, (h) => {
        const ep = h.getPosition(); dot(ep.x, ep.z, "#ff5a5a", 3);
      });
      // Nœuds de récolte disponibles (vert).
      harvestRegistry.forEach((h) => {
        if (!h.available()) return;
        const np = h.getPosition(); dot(np.x, np.z, "#7dff9a", 2.5);
      });
      // Portails (losange violet).
      for (const portal of portalStore.list(mapId)) {
        const dx = (portal.pos[0] - p.x) * scale, dz = (portal.pos[2] - p.z) * scale;
        if (dx * dx + dz * dz > (C - 6) * (C - 6)) continue;
        ctx.save(); ctx.translate(C + dx, C + dz); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#c9a8ff"; ctx.fillRect(-3.5, -3.5, 7, 7); ctx.restore();
      }
      ctx.restore();

      // Joueur : flèche au centre, orientée par le yaw. Avant monde = (-sin yaw, -cos yaw)
      // et écran (x→droite, z→bas) → le triangle "pointe en haut" tourné de -yaw s'aligne
      // exactement sur l'avant (dérivation : rotate(θ) envoie (0,-1) sur (sinθ,-cosθ)).
      const yaw = cameraState.current.yaw;
      ctx.save(); ctx.translate(C, C); ctx.rotate(-yaw);
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
      ctx.fillStyle = "#5bd6ff"; ctx.fill();
      ctx.restore();

      // Nord.
      ctx.fillStyle = "rgba(155,184,204,0.9)"; ctx.font = "10px monospace"; ctx.textAlign = "center";
      ctx.fillText("N", C, 12);
    }, 100);
    return () => window.clearInterval(iv);
  }, [playerPosition, cameraState, mapId]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{ position: "fixed", top: 64, right: 70, zIndex: 55, width: SIZE, height: SIZE, pointerEvents: "none" }}
    />
  );
}
