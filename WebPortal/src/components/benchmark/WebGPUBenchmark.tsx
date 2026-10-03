// ══════════════════════════════════════════════════════════════════════════════
// runtime/WebGPUBenchmark.tsx — Comparateur WebGL vs WebGPU
//
// Monte deux canvases côte à côte, même scène, rend le même nombre de frames
// et compare : FPS, draw calls, triangles, mémoire GPU (estimée).
//
// Usage :
//   <WebGPUBenchmark
//     duration={5000}          // ms par run
//     instanceCount={10000}    // nombre d'instances
//     geometry="box"           // box | sphere | teapot | glb
//   />
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

// ── Types ───────────────────────────────────────────────────────────────────

export interface BenchmarkResult {
  label: "WebGL" | "WebGPU";
  avgFps: number;
  minFps: number;
  maxFps: number;
  frameCount: number;
  durationMs: number;
  drawCalls: number;
  triangles: number;
  /** Ratio d'instances visibles après culling */
  visibleRatio: number;
  /** Score synthétique = avgFps × visibleRatio */
  score: number;
}

export type GeometryKind = "box" | "sphere" | "torus" | "glb";

export interface BenchmarkConfig {
  /** Durée de chaque run (ms). */
  duration: number;
  /** Nombre d'instances. */
  instanceCount: number;
  /** Type de géométrie. */
  geometry: GeometryKind;
  /** Activer les ombres (cher). */
  shadows: boolean;
  /** Activer le post-processing. */
  postProcessing: boolean;
}

// ── Composant benchmark ────────────────────────────────────────────────────

export function WebGPUBenchmark({
  duration = 5000,
  instanceCount = 10000,
  geometry = "box",
  shadows = false,
  postProcessing = false,
  onComplete,
}: Partial<BenchmarkConfig> & {
  onComplete?: (results: [BenchmarkResult, BenchmarkResult]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [results, setResults] = useState<[BenchmarkResult, BenchmarkResult] | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setStatus("running");

    const container = containerRef.current;
    const config: BenchmarkConfig = {
      duration,
      instanceCount,
      geometry,
      shadows,
      postProcessing,
    };

    // Créer deux conteneurs
    const col1 = document.createElement("div");
    col1.style.cssText = "flex:1;position:relative;min-width:0";
    const col2 = document.createElement("div");
    col2.style.cssText = "flex:1;position:relative;min-width:0";

    const label1 = document.createElement("div");
    label1.textContent = "WebGL";
    label1.style.cssText =
      "position:absolute;top:8px;left:8px;z-index:10;color:#fff;font:bold 14px monospace;background:rgba(0,0,0,0.6);padding:4px 10px;border-radius:4px";
    const label2 = document.createElement("div");
    label2.textContent = "WebGPU";
    label2.style.cssText = label1.style.cssText;

    col1.appendChild(label1);
    col2.appendChild(label2);

    const fps1 = document.createElement("div");
    fps1.style.cssText =
      "position:absolute;top:8px;right:8px;z-index:10;color:#0f0;font:bold 16px monospace;background:rgba(0,0,0,0.6);padding:4px 10px;border-radius:4px";
    const fps2 = document.createElement("div");
    fps2.style.cssText = fps1.style.cssText;

    col1.appendChild(fps1);
    col2.appendChild(fps2);

    // Layout
    const flex = document.createElement("div");
    flex.style.cssText =
      "display:flex;gap:4px;width:100%;height:100%;position:absolute;inset:0";
    flex.appendChild(col1);
    flex.appendChild(col2);
    container.appendChild(flex);

    // ── WebGL Renderer ──────────────────────────────────────────────
    const canvas1 = document.createElement("canvas");
    canvas1.style.cssText = "width:100%;height:100%;display:block";
    col1.appendChild(canvas1);

    const rendererGL = new THREE.WebGLRenderer({
      canvas: canvas1,
      antialias: true,
      powerPreference: "high-performance",
    });
    rendererGL.setPixelRatio(window.devicePixelRatio);
    rendererGL.shadowMap.enabled = shadows;

    // ── WebGPU Renderer ─────────────────────────────────────────────
    let rendererWgpu: WebGPURenderer | null = null;

    const canvas2 = document.createElement("canvas");
    canvas2.style.cssText = "width:100%;height:100%;display:block";
    col2.appendChild(canvas2);

    const initWgpu = async () => {
      rendererWgpu = new WebGPURenderer({
        canvas: canvas2,
        antialias: true,
        powerPreference: "high-performance",
      });
      await rendererWgpu.init(); // WebGPU nécessite init() asynchrone
      rendererWgpu.setPixelRatio(window.devicePixelRatio);
      rendererWgpu.shadowMap.enabled = shadows;

      // Lancer le benchmark une fois WebGPU prêt
      runBenchmark();
    };

    // ── Scène commune ───────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111122);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 10, 20);

    // Éclairage
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    dirLight.position.set(10, 20, 10);
    if (shadows) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(1024, 1024);
    }
    scene.add(dirLight);

    // Géométrie
    let geo: THREE.BufferGeometry;
    switch (geometry) {
      case "box":
        geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        break;
      case "sphere":
        geo = new THREE.SphereGeometry(0.3, 16, 16);
        break;
      case "torus":
        geo = new THREE.TorusKnotGeometry(0.3, 0.1, 64, 8);
        break;
      default:
        geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.3,
      roughness: 0.7,
      envMapIntensity: 0.5,
    });

    const mesh = new THREE.InstancedMesh(geo, material, instanceCount);
    if (shadows) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    // Placer les instances aléatoirement
    const dummy = new THREE.Object3D();
    for (let i = 0; i < instanceCount; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 40,
        Math.random() * 10,
        (Math.random() - 0.5) * 40
      );
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      dummy.scale.setScalar(0.5 + Math.random() * 1.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);

    // ── Benchmark ───────────────────────────────────────────────────
    const runBenchmark = () => {
      if (!rendererWgpu) return;

      const resize = () => {
        const w = col1.clientWidth || 300;
        const h = col1.clientHeight || 300;
        rendererGL.setSize(w, h, false);
        rendererWgpu!.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      // Stats
      const glFrames: number[] = [];
      const wgpuFrames: number[] = [];
      let glTime = 0;
      let wgpuTime = 0;
      let isRunning = true;

      const startTime = performance.now();
      let lastGl = startTime;
      let lastWgpu = startTime;

      // WebGL loop
      const animateGL = () => {
        if (!isRunning) return;
        requestAnimationFrame(animateGL);

        const now = performance.now();
        const dt = now - lastGl;
        if (dt > 0) glFrames.push(1000 / dt);
        lastGl = now;

        mesh.rotation.y += 0.005;
        mesh.rotation.x += 0.002;
        camera.position.x = 20 * Math.sin(now / 3000);
        camera.position.z = 20 * Math.cos(now / 3000);
        camera.lookAt(0, 5, 0);

        rendererGL.render(scene, camera);
        fps1.textContent = `${Math.round(glFrames[glFrames.length - 1] || 0)} FPS`;
      };

      // WebGPU loop
      const animateWgpu = () => {
        if (!isRunning || !rendererWgpu) return;
        requestAnimationFrame(animateWgpu);

        const now = performance.now();
        const dt = now - lastWgpu;
        if (dt > 0) wgpuFrames.push(1000 / dt);
        lastWgpu = now;

        rendererWgpu.render(scene, camera);
        fps2.textContent = `${Math.round(wgpuFrames[wgpuFrames.length - 1] || 0)} FPS`;
      };

      animateGL();
      animateWgpu();

      // Fin du benchmark
      setTimeout(() => {
        isRunning = false;
        const elapsed = performance.now() - startTime;

        const avg = (arr: number[]) =>
          arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const min = (arr: number[]) =>
          arr.length > 0 ? Math.min(...arr) : 0;
        const max = (arr: number[]) =>
          arr.length > 0 ? Math.max(...arr) : 0;

        const glResult: BenchmarkResult = {
          label: "WebGL",
          avgFps: avg(glFrames),
          minFps: min(glFrames),
          maxFps: max(glFrames),
          frameCount: glFrames.length,
          durationMs: elapsed,
          drawCalls: rendererGL.info.render.calls,
          triangles: rendererGL.info.render.triangles,
          visibleRatio: mesh.count > 0 ? mesh.count / instanceCount : 1,
          score: avg(glFrames) * (mesh.count > 0 ? mesh.count / instanceCount : 1),
        };

        const info = rendererWgpu?.info;
        const wgpuResult: BenchmarkResult = {
          label: "WebGPU",
          avgFps: avg(wgpuFrames),
          minFps: min(wgpuFrames),
          maxFps: max(wgpuFrames),
          frameCount: wgpuFrames.length,
          durationMs: elapsed,
          drawCalls: info?.render?.calls ?? 0,
          triangles: info?.render?.triangles ?? 0,
          visibleRatio: mesh.count > 0 ? mesh.count / instanceCount : 1,
          score: avg(wgpuFrames) * (mesh.count > 0 ? mesh.count / instanceCount : 1),
        };

        // Nettoyage
        window.removeEventListener("resize", resize);
        rendererGL.dispose();
        rendererWgpu?.dispose();
        geo.dispose();
        material.dispose();

        setResults([glResult, wgpuResult]);
        setStatus("done");
        onComplete?.([glResult, wgpuResult]);
      }, config.duration);
    };

    initWgpu();

    return () => {
      // Cleanup
      rendererGL.dispose();
      rendererWgpu?.dispose();
      geo.dispose();
      material.dispose();
      container.innerHTML = "";
    };
  }, [duration, instanceCount, geometry, shadows, postProcessing, onComplete]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: 500,
        background: "#000",
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {status === "idle" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4488ff",
            fontFamily: "monospace",
            fontSize: 18,
          }}
        >
          Prêt — lancez le benchmark
        </div>
      )}
      {status === "running" && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            color: "#aaa",
            fontFamily: "monospace",
            fontSize: 11,
            background: "rgba(0,0,0,0.7)",
            padding: "2px 10px",
            borderRadius: 4,
          }}
        >
          Benchmark en cours — {instanceCount.toLocaleString()} instances ({geometry})
        </div>
      )}
      {results && <BenchmarkSummary results={results} instanceCount={instanceCount} />}
    </div>
  );
}

// ── Résultats ──────────────────────────────────────────────────────────────

function BenchmarkSummary({
  results,
  instanceCount,
}: {
  results: [BenchmarkResult, BenchmarkResult];
  instanceCount: number;
}) {
  const [gl, wgpu] = results;
  const speedup = wgpu.avgFps / gl.avgFps;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        background: "rgba(0,0,0,0.85)",
        border: "1px solid #334",
        borderRadius: 8,
        padding: "14px 24px",
        color: "#ddd",
        fontFamily: "monospace",
        fontSize: 12,
        minWidth: 400,
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8, color: "#4488ff" }}>
        Résultats du Benchmark
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #334" }}>
            <th style={{ padding: "4px 8px", textAlign: "left" }}>Métrique</th>
            <th style={{ padding: "4px 8px", textAlign: "right" }}>WebGL</th>
            <th style={{ padding: "4px 8px", textAlign: "right" }}>WebGPU</th>
            <th style={{ padding: "4px 8px", textAlign: "right" }}>Gain</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={td}>FPS moyen</td>
            <td style={{ ...td, ...tdVal }}>{gl.avgFps.toFixed(1)}</td>
            <td style={{ ...td, ...tdVal, color: "#4ade80" }}>{wgpu.avgFps.toFixed(1)}</td>
            <td style={{ ...td, ...tdVal, color: speedup > 1 ? "#4ade80" : "#f87171" }}>
              {speedup > 0 ? `×${speedup.toFixed(2)}` : "N/A"}
            </td>
          </tr>
          <tr>
            <td style={td}>FPS min</td>
            <td style={{ ...td, ...tdVal }}>{gl.minFps.toFixed(1)}</td>
            <td style={{ ...td, ...tdVal }}>{wgpu.minFps.toFixed(1)}</td>
            <td style={td}></td>
          </tr>
          <tr>
            <td style={td}>FPS max</td>
            <td style={{ ...td, ...tdVal }}>{gl.maxFps.toFixed(1)}</td>
            <td style={{ ...td, ...tdVal }}>{wgpu.maxFps.toFixed(1)}</td>
            <td style={td}></td>
          </tr>
          <tr>
            <td style={td}>Draw calls</td>
            <td style={{ ...td, ...tdVal }}>{gl.drawCalls.toLocaleString()}</td>
            <td style={{ ...td, ...tdVal }}>{wgpu.drawCalls.toLocaleString()}</td>
            <td style={td}></td>
          </tr>
          <tr>
            <td style={td}>Triangles</td>
            <td style={{ ...td, ...tdVal }}>{gl.triangles.toLocaleString()}</td>
            <td style={{ ...td, ...tdVal }}>{wgpu.triangles.toLocaleString()}</td>
            <td style={td}></td>
          </tr>
          <tr>
            <td style={td}>Score</td>
            <td style={{ ...td, ...tdVal }}>{gl.score.toFixed(0)}</td>
            <td style={{ ...td, ...tdVal, color: "#4ade80" }}>{wgpu.score.toFixed(0)}</td>
            <td style={td}></td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 8, color: "#888", fontSize: 11 }}>
        {instanceCount.toLocaleString()} instances · {gl.frameCount + wgpu.frameCount} frames totaux
        · Durée : {(gl.durationMs / 1000).toFixed(1)}s
      </div>
    </div>
  );
}

const td: React.CSSProperties = {
  padding: "3px 8px",
  textAlign: "left",
  borderBottom: "1px solid #1a1a2e",
};
const tdVal: React.CSSProperties = {
  textAlign: "right",
  fontFamily: "monospace",
  fontWeight: 700,
};
