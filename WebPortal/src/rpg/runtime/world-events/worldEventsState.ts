// WebPortal/src/rpg/runtime/world-events/worldEventsState.ts
// Singleton pur : registre des événements monde actifs (pos + durationMs requis).
// Aucun React, aucune dépendance THREE : contient uniquement les payloads.
import type { WorldEvents } from '../core/worldTypes';

export interface ActiveEvent {
  payload: WorldEvents['world:eventStarted'];
  startedAt: number; // ms (Date.now())
}

class WorldEventsState {
  private events: ActiveEvent[] = [];

  /**
   * Ajoute un événement au registre.
   * Ignoré si le payload ne contient pas pos OU durationMs (pas de visualisation possible).
   */
  add(payload: WorldEvents['world:eventStarted'], now: number): void {
    if (!payload.pos || !payload.durationMs) return;
    this.events.push({ payload, startedAt: now });
  }

  /**
   * Retourne les événements encore actifs à `now`.
   * Purge au passage ceux dont l'âge (now - startedAt) >= durationMs.
   */
  active(now: number): ActiveEvent[] {
    this.events = this.events.filter(
      (e) => now - e.startedAt < (e.payload.durationMs ?? 0),
    );
    return this.events;
  }

  /** Vide le registre (changement de map, démontage du composant). */
  clear(): void {
    this.events = [];
  }
}

export const worldEventsState = new WorldEventsState();
