// audio/bossWarningAudio.ts — BossWarningAudioSystem (alerte AoE de boss).
//
// À la PREMIÈRE entrée en combat contre un boss : une alerte audio prévient que
// le boss a des attaques de zone à esquiver. Jouée UNE seule fois par boss (pas
// en boucle) → mémorise les boss déjà annoncés.

import { audioManager } from "../../utils/AudioManager";

/** Fichier d'alerte AoE de boss. */
export const BOSS_AOE_WARNING = "aoe.mp3";

export class BossWarningAudioSystem {
  private warned = new Set<string>();
  constructor(private play: (file: string) => void = (f) => audioManager.playAnnouncement(f)) {}

  /** Entrée en combat d'un boss : alerte AoE jouée 1× par boss. */
  onBossEngaged(bossId: string): void {
    if (this.warned.has(bossId)) return;
    this.warned.add(bossId);
    this.play(BOSS_AOE_WARNING);
  }

  /** Oublie les boss annoncés (changement de map / respawn). */
  reset(): void { this.warned.clear(); }
}
