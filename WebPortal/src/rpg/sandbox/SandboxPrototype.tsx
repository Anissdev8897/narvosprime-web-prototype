// ══════════════════════════════════════════════════════════════════════════════
// sandbox/SandboxPrototype.tsx — ÉTAPE 1 du prototype sandbox : la scène vide.
//
//   ✓ un plan avec de quoi marcher (ombre portée = repère de contact au sol)
//   ✓ un ciel et UN soleil (lumière directionnelle unique, ombres nettes)
//   ✓ UN personnage jouant "idle" (SandboxCharacter)
//   ✓ OrbitControls pour inspecter (pas de contrôleur joueur en ÉTAPE 1)
//   ✓ <RendererRegistrar /> — OBLIGATOIRE dans tout Canvas qui charge des GLB,
//     sinon KTX2 transcode sur un renderer de sonde et les textures rendent
//     BLANC silencieusement (voir loaders/RendererRegistrar.tsx).
//
//   ✗ PAS de map (PuzzleMap, chunks, streaming)
//   ✗ PAS de PNJ, PAS de HUD, PAS d'arme, PAS de météo/cycle jour-nuit
//   ✗ AUCUN import depuis runtime/ — le jeu ne doit pas démarrer ici
//
// Ce composant est un ÉCRAN autonome : il se monte tel quel depuis App.tsx
// (voir .hermes/DEMANDES_CROISEES.md pour la ligne d'intégration — non
// appliquée par la sandbox elle-même, brief §5).
// ══════════════════════════════════════════════════════════════════════════════

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";

import { RendererRegistrar } from "../loaders/RendererRegistrar";
import { SandboxCharacter } from "./SandboxCharacter";

export default function SandboxPrototype() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#87a8c8" }}>
      <Canvas
        shadows
        camera={{ position: [3.2, 1.9, 4.6], fov: 50, near: 0.1, far: 400 }}
      >
        <RendererRegistrar />

        {/* ── Ciel + lumières : UNE source d'ombre (le soleil) ──────────── */}
        <Sky sunPosition={[60, 45, 30]} turbidity={6} rayleigh={1.2} />
        <hemisphereLight args={["#bcd6f0", "#5a6a4a", 0.55]} />
        <directionalLight
          castShadow
          position={[18, 26, 12]}
          intensity={2.2}
          color="#fff2dd"
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-camera-near={1}
          shadow-camera-far={80}
          shadow-bias={-0.0004}
        />

        {/* ── Le sol : un disque de 60 m, mat (ombre lisible) ───────────── */}
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[60, 64]} />
          <meshStandardMaterial color="#75876a" roughness={0.95} metalness={0} />
        </mesh>

        {/* ── LE personnage du prototype ────────────────────────────────── */}
        <Suspense fallback={null}>
          <SandboxCharacter />
        </Suspense>

        {/* Inspection libre (le contrôleur joueur arrive en ÉTAPE 2) */}
        <OrbitControls
          makeDefault
          target={[0, 1, 0]}
          maxPolarAngle={Math.PI / 2 - 0.02}
          minDistance={1.2}
          maxDistance={30}
        />
      </Canvas>
    </div>
  );
}
