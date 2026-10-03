// WebPortal/src/rpg/runtime/core/worldEntities.ts
import type * as THREE from 'three';
import type { WorldEntity, FactionId } from './worldTypes';
import { areEnemies } from '../../factions/factions';

/** Registre générique des entités du monde (vaisseaux, stations…). Singleton hors-React. */
class WorldEntities {
  private entities = new Map<string, WorldEntity>();

  register(e: WorldEntity): void { this.entities.set(e.id, e); }
  unregister(id: string): void { this.entities.delete(id); }
  all(): WorldEntity[] { return [...this.entities.values()]; }
  /** Lookup O(1) par id (utile pour résoudre les events qui ne portent que l'id). */
  get(id: string): WorldEntity | undefined { return this.entities.get(id); }

  /** Entités VIVANTES dans un rayon d'un point. */
  inRadius(center: THREE.Vector3, r: number): WorldEntity[] {
    const r2 = r * r;
    const out: WorldEntity[] = [];
    for (const e of this.entities.values()) {
      if (!e.isAlive()) continue;
      if (e.getPosition().distanceToSquared(center) <= r2) out.push(e);
    }
    return out;
  }

  /** Ennemis (selon la matrice de factions) vivants dans un rayon. */
  enemiesOf(faction: FactionId, center: THREE.Vector3, r: number): WorldEntity[] {
    return this.inRadius(center, r).filter(
      (e) => e.faction != null && areEnemies(faction, e.faction),
    );
  }

  clear(): void { this.entities.clear(); }
}

export const worldEntities = new WorldEntities();
