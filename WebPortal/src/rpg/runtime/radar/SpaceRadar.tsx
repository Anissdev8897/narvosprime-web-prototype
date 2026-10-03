// WebPortal/src/rpg/runtime/radar/SpaceRadar.tsx
// Radar spatial — HUD overlay canvas 2D, monté en orbital uniquement.
// Lit `worldEntities` + position joueur, dessine à ~15 fps via requestAnimationFrame.
// Aucun re-render React. Aucun composant R3F : c'est du canvas pur.
import { useRef, useEffect } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { worldEntities } from "../core/worldEntities";
import { FACTIONS } from "../../factions/factions";
import { SPACE_BOUNDARY_RADIUS } from "../SpaceEnvironment";
import { worldToRadar } from "./projection";
import { worldEventsState } from "../world-events/worldEventsState";

const RADAR_SIZE = 180;
const ARENA_RADIUS = SPACE_BOUNDARY_RADIUS; // 220 m
const REFRESH_MS = 67; // ≈ 15 fps

interface SpaceRadarProps {
  playerPosition: MutableRefObject<THREE.Vector3>;
}

export function SpaceRadar({ playerPosition }: SpaceRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastDraw = 0;
    const center = RADAR_SIZE / 2;

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - lastDraw < REFRESH_MS) return;
      lastDraw = t;

      // Fond
      ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);
      ctx.fillStyle = "rgba(5, 7, 12, 0.85)";
      ctx.fillRect(0, 0, RADAR_SIZE, RADAR_SIZE);

      // Cercle de l'arène
      ctx.strokeStyle = "rgba(91, 214, 255, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(center, center, center - 2, 0, Math.PI * 2);
      ctx.stroke();

      // Réticule (axes monde)
      ctx.strokeStyle = "rgba(91, 214, 255, 0.16)";
      ctx.beginPath();
      ctx.moveTo(center, 4); ctx.lineTo(center, RADAR_SIZE - 4);
      ctx.moveTo(4, center); ctx.lineTo(RADAR_SIZE - 4, center);
      ctx.stroke();

      // Vaisseaux (points colorés par faction)
      for (const e of worldEntities.all()) {
        if (!e.isAlive() || !e.faction) continue;
        const p = e.getPosition();
        const r = worldToRadar(p.x, p.z, ARENA_RADIUS, RADAR_SIZE);
        if (!r.inBounds) continue;
        ctx.fillStyle = FACTIONS[e.faction].color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Événements monde actifs (anneaux colorés)
      const evNow = Date.now();
      for (const ev of worldEventsState.active(evNow)) {
        if (!ev.payload.pos) continue;
        const er = worldToRadar(ev.payload.pos.x, ev.payload.pos.z, ARENA_RADIUS, RADAR_SIZE);
        if (!er.inBounds) continue;
        ctx.strokeStyle = ev.payload.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(er.x, er.y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Joueur (⊕ orange — cercle + croix)
      const pp = playerPosition.current;
      const pr = worldToRadar(pp.x, pp.z, ARENA_RADIUS, RADAR_SIZE);
      if (pr.inBounds) {
        ctx.strokeStyle = "#ffb050";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pr.x - 6, pr.y); ctx.lineTo(pr.x + 6, pr.y);
        ctx.moveTo(pr.x, pr.y - 6); ctx.lineTo(pr.x, pr.y + 6);
        ctx.stroke();
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playerPosition]);

  return (
    <div style={{
      position: "fixed", left: 16, bottom: 16, zIndex: 41, pointerEvents: "none",
      background: "rgba(5, 7, 12, 0.6)",
      border: "1px solid rgba(91, 214, 255, 0.35)",
      borderRadius: 10, padding: 6,
      boxShadow: "0 0 14px rgba(91, 214, 255, 0.18)",
    }}>
      <canvas ref={canvasRef} width={RADAR_SIZE} height={RADAR_SIZE}
        style={{ display: "block", borderRadius: 6 }} />
      <div style={{
        color: "#5bd6ff", fontSize: 10, textAlign: "center", marginTop: 4,
        fontFamily: "monospace", letterSpacing: "0.16em", fontWeight: 700,
      }}>
        SECTEUR ORBITAL
      </div>
    </div>
  );
}
