// professions/HarvestPlacementGizmo.tsx — placement d'un nœud de récolte au clic.
// Mirror de PortalPlacementGizmo : raycast sol via collisionWorld.raycastPoint →
// anneau de preview teinté par métier ; clic gauche → harvestNodeStore.add.
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { collisionWorld } from "../runtime/CollisionWorld";
import { harvestNodeAdminStore } from "./harvestNodeAdminStore";
import { harvestNodeStore } from "./harvestNodeStore";
import { getProfession } from "./professionCatalog";

export function HarvestPlacementGizmo({ mapId }: { mapId: string }) {
  const { camera, gl } = useThree();
  const ringRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
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
      if (p && ringRef.current) { ringRef.current.position.set(p.x, p.y + 0.03, p.z); ringRef.current.visible = true; }
      if (matRef.current) matRef.current.color.set(getProfession(harvestNodeAdminStore.get().profession).color);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const p = toGround(e); if (!p) return;
      const c = harvestNodeAdminStore.get();
      harvestNodeStore.add(mapId, { pos: [p.x, 0, p.z], profession: c.profession });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    return () => { el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerdown", onDown); };
  }, [camera, gl, mapId]);
  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.9, 1.4, 32]} />
      <meshBasicMaterial ref={matRef} color="#5cb85c" transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}
