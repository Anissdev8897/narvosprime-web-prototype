// network/PredictionManager.test.ts — Tests unitaires de la prédiction client
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
  close(_code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
  }
  addEventListener() {}
  removeEventListener() {}
}

vi.stubGlobal("WebSocket", MockWebSocket);
vi.stubGlobal("performance", { now: () => Date.now() });

import { PredictionManager } from "./PredictionManager";

describe("PredictionManager", () => {
  let pm: PredictionManager;

  beforeEach(() => {
    pm = new PredictionManager();
  });

  afterEach(() => {
    // no cleanup needed
  });

  it("démarre avec un état par défaut à l'origine", () => {
    const s = pm.state;
    expect(s.pos).toEqual([0, 0, 0]);
    expect(s.yaw).toBe(0);
    expect(s.pitch).toBe(0);
    expect(s.health).toBe(100);
    expect(s.state).toBe("idle");
    expect(pm.stats.inputsPredicted).toBe(0);
  });

  it("reset() réinitialise l'état et accepte une position initiale", () => {
    pm.reset([100, 50, 200]);
    expect(pm.state.pos).toEqual([100, 50, 200]);
    expect(pm.stats.pendingInputs).toBe(0);
  });

  it("pushInput incrémente le compteur et retourne un seq number", () => {
    const seq = pm.pushInput({
      moveDir: [1, 0],
      yaw: 90,
      pitch: 0,
      buttons: 0,
      timestamp: Date.now(),
    });

    expect(seq).toBe(1);
    expect(pm.stats.inputsPredicted).toBe(1);
    expect(pm.stats.pendingInputs).toBe(1);
  });

  it("predict() modifie la position après un input de mouvement", () => {
    pm.pushInput({
      moveDir: [1, 0], // avancer
      yaw: 0,          // face à l'axe Z+
      pitch: 0,
      buttons: 0,
      timestamp: Date.now(),
    });

    // Prédire sur ~100ms
    const state = pm.predict(100);
    // Avec speed=5 m/s et 100ms, on devrait avancer de ~0.5m
    expect(state.pos[2]).toBeCloseTo(0.5, 1);
    expect(state.pos[0]).toBeCloseTo(0, 1);
    expect(state.state).toBe("run");
  });

  it("predict() détecte le saut via le bitfield buttons", () => {
    pm.pushInput({
      moveDir: [0, 0],
      yaw: 0,
      pitch: 0,
      buttons: 2, // bit 1 = jump
      timestamp: Date.now(),
    });

    const state = pm.predict(16);
    expect(state.isJumping).toBe(true);
    expect(state.state).toBe("jump");
  });

  it("reconcile() corrige la position et ré-applique les inputs non acquittés", () => {
    // Pousser 3 inputs
    pm.pushInput({ moveDir: [1, 0], yaw: 0, pitch: 0, buttons: 0, timestamp: Date.now() });
    pm.pushInput({ moveDir: [1, 0], yaw: 0, pitch: 0, buttons: 0, timestamp: Date.now() });
    pm.pushInput({ moveDir: [0, 0], yaw: 0, pitch: 0, buttons: 0, timestamp: Date.now() });

    // Avancer un peu
    pm.predict(50);
    expect(pm.stats.pendingInputs).toBe(3);

    // Simuler un ack du serveur pour le premier input
    pm.reconcile({
      inputSeq: 1,
      serverTick: 100,
      correction: {
        entityId: "player",
        pos: [0, 0, 0.25] as [number, number, number], // position autoritaire
        rot: [0, 0, 0, 1] as [number, number, number, number],
        vel: [0, 0, 0] as [number, number, number],
        health: 100,
        state: "idle",
        animState: "idle",
      },
    });

    expect(pm.stats.reconciliationsReceived).toBe(1);
    expect(pm.lastAckedInputSeq).toBe(1);
    // Les inputs 2 et 3 doivent encore être dans l'historique
    expect(pm.stats.pendingInputs).toBe(2);

    // L'état réconcilié doit être proche de la correction + inputs ré-appliqués
    const state = pm.state;
    // Input 2 a avancé, input 3 a stoppé → état corrigé + un mouvement
    expect(state.pos[2]).toBeGreaterThanOrEqual(0.2);
  });

  it("reconcile() téléporte si la correction est lointaine", () => {
    pm.pushInput({ moveDir: [1, 0], yaw: 0, pitch: 0, buttons: 0, timestamp: Date.now() });
    pm.predict(16);

    // Correction très loin (> 5m)
    pm.reconcile({
      inputSeq: 0,
      serverTick: 50,
      correction: {
        entityId: "player",
        pos: [100, 0, 0] as [number, number, number],
        rot: [0, 0, 0, 1] as [number, number, number, number],
        vel: [0, 0, 0] as [number, number, number],
        health: 80,
        state: "idle",
        animState: "idle",
      },
    });

    expect(pm.state.pos[0]).toBe(100);
    expect(pm.state.health).toBe(80);
    expect(pm.stats.snapCorrections).toBe(1);
  });

  it("acknowledgeUpTo vide les inputs acquittés", () => {
    pm.pushInput({ moveDir: [1, 0], yaw: 0, pitch: 0, buttons: 0, timestamp: Date.now() });
    pm.pushInput({ moveDir: [0, 1], yaw: 0, pitch: 0, buttons: 0, timestamp: Date.now() });
    expect(pm.stats.pendingInputs).toBe(2);

    pm.acknowledgeUpTo(2);
    expect(pm.stats.pendingInputs).toBe(0);
  });

  it("setInitialState remplace l'état local", () => {
    pm.setInitialState({
      pos: [50, 100, 200],
      yaw: 180,
      pitch: 45,
      vel: [0, 0, 0],
      state: "idle",
      health: 75,
      isJumping: false,
      isCrouching: false,
      isRunning: false,
    });

    expect(pm.state.pos).toEqual([50, 100, 200]);
    expect(pm.state.yaw).toBe(180);
    expect(pm.state.pitch).toBe(45);
    expect(pm.state.health).toBe(75);
  });
});
