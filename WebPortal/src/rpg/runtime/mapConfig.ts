// runtime/mapConfig.ts — réglages par map qui ne tiennent pas dans le manifeste d'assets.
//
// MAP_SPAWN : point d'apparition du joueur à PIED quand on arrive sur la map
// (utilisé par travelTo). Repli (0,5,0) si la map n'est pas listée.
//
// ⚠️ Repère : le GLB est exporté depuis Blender (Z-up) → glTF (Y-up). La
// conversion mappe Blender (x, y, z) → jeu (x, z, -y). Le donjon a son Entrée
// en Blender (0, -34) → jeu (0, ~, +34). On dépose donc le joueur vers z=+32,
// face à l'arène (centre en 0,0,0), regard par défaut vers -Z.

export const MAP_SPAWN: Record<string, [number, number, number]> = {
  // FORGE — corrigé le 31/07/2026 sur mesure de la géométrie, pas à l'œil.
  //
  // L'ancienne valeur [0, -26, 10] était fausse sur les DEUX axes, et deux
  // corrections successives à l'aveugle (5 → −26) l'ont laissée fausse :
  //
  //   • en Y : l'emprise réelle des 8 chunks (accesseurs POSITION des GLB +
  //     offset [181,−401,−47]) plafonne à −51 pour la géométrie jouable.
  //     −26 est donc AU-DESSUS de toute la map — le joueur naissait en l'air.
  //   • en XZ : (0, 10) est hors de 5 chunks sur 8, et le seul sol qui s'y
  //     trouve appartient au chunk 1, dont la géométrie monte jusqu'à −168.
  //     Le joueur s'y retrouvait sous ~60 m de structure : écran noir, faces
  //     arrière cullées, rien à voir.
  //
  // Nouvelle valeur = centre de l'emprise mesurée en XZ. Le Y n'est plus qu'une
  // indication : `PlayerRig` repose le joueur sur le sol réel mesuré au moment
  // où la map est assemblée (cf. le gel physique), donc une erreur de quelques
  // mètres se corrige toute seule. Une erreur de 200 m, elle, se voyait.
  //
  // Emprise mesurée (monde) : X[−2125, 1238] · Y[−536, 475] · Z[−736, 2160]
  // Centre XZ : (−444, 712)
  forge: [-444, -60, 712],
  donjon_furiste: [0, 6, 34],
  // Orbital — le contenu réel est vers x ≈ 700–7000. (0,5,0) tombe dans le vide.
  // Point de repli placé à l'entrée de la zone de contenu ; l'admin peut le
  // repositionner avec l'outil "🚩 Spawn" si nécessaire.
  orbital: [1000, 50, 0],
};

import { spawnPointStore } from "./spawnPointStore";

export function mapSpawn(mapId: string): [number, number, number] {
  // Point custom de l'éditeur (déplaçable) > réglage statique > repli.
  return spawnPointStore.get(mapId) ?? MAP_SPAWN[mapId] ?? [0, 5, 0];
}
