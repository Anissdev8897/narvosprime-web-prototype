// loot/chestCatalog.ts — Catalogue statique des coffres par map.
//
// Chaque entrée définit un coffre positionné dans le monde avec son contenu
// initial et sa politique de respawn. Les items référencent LOOT_CATALOG.

import type { ChestDef } from "./chestRegistry";
import { LOOT_CATALOG } from "./LootRegistry";

function pick(id: string) {
  const item = LOOT_CATALOG[id];
  if (!item) throw new Error(`chestCatalog: item inconnu "${id}"`);
  return { ...item };
}

export const MAP_CHESTS: Record<string, ChestDef[]> = {
  orbital: [
    {
      id: "orbital-chest-01",
      label: "Conteneur d'approvisionnement",
      position: [12, 0, -8],
      items: [pick("potion_soin_mineure"), pick("potion_soin_mineure"), pick("potion_mana_mineure")],
      credits: 50,
      respawnSec: 300,
    },
    {
      id: "orbital-chest-02",
      label: "Caisse de transit",
      position: [-15, 0, 22],
      items: [pick("potion_mana_mineure"), pick("fragment_vie")],
      credits: 30,
      respawnSec: 300,
    },
  ],

  forge: [
    {
      id: "forge-chest-01",
      label: "Coffre de forge",
      position: [5, 0, -3],
      items: [pick("potion_soin_mineure"), pick("repair_kit")],
      credits: 80,
      respawnSec: 600,
    },
  ],

  tower: [
    {
      id: "tower-chest-01",
      label: "Coffre de la tour",
      position: [0, 2, 10],
      items: [pick("potion_soin_majeure"), pick("cristal_energie"), pick("potion_mana_mineure")],
      credits: 120,
      respawnSec: 0,
    },
  ],
};
