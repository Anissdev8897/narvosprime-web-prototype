// WebPortal/src/rpg/runtime/world-events/eventDirector.ts
// Générateur d'événements procéduraux du monde (Prompt 12 v2 — pos + durationMs).
// Logique PURE : RNG injecté, fonctions exposées pour tests, classe gère le timing.
import type { WorldEventKind, WorldEvents, FactionId } from '../core/worldTypes';
import { FACTIONS } from '../../factions/factions';
import * as THREE from 'three';
import { SPACE_BOUNDARY_RADIUS } from '../SpaceEnvironment';

export type WorldEventEmission = WorldEvents['world:eventStarted'];

// Table de poids (somme = 15). `boss_sighting` rare (1/15 ≈ 6,7 %).
const WEIGHTS: ReadonlyArray<readonly [WorldEventKind, number]> = [
  ['convoy', 4],
  ['distress', 3],
  ['anomaly', 3],
  ['solar_storm', 2],
  ['wreck', 2],
  ['boss_sighting', 1],
];
const TOTAL_WEIGHT = 15;
const COOLDOWN_MIN_MS = 20_000;
const COOLDOWN_MAX_MS = 30_000;
const FACTIONS_LIST: FactionId[] = ['akarlys', 'mezalayis', 'zayan'];

/** Durée de chaque kind d'événement en ms. */
const DURATION_BY_KIND: Record<WorldEventKind, number> = {
  convoy:       20_000,
  distress:     22_000,
  anomaly:      25_000,
  solar_storm:  18_000,
  wreck:        30_000,
  boss_sighting: 15_000,
};

/** Génère une position aléatoire dans l'arène spatiale (évite les bords à <20% et >80% du rayon). */
function randomArenaPos(rng: () => number): THREE.Vector3 {
  const a = rng() * Math.PI * 2;
  const r = SPACE_BOUNDARY_RADIUS * (0.2 + rng() * 0.6);
  const y = 30 + rng() * 40;
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
}

/** Sélection pondérée du type d'événement. Exporté pour les tests. */
export function pickKind(rng: () => number): WorldEventKind {
  const r = rng() * TOTAL_WEIGHT;
  let acc = 0;
  for (const [k, w] of WEIGHTS) {
    acc += w;
    if (r < acc) return k;
  }
  return 'convoy'; // garde-fou flottant (somme atteinte sans match)
}

/** Construit une émission complète (titre, couleur, faction, pos, durationMs). Exporté pour les tests. */
export function buildEvent(rng: () => number): WorldEventEmission {
  const kind = pickKind(rng);
  const pos = randomArenaPos(rng);
  const durationMs = DURATION_BY_KIND[kind];
  switch (kind) {
    case 'convoy':
      return { kind, title: "🛸 Un convoi marchand traverse l'orbital", color: '#c0d4e0', pos, durationMs };
    case 'distress': {
      const idx = Math.min(FACTIONS_LIST.length - 1, Math.floor(rng() * FACTIONS_LIST.length));
      const f = FACTIONS_LIST[idx];
      return {
        kind, faction: f,
        title: `📡 Signal de détresse — ${FACTIONS[f].name}`,
        color: FACTIONS[f].color,
        pos, durationMs,
      };
    }
    case 'anomaly':
      return { kind, title: '🌀 Anomalie spatiale détectée', color: '#c084fc', pos, durationMs };
    case 'solar_storm':
      return { kind, title: '⚡ Tempête solaire imminente', color: '#ffd070', pos, durationMs };
    case 'wreck':
      return { kind, title: '💥 Épave détectée — secteur orbital', color: '#ff8a4c', pos, durationMs };
    case 'boss_sighting':
      return { kind, title: '👹 Sentinelle ennemie détectée', color: '#ef4444', pos, durationMs };
  }
}

/** Réalisateur d'événements : gère le timing (cooldown) et appelle les fonctions pures. */
export class EventDirector {
  private nextAt: number;
  private defaultRng: () => number;

  constructor(rng: () => number = Math.random, now: number = 0) {
    this.defaultRng = rng;
    this.nextAt = now + this.computeCooldown(rng);
  }

  /** Évalue à `now`. Retourne 0 ou 1 émission. */
  tick(now: number, rng?: () => number): WorldEventEmission[] {
    const r = rng ?? this.defaultRng;
    if (now < this.nextAt) return [];
    const event = buildEvent(r);
    this.nextAt = now + this.computeCooldown(r);
    return [event];
  }

  private computeCooldown(rng: () => number): number {
    return COOLDOWN_MIN_MS + rng() * (COOLDOWN_MAX_MS - COOLDOWN_MIN_MS);
  }
}
