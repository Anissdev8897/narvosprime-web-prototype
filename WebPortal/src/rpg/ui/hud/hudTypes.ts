// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/hudTypes.ts — Types partagés du système HUD, Radar et Carte
// ══════════════════════════════════════════════════════════════════════════════

import type { Vector3, Faction } from "../../../types";

// ── Types de Biome pour la carte ─────────────────────────────────────────────

export enum BiomeType {
  FUNGAL = "FUNGAL",
  OCEAN = "OCEAN",
  DESERT = "DESERT",
  HUB = "HUB",
}

// ── Couleurs par faction (définies dans hudConstants) ────────────────────────

export interface FactionColors {
  health: string;
  armor: string;
  mana: string;
  primary: string;
  accent: string;
  glow: string;
}

// ── Types HUD de base ────────────────────────────────────────────────────────

export interface Stats {
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
}

export interface ExtendedStats {
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  mana: number;
  maxMana: number;
  energy?: number;
  maxEnergy?: number;
}

// ── Armes ─────────────────────────────────────────────────────────────────────

export interface WeaponData {
  id: string;
  name: string;
  damage: number;
  ammo?: number;
  maxAmmo?: number;
  icon?: string;
}

// ── Statut joueur ─────────────────────────────────────────────────────────────

export interface PlayerStatus {
  isInCombat: boolean;
  isStealthed: boolean;
  isStunned: boolean;
  statusEffects: string[];
}

// ── Sorts / SpellBar ──────────────────────────────────────────────────────────

export interface SpellSlotData {
  id: string;
  label: string;
  icon?: string;
  manaCost: number;
  cooldown: number;
  currentCooldown: number;
  isUltimate?: boolean;
  description?: string;
}

// ── Buffs / Debuffs ───────────────────────────────────────────────────────────

export interface BuffData {
  id: string;
  label: string;
  icon?: string;
  remaining: number;
  maxDuration: number;
  isDebuff: boolean;
  stacks?: number;
}

// ── Quêtes / QuestTracker ─────────────────────────────────────────────────────

export interface QuestObjectiveDisplay {
  label: string;
  current: number;
  target: number;
  done: boolean;
}

export interface QuestDisplayData {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjectiveDisplay[];
  allDone: boolean;
}

// ── Inventaire rapide ─────────────────────────────────────────────────────────

export interface QuickSlotItem {
  id: string;
  label: string;
  icon?: string;
  quantity: number;
  maxStack?: number;
}

// ── Types Radar ──────────────────────────────────────────────────────────────

export type RadarEntityType =
  | "PLAYER"
  | "MONSTER"
  | "NPC"
  | "VEHICLE"
  | "PROP"
  | "RESOURCE"
  | "STRUCTURE";

export interface RadarEntity {
  id: string;
  type: RadarEntityType;
  position: Vector3;
  velocity?: Vector3;
  faction?: Faction;
  isMoving: boolean;
  lastPosition?: Vector3;
}

// ── Types Carte ──────────────────────────────────────────────────────────────

export type MapZoneType = "BIOME" | "ALLIANCE_ZONE" | "POI";

export interface MapZone {
  id: string;
  type: MapZoneType;
  biome?: BiomeType;
  faction?: Faction;
  name: string;
  bounds: { min: Vector3; max: Vector3 };
  discovered: boolean;
}

export interface MapData {
  zones: MapZone[];
  discoveredAreas: Set<string>;
  playerHistory: Vector3[];
}
