// runtime/debug/StressTestPanel.tsx — contrôle du stress-test (dev/admin, touche F9).
import { stressStore, useStress } from "./stressStore";

export function StressTestPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { count, behavior } = useStress();
  if (!open) return null;
  return (
    <div style={{ position: "fixed", top: 60, left: 16, zIndex: 260, width: 240, font: "12px monospace",
      background: "rgba(10,12,20,0.94)", border: "1px solid #7CFC0055", borderRadius: 10, padding: 14, color: "#dfffdf" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <b style={{ color: "#7CFC00", letterSpacing: "0.15em" }}>⚙ STRESS TEST</b>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #7CFC0055", color: "#7CFC00", borderRadius: 5, cursor: "pointer" }}>✕</button>
      </div>
      <div>Bots : <b>{count}</b></div>
      <input type="range" min={0} max={200} step={10} value={count}
        onChange={(e) => stressStore.set({ count: +e.target.value })} style={{ width: "100%" }} />
      <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
        {[25, 50, 100, 200].map((n) => (
          <button key={n} onClick={() => stressStore.set({ count: n })}
            style={{ flex: 1, cursor: "pointer", background: count === n ? "#7CFC00" : "#1a2a1a",
              color: count === n ? "#04120a" : "#9cdc9c", border: "1px solid #7CFC0040", borderRadius: 5, padding: "4px" }}>{n}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["wander", "shoot"] as const).map((b) => (
          <button key={b} onClick={() => stressStore.set({ behavior: b })}
            style={{ flex: 1, cursor: "pointer", background: behavior === b ? "#7CFC00" : "#1a2a1a",
              color: behavior === b ? "#04120a" : "#9cdc9c", border: "1px solid #7CFC0040", borderRadius: 5, padding: "4px" }}>
            {b === "wander" ? "errer" : "errer+tir"}</button>
        ))}
      </div>
      <button onClick={() => stressStore.set({ count: 0 })}
        style={{ width: "100%", marginTop: 8, cursor: "pointer", background: "#2a1414", color: "#ff9a9a",
          border: "1px solid #ff6a6a40", borderRadius: 5, padding: "5px" }}>Clear (0)</button>
    </div>
  );
}
