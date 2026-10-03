// forge/ForgeMapBackdrop.tsx — rend une MAP EXISTANTE (chunks/GLB) en fond.
//
// Sert à ÉDITER une map déjà présente : on charge forge/orbital/tower/donjon en backdrop
// (étagé, anti-freeze) et on pose des objets par-dessus. `collision` ON en jeu (on marche
// dessus), OFF dans l'éditeur (simple repère visuel).
import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { MAPS, getMapChunks } from "../loaders/assetManifest";
import { qualityVariant } from "../loaders/assetQuality";
import { collisionWorld } from "../runtime/CollisionWorld";
import { configureGLTFLoader, registerRenderer } from "../loaders/sharedLoaders";

export function ForgeMapBackdrop({ mapId, collision = false, onReady }: { mapId: string; collision?: boolean; onReady?: () => void }) {
  const def = MAPS[mapId];
  const [parts, setParts] = useState<THREE.Object3D[]>([]);
  const loadedRef = useRef<THREE.Object3D[]>([]);
  const { gl } = useThree();
  const onReadyRef = useRef(onReady); onReadyRef.current = onReady;

  useEffect(() => {
    if (!def || def.path.startsWith("editor://")) { onReadyRef.current?.(); return; }
    let cancelled = false;
    const loader = new GLTFLoader();
    registerRenderer(gl);
    configureGLTFLoader(loader);
    const sources = getMapChunks(mapId) ?? [def.path];

    const acc: THREE.Object3D[] = [];
    loadedRef.current = acc;
    (async () => {
      for (let i = 0; i < sources.length; i++) {
        if (cancelled) return;
        try {
          const gltf = await loader.loadAsync(qualityVariant(sources[i]));
          if (cancelled) return;
          const s = gltf.scene;
          s.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.receiveShadow = true; });
          if (collision) { s.updateMatrixWorld(true); s.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) collisionWorld.add(m); }); }
          acc.push(s);
          setParts([...acc]);
          if (i === 0) onReadyRef.current?.(); // sol prêt → on entre
        } catch (e) { console.warn(`[ForgeMapBackdrop] chunk ${i} échec`, e); }
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
      onReadyRef.current?.();
    })();

    return () => {
      cancelled = true;
      for (const p of loadedRef.current) p.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
      });
      loadedRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, collision, gl]);

  return <>{parts.map((p, i) => <primitive key={`bd-${i}-${p.uuid}`} object={p} />)}</>;
}
