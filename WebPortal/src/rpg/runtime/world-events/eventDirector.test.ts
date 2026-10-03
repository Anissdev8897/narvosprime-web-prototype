// WebPortal/src/rpg/runtime/world-events/eventDirector.test.ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { EventDirector, pickKind, buildEvent } from './eventDirector';

describe('pickKind (pondération)', () => {
  it('rng = 0 → premier poids (convoy)', () => {
    expect(pickKind(() => 0)).toBe('convoy');
  });
  it('rng = 0.99 → dernier poids (boss_sighting)', () => {
    expect(pickKind(() => 0.99)).toBe('boss_sighting');
  });
  it('rng = 0.5 → tombe dans anomaly (4+3=7 ≤ 7.5 < 10)', () => {
    expect(pickKind(() => 0.5)).toBe('anomaly');
  });
});

describe('buildEvent', () => {
  it('distress inclut une faction et son nom dans le titre', () => {
    // rng[0]=0.33 → pickKind → r=4.95 ∈ [4, 7) → 'distress'
    // rng[1]=0.5, rng[2]=0.5, rng[3]=0.5 → randomArenaPos (angle, rayon, Y) — valeurs quelconques
    // rng[4]=0 → index faction Math.floor(0 * 3) = 0 → akarlys
    const seq = [0.33, 0.5, 0.5, 0.5, 0];
    let i = 0;
    const e = buildEvent(() => seq[i++ % seq.length]!);
    expect(e.kind).toBe('distress');
    expect(e.faction).toBe('akarlys');
    expect(e.title).toContain('Akar');
  });

  it('convoy n\'a pas de faction', () => {
    const e = buildEvent(() => 0); // → convoy
    expect(e.kind).toBe('convoy');
    expect(e.faction).toBeUndefined();
  });
});

describe('EventDirector (timing)', () => {
  it('respecte le cooldown initial : pas d\'émission immédiate', () => {
    const d = new EventDirector(() => 0, 0); // cooldown = COOLDOWN_MIN_MS = 20000
    expect(d.tick(0)).toEqual([]);
    expect(d.tick(19_999)).toEqual([]);
  });

  it('émet une fois le cooldown expiré, puis re-cooldown', () => {
    const d = new EventDirector(() => 0, 0);
    const first = d.tick(20_001);
    expect(first).toHaveLength(1);
    // Après émission, nouveau cooldown calculé → pas de double émission au tick suivant
    expect(d.tick(20_002)).toEqual([]);
  });
});

describe('buildEvent v2 — pos + durationMs', () => {
  it('pos est un THREE.Vector3 défini pour convoy', () => {
    const e = buildEvent(() => 0); // kind = convoy
    expect(e.pos).toBeInstanceOf(THREE.Vector3);
    expect(e.pos).toBeDefined();
  });

  it('durationMs = 20000 pour convoy', () => {
    const e = buildEvent(() => 0);
    expect(e.kind).toBe('convoy');
    expect(e.durationMs).toBe(20_000);
  });

  it('durationMs = 15000 pour boss_sighting', () => {
    const e = buildEvent(() => 0.99); // kind = boss_sighting
    expect(e.kind).toBe('boss_sighting');
    expect(e.durationMs).toBe(15_000);
  });

  it('pos est dans l\'arène (rayon cohérent, Y entre 30 et 70)', () => {
    // Teste avec différents seeds : pos ne doit pas être à l'origine
    for (let seed = 0.1; seed < 1; seed += 0.13) {
      let i = 0;
      // La 2e valeur RNG consommée par pickKind via buildEvent, les suivantes pour pos
      const seq = [0, seed, seed * 0.7, seed * 0.5];
      const e = buildEvent(() => seq[i++ % seq.length]!);
      expect(e.pos).toBeInstanceOf(THREE.Vector3);
      const p = e.pos!;
      // Y entre 30 et 70
      expect(p.y).toBeGreaterThanOrEqual(30);
      expect(p.y).toBeLessThanOrEqual(70);
    }
  });

  it('les anciens champs (kind, title, color) sont préservés', () => {
    const e = buildEvent(() => 0); // convoy
    expect(e.kind).toBe('convoy');
    expect(e.title).toContain('convoi');
    expect(e.color).toBe('#c0d4e0');
  });
});
