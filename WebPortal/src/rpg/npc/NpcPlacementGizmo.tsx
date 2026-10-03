// npc/NpcPlacementGizmo.tsx — placement au clic dans la scène (monté si placementActive)
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { collisionWorld } from "../runtime/CollisionWorld";
import { npcAdminStore } from "./npcAdminStore";
import { npcPlacementStore } from "./npcPlacementStore";

export function NpcPlacementGizmo({ mapId }: { mapId: string }) {
  const { camera, gl } = useThree();
  const ringRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const toGround = (e: PointerEvent): THREE.Vector3 | null => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return collisionWorld.raycastPoint(ray.ray.origin, ray.ray.direction);
    };
    const onMove = (e: PointerEvent) => {
      const p = toGround(e);
      if (p && ringRef.current) { ringRef.current.position.set(p.x, p.y + 0.02, p.z); ringRef.current.visible = true; }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const p = toGround(e); if (!p) return;
      const c = npcAdminStore.get();
      npcPlacementStore.add(mapId, {
        // p.y = point d'impact RÉEL du raycast. Auparavant forcé à 0 : sur une map
        // dont le terrain n'est pas à l'altitude 0 (forge, tower…), tous les PNJ
        // étaient enregistrés au niveau de la mer et ne tenaient que par
        // l'accrochage au sol à l'exécution — d'où les PNJ mal placés.
        folder: c.folder, pos: [p.x, p.y, p.z], level: c.level,
        rank: c.rank, scaleMult: c.scaleMult, hpMult: c.hpMult, resistMult: c.resistMult,
        factionOverride: c.factionOverride, classIdOverride: c.classIdOverride,
        aggroRange: c.aggroRange, attackRange: c.attackRange,
      });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    return () => { el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerdown", onDown); };
  }, [camera, gl, mapId]);
  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.6, 0.9, 32]} />
      <meshBasicMaterial color="#ff5555" transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}
