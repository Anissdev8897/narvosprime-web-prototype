// runtime/movement/noclipUi.tsx — état UI du noclip DÉCOUPLÉ de RpgGameWorld.
//
// L'état physique vit dans camState.current.noclip (ref, zéro re-render). L'indicateur
// HUD avait besoin d'un état React → on le mettait dans RpgGameWorld via setState, ce qui
// RE-RENDAIT le composant ENORME à chaque F4 = freeze. On isole l'état UI dans un micro-store
// : seul <NoclipIndicator/> s'abonne → bascule instantanée, RpgGameWorld ne re-render pas.
//
// Le multiplicateur de vitesse (speedMult) est réglable via la molette en noclip.
import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";

let active = false;
let speedMult = 1.0;
const SPEED_MIN = 0.1;
const SPEED_MAX = 20.0;
const SPEED_STEP = 0.2;
const listeners = new Set<() => void>();
function notify() { for (const f of listeners) f(); }

export const noclipUi = {
  get(): boolean { return active; },
  set(v: boolean): void { if (v !== active) { active = v; if (!v) speedMult = 1.0; notify(); } },
  toggle(): void { noclipUi.set(!active); },
  getSpeed(): number { return speedMult; },
  adjustSpeed(delta: number): void {
    speedMult = Math.max(SPEED_MIN, Math.min(SPEED_MAX, speedMult + delta * SPEED_STEP));
    notify();
  },
  subscribe(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; },
};

// ── Noclip PAR DÉFAUT (réglé à la création de perso) ────────────────────────────
const DEFAULT_KEY = "narvos:noclip_default";
export const noclipDefault = {
  get(): boolean { try { return localStorage.getItem(DEFAULT_KEY) === "1"; } catch { return false; } },
  set(v: boolean): void { try { localStorage.setItem(DEFAULT_KEY, v ? "1" : "0"); } catch { /* quota */ } },
};

function useNoclipActive(): boolean {
  return useSyncExternalStore(noclipUi.subscribe, noclipUi.get, noclipUi.get);
}

function useNoclipSpeed(): number {
  return useSyncExternalStore(noclipUi.subscribe, noclipUi.getSpeed, noclipUi.getSpeed);
}

/** Bandeau NOCLIP — composant isolé, ne re-render QUE lui-même au toggle / molette. */
export function NoclipIndicator() {
  const isActive = useNoclipActive();
  const speed = useNoclipSpeed();

  // Molette → ajuste la vitesse uniquement quand noclip est actif + pointer lock
  useEffect(() => {
    if (!isActive) return;
    const onWheel = (e: WheelEvent) => {
      if (!document.pointerLockElement) return;
      e.preventDefault();
      noclipUi.adjustSpeed(e.deltaY < 0 ? 1 : -1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [isActive]);

  if (!isActive) return null;
  return (
    <div style={{
      position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
      zIndex: 55, pointerEvents: "none",
      background: "rgba(255,80,0,0.18)", border: "1px solid #ff5000aa",
      borderRadius: 6, padding: "3px 14px",
      color: "#ff8040", fontWeight: 900, fontSize: 12,
      letterSpacing: "0.25em", textTransform: "uppercase",
      fontFamily: "monospace", textShadow: "0 0 8px #ff5000",
      display: "flex", gap: 12, alignItems: "center",
    }}>
      <span>NOCLIP</span>
      <span style={{ color: "#ffd080", fontSize: 11 }}>×{speed.toFixed(1)}</span>
      <span style={{ opacity: 0.6, fontSize: 10 }}>Molette = vitesse · Space ▲ · Ctrl ▼ · F4 off</span>
    </div>
  );
}
