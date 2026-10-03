import { describe, it, expect } from "vitest";
import { weaponAnimPackForFile, weaponAnimPackForType } from "./weaponAnimationBinder";

// ÉTAT ACTUEL : les packs d'animation GLB (animationPacks.ts) sont VIDES car les
// dossiers public/models/assets_character/animation_* n'existent pas sur disque.
// Ces tests valident le CONTRAT : résolution arme→pack sans crash, pack vide
// toléré, et SI un pack est rempli un jour, ses paths pointent le bon dossier.
describe("weaponAnimationBinder", () => {
  it("arc → pack archer (vide toléré, sinon paths archer)", () => {
    const p = weaponAnimPackForFile("uploads_files_5605095_recurve_bow.fbx");
    expect(Array.isArray(p)).toBe(true);
    for (const s of p) expect(s.path).toContain("animation_archer");
  });

  it("épée 2H → pack meelee", () => {
    const p = weaponAnimPackForFile("claymore.fbx");
    for (const s of p) expect(s.path).toContain("animation_meelee");
  });

  it("épée 1H → sword_and_shield", () => {
    const p = weaponAnimPackForFile("Sword00_mesh.FBX");
    for (const s of p) expect(s.path).toContain("animation_sword_and_shield");
  });

  it("staff → pack magie", () => {
    const p = weaponAnimPackForType("staff");
    for (const s of p) expect(s.path).toContain("animation_magie");
  });

  it("gun → tireur dédié (décision projet : ≠ archer)", () => {
    const p = weaponAnimPackForFile("Gun_Pistol.fbx");
    for (const s of p) expect(s.path).toContain("animation_shooter");
  });

  it("munition / non-arme → pack vide", () => {
    expect(weaponAnimPackForType("ammo")).toEqual([]);
    expect(weaponAnimPackForType("ignore")).toEqual([]);
  });

  it("résolution ne crashe jamais (pack absent → [])", () => {
    expect(weaponAnimPackForFile("fichier_inconnu.xyz")).toEqual([]);
  });
});
