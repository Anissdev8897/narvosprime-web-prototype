// environment/dayNightCycle.ts — Cycle jour/nuit dynamique (singleton hors-React).
//
// Pilote l'environnement visuel en interpolant entre 4 phases : aube, jour,
// coucher, nuit. Pousse ses valeurs dans environmentStore (qui déclenche le
// re-render de TunableEnvironment). Le cycle est DÉSACTIVABLE par map
// (orbital = espace, donjon = intérieur) et globalement (settings).
//
// Temps de jeu accéléré : 1 cycle complet = CYCLE_MINUTES minutes réelles.

import { environmentStore } from "./environmentStore";
import type { EnvConfig, SkyMode } from "./environmentTypes";
import { DEFAULT_ENV } from "./environmentTypes";
import type { FallbackPreset } from "../lighting/FallbackEnvironment";
import { weatherSystem } from "./weatherSystem";

// ── Configuration ───────────────────────────────────────────────────────────
const CYCLE_MINUTES = 20;
const CYCLE_SECONDS = CYCLE_MINUTES * 60;

interface PhaseKey {
  hour: number;
  sky: SkyMode;
  preset: FallbackPreset;
  ambient: number;
  sun: number;
  sunColor: [number, number, number];
  bgColor: [number, number, number];
  sunPos: [number, number, number];
  fogDensity: number;
  fogColor: [number, number, number];
}

const PHASES: PhaseKey[] = [
  // Aube (5h)
  { hour: 5,  sky: "sunset",  preset: "dawn",   ambient: 0.25, sun: 0.5,  sunColor: [255, 180, 130], bgColor: [40, 25, 50],   sunPos: [80, 4, 60],    fogDensity: 0.015, fogColor: [180, 140, 120] },
  // Matin (8h)
  { hour: 8,  sky: "day",     preset: "forest", ambient: 0.5,  sun: 1.3,  sunColor: [255, 245, 230], bgColor: [130, 180, 230], sunPos: [100, 60, 50],  fogDensity: 0.005, fogColor: [200, 215, 230] },
  // Midi (12h)
  { hour: 12, sky: "day",     preset: "forest", ambient: 0.6,  sun: 1.5,  sunColor: [255, 252, 245], bgColor: [140, 195, 250], sunPos: [20, 80, 30],   fogDensity: 0.003, fogColor: [220, 230, 245] },
  // Après-midi (16h)
  { hour: 16, sky: "day",     preset: "sunset", ambient: 0.5,  sun: 1.2,  sunColor: [255, 220, 180], bgColor: [120, 160, 210], sunPos: [-60, 40, 60],  fogDensity: 0.006, fogColor: [200, 190, 180] },
  // Coucher (18h30)
  { hour: 18.5, sky: "sunset", preset: "sunset", ambient: 0.35, sun: 0.9, sunColor: [255, 160, 100], bgColor: [60, 30, 50],   sunPos: [-100, 6, 50],  fogDensity: 0.012, fogColor: [160, 100, 80] },
  // Crépuscule (20h)
  { hour: 20, sky: "night",   preset: "night",  ambient: 0.2,  sun: 0.3,  sunColor: [120, 140, 200], bgColor: [10, 10, 25],   sunPos: [50, -10, 40],  fogDensity: 0.018, fogColor: [30, 30, 50] },
  // Nuit (23h)
  { hour: 23, sky: "night",   preset: "night",  ambient: 0.12, sun: 0.15, sunColor: [100, 120, 180], bgColor: [5, 5, 15],     sunPos: [50, -20, 40],  fogDensity: 0.02,  fogColor: [15, 15, 30] },
  // Fin de nuit (4h — boucle vers aube)
  { hour: 28, sky: "night",   preset: "night",  ambient: 0.15, sun: 0.2,  sunColor: [130, 130, 170], bgColor: [15, 12, 30],   sunPos: [70, -15, 50],  fogDensity: 0.018, fogColor: [40, 30, 50] },
];

const STATIC_MAPS = new Set(["orbital", "donjon_furiste"]);

function lerpN(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => v + (b[i] - v) * t);
}

function toHex(rgb: number[]): string {
  return "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

function findPhaseSegment(hour: number): { a: PhaseKey; b: PhaseKey; t: number } {
  for (let i = 0; i < PHASES.length - 1; i++) {
    if (hour >= PHASES[i].hour && hour < PHASES[i + 1].hour) {
      const span = PHASES[i + 1].hour - PHASES[i].hour;
      const t = (hour - PHASES[i].hour) / span;
      return { a: PHASES[i], b: PHASES[i + 1], t };
    }
  }
  return { a: PHASES[PHASES.length - 1], b: PHASES[0], t: 0 };
}

function interpolateEnv(a: PhaseKey, b: PhaseKey, t: number): Partial<EnvConfig> {
  const smoothT = t * t * (3 - 2 * t);
  const sc = lerpN(a.sunColor, b.sunColor, smoothT);
  const bg = lerpN(a.bgColor, b.bgColor, smoothT);
  const fc = lerpN(a.fogColor, b.fogColor, smoothT);
  const fd = a.fogDensity + (b.fogDensity - a.fogDensity) * smoothT;

  return {
    sky: smoothT < 0.5 ? a.sky : b.sky,
    preset: smoothT < 0.5 ? a.preset : b.preset,
    ambientIntensity: a.ambient + (b.ambient - a.ambient) * smoothT,
    sunIntensity: a.sun + (b.sun - a.sun) * smoothT,
    sunColor: toHex(sc),
    backgroundColor: toHex(bg),
    fog: { color: toHex(fc), density: fd },
  };
}

// ── Singleton ───────────────────────────────────────────────────────────────

export interface DayNightState {
  hour: number;
  enabled: boolean;
  paused: boolean;
  speedMul: number;
}

let _hour = 8;
let _enabled = true;
let _paused = false;
let _speedMul = 1;
let _activeMap = "";
let _ver = 0;
const _subs = new Set<() => void>();
let _snap: DayNightState = { hour: _hour, enabled: _enabled, paused: _paused, speedMul: _speedMul };

function rebuildSnap(): void {
  _snap = { hour: normalizeHour(_hour), enabled: _enabled, paused: _paused, speedMul: _speedMul };
  _ver++;
  for (const cb of _subs) cb();
}

function normalizeHour(h: number): number {
  return ((h % 24) + 24) % 24;
}

function pushToStore(mapId: string): void {
  if (STATIC_MAPS.has(mapId) || !_enabled) return;
  const h = normalizeHour(_hour);
  const cycleHour = h < 4 ? h + 24 : h;
  const seg = findPhaseSegment(cycleHour);
  const env = interpolateEnv(seg.a, seg.b, seg.t);
  const withWeather = weatherSystem.applyToEnv(env);
  environmentStore.set(mapId, withWeather);
}

const PUSH_INTERVAL = 0.25;
let _pushTimer = 0;

export const dayNightCycle = {
  tick(dt: number): void {
    if (!_enabled || _paused || !_activeMap || STATIC_MAPS.has(_activeMap)) return;
    const hoursPerSecond = 24 / CYCLE_SECONDS;
    _hour += dt * hoursPerSecond * _speedMul;
    if (_hour >= 28) _hour -= 24;

    weatherSystem.tick(dt, hoursPerSecond * _speedMul);

    _pushTimer += dt;
    if (_pushTimer >= PUSH_INTERVAL) {
      _pushTimer = 0;
      pushToStore(_activeMap);
      rebuildSnap();
    }
  },

  setMap(mapId: string): void {
    _activeMap = mapId;
    if (_enabled && !STATIC_MAPS.has(mapId)) {
      pushToStore(mapId);
    }
    rebuildSnap();
  },

  setEnabled(on: boolean): void {
    if (on === _enabled) return;
    _enabled = on;
    if (!on && _activeMap) {
      environmentStore.reset(_activeMap);
    } else if (on && _activeMap) {
      pushToStore(_activeMap);
    }
    rebuildSnap();
  },

  setHour(h: number): void {
    _hour = h;
    _pushTimer = PUSH_INTERVAL;
    if (_activeMap) pushToStore(_activeMap);
    rebuildSnap();
  },

  setPaused(p: boolean): void {
    _paused = p;
    rebuildSnap();
  },

  setSpeed(mul: number): void {
    _speedMul = Math.max(0.1, Math.min(10, mul));
    rebuildSnap();
  },

  getHour(): number { return normalizeHour(_hour); },

  getSunPosition(): [number, number, number] {
    const h = normalizeHour(_hour);
    const cycleHour = h < 4 ? h + 24 : h;
    const seg = findPhaseSegment(cycleHour);
    const t = seg.t * seg.t * (3 - 2 * seg.t);
    return lerpN(seg.a.sunPos, seg.b.sunPos, t) as [number, number, number];
  },

  subscribe(cb: () => void): () => void {
    _subs.add(cb);
    return () => { _subs.delete(cb); };
  },

  getSnapshot(): DayNightState { return _snap; },

  reset(): void {
    _hour = 8;
    _paused = false;
    _pushTimer = 0;
    if (_activeMap) environmentStore.reset(_activeMap);
    rebuildSnap();
  },
};
