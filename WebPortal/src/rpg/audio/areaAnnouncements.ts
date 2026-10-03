// audio/areaAnnouncements.ts — AreaAnnouncementSystem (identité sonore des maps).
//
// À l'entrée d'une map : annonce d'entrée, PUIS (après un délai) la prévention du
// niveau conseillé. Les donjons ont une annonce immersive unique. Une seule
// séquence par entrée (ré-entrer la map la rejoue).

import { audioManager } from "../../utils/AudioManager";

/** Annonces par map normale : entrée + niveau conseillé. */
export const AREA_ANNOUNCE: Record<string, { entry: string; level: string }> = {
  forge:   { entry: "entre_de_la_mapforge.mp3",  level: "1_a_10_mapforge.mp3" },
  orbital: { entry: "entrerzoneorbital.mp3",     level: "orbital_zone_20_30.mp3" },
  tower:   { entry: "entre_de_la_map_tower.mp3", level: "zone_40_a_50_tower.mp3" },
};

/** Annonce immersive d'entrée de donjon (unique). */
export const DUNGEON_ANNOUNCE = "entre_dans_le_dojon.mp3";

/** Délai (ms) entre l'annonce d'entrée et celle du niveau conseillé. */
const LEVEL_DELAY_MS = 3500;

/** true si l'id de map désigne un donjon. */
function isDungeon(mapId: string): boolean {
  return mapId.startsWith("donjon");
}

export class AreaAnnouncementSystem {
  // schedule injecté → testable sans setTimeout réel.
  constructor(
    private play: (file: string) => void = (f) => audioManager.playAnnouncement(f),
    private schedule: (fn: () => void, ms: number) => void = (fn, ms) => { setTimeout(fn, ms); },
  ) {}

  /** Joue la séquence d'entrée de la map. Retourne true si quelque chose a été joué. */
  onMapEnter(mapId: string): boolean {
    if (isDungeon(mapId)) {
      this.play(DUNGEON_ANNOUNCE);
      return true;
    }
    const a = AREA_ANNOUNCE[mapId];
    if (!a) return false;
    this.play(a.entry);
    this.schedule(() => this.play(a.level), LEVEL_DELAY_MS);
    return true;
  }
}
