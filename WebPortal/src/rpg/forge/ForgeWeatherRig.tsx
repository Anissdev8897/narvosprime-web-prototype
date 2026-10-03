// forge/ForgeWeatherRig.tsx — Éclairage + ciel + brume d'une scène Forge.
//
// EXTRAIT de `ForgeBuilderScene` le 02/08/2026 pour corriger le constat M4 :
// l'ambiance réglée par l'auteur (angle solaire, preset, brume) n'était visible
// QUE dans l'éditeur. `ForgeBuiltMap` — ce que voit le joueur — n'avait aucun rig
// météo : la map publiée s'affichait sous l'éclairage par défaut, et le travail
// d'ambiance de l'auteur disparaissait à la publication.
//
// Pourquoi un fichier séparé plutôt qu'un simple `export` : `ForgeBuiltMap` tourne
// dans le JEU. Importer `ForgeBuilderScene` y ferait entrer tout l'éditeur —
// TransformControls, gizmos, navigateur d'assets — dans le bundle runtime.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Sky, Stars, Environment } from "@react-three/drei";
import * as THREE from "three";

/** Ambiance d'une scène Forge — persistée avec elle, rejouée à la publication. */
export interface ForgeWeather {
  /** Position du soleil sur son arc, en degrés (0 = horizon est, 90 = zénith). */
  sunAngle: number;
  /** Clé de `WEATHER` ci-dessous. */
  preset: string;
  /** Densité de brume ajoutée au preset (0 = aucune). */
  fogDensity: number;
  /** Ombres portées du soleil. */
  shadows: boolean;
}

/** Valeurs par défaut d'une scène sans ambiance enregistrée (scènes d'avant M4). */
export const DEFAULT_WEATHER: ForgeWeather = {
  sunAngle: 45, preset: "clear", fogDensity: 0, shadows: true,
};

// Presets MÉTÉO/CIEL : lumière + ciel (Sky/Stars/dégradé) + brouillard de teinte.
//   sky: 'day' Sky atmosphérique · 'night' étoilé · 'sunset' soleil bas chaud · 'space' fond profond.
export const WEATHER: Record<string, { color: string; intensity: number; ambient: number; sky: 'day' | 'overcast' | 'sunset' | 'night' | 'space'; fog: string }> = {
  clear:  { color: '#fff6e0', intensity: 1.5, ambient: 0.35, sky: 'day',      fog: '#bcd4ec' },
  cloudy: { color: '#cdd6e0', intensity: 0.75, ambient: 0.5,  sky: 'overcast', fog: '#aeb8c4' },
  sunset: { color: '#ffb877', intensity: 1.1, ambient: 0.4,  sky: 'sunset',   fog: '#e8a06a' },
  storm:  { color: '#5a6473', intensity: 0.35, ambient: 0.3,  sky: 'overcast', fog: '#3a4350' },
  fog:    { color: '#c0c8d0', intensity: 0.6, ambient: 0.55, sky: 'overcast', fog: '#c0c8d0' },
  night:  { color: '#5566aa', intensity: 0.35, ambient: 0.18, sky: 'night',    fog: '#070b1a' },
  space:  { color: '#aab4ff', intensity: 0.6, ambient: 0.22, sky: 'space',    fog: '#02030a' },
};

/** Lumière + ciel (jour/coucher/nuit étoilée/espace) + brume, pilotés par la météo. */
export function WeatherRig({ sunAngle, preset, fogDensity, shadows }: ForgeWeather) {
  const { scene } = useThree();
  const cfg = WEATHER[preset] ?? WEATHER.clear;
  const rad = (sunAngle * Math.PI) / 180;
  // Coucher de soleil → soleil bas forcé ; nuit/espace → soleil sous l'horizon (Sky sombre).
  const elev = cfg.sky === 'sunset' ? 6 : cfg.sky === 'night' || cfg.sky === 'space' ? -20 : Math.max(2, Math.sin(rad) * 80);
  const sunPos: [number, number, number] = [Math.cos(rad) * 80, elev, 40];
  const starry = cfg.sky === 'night' || cfg.sky === 'space';

  // Brume LIVE teintée par la météo.
  useEffect(() => {
    const fog = new THREE.FogExp2(new THREE.Color(cfg.fog).getHex(), fogDensity + (preset === 'fog' ? 0.012 : 0));
    scene.fog = fog;
    return () => { if (scene.fog === fog) scene.fog = null; };
  }, [scene, fogDensity, cfg.fog, preset]);

  return (
    <>
      <ambientLight intensity={cfg.ambient} color={starry ? '#8090d0' : '#ffffff'} />
      <directionalLight position={sunPos} intensity={cfg.intensity} color={cfg.color} castShadow={shadows}
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-far={200}
        shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} />
      <hemisphereLight args={[starry ? 0x202a55 : 0x87ceeb, 0x3a3a5c, starry ? 0.18 : 0.35]} />
      {cfg.sky === 'space'
        ? <color attach="background" args={['#02030a']} />
        : <Sky sunPosition={sunPos} turbidity={cfg.sky === 'overcast' ? 14 : cfg.sky === 'sunset' ? 8 : 3}
            rayleigh={cfg.sky === 'sunset' ? 3.5 : starry ? 0.2 : 1.2} mieCoefficient={0.005} mieDirectionalG={0.85} />}
      {starry && <Stars radius={300} depth={60} count={cfg.sky === 'space' ? 6000 : 3500} factor={6} saturation={0} fade speed={0.5} />}
      <Environment preset={cfg.sky === 'sunset' ? 'sunset' : cfg.sky === 'night' || cfg.sky === 'space' ? 'night' : cfg.sky === 'overcast' ? 'city' : 'park'} />
    </>
  );
}
