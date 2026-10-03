import { describe, it, expect, beforeEach } from "vitest";
import { forgePresence, peerColor } from "./forgePresenceStore";

const peer = (id: string) => ({ id, name: id, color: "#fff", cam: [0, 0, 0] as [number, number, number] });

describe("forgePresence", () => {
  beforeEach(() => forgePresence.clear());

  it("upsert ajoute puis met à jour un pair", () => {
    forgePresence.upsert(peer("a"), 1000);
    expect(forgePresence.list()).toHaveLength(1);
    forgePresence.upsert({ ...peer("a"), name: "Alice" }, 2000);
    expect(forgePresence.list()).toHaveLength(1);
    expect(forgePresence.list()[0].name).toBe("Alice");
  });

  it("prune retire les pairs silencieux (> 8 s)", () => {
    forgePresence.upsert(peer("a"), 1000);
    forgePresence.upsert(peer("b"), 5000);
    const changed = forgePresence.prune(10000); // a silencieux 9 s, b 5 s
    expect(changed).toBe(true);
    expect(forgePresence.list().map((p) => p.id)).toEqual(["b"]);
  });

  it("prune ne change rien si tous récents", () => {
    forgePresence.upsert(peer("a"), 9000);
    expect(forgePresence.prune(10000)).toBe(false);
  });

  it("peerColor déterministe par id", () => {
    expect(peerColor("alice")).toBe(peerColor("alice"));
    expect(peerColor("alice")).not.toBe(peerColor("bob"));
  });
});
