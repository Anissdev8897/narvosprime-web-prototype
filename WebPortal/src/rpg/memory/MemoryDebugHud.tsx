// ══════════════════════════════════════════════════════════════════════════════
// memory/MemoryDebugHud.tsx — HUD overlay for memory diagnostics
//
// Shows live memory metrics: JS heap, GPU textures/geometries, WASM heap,
// IndexedDB, pool status, and budget level.
// Integrates into StreamingDebugHud (F10) in the game.
//
// Standalone usage:
//   <MemoryDebugHud /> — renders a semi-transparent overlay
// Integrated:
//   imported and rendered inside StreamingDebugHud
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import {
  takeSnapshotAsync,
  subscribe,
  formatSnapshot,
  type MemorySnapshot,
} from "./MemoryTracker";
import { formatDisposeInfo, getDisposeInfo, type DisposeInfo } from "./DisposeTracker";
import { formatBudgetStatus, getLastBudgetStatus } from "./MemoryBudget";
import { formatPoolMetrics, type PoolMetrics, getPoolMetrics } from "./ObjectPool";

// ── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 48,
  left: 12,
  zIndex: 9001,
  background: "rgba(5, 8, 14, 0.92)",
  border: "1px solid #2a1a4a",
  borderRadius: 8,
  padding: "8px 12px",
  minWidth: 280,
  fontFamily: "Consolas, monospace",
  fontSize: 11,
  color: "#cbd5e1",
  pointerEvents: "none",
  lineHeight: 1.5,
};

// ── Component ────────────────────────────────────────────────────────────────

export function MemoryDebugHud() {
  const [snap, setSnap] = useState<MemorySnapshot | null>(null);
  const [dispose, setDispose] = useState<DisposeInfo | null>(null);
  const [pools, setPools] = useState<PoolMetrics | null>(null);

  // Subscribe to memory tracker polling
  useEffect(() => {
    const unsub = subscribe((s) => {
      setSnap(s);
      setDispose(getDisposeInfo());
      setPools(getPoolMetrics());
    });
    return unsub;
  }, []);

  // Fallback: if polling not started, take a snapshot anyway
  useEffect(() => {
    if (!snap) {
      takeSnapshotAsync().then(setSnap).catch(() => {});
      setDispose(getDisposeInfo());
      setPools(getPoolMetrics());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!snap) return null;

  const budget = getLastBudgetStatus();
  const budgetColor = budget?.level === "critical" ? "#f87171"
    : budget?.level === "warning" ? "#fbbf24" : "#4ade80";

  return (
    <div style={containerStyle}>
      <div style={{ color: "#e0a8ff", fontWeight: 700, marginBottom: 4 }}>
        🧠 MEMORY (P2)
      </div>
      <div>JS Heap: <b>{snap.jsHeapUsedMB.toFixed(1)} MB</b> / {snap.jsHeapTotalMB.toFixed(0)} MB</div>
      <div>
        GPU: <b style={{ color: snap.texturesGPU > 400 ? "#f87171" : "#4ade80" }}>
          {snap.texturesGPU} tex
        </b> · <b style={{ color: snap.geometriesGPU > 250 ? "#f87171" : "#4ade80" }}>
          {snap.geometriesGPU} geo
        </b> · {snap.drawCalls} dc · {(snap.triangles / 1000).toFixed(0)}k tri
      </div>
      <div>Programs: {snap.programsGPU} · WASM: <b>{snap.wasmHeapMB} MB</b></div>
      {snap.indexedDBSizeMB > 0 && <div>IndexedDB: {snap.indexedDBSizeMB.toFixed(1)} MB</div>}

      {dispose && (
        <div style={{ color: "#94a3b8" }}>
          Dispose: {dispose.texturesCreated}tex (‍{dispose.texturesDisposed}d) · {dispose.geometriesCreated}geo ({dispose.geometriesDisposed}d)
          {dispose.activeTextures > 100 && <span style={{ color: "#f87171" }}> ⚠</span>}
        </div>
      )}

      {budget && (
        <div>
          Budget: <b style={{ color: budgetColor }}>{budget.level.toUpperCase()}</b>
          {" "}{budget.textures.current}/{budget.textures.max} tex
          {" "}{budget.geometries.current}/{budget.geometries.max} geo
        </div>
      )}

      {pools && (
        <div style={{ color: "#64748b", fontSize: 10 }}>
          Pools: V3 {pools.vector3.active}/{pools.vector3.created} · V2 {pools.vector2.active}/{pools.vector2.created}
          {" "}· Q {pools.quaternion.active}/{pools.quaternion.created}
        </div>
      )}
    </div>
  );
}
