import { describe, it, expect } from "vitest";
import { buildBoneRemap, applyRemapToSkinIndex, zeroUnmatchedWeights } from "./boneRemap";

describe("buildBoneRemap", () => {
  it("mappe par nom exact quand les pièces partagent la nomenclature", () => {
    const src = ["pelvis", "spine_01", "hand_l"];
    const tgt = ["root", "pelvis", "spine_01", "spine_02", "hand_l"];
    const r = buildBoneRemap(src, tgt);
    expect(Array.from(r.remap)).toEqual([1, 2, 4]);
    expect(r.unmatched).toEqual([]);
    expect(r.coverage).toBe(1);
  });

  it("mappe par emplacement humanoïde entre conventions différentes", () => {
    // Veste Meshy posée sur un corps UE4.
    const src = ["Hips", "Spine", "LeftArm", "LeftHand"];
    const tgt = ["root", "pelvis", "spine_01", "upperarm_l", "hand_l"];
    const r = buildBoneRemap(src, tgt);
    expect(Array.from(r.remap)).toEqual([1, 2, 3, 4]);
    expect(r.coverage).toBe(1);
  });

  it("marque -1 et signale les os sans équivalent", () => {
    // weapon_l/weapon_r existent sur le corps mais pas sur un jean, et
    // inversement un os de tissu n'existe pas sur le corps.
    const src = ["pelvis", "cloth_flap_01"];
    const tgt = ["pelvis", "spine_01"];
    const r = buildBoneRemap(src, tgt);
    expect(Array.from(r.remap)).toEqual([0, -1]);
    expect(r.unmatched).toEqual(["cloth_flap_01"]);
    expect(r.coverage).toBe(0.5);
  });

  it("le nom EXACT prime sur l'emplacement humanoïde", () => {
    // "Hips" existe littéralement dans la cible : c'est la correspondance la
    // plus spécifique, elle doit gagner sur la traduction pelvis←hips.
    const r = buildBoneRemap(["Hips"], ["pelvis", "Hips"]);
    expect(r.remap[0]).toBe(1);
  });

  it("le 1er os gagne quand DEUX os cibles occupent le même emplacement", () => {
    // Aucun nom exact ici → passage par l'emplacement. Certains exports UE
    // portent un os de mesh homonyme après le vrai os : le premier gagne.
    const r = buildBoneRemap(["LeftArm"], ["upperarm_l", "leftUpperArm"]);
    expect(r.remap[0]).toBe(0);
  });

  it("coverage = 0 sur un squelette source vide (pas de division par zéro)", () => {
    const r = buildBoneRemap([], ["pelvis"]);
    expect(r.coverage).toBe(0);
    expect(r.remap.length).toBe(0);
  });
});

describe("applyRemapToSkinIndex", () => {
  it("traduit les indices en place", () => {
    const remap = Int32Array.from([5, 3, 7]);
    const idx = Uint16Array.from([0, 1, 2, 0]);
    const dropped = applyRemapToSkinIndex(idx, remap);
    expect(Array.from(idx)).toEqual([5, 3, 7, 5]);
    expect(dropped).toBe(0);
  });

  it("rabat les indices non résolus sur l'os de repli", () => {
    const remap = Int32Array.from([2, -1]);
    const idx = Uint16Array.from([0, 1, 1, 0]);
    const dropped = applyRemapToSkinIndex(idx, remap, 0);
    expect(Array.from(idx)).toEqual([2, 0, 0, 2]);
    expect(dropped).toBe(2);
  });

  it("rabat aussi un index HORS BORNES du remap", () => {
    // Un skinIndex corrompu ne doit jamais sortir en index invalide côté GPU.
    const remap = Int32Array.from([1]);
    const idx = Uint16Array.from([0, 99]);
    applyRemapToSkinIndex(idx, remap, 0);
    expect(Array.from(idx)).toEqual([1, 0]);
  });
});

describe("zeroUnmatchedWeights", () => {
  it("annule le poids d'une influence non résolue et renormalise à 1", () => {
    const originalIndex = [0, 1, 0, 0];           // 1 sommet, 4 influences
    const weights = Float32Array.from([0.5, 0.5, 0, 0]);
    const remap = Int32Array.from([3, -1]);        // l'os 1 n'a pas d'équivalent
    zeroUnmatchedWeights(originalIndex, weights, remap);
    expect(weights[1]).toBe(0);
    // Le poids restant est renormalisé : sans ça le sommet rétrécirait.
    expect(weights[0]).toBeCloseTo(1, 6);
    const sum = weights[0] + weights[1] + weights[2] + weights[3];
    expect(sum).toBeCloseTo(1, 6);
  });

  it("laisse intact un sommet entièrement résolu", () => {
    const originalIndex = [0, 1, 0, 0];
    const weights = Float32Array.from([0.7, 0.3, 0, 0]);
    const remap = Int32Array.from([2, 5]);
    zeroUnmatchedWeights(originalIndex, weights, remap);
    expect(weights[0]).toBeCloseTo(0.7, 6);
    expect(weights[1]).toBeCloseTo(0.3, 6);
  });

  it("ne divise pas par zéro si toutes les influences sont annulées", () => {
    const originalIndex = [0, 0, 0, 0];
    const weights = Float32Array.from([1, 0, 0, 0]);
    const remap = Int32Array.from([-1]);
    expect(() => zeroUnmatchedWeights(originalIndex, weights, remap)).not.toThrow();
    expect(weights[0]).toBe(0);
  });
});
