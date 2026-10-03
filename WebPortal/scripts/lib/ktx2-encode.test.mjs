// Garde-fou sur les dimensions de textures compressées.
//
// Ce test existe à cause d'une panne réelle : `fit: "inside"` préservait le ratio
// et produisait des textures 1024×682. L'encodage réussissait, le fichier était
// valide, les tests passaient — puis le GPU rejetait l'upload en jeu
// (GL_INVALID_OPERATION) et la map ne s'assemblait jamais. Une fonction pure,
// non testée, hors du périmètre de vitest.
import { describe, it, expect } from "vitest";
import { safeBlockDimensions } from "./ktx2-encode.mjs";

/** Vrai si toute la chaîne de mipmaps reste uploadable par le GPU. */
function mipChainIsValid(w, h) {
  while (w > 4 || h > 4) {
    if (w % 4 !== 0 || h % 4 !== 0) return false;
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  return true;
}

describe("safeBlockDimensions", () => {
  it("corrige le cas qui a bloqué la forge : une texture 3:2 ne donne plus 1024×682", () => {
    const [w, h] = safeBlockDimensions(1536, 1024, 1024);
    expect(h % 4).toBe(0);
    expect([w, h]).toEqual([1024, 512]);
  });

  it("garde une chaîne de mipmaps valide sur des ratios variés", () => {
    // Chaque paire est un ratio qu'on trouve réellement dans les assets du projet.
    const cases = [
      [1536, 1024], [3000, 2000], [1920, 1080], [2048, 2048],
      [4096, 4096], [1024, 768], [800, 600], [2560, 1440], [512, 384],
    ];
    for (const [sw, sh] of cases) {
      const [w, h] = safeBlockDimensions(sw, sh, 1024);
      expect(mipChainIsValid(w, h), `${sw}×${sh} → ${w}×${h}`).toBe(true);
    }
  });

  it("ne dépasse jamais maxSize", () => {
    for (const [sw, sh] of [[4096, 4096], [8192, 2048], [2048, 8192]]) {
      const [w, h] = safeBlockDimensions(sw, sh, 1024);
      expect(Math.max(w, h)).toBeLessThanOrEqual(1024);
    }
  });

  it("n'AGRANDIT pas une petite texture jusqu'à maxSize", () => {
    // Une icône 256² doit rester 256² : la faire monter à 1024² multiplierait sa
    // VRAM par 16 pour zéro détail supplémentaire.
    expect(safeBlockDimensions(256, 256, 1024)).toEqual([256, 256]);
    expect(safeBlockDimensions(64, 64, 1024)).toEqual([64, 64]);
  });

  it("ne descend jamais sous 4 — la taille d'un bloc de compression", () => {
    const [w, h] = safeBlockDimensions(3, 1, 1024);
    expect(w).toBeGreaterThanOrEqual(4);
    expect(h).toBeGreaterThanOrEqual(4);
  });

  it("laisse intactes les puissances de deux déjà conformes", () => {
    expect(safeBlockDimensions(1024, 1024, 1024)).toEqual([1024, 1024]);
    expect(safeBlockDimensions(1024, 512, 1024)).toEqual([1024, 512]);
  });

  it("tolère des métadonnées absentes sans produire une dimension nulle", () => {
    // sharp peut renvoyer width/height undefined sur un format exotique ; mieux
    // vaut une texture minuscule qu'un resize(0,0) qui ferait planter le lot.
    const [w, h] = safeBlockDimensions(undefined, undefined, 1024);
    expect(w).toBeGreaterThanOrEqual(4);
    expect(h).toBeGreaterThanOrEqual(4);
  });
});
