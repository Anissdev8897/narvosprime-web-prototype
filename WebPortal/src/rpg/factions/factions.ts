// WebPortal/src/rpg/factions/factions.ts
import type { FactionId, FactionRelation } from '../runtime/core/worldTypes';
import { eventBus } from '../runtime/core/EventBus';

export interface FactionDef { id: FactionId; name: string; color: string; }

export const FACTIONS: Record<FactionId, FactionDef> = {
  akarlys:   { id: 'akarlys',   name: "Akar'lys",  color: '#0ea5e9' }, // humains — bleu
  mezalayis: { id: 'mezalayis', name: 'Mezalayis', color: '#f59e0b' }, // mercenaires — orange
  zayan:     { id: 'zayan',     name: 'Zayan',     color: '#22c55e' }, // aliens — vert
};

/** Clé symétrique triée pour une paire de factions. */
const pairKey = (a: FactionId, b: FactionId): string => [a, b].sort().join('|');

/** Matrice de relations MUTABLE (branche du futur système de factions évolutives). */
const relations = new Map<string, FactionRelation>([
  [pairKey('akarlys', 'mezalayis'), 'enemy'],
  [pairKey('akarlys', 'zayan'),     'enemy'],
  [pairKey('mezalayis', 'zayan'),   'neutral'],
]);

export function relation(a: FactionId, b: FactionId): FactionRelation {
  if (a === b) return 'ally';
  return relations.get(pairKey(a, b)) ?? 'neutral';
}

export function areEnemies(a: FactionId, b: FactionId): boolean {
  return relation(a, b) === 'enemy';
}

/** Modifie une relation et notifie via l'EventBus (Prompt 11 futur). */
export function setRelation(a: FactionId, b: FactionId, rel: FactionRelation): void {
  if (a === b) return;
  relations.set(pairKey(a, b), rel);
  eventBus.emit('faction:relationChanged', { a, b, relation: rel });
}
