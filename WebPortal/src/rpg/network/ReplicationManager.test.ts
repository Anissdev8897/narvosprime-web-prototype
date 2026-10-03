// network/ReplicationManager.test.ts — Tests unitaires de la réplication
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  readyState: number = MockWebSocket.CONNECTING;
  binaryType: string = "blob";
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event("open"));
    }, 10);
  }
  send(_data: unknown): void {}
  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code: code ?? 1000, reason: reason ?? "" }));
  }
  addEventListener() {}
  removeEventListener() {}
}

vi.stubGlobal("WebSocket", MockWebSocket);
vi.stubGlobal("performance", { now: () => Date.now() });

import { ReplicationManager } from "./ReplicationManager";
import { networkManager } from "./NetworkManager";
import type { FullStateSyncPayload, DeltaUpdatePayload, EntitySpawnPayload, EntityDestroyPayload } from "./protocol";

describe("ReplicationManager", () => {
  let repl: ReplicationManager;

  beforeEach(() => {
    vi.useFakeTimers();
    repl = new ReplicationManager();
  });

  afterEach(() => {
    repl.destroy();
    vi.useRealTimers();
  });

  it("démarre vide", () => {
    expect(repl.stats.trackedEntities).toBe(0);
    expect(repl.stats.fullSyncsReceived).toBe(0);
    expect(repl.stats.deltasReceived).toBe(0);
  });

  it("applyFullSync ajoute des entités et supprime celles qui ne sont plus dans la sync", () => {
    const sync: FullStateSyncPayload = {
      tick: 100,
      serverTime: Date.now(),
      entities: [
        {
          entityId: "e1", pos: [10, 0, 20] as [number, number, number],
          rot: [0, 0, 0, 1] as [number, number, number, number],
          vel: [0, 0, 0] as [number, number, number],
          health: 100, state: "idle", animState: "idle",
        },
        {
          entityId: "e2", pos: [50, 0, 30] as [number, number, number],
          rot: [0, 0, 0, 1] as [number, number, number, number],
          vel: [0, 0, 0] as [number, number, number],
          health: 80, state: "run", animState: "run",
        },
      ],
      players: [],
    };

    repl.applyFullSync(sync);
    expect(repl.stats.trackedEntities).toBe(2);
    expect(repl.stats.fullSyncsReceived).toBe(1);
    expect(repl.hasEntity("e1")).toBe(true);
    expect(repl.hasEntity("e2")).toBe(true);

    // Appliquer une sync partielle — e1 devrait disparaître
    const sync2: FullStateSyncPayload = {
      tick: 101,
      serverTime: Date.now(),
      entities: [{
        entityId: "e2", pos: [55, 0, 35] as [number, number, number],
        rot: [0, 0, 0, 1] as [number, number, number, number],
        vel: [0, 0, 0] as [number, number, number],
        health: 80, state: "run", animState: "run",
      }],
      players: [],
    };

    repl.applyFullSync(sync2);
    expect(repl.stats.trackedEntities).toBe(1);
    expect(repl.hasEntity("e1")).toBe(false);
    expect(repl.hasEntity("e2")).toBe(true);
  });

  it("ne réplique pas l'entité du joueur local (filtrée)", () => {
    repl.setPlayerId("player-1");
    const sync: FullStateSyncPayload = {
      tick: 1, serverTime: Date.now(),
      entities: [
        {
          entityId: "player-1", pos: [0, 0, 0] as [number, number, number],
          rot: [0, 0, 0, 1] as [number, number, number, number],
          vel: [0, 0, 0] as [number, number, number],
          health: 100, state: "idle", animState: "idle",
        },
        {
          entityId: "npc-1", pos: [10, 0, 10] as [number, number, number],
          rot: [0, 0, 0, 1] as [number, number, number, number],
          vel: [0, 0, 0] as [number, number, number],
          health: 50, state: "idle", animState: "idle",
        },
      ],
      players: [],
    };

    repl.applyFullSync(sync);
    expect(repl.stats.trackedEntities).toBe(1); // seulement npc-1
    expect(repl.hasEntity("player-1")).toBe(false);
    expect(repl.hasEntity("npc-1")).toBe(true);
  });

  it("applyDelta fusionne les champs modifiés", () => {
    const sync: FullStateSyncPayload = {
      tick: 1, serverTime: Date.now(),
      entities: [{
        entityId: "e1", pos: [10, 0, 20] as [number, number, number],
        rot: [0, 0, 0, 1] as [number, number, number, number],
        vel: [0, 0, 0] as [number, number, number],
        health: 100, state: "idle", animState: "idle",
      }],
      players: [],
    };
    repl.applyFullSync(sync);

    const delta: DeltaUpdatePayload = {
      tick: 2,
      baseSeq: 1,
      deltas: [{
        entityId: "e1",
        changed: { pos: [15, 0, 25] as [number, number, number], health: 90 },
      }],
    };

    repl.applyDelta(delta);
    expect(repl.stats.deltasReceived).toBe(1);

    const state = repl.getEntityState("e1");
    expect(state).not.toBeNull();
    expect(state!.pos).toEqual([15, 0, 25]);
    expect(state!.health).toBe(90);
    // Les champs non modifiés doivent rester
    expect(state!.state).toBe("idle");
  });

  it("spawnEntity et destroyEntity gèrent le cycle de vie", () => {
    const spawn: EntitySpawnPayload = {
      entityId: "npc-42",
      entityType: "goblin",
      pos: [100, 0, 200] as [number, number, number],
      rot: [0, 0, 0, 1] as [number, number, number, number],
    };

    repl.spawnEntity(spawn);
    expect(repl.stats.entitiesSpawned).toBe(1);
    expect(repl.stats.trackedEntities).toBe(1);
    expect(repl.hasEntity("npc-42")).toBe(true);

    const state = repl.getEntityState("npc-42");
    expect(state!.pos).toEqual([100, 0, 200]);

    const destroy: EntityDestroyPayload = { entityId: "npc-42", reason: "killed" };
    repl.destroyEntity(destroy);
    expect(repl.stats.entitiesDestroyed).toBe(1);
    expect(repl.stats.trackedEntities).toBe(0);
    expect(repl.hasEntity("npc-42")).toBe(false);
  });

  it("interpolate ne crashe pas quand il n'y a pas d'entités", () => {
    expect(() => repl.interpolate(16)).not.toThrow();
  });

  it("interpolate produit un état interpolé avec 2+ snapshots dans l'historique", () => {
    const sync: FullStateSyncPayload = {
      tick: 1, serverTime: Date.now(),
      entities: [{
        entityId: "e1", pos: [10, 0, 20] as [number, number, number],
        rot: [0, 0, 0, 1] as [number, number, number, number],
        vel: [0, 0, 0] as [number, number, number],
        health: 100, state: "idle", animState: "idle",
      }],
      players: [],
    };

    repl.applyFullSync(sync);

    // Appliquer un delta pour ajouter un second snapshot dans l'historique
    const delta: DeltaUpdatePayload = {
      tick: 2, baseSeq: 1,
      deltas: [{
        entityId: "e1",
        changed: { pos: [20, 0, 40] as [number, number, number] },
      }],
    };
    repl.applyDelta(delta);

    // L'interpolation ne devrait pas crasher et retourner un état cohérent
    vi.advanceTimersByTime(100);
    repl.interpolate(16);
    const state = repl.getEntityState("e1");
    expect(state).not.toBeNull();
    expect(state!.pos).toBeDefined();
  });

  it("getAllEntityStates retourne toutes les entités sauf le joueur local", () => {
    repl.setPlayerId("player-1");
    const sync: FullStateSyncPayload = {
      tick: 1, serverTime: Date.now(),
      entities: [
        {
          entityId: "player-1", pos: [0, 0, 0] as [number, number, number],
          rot: [0, 0, 0, 1] as [number, number, number, number],
          vel: [0, 0, 0] as [number, number, number],
          health: 100, state: "idle", animState: "idle",
        },
        {
          entityId: "npc-1", pos: [10, 0, 10] as [number, number, number],
          rot: [0, 0, 0, 1] as [number, number, number, number],
          vel: [0, 0, 0] as [number, number, number],
          health: 50, state: "idle", animState: "idle",
        },
      ],
      players: [],
    };
    repl.applyFullSync(sync);

    const all = repl.getAllEntityStates();
    expect(all.size).toBe(1);
    expect(all.has("npc-1")).toBe(true);
    expect(all.has("player-1")).toBe(false);
  });
});
