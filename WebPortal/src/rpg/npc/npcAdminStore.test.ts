import { describe, it, expect } from "vitest";
import { npcAdminStore } from "./npcAdminStore";

describe("npcAdminStore", () => {
  it("set merge, get reflète, subscribe notifié", () => {
    let calls = 0;
    const unsub = npcAdminStore.subscribe(() => { calls++; });
    npcAdminStore.set({ level: 12, placementActive: true });
    expect(npcAdminStore.get().level).toBe(12);
    expect(npcAdminStore.get().placementActive).toBe(true);
    expect(calls).toBe(1);
    npcAdminStore.set({ placementActive: false, level: 1 }); unsub();
  });
});
