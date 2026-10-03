import { describe, it, expect } from "vitest";
import { selectionToMacro, type MacroSelection } from "./selectionToMacro";
import { macroWeights, DEFAULT_MACRO } from "./macroWeights";
import type { BuildId, ArchetypeId } from "./bodyArchetypes";

const sel = (p: Partial<MacroSelection> = {}): MacroSelection => ({
  gender: "male", build: "athletic", archetype: "human", ...p,
});

const BUILDS: BuildId[] = ["slim", "athletic", "muscular", "heavy"];
const ARCHETYPES: ArchetypeId[] = ["human", "alien", "synthetic", "mutant"];

describe("selectionToMacro — genre", () => {
  it("mappe les deux genres aux extrêmes du curseur continu", () => {
    expect(selectionToMacro(sel({ gender: "male" })).gender).toBe(1);
    expect(selectionToMacro(sel({ gender: "female" })).gender).toBe(0);
  });
});

describe("selectionToMacro — morphologie", () => {
  it("distingue MUSCLÉ de CORPULENT sur deux axes séparés", () => {
    // Le point de tout le passage aux macro-morphs. Avec `girth`, ces deux
    // morphologies n'étaient qu'un même curseur « largeur » à deux crans.
    const muscle = selectionToMacro(sel({ build: "muscular" }));
    const corpulent = selectionToMacro(sel({ build: "heavy" }));

    expect(muscle.muscle).toBeGreaterThan(corpulent.muscle);
    expect(corpulent.weight).toBeGreaterThan(muscle.weight);
  });

  it("ordonne la masse grasse de maigre à corpulent", () => {
    const poids = BUILDS.map((b) => selectionToMacro(sel({ build: b })).weight);
    expect(poids).toEqual([...poids].sort((a, b) => a - b));
  });

  it("garde tous les curseurs dans [0, 1] pour toute combinaison", () => {
    // Les écarts d'archétype sont additifs : sans bornage, un mutant corpulent
    // dépasserait 1 et `macroWeights` répartirait sur une ancre inexistante.
    for (const build of BUILDS) {
      for (const archetype of ARCHETYPES) {
        const m = selectionToMacro(sel({ build, archetype }));
        for (const cle of ["gender", "age", "muscle", "weight", "height"] as const) {
          expect(m[cle], `${build}/${archetype}.${cle}`).toBeGreaterThanOrEqual(0);
          expect(m[cle], `${build}/${archetype}.${cle}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("selectionToMacro — archétype", () => {
  it("décale sans écraser : un alien musclé reste plus musclé qu'un alien maigre", () => {
    // Si les écarts d'archétype étaient absolus, les quatre morphologies
    // deviendraient indiscernables sur tout ce qui n'est pas humain.
    const a = selectionToMacro(sel({ archetype: "alien", build: "muscular" }));
    const b = selectionToMacro(sel({ archetype: "alien", build: "slim" }));
    expect(a.muscle).toBeGreaterThan(b.muscle);
  });

  it("laisse l'humain sur la morphologie pure", () => {
    const h = selectionToMacro(sel({ archetype: "human", build: "athletic" }));
    expect(h.height).toBe(DEFAULT_MACRO.height);
  });

  it("donne à chaque archétype une taille distincte", () => {
    const tailles = ARCHETYPES.map((a) => selectionToMacro(sel({ archetype: a })).height);
    expect(new Set(tailles).size).toBe(ARCHETYPES.length);
  });
});

describe("selectionToMacro — neutralité assumée", () => {
  it("n'invente ni âge ni ethnie", () => {
    // Le créateur ne les demande pas. Les déduire de l'archétype produirait des
    // corps que le joueur n'a pas choisis.
    const m = selectionToMacro(sel({ archetype: "mutant", build: "heavy" }));
    expect(m.age).toBe(DEFAULT_MACRO.age);
    expect(m.ethnicity).toEqual(DEFAULT_MACRO.ethnicity);
  });
});

describe("selectionToMacro — branché sur macroWeights", () => {
  it("produit des poids exploitables pour toute combinaison", () => {
    // Le contrat qui compte vraiment : un nom de morph faux ne lève rien, le
    // corps reste simplement neutre. On vérifie donc qu'il sort des poids.
    for (const build of BUILDS) {
      for (const archetype of ARCHETYPES) {
        const poids = macroWeights(selectionToMacro(sel({ build, archetype })));
        const actifs = Object.values(poids).filter((v) => v > 0);
        expect(actifs.length, `${build}/${archetype}`).toBeGreaterThan(0);
      }
    }
  });

  it("deux morphologies différentes ne donnent pas les mêmes poids", () => {
    const a = macroWeights(selectionToMacro(sel({ build: "slim" })));
    const b = macroWeights(selectionToMacro(sel({ build: "heavy" })));
    expect(a).not.toEqual(b);
  });
});
