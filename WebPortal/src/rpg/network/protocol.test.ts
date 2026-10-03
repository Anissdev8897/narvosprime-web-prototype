// network/protocol.test.ts — Tests unitaires du protocole réseau
import { describe, it, expect } from "vitest";
import {
  PacketCategory,
  PacketSubType,
  JsonCodec,
  MsgPackCodec,
  nextSeq,
  createHeader,
  createPacket,
  type Packet,
} from "./protocol";

describe("Protocol", () => {
  describe("nextSeq / createHeader", () => {
    it("génère des séquences uniques et incrémentales", () => {
      const a = nextSeq();
      const b = nextSeq();
      const c = nextSeq();
      expect(b).toBe(a + 1);
      expect(c).toBe(a + 2);
    });

    it("createHeader remplit les champs obligatoires", () => {
      const h = createHeader(PacketCategory.System, PacketSubType.Ping);
      expect(h.cat).toBe("system");
      expect(h.sub).toBe("ping");
      expect(h.seq).toBeGreaterThan(0);
      expect(typeof h.ts).toBe("number");
      expect(h.priority).toBe(128);
    });

    it("createHeader accepte les options", () => {
      const h = createHeader(PacketCategory.Input, PacketSubType.PlayerInput, {
        token: "abc123",
        sessionId: "sess-1",
        priority: 0,
      });
      expect(h.token).toBe("abc123");
      expect(h.sessionId).toBe("sess-1");
      expect(h.priority).toBe(0);
    });
  });

  describe("createPacket", () => {
    it("crée un paquet avec header + data", () => {
      const data = { clientTs: 12345 };
      const pkt = createPacket(PacketCategory.System, PacketSubType.Ping, data);
      expect(pkt.header.cat).toBe("system");
      expect(pkt.header.sub).toBe("ping");
      expect(pkt.data).toEqual(data);
    });
  });

  describe("JsonCodec", () => {
    it("encode et décode un paquet", () => {
      const original: Packet<{ msg: string }> = {
        header: {
          seq: 1,
          ts: 1000,
          cat: PacketCategory.Chat,
          sub: PacketSubType.ChatSay,
          priority: 128,
        },
        data: { msg: "hello" },
      };

      const encoded = JsonCodec.encode(original);
      expect(typeof encoded).toBe("string");

      const decoded = JsonCodec.decode<{ msg: string }>(encoded);
      expect(decoded.header.seq).toBe(1);
      expect(decoded.header.cat).toBe("chat");
      expect(decoded.data.msg).toBe("hello");
    });

    it("décode un ArrayBuffer", () => {
      const json = JSON.stringify({ header: { seq: 1, ts: 0, cat: "system", sub: "ping", priority: 128 }, data: {} });
      const buffer = new TextEncoder().encode(json).buffer;
      const decoded = JsonCodec.decode(buffer);
      expect(decoded.header.cat).toBe("system");
    });

    it("gère les paquets avec payload complexe", () => {
      const pkt = createPacket(PacketCategory.Replication, PacketSubType.FullStateSync, {
        tick: 100,
        serverTime: Date.now(),
        entities: [
          { entityId: "e1", pos: [1, 2, 3] as [number, number, number], state: "idle" },
        ],
      });

      const encoded = JsonCodec.encode(pkt);
      const decoded = JsonCodec.decode(encoded);
      expect(decoded.header.cat).toBe("replication");
      expect((decoded.data as any).tick).toBe(100);
      expect((decoded.data as any).entities[0].entityId).toBe("e1");
    });
  });

  describe("MsgPackCodec", () => {
    it("lance une erreur car msgpackr n'est pas installé", () => {
      expect(() => MsgPackCodec.encode({} as any)).toThrow("msgpackr not installed");
      expect(() => MsgPackCodec.decode(new Uint8Array(0))).toThrow("msgpackr not installed");
    });
  });

  describe("PacketSubType", () => {
    it("contient tous les sous-types attendus", () => {
      expect(PacketSubType.Ping).toBe("ping");
      expect(PacketSubType.Pong).toBe("pong");
      expect(PacketSubType.AuthRequest).toBe("auth:request");
      expect(PacketSubType.AuthResponse).toBe("auth:response");
      expect(PacketSubType.PlayerInput).toBe("input:player");
      expect(PacketSubType.InputAck).toBe("input:ack");
      expect(PacketSubType.FullStateSync).toBe("repl:full_sync");
      expect(PacketSubType.DeltaUpdate).toBe("repl:delta");
      expect(PacketSubType.PriorityUpdate).toBe("repl:priority");
      expect(PacketSubType.EntitySpawn).toBe("entity:spawn");
      expect(PacketSubType.EntityDestroy).toBe("entity:destroy");
      expect(PacketSubType.ChatSay).toBe("chat:say");
    });
  });
});
