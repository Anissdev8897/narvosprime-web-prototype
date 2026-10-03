// WebPortal/src/rpg/runtime/factions-ai/factionsAI.test.ts
import { describe, it, expect } from 'vitest';
import { FactionsAI } from './factionsAI';
import type { FactionId, FactionRelation } from '../core/worldTypes';

const allEnemies = (_a: FactionId, _b: FactionId): FactionRelation => 'enemy';

describe('FactionsAI', () => {
  it('déclenche une trêve quand A et B (ennemis) ont chacun ≥4 pertes dans la fenêtre', () => {
    const ai = new FactionsAI();
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('akarlys', 1000 + i * 100);
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('mezalayis', 1000 + i * 100);
    const transitions = ai.tick(1500, allEnemies);
    const t = transitions.find((x) => x.a === 'akarlys' && x.b === 'mezalayis');
    expect(t).toBeDefined();
    expect(t!.relation).toBe('neutral');
  });

  it("ne re-déclenche pas la trêve tant qu'elle est active", () => {
    const ai = new FactionsAI();
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('akarlys', 1000);
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('mezalayis', 1000);
    ai.tick(1500, allEnemies); // déclenche la trêve

    // Après la trêve, la relation effective est 'neutral' (l'applicateur a setRelation)
    const truceRelation = (a: FactionId, b: FactionId): FactionRelation =>
      (a === 'akarlys' && b === 'mezalayis') || (a === 'mezalayis' && b === 'akarlys') ? 'neutral' : 'enemy';

    for (let i = 0; i < 4; i++) ai.onShipDestroyed('akarlys', 2000);
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('mezalayis', 2000);
    const t2 = ai.tick(2500, truceRelation);
    const dup = t2.find((x) => x.a === 'akarlys' && x.b === 'mezalayis' && x.relation === 'neutral');
    expect(dup).toBeUndefined();
  });

  it('produit la reprise enemy quand la trêve expire', () => {
    const ai = new FactionsAI();
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('akarlys', 1000);
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('mezalayis', 1000);
    ai.tick(1500, allEnemies); // trêve installée, until = 1500 + 18000 = 19500
    const t = ai.tick(20_000, allEnemies);
    const reprise = t.find((x) => x.a === 'akarlys' && x.b === 'mezalayis' && x.relation === 'enemy');
    expect(reprise).toBeDefined();
  });

  it('ignore les pertes hors fenêtre (anciennes)', () => {
    const ai = new FactionsAI();
    // 4 pertes très anciennes (>windowMs)
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('akarlys', 0);
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('mezalayis', 0);
    // 2 pertes récentes seulement (sous le seuil)
    for (let i = 0; i < 2; i++) ai.onShipDestroyed('akarlys', 100_000);
    for (let i = 0; i < 2; i++) ai.onShipDestroyed('mezalayis', 100_000);
    const t = ai.tick(100_500, allEnemies);
    expect(t.length).toBe(0);
  });

  it('dispose() retourne les transitions pour restaurer les trêves actives à enemy', () => {
    const ai = new FactionsAI();
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('akarlys', 1000);
    for (let i = 0; i < 4; i++) ai.onShipDestroyed('mezalayis', 1000);
    ai.tick(1500, allEnemies); // trêve installée
    const restored = ai.dispose();
    const back = restored.find((x) => x.a === 'akarlys' && x.b === 'mezalayis' && x.relation === 'enemy');
    expect(back).toBeDefined();
  });

  // ─── Tests Prompt 11 v2 : Alliances défensives ───────────────────────────

  it('alliance défensive : 6 frappes mezalayis→akarlys déclenche akarlys+zayan ally', () => {
    const ai = new FactionsAI();
    const t0 = 1_000;
    // 6 frappes : mezalayis attaque akarlys
    for (let i = 0; i < 6; i++) ai.onCombatHit('akarlys', 'mezalayis', t0 + i * 50);
    // currentRelation : tous ennemis → aucune faction n'est déjà ennemie de la victime (akarlys)
    // donc zayan est éligible comme allié (non ennemi d'akarlys selon allEnemies → SAUF si on interprète
    // "pas ennemi" comme != 'enemy'. Ici allEnemies renvoie 'enemy', donc on a besoin d'une relation neutre.
    // On utilise une relation où akarlys–zayan sont neutres pour que l'alliance soit possible.
    const mixedRelation = (a: FactionId, b: FactionId): FactionRelation => {
      if ((a === 'akarlys' && b === 'mezalayis') || (a === 'mezalayis' && b === 'akarlys')) return 'enemy';
      return 'neutral';
    };
    const transitions = ai.tick(t0 + 100, mixedRelation);
    const allyTransition = transitions.find(
      (x) => x.relation === 'ally' && ((x.a === 'akarlys' && x.b === 'zayan') || (x.a === 'zayan' && x.b === 'akarlys'))
    );
    expect(allyTransition).toBeDefined();
  });

  it('reprise alliance : après ALLIANCE_DURATION_MS, la paire revient neutral', () => {
    const ai = new FactionsAI();
    const t0 = 1_000;
    for (let i = 0; i < 6; i++) ai.onCombatHit('akarlys', 'mezalayis', t0 + i * 50);
    const mixedRelation = (a: FactionId, b: FactionId): FactionRelation => {
      if ((a === 'akarlys' && b === 'mezalayis') || (a === 'mezalayis' && b === 'akarlys')) return 'enemy';
      return 'neutral';
    };
    // Premier tick : crée l'alliance
    ai.tick(t0 + 100, mixedRelation);
    // Tick après expiration (25 000 ms plus tard)
    const tExpired = t0 + 100 + 25_001;
    const transitions = ai.tick(tExpired, mixedRelation);
    const resumeTransition = transitions.find(
      (x) => x.relation === 'neutral' &&
        ((x.a === 'akarlys' && x.b === 'zayan') || (x.a === 'zayan' && x.b === 'akarlys'))
    );
    expect(resumeTransition).toBeDefined();
  });

  it('dispose() étendu : restaure aussi les alliances actives à neutral', () => {
    const ai = new FactionsAI();
    const t0 = 1_000;
    for (let i = 0; i < 6; i++) ai.onCombatHit('akarlys', 'mezalayis', t0 + i * 50);
    const mixedRelation = (a: FactionId, b: FactionId): FactionRelation => {
      if ((a === 'akarlys' && b === 'mezalayis') || (a === 'mezalayis' && b === 'akarlys')) return 'enemy';
      return 'neutral';
    };
    // Crée l'alliance akarlys–zayan
    ai.tick(t0 + 100, mixedRelation);
    const restored = ai.dispose();
    const allianceRestored = restored.find(
      (x) => x.relation === 'neutral' &&
        ((x.a === 'akarlys' && x.b === 'zayan') || (x.a === 'zayan' && x.b === 'akarlys'))
    );
    expect(allianceRestored).toBeDefined();
  });

  it("friendly fire ignoré : onCombatHit('akarlys','akarlys') ne crée pas d'alliance", () => {
    const ai = new FactionsAI();
    const t0 = 1_000;
    // 6 frappes friendly fire
    for (let i = 0; i < 6; i++) ai.onCombatHit('akarlys', 'akarlys', t0 + i * 50);
    const transitions = ai.tick(t0 + 100, allEnemies);
    const allyTransition = transitions.find((x) => x.relation === 'ally');
    expect(allyTransition).toBeUndefined();
  });
});
