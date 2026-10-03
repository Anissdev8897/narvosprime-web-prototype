// ══════════════════════════════════════════════════════════════════════════════
// runtime/WebGPUCanvas.tsx — Canvas R3F configuré pour WebGPU
//
// Remplace le <Canvas> existant dans RpgGameWorld pour utiliser WebGPURenderer.
// Détecte automatiquement la disponibilité WebGPU et fallback sur WebGL.
//
// Usage dans RpgGameWorld :
//   import { WebGPUCanvas } from "./WebGPUCanvas";
//   ... remplacer <Canvas ...> par <WebGPUCanvas ...>
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";

// ── Détection WebGPU ────────────────────────────────────────────────────────

export type RendererBackend = "webgpu" | "webgl" | "unknown";

/**
 * Détecte si WebGPU est disponible dans le navigateur courant.
 * Résultat mis en cache (pas de re-request à chaque render).
 */
let _cachedBackend: RendererBackend | null = null;

export async function detectWebGPU(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

export async function detectBestBackend(): Promise<RendererBackend> {
  if (_cachedBackend) return _cachedBackend;
  const has = await detectWebGPU();
  _cachedBackend = has ? "webgpu" : "webgl";
  return _cachedBackend;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface WebGPUCanvasProps extends Omit<CanvasProps, "gl"> {
  /** Forcer un backend spécifique (outrepasse la détection). */
  forceBackend?: RendererBackend;
  /** Callback appelé avec le backend résolu. */
  onBackendResolved?: (backend: RendererBackend) => void;
  /** Props supplémentaires pour WebGPURenderer. */
  webgpuOptions?: {
    antialias?: boolean;
    samples?: number;
    alpha?: boolean;
    depth?: boolean;
    stencil?: boolean;
    powerPreference?: GPUPowerPreference;
  };
}

// ── Composant principal ─────────────────────────────────────────────────────

export function WebGPUCanvas({
  children,
  forceBackend,
  onBackendResolved,
  webgpuOptions,
  ...canvasProps
}: WebGPUCanvasProps) {
  const [backend, setBackend] = useState<RendererBackend>("unknown");

  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      const detected = forceBackend ?? (await detectBestBackend());
      if (!cancelled) {
        setBackend(detected);
        onBackendResolved?.(detected);
      }
    };

    detect();
    return () => {
      cancelled = true;
    };
  }, [forceBackend, onBackendResolved]);

  // Pendant la détection, ne pas monter le Canvas (évite un flash WebGL → WebGPU)
  if (backend === "unknown") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#02030a",
          color: "#4488ff",
          fontFamily: "monospace",
          fontSize: 14,
        }}
      >
        Détection du backend GPU…
      </div>
    );
  }

  // Props par défaut WebGPU
  const webgpuDefaults = {
    antialias: true,
    samples: 4,
    alpha: true,
    powerPreference: "high-performance" as GPUPowerPreference,
    ...webgpuOptions,
  };

  return (
    <Canvas
      {...canvasProps}
      gl={
        backend === "webgpu"
          ? ({ canvas }) =>
              new WebGPURenderer({
                canvas: canvas as HTMLCanvasElement,
                ...webgpuDefaults,
              })
          : undefined // ← WebGL par défaut (R3F le gère)
      }
    >
      {/* Indicateur de backend (dev only) */}
      {process.env.NODE_ENV === "development" && (
        <BackendIndicator backend={backend} />
      )}
      {children}
    </Canvas>
  );
}

// ── Indicateur de backend (dev) ────────────────────────────────────────────

function BackendIndicator({ backend }: { backend: RendererBackend }) {
  const { gl } = (window as any).__THREE_DEVTOOLS__ ?? {};
  return (
    <div
      style={{
        position: "fixed",
        bottom: 4,
        right: 4,
        zIndex: 9999,
        padding: "2px 8px",
        borderRadius: 4,
        fontFamily: "monospace",
        fontSize: 10,
        fontWeight: 700,
        background:
          backend === "webgpu"
            ? "rgba(74, 222, 128, 0.2)"
            : "rgba(251, 191, 36, 0.2)",
        color: backend === "webgpu" ? "#4ade80" : "#fbbf24",
        border: `1px solid ${
          backend === "webgpu" ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)"
        }`,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {backend === "webgpu" ? "WebGPU 🚀" : "WebGL"}
    </div>
  );
}

// ── Hook de diagnostic ──────────────────────────────────────────────────────

/**
 * Hook qui expose le backend actif et les stats de rendu.
 * Utile pour les écrans de diagnostic / settings.
 */
export function useBackendInfo() {
  const [backend, setBackend] = useState<RendererBackend>("unknown");
  const [adapterInfo, setAdapterInfo] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      const b = await detectBestBackend();
      setBackend(b);

      if (b === "webgpu" && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            const info = adapter.info;
            setAdapterInfo(
              `${info.vendor} ${info.architecture ?? ""} - ${info.description ?? ""}`.trim()
            );
          }
        } catch {
          // ignore
        }
      }
    };
    fetchInfo();
  }, []);

  return { backend, adapterInfo };
}

export default WebGPUCanvas;
