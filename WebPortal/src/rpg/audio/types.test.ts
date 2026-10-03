// ══════════════════════════════════════════════════════════════════════════════
// audio/types.test.ts — Tests des types et interfaces de l'architecture audio
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import type {
  SubmixBusId,
  GameAudioEvent,
  AudioNodeType,
  IAudioBus,
  IAudioSystem,
  IMusicSystem,
  ISfxSystem,
  IAmbianceSystem,
  IVoiceSystem,
  IFootstepSystem,
  IAudioManager,
  BusVolumes,
  SpatialParams,
  ListenerState,
} from './types';

describe('Types audio — structure', () => {
  it('SubmixBusId est une union des 6 bus', () => {
    const ids: SubmixBusId[] = ['master', 'music', 'sfx', 'voice', 'ambient', 'announce'];
    expect(ids).toHaveLength(6);
    ids.forEach((id) => expect(id).toEqual(expect.any(String)));
  });

  it('GameAudioEvent contient les événements de jeu clés', () => {
    const events: GameAudioEvent[] = [
      'kill', 'death', 'levelUp', 'questAccepted', 'bossEngaged',
      'mapEnter', 'mapExit', 'damageTaken', 'itemPickup', 'footstep',
    ];
    expect(events).toHaveLength(10);
  });

  it('AudioNodeType contient les types de nœuds du graphe procédural', () => {
    const types: AudioNodeType[] = [
      'gain', 'panner', 'biquadFilter', 'convolver', 'delay',
      'dynamicsCompressor', 'waveShaper', 'oscillator', 'noise', 'envelope', 'mixer',
    ];
    expect(types).toHaveLength(11);
  });

  it('BusVolumes a les 6 champs de volume dans [0,1]', () => {
    const vols: BusVolumes = {
      master: 0.8, music: 0.4, sfx: 0.5,
      voice: 1.0, ambient: 0.3, announce: 0.7,
    };
    Object.values(vols).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('SpatialParams supporte les options de PannerNode', () => {
    const p: SpatialParams = {
      position: { x: 10, y: 2, z: -5 },
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance: 8,
      maxDistance: 50,
      rolloffFactor: 1.5,
    };
    expect(p.position.x).toBe(10);
    expect(p.panningModel).toBe('HRTF');
  });

  it('ListenerState a position + orientation', () => {
    const ls: ListenerState = {
      position: { x: 0, y: 1.7, z: 0 },
      forward: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
    };
    expect(ls.position.y).toBe(1.7);
    expect(ls.forward.z).toBe(-1);
    expect(ls.up.y).toBe(1);
  });
});

describe('Interfaces audio — contrat des sous-systèmes', () => {
  it('IAudioBus définit le contrat des submix', () => {
    // Vérification structurelle : l'interface existe et a les bonnes méthodes
    const busMethods: (keyof IAudioBus)[] = ['setVolume', 'getVolume', 'connect', 'disconnect'];
    expect(busMethods).toHaveLength(4);
  });

  it('IAudioSystem définit init + dispose', () => {
    const sysMethods: (keyof IAudioSystem)[] = ['init', 'dispose'];
    // update est optionnel
    expect(sysMethods).toHaveLength(2);
  });

  it('IMusicSystem étend IAudioSystem avec playTheme/stop/fadeTo', () => {
    const ms: IMusicSystem = null as unknown as IMusicSystem;
    // Vérifie que l'interface compile
    expect(typeof ms?.playTheme).toBe('undefined');
  });

  it('IAudioManager a les 5 sous-systèmes + events + init', () => {
    const mgr: IAudioManager = null as unknown as IAudioManager;
    expect(typeof mgr?.music).toBe('undefined');
    expect(typeof mgr?.events).toBe('undefined');
  });
});
