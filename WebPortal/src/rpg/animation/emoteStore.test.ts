import { describe, it, expect, vi } from "vitest";
import { emoteStore } from "./emoteStore";

describe("emoteStore", () => {
  it("démarre avec un état vide", () => {
    const snap = emoteStore.getSnapshot();
    expect(snap.emoteId).toBeNull();
    expect(snap.glbPath).toBeNull();
    expect(snap.loop).toBe(false);
  });

  it("play() met à jour l'état et notifie les abonnés", () => {
    const fn = vi.fn();
    const unsub = emoteStore.subscribe(fn);

    emoteStore.play("wave", "/models/wave.glb", false);
    expect(fn).toHaveBeenCalledTimes(1);

    const snap = emoteStore.getSnapshot();
    expect(snap.emoteId).toBe("wave");
    expect(snap.glbPath).toBe("/models/wave.glb");
    expect(snap.loop).toBe(false);

    unsub();
    emoteStore.cancel();
  });

  it("cancel() remet l'état à null", () => {
    emoteStore.play("sit", "/models/sit.glb", true);
    emoteStore.cancel();

    const snap = emoteStore.getSnapshot();
    expect(snap.emoteId).toBeNull();
    expect(snap.glbPath).toBeNull();
  });

  it("cancel() est idempotent (ne notifie pas si déjà null)", () => {
    emoteStore.cancel(); // assure état clean
    const fn = vi.fn();
    const unsub = emoteStore.subscribe(fn);
    emoteStore.cancel();
    expect(fn).not.toHaveBeenCalled();
    unsub();
  });

  it("incrémente version à chaque mutation", () => {
    const v0 = emoteStore.getSnapshot().version;
    emoteStore.play("dance", "/models/dance.glb", true);
    expect(emoteStore.getSnapshot().version).toBe(v0 + 1);
    emoteStore.cancel();
    expect(emoteStore.getSnapshot().version).toBe(v0 + 2);
  });

  it("unsubscribe empêche les notifications", () => {
    const fn = vi.fn();
    const unsub = emoteStore.subscribe(fn);
    unsub();
    emoteStore.play("wave", "/models/wave.glb", false);
    expect(fn).not.toHaveBeenCalled();
    emoteStore.cancel();
  });
});
