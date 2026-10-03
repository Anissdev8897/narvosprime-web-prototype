// ══════════════════════════════════════════════════════════════════════════════
// audio/audioEventManager.ts — AudioEventManager : façade événementielle + sous-systèmes
//
// Point d'entrée unique qui orchestre :
//   • Sous-systèmes modulaires (Music, SFX, Ambiance, Voice, Footsteps)
//   • Systèmes existants (KillStreakAudioSystem, AreaAnnouncementSystem, BossWarningAudioSystem)
//   • Mapping événement → son (event-driven : subscribe + emit)
//
// Version améliorée avec support des abonnements par événement et intégration
// aux nouveaux sous-systèmes. BACKWARD COMPATIBLE avec l'API existante.
// ══════════════════════════════════════════════════════════════════════════════

import { audioManager } from '../../utils/AudioManager';
import { KillStreakAudioSystem, killStreakLabel } from './killStreakAudio';
import { AreaAnnouncementSystem } from './areaAnnouncements';
import { BossWarningAudioSystem } from './bossWarningAudio';
import type { GameAudioEvent, AudioEventHandler, IAudioSystem } from './types';

/** Voix de quête (PNJ donneur de quête) — non spatial. */
export const QUEST_VOICE = 'queteune.mp3';

// ── Constantes de mapping événement → son ─────────────────────────────────────
// À enrichir au fur et à mesure de l'implémentation.
const EVENT_SOUND_MAP: Partial<Record<GameAudioEvent, string>> = {
  kill:          'kill_confirmed',
  death:         'player_death',
  levelUp:       'level_up',
  questAccepted: QUEST_VOICE,
  itemPickup:    'item_pickup',
  ui_click:      'ui_click',
  ui_hover:      'ui_hover',
  ui_close:      'ui_close',
  jump:          'player_jump',
  land:          'player_land',
};

// ── Classe principale ─────────────────────────────────────────────────────────

export class AudioEventManager {
  // Sous-systèmes existants (conservés pour backward compat)
  readonly killStreak = new KillStreakAudioSystem();
  readonly area = new AreaAnnouncementSystem();
  readonly bossWarning = new BossWarningAudioSystem();

  // Sous-systèmes modulaires (injectés après init)
  private _subsystems: IAudioSystem[] = [];

  // Tableau des handlers par événement
  private _handlers = new Map<GameAudioEvent, Set<AudioEventHandler>>();

  // Cache des sons joués (anti-spam)
  private _recentlyPlayed = new Map<string, number>(); // soundKey → timestamp

  /** Optionnel : callback pour afficher un toast de palier (« DOUBLE KILL »…). */
  onStreakLabel?: (label: string, streak: number) => void;

  // ── Injection des sous-systèmes modulaires ────────────────────────────────

  /** Enregistre un sous-système modulaire (appelé par ModularAudioManager.init()). */
  registerSubsystem(system: IAudioSystem): void {
    this._subsystems.push(system);
  }

  // ── API événementielle ─────────────────────────────────────────────────────

  /** Souscrire à un événement audio. */
  on(event: GameAudioEvent, handler: AudioEventHandler): void {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);
  }

  /** Se désabonner d'un événement. */
  off(event: GameAudioEvent, handler: AudioEventHandler): void {
    const set = this._handlers.get(event);
    if (set) set.delete(handler);
  }

  /** Émettre un événement audio → tous les handlers + son mapping. */
  emit(event: GameAudioEvent, payload?: unknown): void {
    // 1. Notifier les handlers abonnés
    const set = this._handlers.get(event);
    if (set) {
      set.forEach((handler) => {
        try { handler(event, payload); } catch (e) {
          console.warn(`[AudioEventManager] handler error for "${event}":`, e);
        }
      });
    }

    // 2. Jouer le son mappé (si existant et pas spam)
    const soundKey = EVENT_SOUND_MAP[event];
    if (soundKey) {
      const now = Date.now();
      const last = this._recentlyPlayed.get(soundKey) ?? 0;
      // Anti-spam : minimum 100ms entre deux occurrences du même son
      if (now - last > 100) {
        this._recentlyPlayed.set(soundKey, now);
        audioManager.playSfxKey(soundKey);
      }
    }
  }

  // ── API existante (backward compat) ────────────────────────────────────────

  /** Un ennemi vient d'être tué → série + annonce. */
  registerKill(): number {
    const streak = this.killStreak.onKill();
    const label = killStreakLabel(streak);
    if (label && this.onStreakLabel) this.onStreakLabel(label, streak);
    this.emit('kill', { streak });
    return streak;
  }

  /** Entrée en combat d'un boss → alerte AoE (1×). */
  bossEngaged(bossId: string): void {
    this.bossWarning.onBossEngaged(bossId);
    this.emit('bossEngaged', { bossId });
  }

  /** Entrée dans une map → séquence d'annonce. */
  enterMap(mapId: string): void {
    this.area.onMapEnter(mapId);
    this.emit('mapEnter', { mapId });
  }

  /** Quête acceptée → voix. */
  questAccepted(): void {
    audioManager.playAnnouncement(QUEST_VOICE);
    this.emit('questAccepted');
  }

  /** Avance les timers (killstreak). À appeler chaque frame. */
  tick(dt: number): void {
    this.killStreak.tick(dt);
    // Tick les sous-systèmes modulaires
    for (const sys of this._subsystems) {
      if (sys.update) sys.update(dt);
    }
  }

  /** Reset (mort / changement de map). */
  reset(): void {
    this.killStreak.reset();
    this.bossWarning.reset();
    this._recentlyPlayed.clear();
    this.emit('mapExit');
  }

  /** Libère tous les sous-systèmes. */
  dispose(): void {
    this._handlers.clear();
    this._recentlyPlayed.clear();
    for (const sys of this._subsystems) {
      sys.dispose();
    }
    this._subsystems = [];
  }
}

export const audioEvents = new AudioEventManager();
