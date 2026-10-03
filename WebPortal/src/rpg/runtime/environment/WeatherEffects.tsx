// environment/WeatherEffects.tsx — Effets visuels météo (pluie, neige, éclairs).
//
// Composant R3F monté dans TunableEnvironment. Lit l'état météo via
// useSyncExternalStore et rend des particules procédurales + flashs lumineux.
// Aucun asset réseau — tout est généré en code.
import { useRef, useMemo, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { weatherSystem } from "./weatherSystem";
import { gameSettings } from "../../settings/gameSettings";

const subscribe = (cb: () => void) => weatherSystem.subscribe(cb);
const getSnapshot = () => weatherSystem.getSnapshot();

const PARTICLE_COUNT = 2000;
const SPREAD = 80;
const HEIGHT = 60;

function useParticleGeometry(count: number) {
  return useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SPREAD;
      positions[i * 3 + 1] = Math.random() * HEIGHT;
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);
}

function RainParticles({ rate }: { rate: number }) {
  const geo = useParticleGeometry(PARTICLE_COUNT);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state, dt) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const activeCount = Math.min(PARTICLE_COUNT, rate);
    const speed = 40;
    const cam = state.camera.position;

    for (let i = 0; i < activeCount; i++) {
      arr[i * 3 + 1] -= speed * dt;
      if (arr[i * 3 + 1] < -2) {
        arr[i * 3] = cam.x + (Math.random() - 0.5) * SPREAD;
        arr[i * 3 + 1] = cam.y + HEIGHT * 0.5 + Math.random() * 10;
        arr[i * 3 + 2] = cam.z + (Math.random() - 0.5) * SPREAD;
      }
    }
    pos.needsUpdate = true;
    if (matRef.current) matRef.current.opacity = Math.min(1, rate / 800) * 0.6;
  });

  if (rate <= 0) return null;
  return (
    <points ref={pointsRef} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        ref={matRef}
        color="#aabbcc"
        size={0.15}
        transparent
        opacity={0.5}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function SnowParticles({ rate }: { rate: number }) {
  const geo = useParticleGeometry(PARTICLE_COUNT);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state, dt) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const activeCount = Math.min(PARTICLE_COUNT, rate);
    const speed = 4;
    const cam = state.camera.position;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < activeCount; i++) {
      arr[i * 3] += Math.sin(time + i * 0.1) * 0.3 * dt;
      arr[i * 3 + 1] -= speed * dt;
      arr[i * 3 + 2] += Math.cos(time + i * 0.15) * 0.2 * dt;
      if (arr[i * 3 + 1] < -2) {
        arr[i * 3] = cam.x + (Math.random() - 0.5) * SPREAD;
        arr[i * 3 + 1] = cam.y + HEIGHT * 0.4 + Math.random() * 10;
        arr[i * 3 + 2] = cam.z + (Math.random() - 0.5) * SPREAD;
      }
    }
    pos.needsUpdate = true;
    if (matRef.current) matRef.current.opacity = Math.min(1, rate / 400) * 0.7;
  });

  if (rate <= 0) return null;
  return (
    <points ref={pointsRef} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        ref={matRef}
        color="#eeeeff"
        size={0.3}
        transparent
        opacity={0.6}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function LightningFlash() {
  const lightRef = useRef<THREE.PointLight>(null);
  const nextFlash = useRef(3 + Math.random() * 8);
  const flashTimer = useRef(0);
  const flashing = useRef(false);

  useFrame((_, dt) => {
    const light = lightRef.current;
    if (!light) return;

    if (flashing.current) {
      flashTimer.current -= dt;
      light.intensity = flashTimer.current > 0 ? 8 * (flashTimer.current / 0.15) : 0;
      if (flashTimer.current <= 0) {
        flashing.current = false;
        nextFlash.current = 2 + Math.random() * 10;
        light.intensity = 0;
      }
    } else {
      nextFlash.current -= dt;
      if (nextFlash.current <= 0) {
        flashing.current = true;
        flashTimer.current = 0.1 + Math.random() * 0.1;
        light.position.set(
          (Math.random() - 0.5) * 100,
          40 + Math.random() * 20,
          (Math.random() - 0.5) * 100,
        );
      }
    }
  });

  return <pointLight ref={lightRef} color="#c8d8ff" intensity={0} distance={200} decay={2} />;
}

export function WeatherEffects() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (!state.enabled || !gameSettings.video.dynamicWeather) return null;

  const isSnow = state.current === "snow" || (state.transitioning && state.next === "snow");
  const isRain = state.current === "rain" || state.current === "storm"
    || (state.transitioning && (state.next === "rain" || state.next === "storm"));

  return (
    <>
      {isRain && !isSnow && <RainParticles rate={state.particleRate} />}
      {isSnow && <SnowParticles rate={state.particleRate} />}
      {state.lightning && <LightningFlash />}
    </>
  );
}
