// WebPortal/src/rpg/runtime/core/worldTypes.ts
import type * as THREE from 'three';

export type FactionId = 'akarlys' | 'mezalayis' | 'zayan';
export type FactionRelation = 'ally' | 'enemy' | 'neutral';
export type EntityKind = 'ship' | 'npc' | 'station' | 'player';
export type WeaponKind = 'laser' | 'missile';
export type WorldEventKind =
  | 'convoy' | 'distress' | 'anomaly' | 'solar_storm' | 'wreck' | 'boss_sighting';

/** Entité du monde indexée dans worldEntities (vaisseaux, stations, plus tard PNJ). */
export interface WorldEntity {
  id: string;
  kind: EntityKind;
  faction: FactionId | null;
  /** Position LIVE (mutée en place — ne pas cloner pour lire). */
  getPosition(): THREE.Vector3;
  isAlive(): boolean;
  applyDamage(amount: number, sourceId?: string): void;
}

/** Carte typée des événements du monde. Chaque futur système ajoute ses clés ici. */
export interface WorldEvents {
  'ship:spawned':   { id: string; faction: FactionId; pos: THREE.Vector3 };
  'ship:destroyed': { id: string; faction: FactionId; pos: THREE.Vector3; killerId?: string };
  'combat:hit':     { targetId: string; amount: number; weapon: WeaponKind; pos: THREE.Vector3; attackerFaction?: FactionId };
  'faction:relationChanged': { a: FactionId; b: FactionId; relation: FactionRelation };
  /** Événement narratif spontané du monde (convoi, signal de détresse, anomalie…). */
  'world:eventStarted': {
    kind: WorldEventKind;
    title: string;
    color: string;
    faction?: FactionId;
    pos?: THREE.Vector3;       // v2 : position spatiale pour visualisation 3D + radar
    durationMs?: number;       // v2 : durée d'affichage (ms)
  };
  /** Émote jouée par un personnage (broadcast multijoueur). */
  'emote:play': { entityId: string; emoteId: string; loop: boolean };
  'emote:cancel': { entityId: string };
  'map:warning': { message: string };
  /** Une quête vient d'être complétée (tous les objectifs remplis). */
  'quest:complete': { questId: string; title: string };
  /** Événement générique de progression d'objectif de quête.
   *  Routé par questBridge vers les méthodes record*() du questStore. */
  'quest:objective': { kind: string; [key: string]: unknown };
}
