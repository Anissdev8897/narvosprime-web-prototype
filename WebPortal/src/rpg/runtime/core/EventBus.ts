// WebPortal/src/rpg/runtime/core/EventBus.ts
import type { WorldEvents } from './worldTypes';

type Handler<K extends keyof WorldEvents> = (payload: WorldEvents[K]) => void;

/** Bus d'événements typé, singleton hors-React. Découple tous les systèmes. */
class EventBus {
  private handlers: { [K in keyof WorldEvents]?: Set<Handler<K>> } = {};

  /** Abonne un handler ; retourne une fonction de désabonnement. */
  on<K extends keyof WorldEvents>(type: K, handler: Handler<K>): () => void {
    if (!this.handlers[type]) {
      // cast nécessaire : TypeScript ne peut pas vérifier la cohérence du mapped type ici
      (this.handlers as Record<string, Set<unknown>>)[type] = new Set();
    }
    (this.handlers[type] as Set<Handler<K>>).add(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof WorldEvents>(type: K, handler: Handler<K>): void {
    this.handlers[type]?.delete(handler);
  }

  emit<K extends keyof WorldEvents>(type: K, payload: WorldEvents[K]): void {
    this.handlers[type]?.forEach((h) => h(payload));
  }

  /** Vide tous les abonnements (changement de map / tests). */
  clear(): void {
    this.handlers = {};
  }
}

export const eventBus = new EventBus();
