// WebPortal/src/rpg/runtime/feed/worldFeedLog.ts
// Journal du « monde vivant » — logique PURE (testable, sans React).
// Agrège les destructions de vaisseaux par fenêtre de temps (anti-spam) et
// expose les messages non expirés. Alimenté par l'EventBus via WorldFeed.tsx.
import type { FactionId, FactionRelation, WorldEvents } from '../core/worldTypes';
import { FACTIONS } from '../../factions/factions';

export interface FeedMessage {
  id: number;
  text: string;
  color: string;
  createdAt: number; // ms (horloge fournie par l'appelant → testable)
}

const WINDOW_MS = 4000;     // fenêtre d'agrégation d'une « bataille »
const TTL_MS = 6000;        // durée d'affichage d'un message
const BATTLE_COLOR = '#ffd070';

interface Battle {
  msgId: number;
  createdAt: number;
  counts: Partial<Record<FactionId, number>>;
}

export class WorldFeedLog {
  private messages: FeedMessage[] = [];
  private battle: Battle | null = null;
  private counter = 0;

  /** Une destruction de vaisseau : agrégée dans la bataille courante si récente. */
  shipDestroyed(faction: FactionId, now: number): void {
    if (!this.battle || now - this.battle.createdAt >= WINDOW_MS) {
      const id = this.counter++;
      this.battle = { msgId: id, createdAt: now, counts: {} };
      this.messages.push({ id, text: '', color: BATTLE_COLOR, createdAt: now });
    }
    this.battle.counts[faction] = (this.battle.counts[faction] ?? 0) + 1;
    const msg = this.messages.find((m) => m.id === this.battle!.msgId);
    if (msg) msg.text = this.battleText(this.battle.counts);
  }

  private battleText(counts: Partial<Record<FactionId, number>>): string {
    const parts = (Object.keys(counts) as FactionId[])
      .map((f) => `${FACTIONS[f].name} −${counts[f]}`); // « −N »
    return `⚔ Bataille orbitale — ${parts.join(' · ')}`;
  }

  /** Changement de relation entre factions : message dédié immédiat. */
  factionRelationChanged(a: FactionId, b: FactionId, relation: FactionRelation, now: number): void {
    const label = relation === 'enemy' ? 'guerre' : relation === 'ally' ? 'alliance' : 'neutralité';
    this.messages.push({
      id: this.counter++,
      text: `\u{1F3F4} ${FACTIONS[a].name} & ${FACTIONS[b].name} : ${label}`,
      color: FACTIONS[a].color,
      createdAt: now,
    });
  }

  /** Événement narratif spontané (convoi, signal, anomalie…) — message dédié immédiat. */
  worldEventStarted(payload: WorldEvents['world:eventStarted'], now: number): void {
    this.messages.push({
      id: this.counter++,
      text: payload.title,
      color: payload.color,
      createdAt: now,
    });
  }

  /** Messages encore actifs (purge paresseuse des expirés). */
  recent(now: number): FeedMessage[] {
    this.messages = this.messages.filter((m) => now - m.createdAt < TTL_MS);
    return this.messages;
  }

  clear(): void {
    this.messages = [];
    this.battle = null;
  }
}
