// runtime/admin/useDraggablePanel.ts — rend un panneau admin DÉPLAÇABLE par son en-tête.
//
// Usage :
//   const { handleProps, transform } = useDraggablePanel();
//   <div style={{ ...panelStyle, transform }}>
//     <div {...handleProps}>…en-tête…</div>   // ← poignée de glissé
//   </div>
import { useCallback, useRef, useState } from "react";

export function useDraggablePanel() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos?.x ?? 0, oy: pos?.y ?? 0 };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ok */ }
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPos({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ok */ }
  }, []);

  const dragHandlers = { onPointerDown, onPointerMove, onPointerUp };
  const dragStyle = { cursor: "move", touchAction: "none" as const, userSelect: "none" as const };
  const transform = pos ? `translate(${pos.x}px, ${pos.y}px)` : undefined;
  return { dragHandlers, dragStyle, transform };
}
