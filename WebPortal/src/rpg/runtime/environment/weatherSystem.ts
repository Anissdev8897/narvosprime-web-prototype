// environment/weatherSystem.ts — Système météo dynamique (singleton hors-React).
//
// Gère les transitions entre états météo (clair, nuageux, pluie, orage, brouillard,
// neige). Fournit des modificateurs d'environnement que le cycle jour/nuit applique
// PAR-DESSUS sa sortie avant de pousser vers environmentStore.
//
// Exclut les mêmes maps statiques que dayNightCycle (orbital, donjon_furiste).

import type { EnvConfig, SkyMode } from "./environmentTypes";

// ── Types ────────────────────────────────────────────────────────────────────

export type WeatherType = "clear" | "cloudy" | "rain" | "storm" | "fog" | "snow";

interface WeatherDef {
  ambientMul: number;
  sunMul: number;
  fogDensityAdd: number;
  fogColorShift: [number, number, number];
  skyOverride: SkyMode | null;
  particleRate: number;
  lightning: boolean;
}

const WEATHER_DEFS: Record<WeatherType, WeatherDef> = {
  clear:  { ambientMul: 1,    sunMul: 1,    fogDensityAdd: 0,     fogColorShift: [0, 0, 0],      skyOverride: null,       particleRate: 0,    lightning: false },
  cloudy: { ambientMul: 0.8,  sunMul: 0.7,  fogDensityAdd: 0.003, fogColorShift: [-10, -5, 0],   skyOverride: "overcast", particleRate: 0,    lightning: false },
  rain:   { ambientMul: 0.6,  sunMul: 0.4,  fogDensityAdd: 0.008, fogColorShift: [-20, -15, -5], skyOverride: "overcast", particleRate: 800,  lightning: false },
  storm:  { ambientMul: 0.4,  sunMul: 0.25, fogDensityAdd: 0.012, fogColorShift: [-30, -25, -10],skyOverride: "overcast", particleRate: 1200, lightning: true },
  fog:    { ambientMul: 0.7,  sunMul: 0.5,  fogDensityAdd: 0.025, fogColorShift: [10, 10, 10],   skyOverride: "overcast", particleRate: 0,    lightning: false },
  snow:   { ambientMul: 0.75, sunMul: 0.6,  fogDensityAdd: 0.006, fogColorShift: [15, 15, 20],   skyOverride: "overcast", particleRate: 400,  lightning: false },
};

// ── Transitions pondérées ────────────────────────────────────────────────────

type TransitionRow = Partial<Record<WeatherType, number>>;
const TRANSITIONS: Record<WeatherType, TransitionRow> = {
  clear:  { clear: 0.5, cloudy: 0.3, fog: 0.1, rain: 0.1 },
  cloudy: { clear: 0.3, cloudy: 0.3, rain: 0.25, fog: 0.1, snow: 0.05 },
  rain:   { rain: 0.4, storm: 0.2, cloudy: 0.25, clear: 0.1, fog: 0.05 },
  storm:  { storm: 0.3, rain: 0.4, cloudy: 0.2, clear: 0.1 },
  fog:    { fog: 0.4, cloudy: 0.3, clear: 0.2, rain: 0.1 },
  snow:   { snow: 0.4, cloudy: 0.3, clear: 0.2, fog: 0.1 },
};

const MIN_DURATION_H = 1;
const MAX_DURATION_H = 4;
const TRANSITION_DURATION_H = 0.5;

const STATIC_MAPS = new Set(["orbital", "donjon_furiste"]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function pickNextWeather(current: WeatherType, seed: number): WeatherType {
  const row = TRANSITIONS[current];
  const entries = Object.entries(row) as [WeatherType, number][];
  let r = seededRandom(seed);
  for (const [w, weight] of entries) {
    r -= weight!;
    if (r <= 0) return w;
  }
  return entries[entries.length - 1][0];
}

function lerpDef(a: WeatherDef, b: WeatherDef, t: number): WeatherDef {
  const s = t * t * (3 - 2 * t);
  return {
    ambientMul: a.ambientMul + (b.ambientMul - a.ambientMul) * s,
    sunMul: a.sunMul + (b.sunMul - a.sunMul) * s,
    fogDensityAdd: a.fogDensityAdd + (b.fogDensityAdd - a.fogDensityAdd) * s,
    fogColorShift: a.fogColorShift.map((v, i) => v + (b.fogColorShift[i] - v) * s) as [number, number, number],
    skyOverride: s < 0.5 ? a.skyOverride : b.skyOverride,
    particleRate: Math.round(a.particleRate + (b.particleRate - a.particleRate) * s),
    lightning: s > 0.7 ? b.lightning : a.lightning,
  };
}

// ── État singleton ──────────────────────────────────────────────────────────

export interface WeatherState {
  current: WeatherType;
  next: WeatherType;
  transitioning: boolean;
  transitionProgress: number;
  particleRate: number;
  lightning: boolean;
  enabled: boolean;
}

let _current: WeatherType = "clear";
let _next: WeatherType = "clear";
let _timer = 0;
let _duration = 2;
let _transitioning = false;
let _transitionTimer = 0;
let _enabled = true;
let _activeMap = "";
let _seed = 42;
let _notifyTimer = 0;
const NOTIFY_INTERVAL = 0.25;
const _subs = new Set<() => void>();
let _snap: WeatherState = buildSnap();

function buildSnap(): WeatherState {
  const def = _transitioning
    ? lerpDef(WEATHER_DEFS[_current], WEATHER_DEFS[_next], _transitionTimer / TRANSITION_DURATION_H)
    : WEATHER_DEFS[_current];
  return {
    current: _current,
    next: _next,
    transitioning: _transitioning,
    transitionProgress: _transitioning ? _transitionTimer / TRANSITION_DURATION_H : 0,
    particleRate: def.particleRate,
    lightning: def.lightning,
    enabled: _enabled,
  };
}

function notifySubs(): void {
  _snap = buildSnap();
  for (const cb of _subs) cb();
}

function rollDuration(): number {
  return MIN_DURATION_H + seededRandom(_seed++) * (MAX_DURATION_H - MIN_DURATION_H);
}

// ── API publique ─────────────────────────────────────────────────────────────

export const weatherSystem = {
  tick(dt: number, gameHoursPerSecond: number): void {
    if (!_enabled || !_activeMap || STATIC_MAPS.has(_activeMap)) return;
    const dh = dt * gameHoursPerSecond;

    if (_transitioning) {
      _transitionTimer += dh;
      if (_transitionTimer >= TRANSITION_DURATION_H) {
        _current = _next;
        _transitioning = false;
        _transitionTimer = 0;
        _duration = rollDuration();
        _timer = 0;
        notifySubs();
      } else {
        _notifyTimer += dt;
        if (_notifyTimer >= NOTIFY_INTERVAL) {
          _notifyTimer = 0;
          notifySubs();
        }
      }
      return;
    }

    _timer += dh;
    if (_timer >= _duration) {
      _next = pickNextWeather(_current, _seed++);
      _transitioning = true;
      _transitionTimer = 0;
      _timer = 0;
      notifySubs();
    }
  },

  getModifiers(): Partial<EnvConfig> {
    if (!_enabled || STATIC_MAPS.has(_activeMap)) return {};
    const def = _transitioning
      ? lerpDef(WEATHER_DEFS[_current], WEATHER_DEFS[_next], _transitionTimer / TRANSITION_DURATION_H)
      : WEATHER_DEFS[_current];
    if (def.ambientMul === 1 && def.sunMul === 1 && def.fogDensityAdd === 0 && !def.skyOverride) return {};
    return { _weatherDef: def } as unknown as Partial<EnvConfig>;
  },

  applyToEnv(env: Partial<EnvConfig>): Partial<EnvConfig> {
    if (!_enabled || STATIC_MAPS.has(_activeMap)) return env;
    const def = _transitioning
      ? lerpDef(WEATHER_DEFS[_current], WEATHER_DEFS[_next], _transitionTimer / TRANSITION_DURATION_H)
      : WEATHER_DEFS[_current];
    if (def.ambientMul === 1 && def.sunMul === 1 && def.fogDensityAdd === 0) return env;

    const result = { ...env };
    if (result.ambientIntensity != null) result.ambientIntensity *= def.ambientMul;
    if (result.sunIntensity != null) result.sunIntensity *= def.sunMul;
    if (def.skyOverride) result.sky = def.skyOverride;
    if (result.fog) {
      result.fog = {
        color: shiftColor(result.fog.color, def.fogColorShift),
        density: result.fog.density + def.fogDensityAdd,
      };
    } else if (def.fogDensityAdd > 0.005) {
      result.fog = { color: shiftColor("#aaaaaa", def.fogColorShift), density: def.fogDensityAdd };
    }
    return result;
  },

  setMap(mapId: string): void { _activeMap = mapId; notifySubs(); },
  setEnabled(on: boolean): void { if (on !== _enabled) { _enabled = on; notifySubs(); } },
  setWeather(w: WeatherType): void { _current = w; _next = w; _transitioning = false; _timer = 0; notifySubs(); },

  subscribe(cb: () => void): () => void { _subs.add(cb); return () => { _subs.delete(cb); }; },
  getSnapshot(): WeatherState { return _snap; },

  reset(): void {
    _current = "clear"; _next = "clear"; _timer = 0; _duration = 2;
    _transitioning = false; _transitionTimer = 0; _seed = 42;
    notifySubs();
  },
};

function shiftColor(hex: string, shift: [number, number, number]): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + shift[0]));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + shift[1]));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + shift[2]));
  return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}
