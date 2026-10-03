import { describe, it, expect, beforeEach } from "vitest";
import { cameraViewStore } from "./cameraViewStore";

beforeEach(() => { cameraViewStore.set("tps"); });

describe("cameraViewStore", () => {
  // La valeur initiale du module est "fps" pour correspondre à createPlayerState().view.
  // La réinitialisation beforeEach → "tps" permet de tester proprement la transition tps→fps.

  it("notifie au changement de vue — c'est ce qui monte le viewmodel d'arme", () => {
    let n = 0;
    const stop = cameraViewStore.subscribe(() => { n++; });
    cameraViewStore.set("fps");
    expect(n).toBe(1);
    expect(cameraViewStore.get()).toBe("fps");
    stop();
  });

  it("NE notifie PAS quand la vue ne change pas", () => {
    // Garde-fou non négociable : `set` est appelé depuis `useFrame`, donc ~60
    // fois par seconde. Sans ce test, une régression y ferait re-rendre
    // RpgGameWorld à chaque frame — et personne ne le verrait avant le terrain.
    cameraViewStore.set("fps");
    let n = 0;
    const stop = cameraViewStore.subscribe(() => { n++; });
    for (let i = 0; i < 60; i++) cameraViewStore.set("fps");
    expect(n, "60 publications identiques doivent produire 0 notification").toBe(0);
    stop();
  });

  it("se désabonne proprement", () => {
    let n = 0;
    const stop = cameraViewStore.subscribe(() => { n++; });
    stop();
    cameraViewStore.set("fps");
    expect(n).toBe(0);
  });

  it("sert plusieurs abonnés", () => {
    let a = 0, b = 0;
    const s1 = cameraViewStore.subscribe(() => { a++; });
    const s2 = cameraViewStore.subscribe(() => { b++; });
    cameraViewStore.set("fps");
    expect([a, b]).toEqual([1, 1]);
    s1(); s2();
  });
});
