/**
 * SfxManager.ts - Gestion des sons d'effets (combat, UI, ambiance).
 *
 * Singleton qui charge des AudioBuffers une fois et les rejoue a la demande.
 * Volume controle via les memes settings que la musique (audioManager).
 *
 * SFX disponibles : cast, impact, death, click, victory, defeat, levelup, portal.
 * Si un SFX manque, on tente un fallback (silent ou autre son).
 */

const SFX_PATHS: Record<string, string> = {
  cast: '/textures/audio/sfx/Buttons/click_001.wav',
  impact: '/textures/audio/sfx/Glitch/glitch_short_001.wav',
  death: '/textures/audio/sfx/Cinematic Glitch/cinematic_glitch_001.wav',
  click: '/textures/audio/sfx/Buttons/click_001.wav',
  victory: '/textures/audio/sfx/Transitions/transition_001.wav',
  defeat: '/textures/audio/sfx/Cinematic Glitch/cinematic_glitch_002.wav',
  levelup: '/textures/audio/sfx/Transitions/transition_002.wav',
  portal: '/textures/audio/sfx/Glitch/glitch_short_002.wav',
};

type SfxId = keyof typeof SFX_PATHS;

class SfxManagerImpl {
  private cache: Record<string, HTMLAudioElement> = {};
  private volume: number = 0.5;

  constructor() {
    this.loadVolume();
  }

  private loadVolume() {
    try {
      const s = localStorage.getItem('narvos_audio_settings');
      if (s) { const v = JSON.parse(s); this.volume = v.sfx ?? 0.5; }
    } catch (_) { /* */ }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    try {
      const s = localStorage.getItem('narvos_audio_settings');
      const obj = s ? JSON.parse(s) : {};
      obj.sfx = this.volume;
      localStorage.setItem('narvos_audio_settings', JSON.stringify(obj));
    } catch (_) { /* */ }
  }

  /**
   * Joue un effet sonore. Tolerant : log warning si fichier absent, ne crash pas.
   */
  play(id: string, volumeMul: number = 1) {
    const path = SFX_PATHS[id as SfxId] || id; // accepte aussi un path direct
    if (!path) return;
    let audio = this.cache[path];
    if (!audio) {
      audio = new Audio(path);
      audio.preload = 'auto';
      this.cache[path] = audio;
    }
    try {
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.max(0, Math.min(1, this.volume * volumeMul));
      clone.play().catch(() => { /* silent (autoplay policy) */ });
    } catch (_) { /* */ }
  }

  /** Pre-charge tous les SFX (optionnel, evite latence au premier play). */
  preload() {
    Object.values(SFX_PATHS).forEach((path) => {
      if (this.cache[path]) return;
      const a = new Audio(path);
      a.preload = 'auto';
      this.cache[path] = a;
    });
  }
}

export const sfxManager = new SfxManagerImpl();

// Expose globalement pour debug
try {
  const w = window as any;
  if (w && !w.narvosLauncher?.sfxManager) {
    w.narvosLauncher = w.narvosLauncher || {};
    w.narvosLauncher.sfxManager = sfxManager;
  }
} catch (_) { /* SSR safe */ }
