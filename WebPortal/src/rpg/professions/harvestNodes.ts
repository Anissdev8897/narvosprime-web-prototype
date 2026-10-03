// professions/harvestNodes.ts — emplacements des nœuds de récolte par map (seed).
//
// v1 : seed statique pour tester la récolte tout de suite. La PROCHAINE étape
// rendra ces nœuds plaçables via un éditeur (même patron que portails F10).
import type { ProfessionId } from "./professionTypes";

export interface HarvestNodeSeed {
  id: string;
  pos: [number, number, number]; // Y est recalé au sol par le nœud
  profession: ProfessionId;
}

// Seed VIDE : l'utilisateur place lui-même tous les nœuds de récolte (arbres/mines/
// buissons) via l'éditeur de récolte (🌿). Ces placements sont persistés dans
// harvestNodeStore (DB + localStorage) et rechargés automatiquement avec la map.
export const HARVEST_NODES: Record<string, HarvestNodeSeed[]> = {};

export function harvestNodesForMap(mapId: string): HarvestNodeSeed[] {
  return HARVEST_NODES[mapId] ?? [];
}
