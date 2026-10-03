// ══════════════════════════════════════════════════════════════════════════════
// audio/AudioEventManager.test.ts — Tests de l'AudioEventManager
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { KillStreakAudioSystem, KILLSTREAK_WINDOW } from './killStreakAudio';

// Mock du module AudioManager pour éviter les dépendances DOM (new Audio())
vi.mock('../../utils/AudioManager', () => ({
  audioManager: {
    playSfxKey: vi.fn(),
    playAnnouncement: vi.fn(),
    setMusicVolume: vi.fn(),
    setSfxVolume: vi.fn(),
    setVoiceVolume: vi.fn(),
    playSfx: vi.fn(),
  },
}));

// ── Tests structurels sur l'export ───────────────────────────────────────────

describe('AudioEventManager — structure', () => {
  it('le module exporte audioEvents avec les sous-systèmes attendus', async () => {
    const mod = await import('./audioEventManager');
    expect(mod.audioEvents).toBeDefined();
    expect(mod.audioEvents.killStreak).toBeDefined();
    expect(mod.audioEvents.area).toBeDefined();
    expect(mod.audioEvents.bossWarning).toBeDefined();
    expect(mod.QUEST_VOICE).toBe('queteune.mp3');
  });

  it('audioEvents peut recevoir un callback onStreakLabel', async () => {
    const { audioEvents } = await import('./audioEventManager');
    expect(audioEvents.onStreakLabel).toBeUndefined();
    const fn = () => {};
    audioEvents.onStreakLabel = fn;
    expect(audioEvents.onStreakLabel).toBe(fn);
    audioEvents.onStreakLabel = undefined;
  });
});

describe('AudioEventManager — event-driven', () => {
  it('supporte subscribe/emit/off', async () => {
    const { audioEvents } = await import('./audioEventManager');

    const events: string[] = [];
    const handler = () => { events.push('called'); };

    audioEvents.on('kill', handler);
    audioEvents.emit('kill', { streak: 1 });
    expect(events).toContain('called');

    audioEvents.off('kill', handler);
    // Après off, le handler n'est plus appelé
    events.length = 0;
    audioEvents.emit('kill', { streak: 2 });
    expect(events).not.toContain('called');
  });

  it('emit appelle les handlers avec payload', async () => {
    const { audioEvents } = await import('./audioEventManager');

    let captured: unknown = null;
    audioEvents.on('kill', (_e, payload) => { captured = payload; });
    audioEvents.emit('kill', { streak: 5 });
    expect(captured).toEqual({ streak: 5 });
  });
});

describe('AudioEventManager — API existante (backward compat)', () => {
  it('registerKill délègue au killStreak (sans jouer audio)', async () => {
    const { audioEvents } = await import('./audioEventManager');

    audioEvents.killStreak.reset();
    const s1 = audioEvents.registerKill();
    expect(s1).toBe(1);
  });

  it('tick avance le killStreak (sans jouer audio)', async () => {
    const { audioEvents } = await import('./audioEventManager');
    audioEvents.killStreak.reset();

    audioEvents.registerKill(); // streak = 1
    audioEvents.registerKill(); // streak = 2
    expect(audioEvents.killStreak.streak).toBe(2);

    audioEvents.tick(KILLSTREAK_WINDOW + 1);
    expect(audioEvents.killStreak.streak).toBe(0);
  });

  it('reset nettoie le killStreak et bossWarning', async () => {
    const { audioEvents } = await import('./audioEventManager');
    audioEvents.killStreak.reset();

    audioEvents.registerKill(); // streak = 1
    expect(audioEvents.killStreak.streak).toBe(1);

    audioEvents.reset();
    expect(audioEvents.killStreak.streak).toBe(0);
  });

  it('bossEngaged délègue à bossWarning', async () => {
    const { audioEvents } = await import('./audioEventManager');
    expect(() => audioEvents.bossEngaged('boss_001')).not.toThrow();
  });

  it('dispose libère les ressources', async () => {
    const { audioEvents } = await import('./audioEventManager');
    // vérifie que dispose ne lance pas d'erreur
    expect(() => audioEvents.dispose()).not.toThrow();
  });
});

describe('KillStreakAudioSystem (backward compat)', () => {
  it('fonctionne sans régression avec mock play', () => {
    const played: string[] = [];
    const ks = new KillStreakAudioSystem((f) => played.push(f));
    expect(ks.onKill()).toBe(1);
    ks.tick(2);
    expect(ks.onKill()).toBe(2);
    expect(played).toEqual(['double_kils.mp3']);
  });

  it('reset remet le compteur à zéro', () => {
    const ks = new KillStreakAudioSystem(() => {});
    ks.onKill(); ks.onKill();
    expect(ks.streak).toBe(2);
    ks.reset();
    expect(ks.streak).toBe(0);
  });
});
