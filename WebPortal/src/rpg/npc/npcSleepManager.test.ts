import { describe, it, expect, beforeEach } from "vitest";
import { npcSleepManager } from "./npcSleepManager";

describe("npcSleepManager", () => {
  beforeEach(() => {
    npcSleepManager.clear();
  });

  it("NPC NEAR est éveillé", () => {
    npcSleepManager.register("near_1", 0);
    const { asleep, state } = npcSleepManager.update("near_1", 0);
    expect(asleep).toBe(false);
    expect(state).toBe("awake");
    expect(npcSleepManager.isAsleep("near_1")).toBe(false);
  });

  it("NPC FAR est endormi", () => {
    npcSleepManager.register("far_1", 2);
    const { asleep, state } = npcSleepManager.update("far_1", 2);
    expect(asleep).toBe(true);
    expect(state).toBe("asleep");
    expect(npcSleepManager.isAsleep("far_1")).toBe(true);
  });

  it("NPC MID est throttlé", () => {
    npcSleepManager.register("mid_1", 1);
    const { asleep, state } = npcSleepManager.update("mid_1", 1);
    expect(asleep).toBe(false);
    expect(state).toBe("throttled");
    expect(npcSleepManager.isThrottled("mid_1")).toBe(true);
  });

  it("transition FAR→NEAR signale wakeTransition", () => {
    npcSleepManager.register("mover", 2);
    npcSleepManager.update("mover", 2); // s'endort

    const result = npcSleepManager.update("mover", 0); // se réveille
    expect(result.wakeTransition).toBe(true);
    expect(result.asleep).toBe(false);
    expect(result.state).toBe("awake");
  });

  it("transition NEAR→FAR passe en sommeil", () => {
    npcSleepManager.register("leaver", 0);
    npcSleepManager.update("leaver", 0); // éveillé

    const result = npcSleepManager.update("leaver", 2); // s'endort
    expect(result.asleep).toBe(true);
    expect(result.state).toBe("asleep");
    expect(npcSleepManager.sleepTransitions).toBe(1);
  });

  it("msSinceWake retourne le temps depuis le dernier réveil", () => {
    npcSleepManager.register("test", 2);
    npcSleepManager.update("test", 2); // endormi

    const before = npcSleepManager.msSinceWake("test");
    expect(before).toBeGreaterThanOrEqual(0);

    npcSleepManager.update("test", 0); // réveil
    const after = npcSleepManager.msSinceWake("test");
    expect(after).toBeLessThan(100); // quasi instantané
  });

  it("unregister libère les stats", () => {
    npcSleepManager.register("temp", 0);
    expect(npcSleepManager.stats.total).toBe(1);

    npcSleepManager.unregister("temp");
    expect(npcSleepManager.stats.total).toBe(0);
  });

  it("clear() réinitialise tout", () => {
    npcSleepManager.register("a", 0);
    npcSleepManager.register("b", 2);
    npcSleepManager.register("c", 1);

    npcSleepManager.clear();
    expect(npcSleepManager.stats.total).toBe(0);
    expect(npcSleepManager.wakeTransitions).toBe(0);
    expect(npcSleepManager.sleepTransitions).toBe(0);
  });

  it("update auto-enregistre si l'ID n'existe pas", () => {
    const result = npcSleepManager.update("auto_reg", 0);
    expect(result.asleep).toBe(false);
    expect(result.state).toBe("awake");
    expect(npcSleepManager.stats.total).toBe(1);
  });

  it("stats refletent la répartition des états", () => {
    npcSleepManager.register("a", 0);
    npcSleepManager.register("b", 1);
    npcSleepManager.register("c", 2);

    npcSleepManager.update("a", 0);
    npcSleepManager.update("b", 1);
    npcSleepManager.update("c", 2);

    const s = npcSleepManager.stats;
    expect(s.awake).toBe(1);
    expect(s.throttled).toBe(1);
    expect(s.asleep).toBe(1);
    expect(s.total).toBe(3);
  });
});
