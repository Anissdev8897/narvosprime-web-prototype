// forge/RoadMesh.tsx — rend une ROUTE/CHEMIN (ruban le long d'une spline) + texture répétée.
//
// Construit la BufferGeometry via buildRoad (pur), applique couleur OU texture (wrap répété
// le long). Dispose la géométrie/texture au changement (anti-fuite VRAM, cf. terrain).
import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { buildRoad } from "./pathGeometry";
import type { ForgePath } from "./forgeSceneStore";

// Charge une texture optionnelle (hook conditionnel interdit → composant dédié).
function TexturedRoad({ geom, color, texture, repeat }: { geom: THREE.BufferGeometry; color: string; texture: string; repeat: number }) {
  const tex = useLoader(THREE.TextureLoader, texture);
  useEffect(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, repeat);
    tex.anisotropy = 8;
  }, [tex, repeat]);
  return <mesh geometry={geom} receiveShadow><meshStandardMaterial map={tex} color={color} roughness={0.95} metalness={0} side={THREE.DoubleSide} /></mesh>;
}

export function RoadMesh({ path }: { path: ForgePath }) {
  const buf = useMemo(() => buildRoad(path.points, path.width), [path.points, path.width]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(buf.positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(buf.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(buf.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [buf]);
  useEffect(() => () => geom.dispose(), [geom]); // libère la VRAM au remplacement

  if (buf.samples === 0) return null;
  const repeat = Math.max(1, Math.round((buf.samples * 0.5)));
  return path.texture
    ? <TexturedRoad geom={geom} color={path.color} texture={path.texture} repeat={repeat} />
    : <mesh geometry={geom} receiveShadow><meshStandardMaterial color={path.color} roughness={0.95} metalness={0} side={THREE.DoubleSide} /></mesh>;
}
