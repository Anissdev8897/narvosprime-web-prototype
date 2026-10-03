// WebPortal/src/rpg/runtime/feed/worldFeedLog.test.ts
import { describe, it, expect } from 'vitest';
import { WorldFeedLog } from './worldFeedLog';

describe('WorldFeedLog', () => {
  it('agrège les destructions rapprochées en un seul message', () => {
    const log = new WorldFeedLog();
    log.shipDestroyed('akarlys', 1000);
    log.shipDestroyed('akarlys', 1500);
    log.shipDestroyed('zayan', 2000);
    const msgs = log.recent(2100);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toContain('Akar');
    expect(msgs[0].text).toContain('2'); // −2 akarlys
    expect(msgs[0].text).toContain('1'); // −1 zayan
  });

  it("démarre un nouveau message après la fenêtre d'agrégation", () => {
    const log = new WorldFeedLog();
    log.shipDestroyed('akarlys', 1000);
    log.shipDestroyed('akarlys', 6000); // 5000 ms plus tard > windowMs (4000)
    expect(log.recent(6100)).toHaveLength(2);
  });

  it('recent() exclut les messages expirés (TTL)', () => {
    const log = new WorldFeedLog();
    log.shipDestroyed('akarlys', 1000);
    expect(log.recent(1000)).toHaveLength(1);
    expect(log.recent(1000 + 6001)).toHaveLength(0);
  });

  it('factionRelationChanged produit un message dédié', () => {
    const log = new WorldFeedLog();
    log.factionRelationChanged('akarlys', 'mezalayis', 'enemy', 1000);
    const msgs = log.recent(1100);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text.toLowerCase()).toMatch(/akar|mezal/);
  });

  it('worldEventStarted ajoute un message avec le titre et la couleur fournis', () => {
    const log = new WorldFeedLog();
    log.worldEventStarted(
      { kind: 'convoy', title: '🛸 Convoi', color: '#c0d4e0' },
      1000,
    );
    const msgs = log.recent(1100);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('🛸 Convoi');
    expect(msgs[0].color).toBe('#c0d4e0');
  });
});
