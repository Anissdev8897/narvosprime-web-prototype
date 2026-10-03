// runtime/editor/TransformGizmo.tsx — manipulateur (drei TransformControls) pour
// repositionner/orienter un objet placé (PNJ ou portail) sur les axes X/Y/Z.
//
// Découplé de l'objet réel : on attache le gizmo à un GROUPE PROXY (avec un anneau
// repère) initialisé à la transform stockée. Au relâchement de la souris, on écrit
// la nouvelle position + rotation dans le store → l'objet se re-rend à jour.
// Monté uniquement quand un éditeur admin est ouvert (curseur libre, caméra figée).
import { useEffect, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  position: [number, number, number];
  rotation: [number, number, number];
  mode: "translate" | "rotate";
  onCommit: (pos: [number, number, number], rot: [number, number, number]) => void;
  color?: string;
}

export function TransformGizmo({ position, rotation, mode, onCommit, color = "#ffe96b" }: Props) {
  const [target, setTarget] = useState<THREE.Group | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useRef<any>(null);

  useEffect(() => {
    const c = controls.current;
    if (!c || !target) return;
    const onUp = () => {
      onCommit(
        [target.position.x, target.position.y, target.position.z],
        [target.rotation.x, target.rotation.y, target.rotation.z],
      );
    };
    // L'objet three TransformControls émet "mouseUp" à la fin d'un drag.
    c.addEventListener("mouseUp", onUp);
    return () => c.removeEventListener("mouseUp", onUp);
  }, [target, onCommit]);

  return (
    <>
      <group ref={setTarget} position={position} rotation={rotation}>
        {/* anneau repère de l'objet sélectionné */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <torusGeometry args={[1.0, 0.06, 8, 28]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} depthTest={false} />
        </mesh>
      </group>
      {target && (
        <TransformControls ref={controls} object={target} mode={mode} size={0.9} />
      )}
    </>
  );
}
