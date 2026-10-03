// components/character/CustomCharPreview3D.tsx — aperçu 3D d'un PERSO COMPOSÉ (Forge
// Personnages) dans l'écran de création : corps choisi + attachements + teinte + échelle,
// qui tourne, anim idle. Affiché quand l'avatar sélectionné est un cc_.
import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { HumanCharacter } from "../../rpg/characters/HumanCharacter";
import { MeshyPlayerCharacter } from "../../rpg/characters/MeshyPlayerCharacter";
import { OwnAnimPlayerCharacter } from "../../rpg/characters/OwnAnimPlayerCharacter";
import { ownAnimPath, ownAnimScale, isMeshyAvatar, avatarSharedRig } from "../../rpg/characters/playerAvatars";
import { customCharacterStore } from "../../rpg/characters/customCharacterStore";
import { createPlayerState } from "../../rpg/runtime/movement/playerState";
import type { CharacterConfig } from "../../rpg/types";
import { RendererRegistrar } from "../../rpg/loaders/RendererRegistrar";

function Spinner({ modelId, tint }: { modelId: string; tint: string }) {
  const group = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const cam = useRef(createPlayerState());
  const cc = customCharacterStore.get(modelId);
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * 0.4; });
  if (!cc) return null;
  const body = cc.baseAvatar;
  const config: CharacterConfig = { gender: "male", classId: "warrior_bruiser", outfitStyle: "Ranger", parts: {}, skinColor: "#e0ac69", tint: cc.tint || tint, modelId: body };
  return (
    <group ref={group}>
      {ownAnimPath(body) ? (
        <OwnAnimPlayerCharacter path={ownAnimPath(body)!} playerPosition={pos} cameraState={cam}
          scaleMul={ownAnimScale(body) * cc.scaleMult} sharedRig={avatarSharedRig(body)} offsetKey={body} attachments={cc.attachments} />
      ) : isMeshyAvatar(body) ? (
        <MeshyPlayerCharacter modelId={body} playerPosition={pos} cameraState={cam} attachments={cc.attachments} scaleMult={cc.scaleMult} />
      ) : (
        <HumanCharacter config={config} playerPosition={pos} cameraState={cam} attachments={cc.attachments} scaleMult={cc.scaleMult} />
      )}
    </group>
  );
}

export function CustomCharPreview3D({ modelId, tint }: { modelId: string; tint: string }) {
  return (
    <Canvas shadows camera={{ position: [0, 1.2, 3], fov: 45 }} style={{ width: "100%", height: "100%" }}>
      <RendererRegistrar />
      <color attach="background" args={["#0a0a14"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 2]} intensity={1.3} castShadow />
      <pointLight position={[-2, 1.5, 2]} color="#88aaff" intensity={1.5} distance={8} />
      <Suspense fallback={null}>
        <group position={[0, 0, 0]}>
          <Spinner modelId={modelId} tint={tint} />
          <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={6} blur={2} />
        </group>
      </Suspense>
      <OrbitControls enablePan={false} minDistance={1.5} maxDistance={6} target={[0, 0.9, 0]}
        minPolarAngle={Math.PI / 6} maxPolarAngle={Math.PI / 1.8} />
    </Canvas>
  );
}
