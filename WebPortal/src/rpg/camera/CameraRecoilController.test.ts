import { describe, it, expect, beforeEach } from "vitest";
import { cameraRecoil, envelope } from "./CameraRecoilController";
import type { CameraRecoilProfile } from "./recoilProfiles";

const P: CameraRecoilProfile = {
  id: "test", rot: { pitch: -0.1, yaw: 0, roll: 0 }, pos: { x: 0, y: 0, z: -0.1 },
  attack: 0.1, duration: 0.2, returnEase: "linear", shakeTrauma: 0,
};
const lin = (x: number) => x;

describe("envelope", () => {
  it("monte sur attack (0→1) puis redescend (1→0)", () => {
    expect(envelope(0, 0.1, 0.2, lin)).toBe(0);
    expect(envelope(0.05, 0.1, 0.2, lin)).toBeCloseTo(0.5); // mi-montée
    expect(envelope(0.1, 0.1, 0.2, lin)).toBeCloseTo(1);    // pic (fin attack)
    expect(envelope(0.2, 0.1, 0.2, lin)).toBeCloseTo(0.5);  // mi-retour
    expect(envelope(0.3, 0.1, 0.2, lin)).toBeCloseTo(0);    // fin
  });
});

describe("cameraRecoil (ICameraShakeable)", () => {
  beforeEach(() => cameraRecoil.reset());

  it("aucun offset au repos", () => {
    const o = cameraRecoil.tick(0.016);
    expect(o.active).toBe(false);
    expect(o.rot.x).toBe(0);
    expect(o.pos.z).toBe(0);
  });

  it("applyRecoil produit un kick directionnel", () => {
    cameraRecoil.applyRecoil(P);
    const o = cameraRecoil.tick(0.05); // mi-montée
    expect(o.active).toBe(true);
    expect(o.rot.x).toBeLessThan(0);   // pitch négatif (recul haut)
    expect(o.pos.z).toBeLessThan(0);   // position reculée
  });

  it("l'impulsion se termine et est retirée après attack+duration", () => {
    cameraRecoil.applyRecoil(P);
    cameraRecoil.tick(0.15); // elapsed 0.15 (en retour)
    cameraRecoil.tick(0.2);  // elapsed 0.35 > total 0.3 → retirée
    const o = cameraRecoil.tick(0.016);
    expect(o.active).toBe(false);
    expect(o.rot.x).toBe(0);
  });

  it("plusieurs impulsions se somment", () => {
    cameraRecoil.applyRecoil(P);
    cameraRecoil.applyRecoil(P);
    const o = cameraRecoil.tick(0.05);
    expect(o.rot.x).toBeLessThan(-0.05); // 2× le kick d'une seule
  });
});
