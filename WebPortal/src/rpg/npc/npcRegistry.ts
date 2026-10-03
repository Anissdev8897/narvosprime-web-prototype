// ══════════════════════════════════════════════════════════════════════════════
// npc/npcRegistry.ts — Registre runtime des PNJ (singleton, hors React)
//
// Pourquoi un singleton ? Le combat tourne dans useFrame (pas en état React).
// Les sorts (RpgGameWorld) doivent trouver les ennemis et leur infliger des
// dégâts SANS prop-drilling ni re-render. Même pattern que collisionWorld.
//
// Chaque PNJ s'enregistre au montage (handle léger) et se retire au démontage.
//
// BROADPHASE : une grille uniforme XZ indexe les PNJ par cellule → les requêtes de
// rayon (flèches, sorts) ne visitent que les cellules voisines au lieu de scanner
// TOUS les PNJ. `forEachEnemyInRadius` est SANS allocation (callback). Les PNJ qui
// bougent appellent `refreshPosition(id)` pour se réindexer.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { NpcRole } from "./npcCatalog";
import type { LootItem } from "../loot/LootRegistry";

/** Butin déposé sur un cadavre (null si vivant ou déjà pillé). */
export interface CorpseLoot {
  items: LootItem[];
  credits: number;
}

/** Poignée légère exposée par chaque PNJ vivant dans la scène. */
export interface NpcHandle {
  id: string;
  role: NpcRole;
  /** Position monde LIVE (le PNJ mute ce vecteur en place — ne pas cloner pour lire). */
  getPosition: () => THREE.Vector3;
  /** true tant que le PNJ n'est pas mort. */
  isAlive: () => boolean;
  /** Inflige des dégâts bruts ; déclenche la mort si hp ≤ 0. */
  applyDamage: (amount: number) => void;
  /** Défense de la cible (atténue les dégâts d'archétype). Absent = 0 (neutre). */
  getDefense?: () => number;
  /** Butin disponible sur le cadavre (null si vivant/déjà pillé). */
  getLoot: () => CorpseLoot | null;
  /** Récupère et VIDE le butin du cadavre (null si rien). */
  takeLoot: () => CorpseLoot | null;
  /** Nom affiché (label du PNJ). */
  getLabel?: () => string;
  /** Fraction HP courante (0..1). */
  getHpFraction?: () => number;
  /** HP max du PNJ. */
  getMaxHp?: () => number;
  /** Niveau du PNJ. */
  getLevel?: () => number;
}

// Taille de cellule ≈ rayon de hit typique des flèches (HIT_R+VBAND≈3.7) arrondi.
const CELL = 4;
// Décalage pour clés positives (grille bornée ±16384 cellules = ±65 km à CELL=4).
const OFFSET = 16384;
const SPAN = 32768;
function cellKey(x: number, z: number): number {
  return (Math.floor(x / CELL) + OFFSET) * SPAN + (Math.floor(z / CELL) + OFFSET);
}

class NpcRegistry {
  private npcs = new Map<string, NpcHandle>();
  private cellOf = new Map<string, number>();   // id → clé de cellule courante
  private grid = new Map<number, Set<string>>(); // clé de cellule → ids

  /**
   * Le joueur est-il vivant ? Partagé hors-React → lu par chaque PNJ dans son
   * useFrame pour se désengager instantanément quand le joueur meurt (sans
   * prop-drilling ni re-render). Remis à true au respawn par RpgGameWorld.
   */
  playerAlive = true;

  /**
   * Le joueur est-il CIBLABLE ? Passe à false pendant l'invisibilité (sort
   * Guerrier) → les PNJ cessent de l'aggro/cibler sans le considérer mort.
   * Remis à true par statusEffects à la fin de l'invisibilité.
   */
  playerTargetable = true;

  private addToCell(id: string, key: number): void {
    let set = this.grid.get(key);
    if (!set) { set = new Set(); this.grid.set(key, set); }
    set.add(id);
    this.cellOf.set(id, key);
  }
  private removeFromCell(id: string): void {
    const key = this.cellOf.get(id);
    if (key === undefined) return;
    const set = this.grid.get(key);
    if (set) { set.delete(id); if (set.size === 0) this.grid.delete(key); }
    this.cellOf.delete(id);
  }

  register(handle: NpcHandle): void {
    this.npcs.set(handle.id, handle);
    const p = handle.getPosition();
    this.addToCell(handle.id, cellKey(p.x, p.z));
  }

  unregister(id: string): void {
    this.npcs.delete(id);
    this.removeFromCell(id);
  }

  /** À appeler quand un PNJ s'est déplacé → met à jour sa cellule si elle a changé. */
  refreshPosition(id: string): void {
    const h = this.npcs.get(id);
    if (!h) return;
    const p = h.getPosition();
    const key = cellKey(p.x, p.z);
    if (this.cellOf.get(id) !== key) { this.removeFromCell(id); this.addToCell(id, key); }
  }

  /** Tous les PNJ enregistrés (vivants ou morts). */
  all(): NpcHandle[] { return [...this.npcs.values()]; }

  /** PNJ par id (cible des projectiles homing). undefined si parti/mort-démonté. */
  get(id: string): NpcHandle | undefined { return this.npcs.get(id); }

  /** Visite les ennemis VIVANTS dans un rayon — SANS allocation (cellules voisines). */
  forEachEnemyInRadius(center: THREE.Vector3, radius: number, cb: (h: NpcHandle) => void): void {
    const r2 = radius * radius;
    const minCx = Math.floor((center.x - radius) / CELL);
    const maxCx = Math.floor((center.x + radius) / CELL);
    const minCz = Math.floor((center.z - radius) / CELL);
    const maxCz = Math.floor((center.z + radius) / CELL);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const set = this.grid.get((cx + OFFSET) * SPAN + (cz + OFFSET));
        if (!set) continue;
        for (const id of set) {
          const h = this.npcs.get(id);
          if (!h || h.role !== "enemy" || !h.isAlive()) continue;
          if (h.getPosition().distanceToSquared(center) <= r2) cb(h);
        }
      }
    }
  }

  /** Compat (sorts, occasionnel) : renvoie un NOUVEAU tableau — sûr pour les appels imbriqués
   *  (un sort qui requête à l'intérieur de sa propre boucle d'ennemis). Le hot-path par-frame
   *  (flèches) utilise `forEachEnemyInRadius` (sans alloc) au lieu de ceci. */
  queryEnemiesInRadius(center: THREE.Vector3, radius: number): NpcHandle[] {
    const out: NpcHandle[] = [];
    this.forEachEnemyInRadius(center, radius, (h) => out.push(h));
    return out;
  }

  /** Cadavres pillables (morts avec butin) dans un rayon horizontal d'un point. */
  lootableCorpsesInRadius(center: THREE.Vector3, radius: number): NpcHandle[] {
    const out: NpcHandle[] = [];
    for (const h of this.npcs.values()) {
      if (h.isAlive() || !h.getLoot()) continue;
      const p = h.getPosition();
      const dx = p.x - center.x;
      const dz = p.z - center.z;
      if (dx * dx + dz * dz <= radius * radius) out.push(h);
    }
    return out;
  }

  /** Trouve l'ennemi vivant le plus proche dans un cône avant (pour le ciblage viseur). */
  findAimedEnemy(center: THREE.Vector3, forwardDir: THREE.Vector3, maxRange: number, coneAngle: number): NpcHandle | null {
    let best: NpcHandle | null = null;
    let bestDist = maxRange * maxRange;
    const tmp = new THREE.Vector3();
    this.forEachEnemyInRadius(center, maxRange, (h) => {
      tmp.copy(h.getPosition()).sub(center);
      const dist2 = tmp.lengthSq();
      if (dist2 > bestDist) return;
      tmp.normalize();
      if (tmp.dot(forwardDir) < Math.cos(coneAngle)) return;
      bestDist = dist2;
      best = h;
    });
    return best;
  }

  /** Vide le registre (changement de map / sortie du jeu). */
  clear(): void {
    this.npcs.clear();
    this.grid.clear();
    this.cellOf.clear();
  }
}

/** Instance unique partagée par toute la scène RPG. */
export const npcRegistry = new NpcRegistry();
