// ui/AnimDebugHud.tsx — Overlay de diagnostic ANIMATION / FSM / COLLISION.
//
// POURQUOI CE HUD EXISTE
//
// Trois pannes de cette session étaient invisibles depuis la console : un clip
// qui se rabattait silencieusement sur un fallback, deux couches d'animation qui
// se superposaient, et une machine à états bloquée. Chaque fois le symptôme
// visible ("ça a l'air figé") ne désignait pas la cause.
//
// Ce panneau montre l'ÉTAT RÉEL, pas une interprétation : la transition de FSM
// avec son horodatage, les clips actifs et leur poids, et si la pose accroupie
// est la vraie ou le repli procédural.
//
// Bascule : F9. Aucune allocation quand il est masqué.
import { useEffect, useRef, useState } from "react";
import type { PlayerState } from "../runtime/movement/playerState";
import { playerAnimDebug } from "../animation/playerAnimDebug";
import { staminaStore } from "../runtime/movement/staminaStore";
import { collisionWorld } from "../runtime/CollisionWorld";

/** Une transition d'état, conservée pour l'historique. */
interface Transition { from: string; to: string; at: number }

const MAX_HISTORY = 6;

interface Props {
  /** État du joueur (ref muté hors React — lu par sondage). */
  state: React.MutableRefObject<PlayerState>;
}

export function AnimDebugHud({ state }: Props) {
  const [visible, setVisible] = useState(false);
  const [, forceRender] = useState(0);
  const history = useRef<Transition[]>([]);
  const lastMove = useRef<string>("");
  const lastClimb = useRef<string>("");

  // Bascule F9.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F9" && !e.repeat) { e.preventDefault(); setVisible((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sondage à 10 Hz plutôt qu'à chaque frame : l'état vit dans des refs mutées
  // hors React, donc rien ne déclencherait un rendu — et 60 rendus/seconde pour
  // un panneau de debug coûteraient plus cher que ce qu'ils diagnostiquent.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      const s = state.current;
      if (s) {
        if (s.moveState !== lastMove.current) {
          history.current = [
            { from: lastMove.current || "—", to: s.moveState, at: Date.now() },
            ...history.current,
          ].slice(0, MAX_HISTORY);
          lastMove.current = s.moveState;
        }
        if (s.climbState !== lastClimb.current) {
          history.current = [
            { from: `climb:${lastClimb.current || "—"}`, to: `climb:${s.climbState}`, at: Date.now() },
            ...history.current,
          ].slice(0, MAX_HISTORY);
          lastClimb.current = s.climbState;
        }
      }
      forceRender((n) => n + 1);
    }, 100);
    return () => clearInterval(id);
  }, [visible, state]);

  if (!visible) return null;

  const s = state.current;
  const ctrl = playerAnimDebug.get();
  const loco = ctrl?.activeLocomotion ?? [];
  const crouchBad = ctrl?.isCrouchProcedural ?? false;
  const blendOff = ctrl != null && !ctrl.hasLocomotionBlend;
  const colliders = collisionWorld.colliderCount;

  const row = (label: string, value: string, warn = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ color: warn ? "#ff6b6b" : "#d8f5ff", fontWeight: warn ? 700 : 400 }}>{value}</span>
    </div>
  );

  return (
    <div
      className="fixed top-4 right-4 pointer-events-none select-none"
      style={{
        width: 320, padding: "10px 12px", zIndex: 60,
        background: "rgba(6,10,18,0.88)", border: "1px solid rgba(77,232,255,0.25)",
        borderRadius: 8, color: "#d8f5ff",
        font: "11px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace",
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{ color: "#4de8ff", fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
        ANIM DEBUG · F9
      </div>

      {row("moveState", s?.moveState ?? "—")}
      {row("climbState", s?.climbState ?? "none", (s?.climbState ?? "none") !== "none")}
      {row("vitesse", `${(s?.horizontalSpeed ?? 0).toFixed(2)} m/s`)}
      {row("intention", `x=${(s?.localMoveX ?? 0).toFixed(2)} z=${(s?.localMoveZ ?? 0).toFixed(2)}`)}
      {row("sol / course", `${s?.grounded ? "sol" : "air"} / ${s?.running ? "oui" : "non"}`)}
      {row("accroupi", s?.crouching ? "oui" : "non")}
      {row("endurance", `${Math.round(staminaStore.ratio * 100)}%${staminaStore.isExhausted ? " ÉPUISÉ" : ""}`, staminaStore.isExhausted)}

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", margin: "6px 0" }} />

      {/* Les deux pannes silencieuses qu'on veut voir immédiatement. */}
      {row("blend directionnel", blendOff ? "ABSENT (fallback)" : `${loco.length} clip(s)`, blendOff)}
      {row("pose accroupie", crouchBad ? "PROCÉDURALE (déforme)" : "capturée", crouchBad)}
      {row("action de base", ctrl?.currentAction ?? "—")}

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", margin: "6px 0" }} />

      {/* Collisions : zéro collider = le joueur traverse tout, en silence. */}
      {row("colliders", `${colliders}`, colliders === 0)}
      {row("moteur collision", collisionWorld.wasmActive ? "WASM (AABB)" : "Three.js (BVH)")}

      {loco.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {loco.map((l) => (
            <div key={l.name} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.75 }}>{l.name}</span>
              <span>{l.weight.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", margin: "6px 0" }} />
      <div style={{ opacity: 0.6, marginBottom: 2 }}>transitions</div>
      {history.current.length === 0
        ? <div style={{ opacity: 0.4 }}>—</div>
        : history.current.map((t) => (
            <div key={`${t.at}-${t.to}`} style={{ opacity: 0.85 }}>
              {t.from} <span style={{ color: "#4de8ff" }}>→</span> {t.to}
            </div>
          ))}
    </div>
  );
}
