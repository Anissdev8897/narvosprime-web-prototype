// ══════════════════════════════════════════════════════════════════════════════
// network/ReplicationManager.ts — Réplication d'état delta-compressée
//
// Architecture (inspirée du système de réplication Unreal Engine / Iris) :
//
//   AUTORITÉ SERVEUR
//   ────────────────
//   Le serveur est la seule source de vérité. Le client n'envoie que des
//   intentions (inputs). Le serveur valide, calcule le nouvel état, et
//   réplique le delta vers les clients concernés.
//
//   DELTA-COMPRESSION
//   ─────────────────
//   On n'envoie jamais l'état complet à chaque tick. Le serveur maintient
//   un "baseline" (état complet) et n'envoie que les champs modifiés.
//   Un StateSync complet est envoyé périodiquement (toutes les ~2s) ou
//   à la connexion d'un nouveau client.
//
//   PRIORITY-BASED
//   ──────────────
//   Les entités proches du joueur sont synchronisées en priorité :
//     • Dist < 10m → tick complet (every tick)
//     • 10m < dist < 50m → tick réduit (1/4 champs, 1/2 ticks)
//     • Dist > 50m → tick minimal (position + état, 1/8 ticks)
//     • Dist > 100m → update toutes les 500ms
//
//   INTERPOLATION
//   ─────────────
//   Le client interpole les positions des entités distantes entre deux
//   updates reçus pour un rendu fluide. Les entités locales (contrôlées
//   par le joueur) utilisent la prédiction client (PredictionManager).
//
// Utilisation :
//   import { replicationManager } from "./ReplicationManager";
//   replicationManager.setPlayerId("player-123");
//   replicationManager.applyFullSync(payload);
//   replicationManager.applyDelta(payload);
//   // chaque frame : replicationManager.interpolate(dt)
// ══════════════════════════════════════════════════════════════════════════════

import {
  type EntityState,
  type EntityDelta,
  type FullStateSyncPayload,
  type DeltaUpdatePayload,
  type PriorityUpdatePayload,
  type EntitySpawnPayload,
  type EntityDestroyPayload,
  type PlayerStatePayload,
} from "./protocol";
import { networkManager, type NetworkEvents } from "./NetworkManager";

// ── Constantes ──────────────────────────────────────────────────────────────

const REPLICATION_DEFAULTS = {
  /** Intervalle entre deux StateSync complets (ms). */
  fullSyncIntervalMs: 2000,
  /** Taille du buffer d'historique pour l'interpolation. */
  interpHistorySize: 64,
  /** Délai d'interpolation cible (ms) — on retarde le rendu pour lisser. */
  interpDelayMs: 50,
  /** Distance de priorité haute (< 10m = tick complet). */
  priorityCloseDist: 10,
  /** Distance de priorité moyenne. */
  priorityMidDist: 50,
  /** Distance de priorité étendue. */
  priorityFarDist: 100,
  /** Nombre max d'entités suivies. */
  maxTrackedEntities: 1024,
} as const;

// ── Types ───────────────────────────────────────────────────────────────────

/** État interpolé d'une entité distante. */
export interface InterpState {
  entityId: string;
  /** Snapshots reçus pour l'interpolation (timestamp → state). */
  history: Array<{ ts: number; state: EntityState }>;
  /** État actuel (interpolé). */
  current: EntityState;
  /** Dernier état reçu du serveur. */
  target: EntityState;
  /** Dernière mise à jour reçue (timestamp serveur). */
  lastUpdateTs: number;
  /** Distance au joueur (mise à jour par le serveur ou calculée). */
  distance: number;
}

/** Métadonnées d'entité traquée côté client. */
interface TrackedEntity {
  entityId: string;
  /** Type d'entité ("player" | "npc" | "projectile" | ...). */
  entityType: string;
  /** Timestamp de l'état complet reçu. */
  lastFullSyncTs: number;
  /** Timestamp de la dernière mise à jour delta. */
  lastDeltaTs: number;
  /** Priorité actuelle (0=haute). */
  priority: number;
  /** État interpolé. */
  interp: InterpState;
}

export interface ReplicationStats {
  /** Nombre d'entités traquées. */
  trackedEntities: number;
  /** Nombre de full syncs reçues. */
  fullSyncsReceived: number;
  /** Nombre de deltas reçus. */
  deltasReceived: number;
  /** Nombre d'entités spawnees. */
  entitiesSpawned: number;
  /** Nombre d'entités détruites. */
  entitiesDestroyed: number;
  /** Nombre d'entités en interpolation active. */
  interpolating: number;
  /** Latence réseau utilisée pour le calcul d'interpolation. */
  networkLatencyMs: number;
}

export interface ReplicationEvents {
  entitySpawned: (entityId: string, entityType: string) => void;
  entityDestroyed: (entityId: string, reason?: string) => void;
  entityUpdated: (entityId: string, state: EntityState) => void;
  fullSyncReceived: (sync: FullStateSyncPayload) => void;
  deltaReceived: (delta: DeltaUpdatePayload) => void;
}

// ── ReplicationManager ──────────────────────────────────────────────────────

/**
 * Gestionnaire de réplication — synchronisation d'état client/serveur.
 *
 * Design :
 *   • Maintient une copie locale des états d'entités
 *   • Applique les full syncs (écrase) et les deltas (fusion)
 *   • Calcule l'interpolation entre deux snapshots reçus
 *   • Priorise les entités proches
 *   • Singleton : s'abonne aux paquets réseau via NetworkManager
 */
export class ReplicationManager {
  // ── Privé ────────────────────────────────────────────────────────────────
  private _entities = new Map<string, TrackedEntity>();
  private _playerId: string | null = null;

  // Statistiques
  private _fullSyncsReceived = 0;
  private _deltasReceived = 0;
  private _entitiesSpawned = 0;
  private _entitiesDestroyed = 0;

  // Désabonnement réseau
  private _unsubPacket: (() => void) | null = null;

  // Cache d'interpolation
  private _playerPos: [number, number, number] = [0, 0, 0];

  constructor() {
    // S'abonner aux paquets réseau entrants
    this._unsubPacket = networkManager.on("packet", (pkt) => {
      this._handlePacket(pkt);
    });
  }

  /** Détruit le gestionnaire et se désabonne. */
  destroy(): void {
    if (this._unsubPacket) {
      this._unsubPacket();
      this._unsubPacket = null;
    }
    this._entities.clear();
  }

  // ── Propriétés ────────────────────────────────────────────────────────────

  /** Définit l'ID du joueur local (pour filtrer sa propre entité). */
  setPlayerId(id: string): void {
    this._playerId = id;
  }

  get playerId(): string | null {
    return this._playerId;
  }

  /** Position courante du joueur (pour le calcul de priorité). */
  setPlayerPos(pos: [number, number, number]): void {
    this._playerPos = pos;
  }

  get stats(): ReplicationStats {
    let interpolating = 0;
    this._entities.forEach((e) => {
      if (e.interp.history.length > 1) interpolating++;
    });
    return {
      trackedEntities: this._entities.size,
      fullSyncsReceived: this._fullSyncsReceived,
      deltasReceived: this._deltasReceived,
      entitiesSpawned: this._entitiesSpawned,
      entitiesDestroyed: this._entitiesDestroyed,
      interpolating,
      networkLatencyMs: networkManager.stats.latencyMs,
    };
  }

  /** Récupère l'état autoritaire (dernier état connu du serveur) d'une entité. */
  getEntityState(entityId: string): EntityState | null {
    const e = this._entities.get(entityId);
    if (!e) return null;
    // Retourner target (dernier état connu du serveur).
    // Pour l'état interpolé (rendu), appeler interpolate() d'abord.
    return { ...e.interp.target };
  }

  /** Récupère toutes les entités traquées (sauf le joueur local). */
  getAllEntityStates(): Map<string, EntityState> {
    const result = new Map<string, EntityState>();
    this._entities.forEach((e, id) => {
      if (id !== this._playerId) {
        result.set(id, e.interp.current);
      }
    });
    return result;
  }

  /** Vérifie si une entité est traquée. */
  hasEntity(entityId: string): boolean {
    return this._entities.has(entityId);
  }

  // ── Application des syncs ────────────────────────────────────────────────

  /**
   * Applique une synchronisation complète (full state).
   * Remplace TOUS les états d'entités connus.
   */
  applyFullSync(payload: FullStateSyncPayload): void {
    this._fullSyncsReceived++;

    // Mettre à jour ou créer chaque entité
    for (const state of payload.entities) {
      // Ne pas répliquer notre propre entité (gérée par PredictionManager)
      if (state.entityId === this._playerId) continue;
      this._upsertEntity(state.entityId, "unknown", state);
    }

    // Supprimer les entités qui ne sont plus dans la sync
    const receivedIds = new Set(payload.entities.map((e) => e.entityId));
    const toRemove: string[] = [];
    this._entities.forEach((_val, id) => {
      if (id === this._playerId) return;
      if (!receivedIds.has(id)) {
        toRemove.push(id);
      }
    });
    for (const id of toRemove) {
      this._removeEntity(id, "full_sync_prune");
    }

    this._emit("fullSyncReceived", payload);
  }

  /**
   * Applique un delta update (seuls les champs changés).
   */
  applyDelta(payload: DeltaUpdatePayload): void {
    this._deltasReceived++;

    for (const delta of payload.deltas) {
      if (delta.entityId === this._playerId) continue;

      const tracked = this._entities.get(delta.entityId);
      if (!tracked) {
        // Delta pour une entité inconnue — on ignore (full sync arrivera)
        continue;
      }

      // Fusionner les champs changés dans l'état cible
      const target = tracked.interp.target;
      const changed = delta.changed;
      if (changed.pos) target.pos = changed.pos;
      if (changed.rot) target.rot = changed.rot;
      if (changed.vel) target.vel = changed.vel;
      if (changed.health !== undefined) target.health = changed.health;
      if (changed.state) target.state = changed.state;
      if (changed.animState) target.animState = changed.animState;

      tracked.lastDeltaTs = performance.now();

      // Ajouter à l'historique d'interpolation
      this._pushInterpHistory(tracked.interp, target);

      this._emit("entityUpdated", delta.entityId, { ...target });
    }

    this._emit("deltaReceived", payload);
  }

  /**
   * Applique une mise à jour prioritaire (entités proches).
   */
  applyPriorityUpdate(payload: PriorityUpdatePayload): void {
    for (const update of payload.updates) {
      if (update.entityId === this._playerId) continue;

      const tracked = this._entities.get(update.entityId);
      if (!tracked) continue;

      const target = tracked.interp.target;
      const changed = update.changed;
      if (changed.pos) target.pos = changed.pos;
      if (changed.rot) target.rot = changed.rot;
      if (changed.vel) target.vel = changed.vel;

      tracked.interp.distance = update.dist;
      tracked.lastDeltaTs = performance.now();
      this._pushInterpHistory(tracked.interp, target);
    }
  }

  /**
   * Traite un spawn d'entité (côté serveur).
   */
  spawnEntity(payload: EntitySpawnPayload): void {
    const state: EntityState = {
      entityId: payload.entityId,
      pos: payload.pos,
      rot: payload.rot,
      vel: [0, 0, 0],
      health: 100,
      state: "idle",
      animState: "idle",
    };

    this._upsertEntity(payload.entityId, payload.entityType, state);
    this._entitiesSpawned++;
    this._emit("entitySpawned", payload.entityId, payload.entityType);
  }

  /**
   * Traite la destruction d'une entité.
   */
  destroyEntity(payload: EntityDestroyPayload): void {
    this._removeEntity(payload.entityId, payload.reason ?? "destroy");
    this._entitiesDestroyed++;
    this._emit("entityDestroyed", payload.entityId, payload.reason);
  }

  // ── Interpolation (appelée chaque frame) ─────────────────────────────────

  /**
   * Interpole les positions de toutes les entités distantes.
   * À appeler chaque frame avec le delta time.
   *
   * Algorithme :
   *   1. On détermine le "render timestamp" = now - interpDelay
   *   2. On cherche dans l'historique le segment [t0, t1] qui encadre ce timestamp
   *   3. On interpole linéairement entre state0 et state1
   *   4. Si pas de segment → on utilise le dernier état connu
   */
  interpolate(dt: number): void {
    if (this._entities.size === 0) return;

    const now = performance.now();
    const renderTs = now - REPLICATION_DEFAULTS.interpDelayMs;

    const entities = Array.from(this._entities.values());
    for (const e of entities) {
      const interp = e.interp;
      const hist = interp.history;

      if (hist.length < 2) {
        // Pas assez de données — utiliser la cible directement
        interp.current = { ...interp.target };
        continue;
      }

      // Chercher le segment [hist[i], hist[i+1]] qui encadre renderTs
      let t0 = hist[0];
      let t1 = hist[hist.length - 1];

      for (let i = 0; i < hist.length - 1; i++) {
        if (hist[i].ts <= renderTs && hist[i + 1].ts >= renderTs) {
          t0 = hist[i];
          t1 = hist[i + 1];
          break;
        }
      }

      // Si renderTs est avant le premier snapshot → utiliser le premier
      if (renderTs <= t0.ts) {
        interp.current = { ...t0.state };
        continue;
      }

      // Si renderTs est après le dernier → utiliser le dernier
      if (renderTs >= t1.ts) {
        interp.current = { ...t1.state };
        continue;
      }

      // Interpolation linéaire entre t0 et t1
      const range = t1.ts - t0.ts;
      const fraction = range > 0 ? (renderTs - t0.ts) / range : 0;
      const clamped = Math.max(0, Math.min(1, fraction));

      interp.current = {
        entityId: interp.current.entityId,
        pos: this._lerpVec3(t0.state.pos, t1.state.pos, clamped),
        rot: this._lerpQuat(t0.state.rot, t1.state.rot, clamped),
        vel: this._lerpVec3(t0.state.vel, t1.state.vel, clamped),
        health: t1.state.health, // pas d'interpolation sur la vie
        state: t1.state.state,
        animState: t1.state.animState,
      };
    }
  }

  // ── Handlers internes ─────────────────────────────────────────────────────

  private _handlePacket(pkt: unknown): void {
    const packet = pkt as { header?: { cat?: string; sub?: string }; data?: unknown };
    if (!packet?.header) return;

    const cat = packet.header.cat;
    const sub = packet.header.sub;

    // Routage par catégorie
    if (cat === "replication") {
      switch (sub) {
        case "repl:full_sync":
          this.applyFullSync(packet.data as FullStateSyncPayload);
          break;
        case "repl:delta":
          this.applyDelta(packet.data as DeltaUpdatePayload);
          break;
        case "repl:priority":
          this.applyPriorityUpdate(packet.data as PriorityUpdatePayload);
          break;
      }
    } else if (cat === "entity") {
      switch (sub) {
        case "entity:spawn":
          this.spawnEntity(packet.data as EntitySpawnPayload);
          break;
        case "entity:destroy":
          this.destroyEntity(packet.data as EntityDestroyPayload);
          break;
      }
    }
  }

  // ── Méthodes privées ──────────────────────────────────────────────────────

  private _upsertEntity(entityId: string, entityType: string, state: EntityState): void {
    const existing = this._entities.get(entityId);
    if (existing) {
      existing.interp.target = { ...state };
      existing.lastFullSyncTs = performance.now();
      this._pushInterpHistory(existing.interp, state);
    } else {
      const interp: InterpState = {
        entityId,
        history: [{ ts: performance.now(), state: { ...state } }],
        current: { ...state },
        target: { ...state },
        lastUpdateTs: performance.now(),
        distance: this._calcDistance(state.pos),
      };
      this._entities.set(entityId, {
        entityId,
        entityType,
        lastFullSyncTs: performance.now(),
        lastDeltaTs: 0,
        priority: 0,
        interp,
      });
    }
  }

  private _removeEntity(entityId: string, _reason?: string): void {
    this._entities.delete(entityId);
  }

  /** Ajoute un snapshot à l'historique d'interpolation (en limitant la taille). */
  private _pushInterpHistory(interp: InterpState, state: EntityState): void {
    interp.history.push({ ts: performance.now(), state: { ...state } });
    if (interp.history.length > REPLICATION_DEFAULTS.interpHistorySize) {
      interp.history.shift();
    }
  }

  /** Calcule la distance entre l'entité et le joueur. */
  private _calcDistance(pos: [number, number, number]): number {
    const dx = pos[0] - this._playerPos[0];
    const dy = pos[1] - this._playerPos[1];
    const dz = pos[2] - this._playerPos[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // ── Maths d'interpolation ─────────────────────────────────────────────────

  private _lerpVec3(
    a: [number, number, number],
    b: [number, number, number],
    t: number,
  ): [number, number, number] {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }

  private _lerpQuat(
    a: [number, number, number, number],
    b: [number, number, number, number],
    t: number,
  ): [number, number, number, number] {
    // SLERP simplifié (interpolation linéaire normalisée)
    // Pour un vrai SLERP, il faudrait une implémentation complète
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const sign = dot < 0 ? -1 : 1; // prendre le chemin le plus court
    const result = [
      a[0] + (b[0] * sign - a[0]) * t,
      a[1] + (b[1] * sign - a[1]) * t,
      a[2] + (b[2] * sign - a[2]) * t,
      a[3] + (b[3] * sign - a[3]) * t,
    ];

    // Normaliser
    let len = 0;
    for (let i = 0; i < 4; i++) len += result[i] * result[i];
    len = Math.sqrt(len);
    return len > 0
      ? [result[0] / len, result[1] / len, result[2] / len, result[3] / len]
      : [1, 0, 0, 0];
  }

  // ── Événements internes ───────────────────────────────────────────────────

  private _eventListeners = new Map<string, Set<(...args: unknown[]) => void>>();

  on<K extends keyof ReplicationEvents>(event: K, listener: ReplicationEvents[K]): () => void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    const handlers = this._eventListeners.get(event)!;
    handlers.add(listener as (...args: unknown[]) => void);
    return () => {
      handlers.delete(listener as (...args: unknown[]) => void);
    };
  }

  private _emit(event: string, ...args: unknown[]): void {
    const handlers = this._eventListeners.get(event);
    if (handlers) {
      Array.from(handlers).forEach((handler) => {
        try { handler(...args); } catch (err) {
          console.error(`[ReplicationManager] handler '${event}' error:`, err);
        }
      });
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

/** Instance unique du gestionnaire de réplication. */
export const replicationManager = new ReplicationManager();
