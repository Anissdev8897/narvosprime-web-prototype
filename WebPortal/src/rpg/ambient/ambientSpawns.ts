// ambient/ambientSpawns.ts — placement des animaux ambiants par map (seed).
//
// Quelques animaux par PLANÈTE (forge / tower) + station spatiale (orbital) pour
// donner vie aux zones. Sur l'orbital, ce sont des animaux de compagnie ou des
// drones de cargo. Le `pos` est recalé au sol par chaque animal.

export interface AmbientSpawn {
  id: string;
  animal: string; // id d'un AMBIENT_ANIMALS
  pos: [number, number, number];
}

export const AMBIENT_SPAWNS: Record<string, AmbientSpawn[]> = {
  forge: [
    { id: "forge_cow1",       animal: "cow",       pos: [18, 0, -6] },
    { id: "forge_cow2",       animal: "cow",       pos: [22, 0, -11] },
    { id: "forge_dog1",       animal: "dog",       pos: [9, 0, 19] },
    { id: "forge_goat1",      animal: "goat",      pos: [-14, 0, 12] },
    { id: "forge_goat2",      animal: "goat",      pos: [-16, 0, 14] },
    { id: "forge_horse1",     animal: "horse",     pos: [-10, 0, -8] },
    { id: "forge_horse2",     animal: "horse",     pos: [26, 0, 2] },
    { id: "forge_girafe1",    animal: "girafe",    pos: [30, 0, 5] },
    { id: "forge_butterfly1", animal: "butterfly", pos: [4, 0, 6] },
    { id: "forge_butterfly2", animal: "butterfly", pos: [-6, 0, 10] },
    { id: "forge_lion1",      animal: "lion",      pos: [1, 0, 4] },
  ],
  tower: [
    { id: "tower_dog1",       animal: "dog",       pos: [12, 0, 9] },
    { id: "tower_goat1",      animal: "goat",      pos: [-8, 0, 11] },
    { id: "tower_butterfly1", animal: "butterfly", pos: [6, 0, -4] },
    { id: "tower_butterfly2", animal: "butterfly", pos: [-4, 0, 7] },
    { id: "tower_lion1",      animal: "lion",      pos: [2, 0, 3] },
  ],
  orbital: [
    { id: "orbital_dog1",       animal: "dog",       pos: [10, 0, -3] },
    { id: "orbital_goat1",      animal: "goat",      pos: [5, 0, 10] },
    { id: "orbital_goat2",      animal: "goat",      pos: [-4, 0, 12] },
    { id: "orbital_butterfly1", animal: "butterfly", pos: [3, 0, -2] },
    { id: "orbital_butterfly2", animal: "butterfly", pos: [-2, 0, 5] },
    { id: "orbital_lion1",      animal: "lion",      pos: [7, 0, 0] },
  ],
};

export function ambientSpawnsForMap(mapId: string): AmbientSpawn[] {
  return AMBIENT_SPAWNS[mapId] ?? [];
}
