// professions/harvestRegistry.ts — registre runtime des nœuds de récolte (hors-React).
//
// Chaque nœud (arbre/rocher) s'enregistre avec un handle. Le mini-jeu (HUD) frappe
// un nœud via harvestRegistry.get(id).chop(quality) sans prop-drilling. Même patron
// que npcRegistry / collisionWorld.
import type * as THREE from "three";
import type { ProfessionId } from "./professionTypes";

export interface ChopResult {
  struck: boolean;    // false = raté (aucune progression)
  depleted: boolean;  // true = nœud épuisé (yield à octroyer)
}

export interface HarvestHandle {
  id: string;
  profession: ProfessionId;
  getPosition: () => THREE.Vector3;
  available: () => boolean;                 // false pendant chute/respawn
  chop: (quality: number) => ChopResult;    // quality 0..1 (0 = raté)
  /** Appelé par le ticker central quand l'état near/far CHANGE (edge-trigger interne). */
  setNear: (near: boolean) => void;
}

class HarvestRegistry {
  private nodes = new Map<string, HarvestHandle>();
  register(h: HarvestHandle): void { this.nodes.set(h.id, h); }
  unregister(id: string): void { this.nodes.delete(id); }
  get(id: string): HarvestHandle | undefined { return this.nodes.get(id); }
  /** Itère tous les nœuds (utilisé par le ticker de proximité central). */
  forEach(cb: (h: HarvestHandle) => void): void { for (const h of this.nodes.values()) cb(h); }
  clear(): void { this.nodes.clear(); }
}

export const harvestRegistry = new HarvestRegistry();
