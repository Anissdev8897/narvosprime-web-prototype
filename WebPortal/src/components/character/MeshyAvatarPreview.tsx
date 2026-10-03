// components/character/MeshyAvatarPreview.tsx — aperçu 3D d'un avatar Meshy
// (soldat) dans l'écran de création : modèle qui tourne + anim idle partagée.
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { AnimationController } from "../../rpg/animation/AnimationController";
import { getNpcModelPath } from "../../rpg/loaders/assetManifest";
import { ownAnimPath, ownAnimScale } from "../../rpg/characters/playerAvatars";
import { RendererRegistrar } from "../../rpg/loaders/RendererRegistrar";

const ANIM_SOURCE = getNpcModelPath("soldat_humain");

// Aperçu d'un avatar à RIG PROPRE (RobotGirl…) : charge SON GLB + SES anims embarquées,
// normalisé par bounding-box (échelle source inconnue). N'emprunte PAS le chemin Meshy
// (qui n'existe pas pour ces persos → 404 → crash du Canvas de création).
function OwnAnimPreviewModel({ path, scaleMul = 1 }: { path: string; scaleMul?: number }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(path);
  const { object, scale } = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    // Matrices monde à jour AVANT mesure (clone jamais rendu) → bbox correcte.
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    return { object: c, scale: (1.8 / h) * scaleMul }; // hauteur cible ≈ 1.8 m (cohérent caméra)
  }, [scene, scaleMul]);
  const ctrl = useRef<AnimationController | null>(null);

  useEffect(() => {
    if (group.current && animations.length > 0) {
      ctrl.current = new AnimationController(group.current, animations, { initial: "idle" });
      return () => ctrl.current?.dispose();
    }
  }, [object, animations]);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.4;
    ctrl.current?.update(dt);
  });

  return (
    <group ref={group}>
      <primitive object={object} scale={scale} />
    </group>
  );
}

function PreviewModel({ modelId }: { modelId: string }) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(getNpcModelPath(modelId));
  const { animations } = useGLTF(ANIM_SOURCE);
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const ctrl = useRef<AnimationController | null>(null);

  useEffect(() => {
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
    if (group.current && animations.length > 0) {
      ctrl.current = new AnimationController(group.current, animations, { initial: "idle" });
      return () => ctrl.current?.dispose();
    }
  }, [cloned, animations]);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.4;
    ctrl.current?.update(dt);
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
    </group>
  );
}

export function MeshyAvatarPreview({ modelId }: { modelId: string }) {
  return (
    <Canvas shadows camera={{ position: [0, 1.2, 3], fov: 45 }} style={{ width: "100%", height: "100%" }}>
      <RendererRegistrar />
      <color attach="background" args={["#0a0a14"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 2]} intensity={1.3} castShadow />
      <pointLight position={[-2, 1.5, 2]} color="#88aaff" intensity={1.5} distance={8} />
      <Suspense fallback={null}>
        <group position={[0, -0.95, 0]}>
          {ownAnimPath(modelId)
            ? <OwnAnimPreviewModel path={ownAnimPath(modelId)!} scaleMul={ownAnimScale(modelId)} />
            : <PreviewModel modelId={modelId} />}
          <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={6} blur={2} />
        </group>
      </Suspense>
      <OrbitControls enablePan={false} minDistance={1.5} maxDistance={6} target={[0, 0.9, 0]}
        minPolarAngle={Math.PI / 6} maxPolarAngle={Math.PI / 1.8} />
    </Canvas>
  );
}
