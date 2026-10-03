// audio/killStreakAudio.ts — KillStreakAudioSystem (style LoL / Halo).
//
// Compte les kills rapprochés : tant que le joueur tue dans la FENÊTRE de temps,
// la série monte et les annonces escaladent. Au-delà de la fenêtre → reset.
//   2 → double · 3 → triple · 4 → quadra · 5 → penta · 6+ → massacre
// Logique PURE (compteur + timer) ; la lecture audio est injectée → testable.

import { audioManager } from "../../utils/AudioManager";

/** Fenêtre (s) entre deux kills pour garder la série. */
export const KILLSTREAK_WINDOW = 10;

/** Annonce associée à une série de n kills (null = pas d'annonce). */
export function killStreakClip(n: number): string | null {
  if (n === 2) return "double_kils.mp3";
  if (n === 3) return "triple_frague.mp3";
  if (n === 4) return "quadra_kils.mp3";
  if (n === 5) return "pentakil.mp3";
  if (n >= 6) return "masacre.mp3"; // série très élevée
  return null;
}

/** Libellé affiché (toast) pour le palier de série. */
export function killStreakLabel(n: number): string | null {
  if (n === 2) return "DOUBLE KILL";
  if (n === 3) return "TRIPLE KILL";
  if (n === 4) return "QUADRA KILL";
  if (n === 5) return "PENTA KILL";
  if (n >= 6) return "MASSACRE";
  return null;
}

export class KillStreakAudioSystem {
  private count = 0;
  private sinceLastKill = 0; // s écoulées depuis le dernier kill
  constructor(private play: (file: string) => void = (f) => audioManager.playAnnouncement(f)) {}

  /** Enregistre un kill. Retourne la série courante (≥1). Joue l'annonce du palier. */
  onKill(): number {
    // Si la fenêtre a expiré avant ce kill, on repart de zéro.
    if (this.sinceLastKill > KILLSTREAK_WINDOW) this.count = 0;
    this.count += 1;
    this.sinceLastKill = 0;
    const clip = killStreakClip(this.count);
    if (clip) this.play(clip);
    return this.count;
  }

  /** Avance le timer ; remet la série à zéro si la fenêtre est dépassée. */
  tick(dt: number): void {
    if (this.count === 0) return;
    this.sinceLastKill += dt;
    if (this.sinceLastKill > KILLSTREAK_WINDOW) this.count = 0;
  }

  get streak(): number { return this.count; }
  /** Fraction de la fenêtre de combo restante (1 = vient de tuer · 0 = expirée). */
  windowFraction(): number {
    if (this.count === 0) return 0;
    return Math.max(0, 1 - this.sinceLastKill / KILLSTREAK_WINDOW);
  }
  reset(): void { this.count = 0; this.sinceLastKill = 0; }
}
