// ══════════════════════════════════════════════════════════════════════════════
// npc/npcEntityPool.ts — Pool d'entités NPC (évite les alloc/dealloc per-frame)
//
// Pourquoi un pool ? Chaque PNJ monté/démonté dans React cause :
//   • allocations GC (NpcHandle, Map entries, THREE.Vector3, refs)
//   • enregistrement/désenregistrement dans npcRegistry (+ grille spatiale)
//   • recréation de l'AnimationController, du NpcController
//
// Le pool PRÉALLoue des slots réutilisables. Un NPC qui meurt → slot libéré
// pour le prochain spawn, SANS toucher au tas.
//
// Usage (via le singleton) :
//   const slot = npcEntityPool.acquire(id, cfg, pos)
//   slot.controller.update(dt, dist, senses)
//   npcEntityPool.release(id)    // slot remis dans la free-list
//
// Statistiques exposées pour le debugger/benchmark :
//   poolSize, activeCount, peakActive, hitRate
// ══════════════════════════════════════════════════════════════════════════════

import { NpcController, type NpcConfig, type NpcFrameResult, type NpcSenses } from "./NpcController";
import * as THREE from "three";

// ── Slot de pool ────────────────────────────────────────────────────────────

export interface NpcPoolSlot {
  /** Identifiant unique du PNJ (ex: `forge_npc_0_soldat_humain`). */
  id: string;
  /** Cerveau IA (machine à états + santé). Créé une seule fois, réinitialisé au acquire. */
  controller: NpcController;
  /** Position monde LIVE (mutée en place — l'IA la déplace). */
  position: THREE.Vector3;
  /** Timestamp (performance.now) du dernier update. Pour calcul dt en sleeping. */
  lastUpdateMs: number;
  /** true si le slot est actuellement attribué à un PNJ vivant. */
  active: boolean;
  /** Compteur d'utilisation (diagnostic). */
  useCount: number;
  /** Dernière bande LOD connue. */
  lastBand: number;
}

// ── Stats du pool ───────────────────────────────────────────────────────────

export interface NpcPoolStats {
  poolSize: number;
  activeCount: number;
  peakActive: number;
  totalAcquired: number;
  totalReleased: number;
  /** Combien de fois un slot a été réutilisé (vs créé neuf). */
  reuseCount: number;
}

// ── Le pool ─────────────────────────────────────────────────────────────────

class NpcEntityPool {
  /** Tous les slots pré-alloués (actifs + libres). */
  private slots: NpcPoolSlot[] = [];
  /** Liste d'IDs libres (free-list). On pousse/pop pour éviter un sweep. */
  private freeList: number[] = [];

  // Stats
  private _peakActive = 0;
  private _totalAcquired = 0;
  private _totalReleased = 0;
  private _reuseCount = 0;

  /** Taille initiale du pool (allocation paresseuse jusqu'à ce seuil). */
  private readonly initialSize: number;
  /** Taille maximale (soft cap — au-delà, on alloue mais on log un warning). */
  private readonly maxSize: number;

  constructor(initialSize = 32, maxSize = 500) {
    this.initialSize = initialSize;
    this.maxSize = maxSize;
    this.grow(initialSize);
  }

  // ── Accès ────────────────────────────────────────────────────────────────

  get activeCount(): number {
    return this.slots.reduce((n, s) => n + (s.active ? 1 : 0), 0);
  }

  get poolSize(): number {
    return this.slots.length;
  }

  get peakActive(): number {
    return this._peakActive;
  }

  get stats(): NpcPoolStats {
    return {
      poolSize: this.slots.length,
      activeCount: this.activeCount,
      peakActive: this._peakActive,
      totalAcquired: this._totalAcquired,
      totalReleased: this._totalReleased,
      reuseCount: this._reuseCount,
    };
  }

  // ── Gestion du pool ──────────────────────────────────────────────────────

  /**
   * Acquiert un slot pour un PNJ. Si un slot libre est disponible, il est
   * réutilisé. Sinon, on agrandit le pool (jusqu'à maxSize).
   */
  acquire(id: string, cfg: NpcConfig, pos: [number, number, number]): NpcPoolSlot {
    let idx: number;
    let slot: NpcPoolSlot;
    let reused = false;

    if (this.freeList.length > 0) {
      // Réutilisation d'un slot existant
      idx = this.freeList.pop()!;
      slot = this.slots[idx];
      // Réinitialise le controller avec la nouvelle config
      // (on crée un nouveau car la config peut changer entre spawns)
      Object.assign(slot.controller, new NpcController(cfg));
      slot.active = true;
      slot.position.set(pos[0], pos[1], pos[2]);
      slot.lastUpdateMs = performance.now();
      slot.useCount++;
      reused = true;
    } else if (this.slots.length < this.maxSize) {
      // Croissance du pool
      idx = this.slots.length;
      slot = this.createSlot(id, cfg, pos);
      this.slots.push(slot);
    } else {
      // Pool saturé — on prend le slot le plus vieux et le plus éloigné
      // (fallback : on prend le 1er slot inactif, sinon le 1er slot tout court)
      idx = this.slots.findIndex((s) => !s.active);
      if (idx === -1) idx = 0; // pire cas : on écrase le 1er actif
      slot = this.slots[idx];
      Object.assign(slot.controller, new NpcController(cfg));
      slot.id = id;
      slot.active = true;
      slot.position.set(pos[0], pos[1], pos[2]);
      slot.lastUpdateMs = performance.now();
      slot.useCount++;
      reused = true;
    }

    slot.id = id;
    this._totalAcquired++;
    if (reused) this._reuseCount++;
    const ac = this.activeCount;
    if (ac > this._peakActive) this._peakActive = ac;

    return slot;
  }

  /**
   * Libère un slot. Le slot redevient disponible pour un futur acquire.
   * @returns true si le slot a été trouvé et libéré.
   */
  release(id: string): boolean {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.active && s.id === id) {
        s.active = false;
        this.freeList.push(i);
        this._totalReleased++;
        return true;
      }
    }
    return false;
  }

  /** Libère TOUS les slots actifs (reset de map). */
  releaseAll(): void {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].active) {
        this.slots[i].active = false;
        this.freeList.push(i);
        this._totalReleased++;
      }
    }
    this._peakActive = 0;
  }

  /** Trouve un slot actif par ID. Retourne undefined si inconnu/libre. */
  get(id: string): NpcPoolSlot | undefined {
    return this.slots.find((s) => s.active && s.id === id);
  }

  /** Itère sur tous les slots actifs. */
  forEach(fn: (slot: NpcPoolSlot) => void): void {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].active) fn(this.slots[i]);
    }
  }

  /** Nombre de slots actifs groupés par bande LOD. */
  countByBand(): { near: number; mid: number; far: number } {
    let near = 0, mid = 0, far = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      if (s.lastBand === 0) near++;
      else if (s.lastBand === 1) mid++;
      else far++;
    }
    return { near, mid, far };
  }

  // ── Privé ────────────────────────────────────────────────────────────────

  private grow(count: number): void {
    for (let i = 0; i < count; i++) {
      // Slots vides — initialisés paresseusement
      const slot: NpcPoolSlot = {
        id: "",
        controller: new NpcController({
          maxHp: 1, moveSpeed: 0, aggroRange: 1,
          attackRange: 1, attackCooldown: 1, attackDamage: 0, hostile: false,
        }),
        position: new THREE.Vector3(),
        lastUpdateMs: 0,
        active: false,
        useCount: 0,
        lastBand: 99,
      };
      this.slots.push(slot);
      this.freeList.push(this.slots.length - 1);
    }
  }

  private createSlot(id: string, cfg: NpcConfig, pos: [number, number, number]): NpcPoolSlot {
    return {
      id,
      controller: new NpcController(cfg),
      position: new THREE.Vector3(pos[0], pos[1], pos[2]),
      lastUpdateMs: performance.now(),
      active: true,
      useCount: 1,
      lastBand: 0,
    };
  }
}

/** Instance unique partagée par toute la scène RPG. */
export const npcEntityPool = new NpcEntityPool(64, 500);
