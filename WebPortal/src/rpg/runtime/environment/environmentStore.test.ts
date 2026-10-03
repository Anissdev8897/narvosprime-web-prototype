import { describe, it, expect } from "vitest";
import { resolveEnv, environmentStore } from "./environmentStore";
import { DEFAULT_ENV, FALLBACK_ENV } from "./environmentTypes";

describe("resolveEnv", () => {
  it("override mergé sur le défaut de la map", () => {
    const r = resolveEnv({ forge: { sunColor: "#ff0000" } }, "forge");
    expect(r.sunColor).toBe("#ff0000");
    expect(r.preset).toBe(DEFAULT_ENV.forge.preset);
    expect(r.ambientIntensity).toBe(DEFAULT_ENV.forge.ambientIntensity);
  });
  it("sans override → défaut de la map", () => {
    expect(resolveEnv({}, "tower")).toEqual(DEFAULT_ENV.tower);
  });
  it("map inconnue → FALLBACK_ENV", () => {
    expect(resolveEnv({}, "nope")).toEqual(FALLBACK_ENV);
  });
});

describe("environmentStore", () => {
  it("set merge un patch partiel, reflété par get", () => {
    environmentStore.set("forge", { sunIntensity: 2.5 });
    expect(environmentStore.get("forge").sunIntensity).toBe(2.5);
    expect(environmentStore.get("forge").preset).toBe(DEFAULT_ENV.forge.preset);
    environmentStore.reset("forge");
  });
  it("reset revient au défaut de la map", () => {
    environmentStore.set("tower", { ambientIntensity: 1.9 });
    environmentStore.reset("tower");
    expect(environmentStore.get("tower")).toEqual(DEFAULT_ENV.tower);
  });
  it("subscribe notifié + getVersion incrémente sur set et reset", () => {
    let calls = 0;
    const unsub = environmentStore.subscribe(() => { calls++; });
    const v0 = environmentStore.getVersion();
    environmentStore.set("forge", { sunColor: "#123456" });
    expect(calls).toBe(1);
    expect(environmentStore.getVersion()).toBe(v0 + 1);
    environmentStore.reset("forge");
    expect(calls).toBe(2);
    unsub();
  });
});
