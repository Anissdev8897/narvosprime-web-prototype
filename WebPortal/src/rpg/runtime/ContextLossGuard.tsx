// runtime/ContextLossGuard.tsx — récupération du contexte WebGL.
//
// Un pic VRAM (assemblage de map + upload des textures PNJ 4K) peut faire perdre le contexte
// GPU. SANS gérer l'événement, le navigateur abandonne le contexte DÉFINITIVEMENT → map qui
// ne se charge jamais entièrement (chunks/PNJ jamais uploadés). On appelle preventDefault()
// sur `webglcontextlost` → le contexte est RESTAURABLE ; sur `webglcontextrestored`, three
// ré-initialise et ré-upload les objets de la scène au frame suivant → la map se recompose.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export function ContextLossGuard({ onLost, onRestored }: { onLost?: () => void; onRestored?: () => void }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const canvas = gl.domElement;
    const onCtxLost = (e: Event) => {
      e.preventDefault(); // CRUCIAL : sans ça le contexte est perdu pour de bon
      console.warn("[WebGL] contexte perdu — restauration tentée (preventDefault)");
      onLost?.();
    };
    const onCtxRestored = () => {
      console.info("[WebGL] contexte restauré — ré-upload de la scène");
      try { invalidate(); } catch { /* noop */ } // force un rendu → three ré-upload
      onRestored?.();
    };
    canvas.addEventListener("webglcontextlost", onCtxLost as EventListener, false);
    canvas.addEventListener("webglcontextrestored", onCtxRestored as EventListener, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", onCtxLost as EventListener);
      canvas.removeEventListener("webglcontextrestored", onCtxRestored as EventListener);
    };
  }, [gl, invalidate, onLost, onRestored]);
  return null;
}
