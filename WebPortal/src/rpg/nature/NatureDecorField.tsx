// nature/NatureDecorField.tsx — un champ d'herbe décorative INSTANCIÉ (1 draw call).
//
// Extrait la géométrie + UV du GLB, applique la texture d'été (alphaTest pour les
// découpes), et disperse N instances calées au sol via une graine déterministe.
// Statique, sans interaction (décor pur).
import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { collisionWorld } from "../runtime/CollisionWorld";
import { DECOR_MODELS, type DecorField } from "./natureDecor";

/** PRNG déterministe (dispersion stable entre rendus). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function NatureDecorField({ field }: { field: DecorField }) {
  const model = DECOR_MODELS[field.model];
  const { scene } = useGLTF(model.glb);
  const texture = useTexture(model.tex);
  const mesh = useRef<THREE.InstancedMesh>(null);

  const { geometry, material, baseScale } = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !geo) geo = m.geometry; });
    const g = geo ?? new THREE.PlaneGeometry(0.001, 0.001);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
    g.computeBoundingBox();
    const h = Math.max(0.001, (g.boundingBox!.max.y - g.boundingBox!.min.y));
    return { geometry: g, material: mat, baseScale: model.targetSize / h };
  }, [scene, texture, model.targetSize]);

  // Construit les matrices d'instance (dispersion + snap au sol) une fois la map prête.
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const rng = mulberry32(field.seed);
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let k = 0; k < field.count; k++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * field.radius; // sqrt → densité uniforme dans le disque
      const x = field.cx + Math.cos(a) * r;
      const z = field.cz + Math.sin(a) * r;
      const gy = collisionWorld.getGroundY(x, z, 80);
      if (gy === null) continue; // pas de sol ici → on saute l'instance
      dummy.position.set(x, gy, z);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.scale.setScalar(baseScale * (0.75 + rng() * 0.6));
      dummy.updateMatrix();
      m.setMatrixAt(i++, dummy.matrix);
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
  }, [geometry, baseScale, field]);

  return <instancedMesh ref={mesh} args={[geometry, material, field.count]} castShadow receiveShadow frustumCulled={false} />;
}
