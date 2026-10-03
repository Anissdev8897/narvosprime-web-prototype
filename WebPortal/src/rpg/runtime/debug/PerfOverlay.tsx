// runtime/debug/PerfOverlay.tsx — mesure FPS/1%low/draw calls (dev/admin).
// PerfProbe : capteur DANS le <Canvas> (lit gl.info + dt). PerfHud : afficheur DOM.
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";

interface Perf { fps: number; low1: number; ms: number; calls: number; tris: number; }
let perf: Perf = { fps: 0, low1: 0, ms: 0, calls: 0, tris: 0 };
const subs = new Set<() => void>();

// Capteur : à monter DANS le <Canvas>. Échantillonne ~0,5 s glissante.
export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const samples = useRef<number[]>([]);
  const acc = useRef(0);
  useFrame((_, dt) => {
    samples.current.push(dt);
    acc.current += dt;
    if (acc.current >= 0.5) {
      const s = samples.current; samples.current = [];
      const avg = s.reduce((a, b) => a + b, 0) / s.length;
      const sorted = [...s].sort((a, b) => b - a);
      const low1 = sorted[Math.min(sorted.length - 1, Math.floor(s.length * 0.01))] ?? avg;
      perf = {
        fps: Math.round(1 / avg),
        low1: Math.round(1 / low1),
        ms: +(avg * 1000).toFixed(1),
        calls: gl.info.render.calls,
        tris: gl.info.render.triangles,
      };
      acc.current = 0;
      for (const f of subs) f();
    }
  });
  return null;
}

// Afficheur : à monter HORS du <Canvas> (DOM).
export function PerfHud() {
  const [p, setP] = useState(perf);
  useEffect(() => { const f = () => setP({ ...perf }); subs.add(f); return () => { subs.delete(f); }; }, []);
  return (
    <div style={{ position: "fixed", top: 8, left: 8, zIndex: 300, font: "11px monospace",
      background: "rgba(0,0,0,0.7)", color: "#7CFC00", padding: "6px 9px", borderRadius: 6, pointerEvents: "none" }}>
      <div>FPS {p.fps} · 1%low {p.low1} · {p.ms}ms</div>
      <div>draws {p.calls} · tris {(p.tris / 1000).toFixed(0)}k</div>
    </div>
  );
}
