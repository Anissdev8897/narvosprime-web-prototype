// ══════════════════════════════════════════════════════════════════════════════
// loot/chestRegistry.ts — Registre runtime des coffres de butin (singleton)
//
// Meme pattern que npcRegistry : singleton hors-React, pont vers React via
// useSyncExternalStore. Les coffres s'enregistrent au montage et se retirent
// au demontage. Le combat/loot tourne dans useFrame sans prop-drilling.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { useSyncExternalStore } from "react";
import type { LootItem } from "./LootRegistry";

/** Definition statique d'un coffre (catalogue / spawn de map). */
export interface ChestDef {
  id: string;
  label: string;
  position: [number, number, number];
  items: LootItem[];
  credits: number;
  /** Delai de reapparition en secondes (0 = unique, pas de respawn). */
  respawnSec: number;
  /** Chemin GLB optionnel (null = mesh procedurale). */
  model?: string;
}

/** Poignee legere exposee par chaque coffre vivant dans la scene. */
export interface ChestHandle {
  id: string;
  label: string;
  /** Position monde LIVE du coffre. */
  getPosition: () => THREE.Vector3;
  /** false une fois pille (jusqu'au respawn). */
  isAvailable: () => boolean;
  /** Prend tout le butin du coffre (retourne null si deja pille). */
  takeLoot: () => { items: LootItem[]; credits: number } | null;
}

type Listener = () => void;

class ChestRegistry {
  private chests = new Map<string, ChestHandle>();
  private subs = new Set<Listener>();
  private ver = 0;

  /** Notifie tous les abonnes React d'un changement. */
  private notify(): void {
    this.ver++;
    for (const fn of this.subs) fn();
  }

  /** Enregistre un coffre (appele au montage du composant 3D). */
  register(handle: ChestHandle): void {
    this.chests.set(handle.id, handle);
    this.notify();
  }

  /** Retire un coffre (appele au demontage). */
  unregister(id: string): void {
    this.chests.delete(id);
    this.notify();
  }

  /** Coffres disponibles (non pilles) dans un rayon horizontal d'un point. */
  availableInRadius(center: THREE.Vector3, radius: number): ChestHandle[] {
    const r2 = radius * radius;
    const out: ChestHandle[] = [];
    for (const h of this.chests.values()) {
      if (!h.isAvailable()) continue;
      const p = h.getPosition();
      const dx = p.x - center.x, dz = p.z - center.z;
      if (dx * dx + dz * dz <= r2) out.push(h);
    }
    return out;
  }

  /** Vide le registre (changement de map / sortie du jeu). */
  clear(): void {
    this.chests.clear();
    this.notify();
  }

  /** Abonnement pour useSyncExternalStore. */
  subscribe = (fn: Listener): (() => void) => {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  };

  /** Version courante (compteur monotone pour detecter les changements). */
  getVersion = (): number => this.ver;
}

/** Instance unique partagee par toute la scene RPG. */
export const chestRegistry = new ChestRegistry();

/** Hook React : force un re-render quand le registre change. */
export function useChestVersion(): number {
  return useSyncExternalStore(chestRegistry.subscribe, chestRegistry.getVersion);
}
