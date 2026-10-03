// quantize-morph.test.mjs — l'aller-retour doit rester sous le pas de quantification.
//
// On vérifie le DÉCODAGE tel que le fait un lecteur glTF (`max(v/32767, -1)`),
// pas une simple division : c'est la seule façon de savoir que le fichier écrit
// sera relu correctement par Three.js.

import { describe, it, expect } from "vitest";
import { quantizeNormalized, dequantizeNormalized, maxAbs, INT16_MAX } from "./quantize-morph.mjs";

const PAS = 1 / INT16_MAX;

describe("quantizeNormalized", () => {
  it("produit de l'Int16", () => {
    const { array } = quantizeNormalized(new Float32Array([0.5]));
    expect(array).toBeInstanceOf(Int16Array);
  });

  it("conserve les deltas de position mesurés sur Echo", () => {
    // Amplitudes réelles : 0,0257 (tête) à 0,1318 (bras).
    const src = new Float32Array([0.0257, -0.0422, 0.1318, 0]);
    const { array, clipped } = quantizeNormalized(src);
    const relu = dequantizeNormalized(array);
    expect(clipped).toBe(0);
    for (let i = 0; i < src.length; i++) expect(Math.abs(relu[i] - src[i])).toBeLessThan(PAS);
  });

  it("écrête au-delà de 1 et le SIGNALE", () => {
    // Cas réel des normales d'Echo : max 1,0079.
    const { array, clipped } = quantizeNormalized(new Float32Array([1.0079, -1.0079, 0.5]));
    expect(clipped).toBe(2);
    const relu = dequantizeNormalized(array);
    expect(relu[0]).toBeCloseTo(1, 5);
    expect(relu[1]).toBeCloseTo(-1, 5);
    // L'erreur introduite reste bornée par le dépassement lui-même.
    expect(Math.abs(relu[0] - 1.0079)).toBeLessThan(0.008);
  });

  it("ne signale rien quand tout tient dans la plage", () => {
    expect(quantizeNormalized(new Float32Array([1, -1, 0])).clipped).toBe(0);
  });

  it("zéro reste exactement zéro", () => {
    // Un delta nul qui deviendrait non nul déplacerait des sommets censés être
    // immobiles — c'est le pire cas possible pour une cible morph.
    const { array } = quantizeNormalized(new Float32Array([0, 0, 0]));
    expect(Array.from(array)).toEqual([0, 0, 0]);
  });
});

describe("dequantizeNormalized", () => {
  it("suit la formule de la spec glTF, pas une simple division", () => {
    // -32768 existe en Int16 ; la spec impose de le ramener à -1 exactement.
    expect(dequantizeNormalized(new Int16Array([-32768]))[0]).toBe(-1);
    expect(dequantizeNormalized(new Int16Array([INT16_MAX]))[0]).toBe(1);
  });
});

describe("aller-retour sur un bruit dense", () => {
  it("erreur bornée par le pas de quantification sur 1000 valeurs", () => {
    // Valeurs déterministes (pas de Math.random : un test qui échoue une fois
    // sur cent est pire qu'un test absent).
    const src = new Float32Array(1000);
    for (let i = 0; i < src.length; i++) src[i] = Math.sin(i) * 0.13;

    const { array, clipped } = quantizeNormalized(src);
    const relu = dequantizeNormalized(array);
    expect(clipped).toBe(0);

    let pire = 0;
    for (let i = 0; i < src.length; i++) pire = Math.max(pire, Math.abs(relu[i] - src[i]));
    expect(pire).toBeLessThan(PAS);
  });
});

describe("maxAbs", () => {
  it("trouve l'amplitude, signe indifférent", () => {
    expect(maxAbs(new Float32Array([0.1, -1.0079, 0.5]))).toBeCloseTo(1.0079, 6);
  });

  it("tableau vide → 0", () => {
    expect(maxAbs(new Float32Array([]))).toBe(0);
  });
});
