import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { positionsMonde, translationsLocales, type RecetteSquelette } from "./jointCubes";
import { parseMorphSet, applyMorphs, MAKEHUMAN_TO_METERS, type MorphSet } from "./morphSet";
import { CANONICAL_VERTEX_COUNT } from "./morphLoader";
import { macroWeights } from "./macroWeights";
import { selectionToMacro } from "./selectionToMacro";

const RACINE = path.resolve(__dirname, "../../../../public/models/personnages/_body");
const F = path.join(RACINE, "joint-cubes.json");
const present = fs.existsSync(F);
const recette: RecetteSquelette = present
  ? JSON.parse(fs.readFileSync(F, "utf8"))
  : { scale: 0.1, groundOffset: 0, canonicalVertexCount: 0, bones: [] };

/** Positions canoniques de `base.obj`, via le GLB de rendu — suffisant ici. */
function canonNeutre(): Float32Array {
  const out = new Float32Array(CANONICAL_VERTEX_COUNT * 3);
  // Les tests portent sur la MÉCANIQUE, pas sur des valeurs d'auteur : un
  // maillage synthétique suffit et rend l'attendu calculable à la main.
  for (let i = 0; i < out.length; i++) out[i] = i % 17;
  return out;
}

describe.skipIf(!present)("jointCubes — recette d'auteur", () => {
  it("couvre les 53 os d'auteur, chacun avec un cube non vide", () => {
    expect(recette.bones.length).toBe(53);
    for (const b of recette.bones) {
      expect(b.cube.length, `${b.nom} sans cube`).toBeGreaterThan(0);
      for (const v of b.cube) {
        // Un indice hors bornes donnerait NaN et un corps invisible.
        expect(v, `${b.nom} indice ${v}`).toBeLessThan(CANONICAL_VERTEX_COUNT);
      }
    }
  });

  it("porte l'échelle ET la remontée au sol", () => {
    // Les oublier donnerait un squelette dix fois trop grand et enterré de 82 cm.
    expect(recette.scale).toBeCloseTo(MAKEHUMAN_TO_METERS, 6);
    expect(recette.groundOffset).toBeGreaterThan(0.7);
  });

  it("chaque parent déclaré existe dans la recette", () => {
    const noms = new Set(recette.bones.map((b) => b.nom));
    const orphelins = recette.bones
      .filter((b) => b.parent && !noms.has(b.parent))
      .map((b) => `${b.nom} ⊂ ${b.parent}`);
    expect(orphelins).toEqual([]);
  });
});

describe("positionsMonde", () => {
  const r: RecetteSquelette = {
    scale: 0.1, groundOffset: 2, canonicalVertexCount: 4,
    bones: [{ nom: "a", parent: null, cube: [0, 1], neutre: [1, 5, 9] }],
  };

  it("AJOUTE le déplacement moyen à la pose de repos", () => {
    // ⚠ Le tableau canonique porte un DÉPLACEMENT aux indices des cubes, pas
    // une position : les joint cubes sont des helpers, absents du maillage de
    // rendu, donc `gatherFromRender` les laisse à zéro.
    const c = new Float32Array([0, 0, 0, 10, 20, 30]);
    // moyenne des deltas (5,10,15) × 0,1 = (0.5,1,1.5), ajoutée à (1,5,9)
    expect(positionsMonde(c, r).get("a")).toEqual([1.5, 6, 10.5]);
  });

  it("à déplacement NUL, rend exactement la pose de repos", () => {
    // LE TEST QUI MANQUAIT. Le premier jet lisait le canonique comme une
    // POSITION : à déplacement nul il rendait (0,0,0) au lieu de `neutre`, et
    // tous les os s'effondraient à l'origine — corps écrasé, aucune erreur.
    // Le test d'alors ne vérifiait que « les os ont bougé », ce qui était vrai.
    expect(positionsMonde(new Float32Array(12), r).get("a")).toEqual([1, 5, 9]);
  });

  it("saute un indice hors bornes plutôt que de produire NaN", () => {
    const rr: RecetteSquelette = {
      ...r, bones: [{ nom: "a", parent: null, cube: [0, 999], neutre: [1, 5, 9] }],
    };
    expect(positionsMonde(new Float32Array([1, 2, 3]), rr).get("a")!.every(Number.isFinite)).toBe(true);
  });

  it("aucun sommet lisible : rend la pose de repos, pas rien", () => {
    // Omettre l'os ferait diverger la soustraction du parent chez ses enfants.
    const rr: RecetteSquelette = {
      ...r, bones: [{ nom: "a", parent: null, cube: [999], neutre: [1, 5, 9] }],
    };
    expect(positionsMonde(new Float32Array([1, 2, 3]), rr).get("a")).toEqual([1, 5, 9]);
  });
});

describe("translationsLocales", () => {
  const r: RecetteSquelette = {
    scale: 1, groundOffset: 0, canonicalVertexCount: 0,
    bones: [
      { nom: "racine", parent: null, cube: [], neutre: [0, 0, 0] },
      { nom: "enfant", parent: "racine", cube: [], neutre: [0, 0, 0] },
      { nom: "orphelin", parent: "absent", cube: [], neutre: [0, 0, 0] },
    ],
  };

  it("soustrait le parent — sinon les transforms se cumulent", () => {
    const monde = new Map<string, [number, number, number]>([
      ["racine", [1, 2, 3]], ["enfant", [4, 6, 8]],
    ]);
    const l = translationsLocales(monde, r);
    expect(l.get("racine")).toEqual([1, 2, 3]);
    expect(l.get("enfant")).toEqual([3, 4, 5]);
  });

  it("un os sans parent recalculé garde sa position monde", () => {
    const monde = new Map<string, [number, number, number]>([["orphelin", [7, 7, 7]]]);
    expect(translationsLocales(monde, r).get("orphelin")).toEqual([7, 7, 7]);
  });
});

describe.skipIf(!present)("le squelette SUIT la morphologie", () => {
  it("un morph de taille déplace réellement les os", () => {
    // Le contrat qui compte : sans recalcul, la peau se déforme autour d'un
    // squelette figé et toute pièce accrochée à un os flotte.
    const sets: MorphSet[] = [parseMorphSet(
      fs.readFileSync(path.join(RACINE, "morphs/macrodetails.morphs")).buffer as ArrayBuffer,
    )];
    const base = canonNeutre();
    const out = new Float32Array(base.length);

    const avant = positionsMonde(base, recette);
    applyMorphs(base, out, sets,
      macroWeights(selectionToMacro({ gender: "male", build: "heavy", archetype: "human" })),
      MAKEHUMAN_TO_METERS);
    const apres = positionsMonde(out, recette);

    let bouges = 0;
    for (const [nom, p] of apres) {
      const a = avant.get(nom)!;
      if (Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) > 1e-6) bouges++;
      expect(p.every(Number.isFinite), `${nom} non fini`).toBe(true);
    }
    expect(bouges, "aucun os n'a bougé — le recalcul ne sert à rien").toBeGreaterThan(0);
  });

  it("le squelette morphé reste ANATOMIQUEMENT plausible", () => {
    // ⚠ LE CONTRÔLE QUI MANQUAIT. Vérifier que les os « ont bougé » ne dit rien
    // de l'endroit : la première version les effondrait TOUS à l'origine et ce
    // test-là passait. Ici on borne : un corps humain fait ~1,7 m, ses os
    // tiennent dans [0, 2,2] m en Y et |X|,|Z| < 1,2 m.
    const sets: MorphSet[] = [parseMorphSet(
      fs.readFileSync(path.join(RACINE, "morphs/macrodetails.morphs")).buffer as ArrayBuffer,
    )];
    const base = new Float32Array(CANONICAL_VERTEX_COUNT * 3);   // helpers à ZÉRO, comme au runtime
    const out = new Float32Array(base.length);

    for (const build of ["slim", "heavy"] as const) {
      applyMorphs(base, out, sets,
        macroWeights(selectionToMacro({ gender: "male", build, archetype: "human" })),
        MAKEHUMAN_TO_METERS);

      const m = positionsMonde(out, recette);
      const aberrants: string[] = [];
      for (const [nom, p] of m) {
        if (!p.every(Number.isFinite)) { aberrants.push(`${nom} non fini`); continue; }
        // Tolérance de 2 cm sous le sol : `root` est le bone du SOL et les
        // morphs le font passer d'un ou deux millimètres sous zéro. Un os
        // franchement enterré reste un vrai défaut, 1,5 mm non.
        if (p[1] < -0.02 || p[1] > 2.2) aberrants.push(`${nom} Y=${p[1].toFixed(3)}`);
        if (Math.abs(p[0]) > 1.2 || Math.abs(p[2]) > 1.2) aberrants.push(`${nom} hors X/Z`);
      }
      expect(aberrants, `${build} : os aberrants`).toEqual([]);

      // Et le squelette doit rester DÉPLOYÉ : effondré, tous les os seraient
      // au même endroit et l'amplitude verticale tomberait à zéro.
      const ys = [...m.values()].map((p) => p[1]);
      expect(Math.max(...ys) - Math.min(...ys), `${build} : squelette effondré`)
        .toBeGreaterThan(1.2);
    }
  });
});
