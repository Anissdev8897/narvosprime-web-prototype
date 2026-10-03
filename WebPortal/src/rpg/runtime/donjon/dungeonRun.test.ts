import { describe, it, expect, beforeEach } from "vitest";
import { dungeonRun } from "./dungeonRun";

describe("dungeonRun", () => {
  beforeEach(() => dungeonRun.abandon());

  it("cycle complet : start → bossKilled → chestOpened → idle", () => {
    expect(dungeonRun.state).toBe("idle");
    dungeonRun.start();
    expect(dungeonRun.state).toBe("inProgress");
    dungeonRun.bossKilled([1, 2, 3]);
    expect(dungeonRun.state).toBe("bossDown");
    expect(dungeonRun.chestPos).toEqual([1, 2, 3]);
    dungeonRun.chestOpened();
    expect(dungeonRun.state).toBe("idle");
    expect(dungeonRun.chestPos).toBeNull();
  });

  it("boss tué HORS run → pas de coffre (admin/debug)", () => {
    dungeonRun.bossKilled([0, 0, 0]);
    expect(dungeonRun.state).toBe("idle");
    expect(dungeonRun.chestPos).toBeNull();
  });

  it("abandon pendant le run → run perdu", () => {
    dungeonRun.start();
    dungeonRun.abandon();
    expect(dungeonRun.state).toBe("idle");
  });
});
