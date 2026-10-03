import { describe, it, expect } from "vitest";
import { DoubleTapDetector } from "./doubleTap";

describe("DoubleTapDetector", () => {
  it("ne déclenche pas sur un appui isolé", () => {
    const d = new DoubleTapDetector();
    expect(d.tap(1000)).toBe(false);
  });

  it("déclenche sur deux appuis dans la fenêtre", () => {
    const d = new DoubleTapDetector({ windowMs: 300 });
    expect(d.tap(1000)).toBe(false);
    expect(d.tap(1200)).toBe(true);
  });

  it("ne déclenche pas si les appuis sont trop espacés", () => {
    const d = new DoubleTapDetector({ windowMs: 300 });
    expect(d.tap(1000)).toBe(false);
    expect(d.tap(1400)).toBe(false);
  });

  it("accepte la limite exacte de la fenêtre", () => {
    const d = new DoubleTapDetector({ windowMs: 300 });
    d.tap(1000);
    expect(d.tap(1300)).toBe(true);
  });

  it("se réarme après détection : trois appuis rapides ne déclenchent qu'une fois", () => {
    // Sans réarmement, le 3e appui compléterait un second double avec le 2e —
    // le joueur ré-entrerait en escalade juste après en être sorti.
    const d = new DoubleTapDetector({ windowMs: 300 });
    expect(d.tap(1000)).toBe(false);
    expect(d.tap(1100)).toBe(true);
    expect(d.tap(1200)).toBe(false);
  });

  it("quatre appuis rapides déclenchent exactement deux fois", () => {
    const d = new DoubleTapDetector({ windowMs: 300 });
    const results = [1000, 1100, 1200, 1300].map((t) => d.tap(t));
    expect(results).toEqual([false, true, false, true]);
  });

  it("un appui tardif après un double repart de zéro", () => {
    const d = new DoubleTapDetector({ windowMs: 300 });
    d.tap(1000);
    expect(d.tap(1100)).toBe(true);
    expect(d.tap(5000)).toBe(false);
    expect(d.tap(5100)).toBe(true);
  });

  it("reset annule l'appui en attente", () => {
    const d = new DoubleTapDetector({ windowMs: 300 });
    d.tap(1000);
    d.reset();
    expect(d.tap(1100)).toBe(false);
  });
});
