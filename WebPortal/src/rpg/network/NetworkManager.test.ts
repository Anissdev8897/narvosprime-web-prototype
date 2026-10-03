// network/NetworkManager.test.ts — Tests unitaires du gestionnaire réseau
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock WebSocket AVANT l'import du module
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

  send(data: unknown): void {
    // no-op in mock
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code: code ?? 1000, reason: reason ?? "" }));
  }

  addEventListener() {}
  removeEventListener() {}
}

vi.stubGlobal("WebSocket", MockWebSocket);
vi.stubGlobal("performance", { now: () => Date.now() });

import { NetworkManager } from "./NetworkManager";
import { JsonCodec, createPacket, PacketCategory, PacketSubType } from "./protocol";

describe("NetworkManager", () => {
  let nm: NetworkManager;

  beforeEach(() => {
    nm = new NetworkManager(JsonCodec);
  });

  afterEach(() => {
    nm.disconnect();
  });

  it("démarre avec l'état disconnected", () => {
    expect(nm.state).toBe("disconnected");
    expect(nm.codecName).toBe("json");
  });

  it("passe à connecting puis connected après un appel à connect()", async () => {
    const onConnect = vi.fn();
    nm.on("connect", onConnect);

    nm.connect("ws://localhost:9999/test");

    expect(nm.state).toBe("connecting");

    // Attendre la connexion mockée
    await vi.waitFor(() => {
      expect(nm.state).toBe("connected");
    });

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("passe à disconnected après disconnect()", async () => {
    const onDisconnect = vi.fn();
    nm.on("disconnect", onDisconnect);

    nm.connect("ws://localhost:9999/test");
    await vi.waitFor(() => expect(nm.state).toBe("connected"));

    nm.disconnect();
    expect(nm.state).toBe("disconnected");
  });

  it("mesure la latence via ping/pong", async () => {
    const onLatency = vi.fn();
    nm.on("latency", onLatency);

    nm.connect("ws://localhost:9999/test");
    await vi.waitFor(() => expect(nm.state).toBe("connected"));

    // Simuler un pong entrant
    const clientTs = performance.now();
    const pongPacket = createPacket(
      PacketCategory.System,
      PacketSubType.Pong,
      { clientTs, serverTs: performance.now() },
    );

    // Déclencher manuellement la réception du pong
    const encoded = JsonCodec.encode(pongPacket);
    const decoded = JsonCodec.decode(encoded);

    // Envoyer via le mock ws.onmessage
    const ws = (nm as any)._ws as MockWebSocket;
    if (ws.onmessage) {
      ws.onmessage(new MessageEvent("message", { data: encoded }));
    }

    await vi.waitFor(() => {
      expect(nm.stats.lastPingMs).toBeGreaterThanOrEqual(0);
    });
  });

  it("met en file d'attente les paquets envoyés hors-ligne et les vide à la connexion", async () => {
    // Envoyer un paquet hors-ligne
    const pkt = createPacket(PacketCategory.Chat, PacketSubType.ChatSay, { from: "test", text: "hello", channel: "say" });
    const sent = nm.send(pkt);
    expect(sent).toBe(false); // mis en file

    expect((nm as any)._pendingQueue.length).toBe(1);

    // Se connecter — la file devrait se vider
    nm.connect("ws://localhost:9999/test");
    await vi.waitFor(() => expect(nm.state).toBe("connected"));

    expect((nm as any)._pendingQueue.length).toBe(0);
  });

  it("émet un événement 'packet' à la réception d'un message", async () => {
    const onPacket = vi.fn();
    nm.on("packet", onPacket);

    nm.connect("ws://localhost:9999/test");
    await vi.waitFor(() => expect(nm.state).toBe("connected"));

    // Simuler la réception d'un paquet
    const ws = (nm as any)._ws as MockWebSocket;
    const pkt = createPacket(PacketCategory.System, PacketSubType.Pong, { clientTs: 100, serverTs: 200 });
    const encoded = JsonCodec.encode(pkt);

    ws.onmessage!(new MessageEvent("message", { data: encoded }));

    await vi.waitFor(() => {
      expect(onPacket).toHaveBeenCalled();
    });
  });

  it("change de codec avec setCodec", () => {
    expect(nm.codecName).toBe("json");
    const mockCodec = { name: "mock", encode: () => "", decode: () => ({ header: {} as any, data: {} }) };
    nm.setCodec(mockCodec as any);
    expect(nm.codecName).toBe("mock");
  });
});
