// WebPortal/src/rpg/runtime/world-events/WorldEventsRenderer.tsx
// Composant R3F : visualise les événements monde actifs dans le Canvas orbital.
// Monté DANS le <Canvas>, à côté de <SpaceWarfare />.
// Pas de tests : validation visuelle uniquement.
import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { eventBus } from '../core/EventBus';
import { worldEventsState } from './worldEventsState';
import type { ActiveEvent } from './worldEventsState';
import type { WorldEventKind } from '../core/worldTypes';

// ── Throttle : rafraîchissement de l'état à ~5 fps (200 ms) ─────────────────
const REFRESH_MS = 200;

// ── Géométries pré-créées (évite les recréations à chaque render) ─────────────
const GEO_CONE    = new THREE.ConeGeometry(1, 3, 6);
const GEO_SPHERE  = new THREE.SphereGeometry(1, 8, 8);
const GEO_BOX     = new THREE.BoxGeometry(2, 1, 3);

// ── Particules solar_storm : positions fixes dans une sphère unitaire ─────────
const STORM_COUNT = 50;
function makeSolarStormPositions(): Float32Array {
  const arr = new Float32Array(STORM_COUNT * 3);
  for (let i = 0; i < STORM_COUNT; i++) {
    const phi   = Math.acos(2 * Math.random() - 1);
    const theta = 2 * Math.PI * Math.random();
    const r     = 5 * Math.cbrt(Math.random()); // distribution volumétrique
    arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    arr[i * 3 + 2] = r * Math.cos(phi);
  }
  return arr;
}
const STORM_POSITIONS = makeSolarStormPositions();

// ────────────────────────────────────────────────────────────────────────────
// Sous-composants par kind
// ────────────────────────────────────────────────────────────────────────────

function ConvoyMarker({ pos }: { pos: THREE.Vector3 }) {
  return (
    <mesh position={pos} geometry={GEO_CONE}>
      <meshStandardMaterial
        color="#c0d4e0"
        emissive="#c0d4e0"
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}

function DistressMarker({ pos, color, t }: { pos: THREE.Vector3; color: string; t: number }) {
  const scale = 1.5 + 0.4 * Math.sin(t * 4);
  return (
    <mesh position={pos} geometry={GEO_SPHERE} scale={scale}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}

function AnomalyMarker({ pos, t }: { pos: THREE.Vector3; t: number }) {
  const scale = 4 + 0.6 * Math.sin(t * 2.5);
  return (
    <mesh position={pos} geometry={GEO_SPHERE} scale={scale}>
      <meshStandardMaterial
        color="#c084fc"
        emissive="#c084fc"
        emissiveIntensity={0.6}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function SolarStormMarker({ pos }: { pos: THREE.Vector3 }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(STORM_POSITIONS.slice(), 3));
    return g;
  }, []);

  return (
    <points position={pos} geometry={geo}>
      <pointsMaterial
        color="#ffd070"
        size={0.4}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={0.9}
      />
    </points>
  );
}

function WreckMarker({ pos }: { pos: THREE.Vector3 }) {
  return (
    <mesh position={pos} geometry={GEO_BOX}>
      <meshStandardMaterial color="#444444" roughness={0.9} />
    </mesh>
  );
}

function BossSightingMarker({ pos, t }: { pos: THREE.Vector3; t: number }) {
  const pulseScale = 1 + 0.08 * Math.sin(t * 5);
  return (
    <group position={pos}>
      {/* Sphère principale rouge */}
      <mesh geometry={GEO_SPHERE} scale={3 * pulseScale}>
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={0.7}
        />
      </mesh>
      {/* Halo additif (BackSide, légèrement plus grand) */}
      <mesh geometry={GEO_SPHERE} scale={3 * pulseScale * 1.3}>
        <meshStandardMaterial
          color="#ef4444"
          side={THREE.BackSide}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Dispatcher : sélectionne le sous-composant selon kind
// ────────────────────────────────────────────────────────────────────────────

function EventMarker({ event, t }: { event: ActiveEvent; t: number }) {
  const { payload } = event;
  if (!payload.pos) return null;
  const pos = payload.pos;
  const kind: WorldEventKind = payload.kind;

  switch (kind) {
    case 'convoy':
      return <ConvoyMarker pos={pos} />;
    case 'distress':
      return <DistressMarker pos={pos} color={payload.color} t={t} />;
    case 'anomaly':
      return <AnomalyMarker pos={pos} t={t} />;
    case 'solar_storm':
      return <SolarStormMarker pos={pos} />;
    case 'wreck':
      return <WreckMarker pos={pos} />;
    case 'boss_sighting':
      return <BossSightingMarker pos={pos} t={t} />;
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Composant principal
// ────────────────────────────────────────────────────────────────────────────

export function WorldEventsRenderer() {
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const lastRefreshRef = useRef<number>(0);
  const timeRef        = useRef<number>(0);

  // Abonnement à l'EventBus
  useEffect(() => {
    const off = eventBus.on('world:eventStarted', (payload) => {
      worldEventsState.add(payload, Date.now());
    });
    return () => {
      off();
      worldEventsState.clear();
    };
  }, []);

  // useFrame : update temps + rafraîchissement état à ~5 fps
  useFrame((_, delta) => {
    timeRef.current += delta;
    const now = Date.now();
    if (now - lastRefreshRef.current >= REFRESH_MS) {
      lastRefreshRef.current = now;
      setActiveEvents(worldEventsState.active(now).slice()); // slice pour forcer re-render
    }
  });

  return (
    <>
      {activeEvents.map((event, i) => (
        <EventMarker
          key={`${event.payload.kind}-${event.startedAt}-${i}`}
          event={event}
          t={timeRef.current}
        />
      ))}
    </>
  );
}
