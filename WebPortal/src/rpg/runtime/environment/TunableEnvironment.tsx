// environment/TunableEnvironment.tsx — éclairage terrestre piloté par le store (live).
//
// Rend AUSSI le ciel procédural (Sky/Stars drei — zéro réseau, offline-safe) et la brume
// (FogExp2) selon la config de la map : Forge = coucher de soleil, Tower = brume, Orbital =
// espace étoilé. Donne à chaque map son ambiance d'environnement.
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Sky, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useEnvironment } from "./useEnvironment";
import { FallbackEnvironment } from "../lighting/FallbackEnvironment";
import type { SkyMode } from "./environmentTypes";
import { dayNightCycle } from "./dayNightCycle";
import { weatherSystem } from "./weatherSystem";
import { WeatherEffects } from "./WeatherEffects";
import { gameSettings } from "../../settings/gameSettings";

interface Props { mapId: string; shadowMapSize: number; }

// Réglages de ciel par mode (position soleil + turbidité/rayleigh) — miroir de l'éditeur.
const SKY: Record<Exclude<SkyMode, "none" | "space">, { sun: [number, number, number]; turbidity: number; rayleigh: number }> = {
  day:      { sun: [100, 60, 50],  turbidity: 3,  rayleigh: 1.2 },
  sunset:   { sun: [100, 6, 50],   turbidity: 8,  rayleigh: 3.5 },
  overcast: { sun: [60, 40, 50],   turbidity: 14, rayleigh: 1 },
  night:    { sun: [50, -20, 40],  turbidity: 6,  rayleigh: 0.2 },
};

function SkyAndFog({ sky, fog }: { sky: SkyMode; fog?: { color: string; density: number } }) {
  const { scene } = useThree();
  useEffect(() => {
    if (!fog) return;
    const f = new THREE.FogExp2(new THREE.Color(fog.color).getHex(), fog.density);
    scene.fog = f;
    return () => { if (scene.fog === f) scene.fog = null; };
  }, [scene, fog?.color, fog?.density]);

  if (sky === "space") return <Stars radius={400} depth={80} count={6000} factor={7} saturation={0} fade speed={0.4} />;
  if (sky === "none") return null;
  const s = SKY[sky];
  return (
    <>
      <Sky sunPosition={s.sun} turbidity={s.turbidity} rayleigh={s.rayleigh} mieCoefficient={0.005} mieDirectionalG={0.85} />
      {sky === "night" && <Stars radius={350} depth={60} count={3500} factor={6} saturation={0} fade speed={0.5} />}
    </>
  );
}

export function TunableEnvironment({ mapId, shadowMapSize }: Props) {
  const env = useEnvironment(mapId);
  const sky = env.sky ?? "none";
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const { gl, scene } = useThree();

  // Génère un envMap procédural pour que les matériaux métalliques reflètent
  // quelque chose (sans envMap, metalness > 0 → surface blanche/plate).
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileCubemapShader();
    const envScene = new THREE.Scene();
    const skyC = new THREE.Color(env.backgroundColor);
    skyC.lerp(new THREE.Color(0xffffff), 0.3);
    envScene.add(new THREE.HemisphereLight(skyC, new THREE.Color(env.backgroundColor), 1.0));
    envScene.background = skyC;
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    pmrem.dispose();
    return () => {
      if (scene.environment === envMap) scene.environment = null;
      envMap.dispose();
    };
  }, [gl, scene, env.backgroundColor]);

  useEffect(() => {
    dayNightCycle.setEnabled(gameSettings.video.dayNightCycle);
    dayNightCycle.setMap(mapId);
    weatherSystem.setMap(mapId);
    weatherSystem.setEnabled(gameSettings.video.dynamicWeather);
  }, [mapId]);

  useFrame((_, dt) => {
    dayNightCycle.setEnabled(gameSettings.video.dayNightCycle);
    weatherSystem.setEnabled(gameSettings.video.dynamicWeather);
    dayNightCycle.tick(dt);
    const dl = dirRef.current;
    if (dl) {
      const sp = dayNightCycle.getSunPosition();
      dl.position.set(sp[0], sp[1], sp[2]);
    }
  });

  return (
    <>
      <color attach="background" args={[env.backgroundColor]} />
      <ambientLight intensity={env.ambientIntensity} />
      <directionalLight
        ref={dirRef}
        position={[10, 20, 8]} intensity={env.sunIntensity} color={env.sunColor} castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-near={0.5} shadow-camera-far={200}
        shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60}
      />
      <FallbackEnvironment preset={env.preset} />
      <SkyAndFog sky={sky} fog={env.fog} />
      <WeatherEffects />
    </>
  );
}
