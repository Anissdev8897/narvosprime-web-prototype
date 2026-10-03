// ui/TimeHud.tsx — horloge in-game (heure de la journée virtuelle).
//
// Affiche l'heure du cycle jour/nuit en bas à droite, icône soleil/lune selon
// la phase. Masqué quand le cycle est désactivé ou en espace.
import { useSyncExternalStore } from "react";
import { dayNightCycle } from "../runtime/environment/dayNightCycle";

const subscribe = (cb: () => void) => dayNightCycle.subscribe(cb);
const getSnapshot = () => dayNightCycle.getSnapshot();

function hourLabel(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeIcon(h: number): string {
  if (h >= 6 && h < 18) return "☀️";   // soleil
  if (h >= 18 && h < 20) return "🌅";   // coucher
  return "🌙";                           // lune
}

export function TimeHud() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!state.enabled) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 16,
      right: 16,
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      background: "rgba(0,0,0,0.55)",
      borderRadius: 6,
      backdropFilter: "blur(4px)",
      zIndex: 40,
      pointerEvents: "none",
      fontFamily: "monospace",
      fontSize: 13,
      color: "#e2e8f0",
      letterSpacing: "0.06em",
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{timeIcon(state.hour)}</span>
      <span>{hourLabel(state.hour)}</span>
    </div>
  );
}
