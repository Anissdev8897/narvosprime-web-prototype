import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { macroWeights, DEFAULT_MACRO, type BodyMacro } from "./macroWeights";
import { parseMorphSet } from "./morphSet";

const macro = (p: Partial<BodyMacro> = {}): BodyMacro => ({ ...DEFAULT_MACRO, ...p });

/** Somme des poids d'une famille, repérée par un préfixe. */
function somme(w: Record<string, number>, filtre: (nom: string) => boolean): number {
  return Object.entries(w).filter(([n]) => filtre(n)).reduce((s, [, v]) => s + v, 0);
}

describe("macroWeights — le genre est un curseur, pas un interrupteur", () => {
  it("gender=0 ne produit que du féminin", () => {
    const w = macroWeights(macro({ gender: 0 }));
    expect(somme(w, (n) => n.includes("-male-"))).toBe(0);
    expect(somme(w, (n) => n.includes("-female-"))).toBeGreaterThan(0);
  });

  it("gender=1 ne produit que du masculin", () => {
    const w = macroWeights(macro({ gender: 1 }));
    expect(somme(w, (n) => n.includes("-female-"))).toBe(0);
    expect(somme(w, (n) => n.includes("-male-"))).toBeGreaterThan(0);
  });

  it("gender=0,5 mélange les deux à parts égales", () => {
    // La propriété qui rend la morphologie continue : entre deux ancres, tout
    // est atteignable. Sans ça on aurait un catalogue de deux corps.
    // Corpulence volontairement hors du point moyen/moyen : c'est le seul
    // combo `universal-` que MakeHuman ne livre pas, y sonder ne mesurerait
    // rien.
    const w = macroWeights(macro({ gender: 0.5, muscle: 1, weight: 0 }));
    const f = somme(w, (n) => n.startsWith("universal-female-"));
    const m = somme(w, (n) => n.startsWith("universal-male-"));
    expect(f).toBeCloseTo(m, 6);
    expect(f).toBeGreaterThan(0);
  });

  it("le curseur est monotone : plus de gender = plus de masculin", () => {
    const part = (g: number) => somme(macroWeights(macro({ gender: g })), (n) => n.includes("-male-"));
    expect(part(0.25)).toBeLessThan(part(0.75));
  });
});

describe("macroWeights — conservation des poids", () => {
  it("aucune famille ne DÉPASSE 1, quels que soient les réglages", () => {
    // Dépasser 1 ferait s'additionner les deltas au-delà de l'extrême prévu et
    // déformerait le corps.
    //
    // En revanche l'égalité stricte n'est PAS attendue pour `universal-` :
    // MakeHuman ne livre pas `averagemuscle-averageweight`, ce point étant le
    // maillage de base lui-même. À corpulence moyenne, une part du poids reste
    // donc sur la base — et c'est le résultat correct.
    const cas: Partial<BodyMacro>[] = [
      {}, { gender: 0 }, { gender: 1 }, { age: 1 }, { muscle: 0 }, { muscle: 1 },
      { weight: 0.33 }, { gender: 0.7, age: 0.4, muscle: 0.2, weight: 0.9 },
    ];
    for (const c of cas) {
      const w = macroWeights(macro(c));
      const eth = somme(w, (n) => /^(african|asian|caucasian)-/.test(n));
      const uni = somme(w, (n) => n.startsWith("universal-"));
      expect(eth, `ethnie ${JSON.stringify(c)}`).toBeCloseTo(1, 6);
      expect(uni, `universal ${JSON.stringify(c)}`).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it("aux extrêmes de corpulence, `universal` totalise bien 1", () => {
    // Le complément du test précédent : hors du point moyen/moyen, la famille
    // est complète et doit se conserver exactement.
    const w = macroWeights(macro({ muscle: 1, weight: 0 }));
    expect(somme(w, (n) => n.startsWith("universal-"))).toBeCloseTo(1, 6);
  });

  it("les ethnies sont normalisées même si la somme d'entrée ne vaut pas 1", () => {
    const w = macroWeights(macro({ ethnicity: { african: 5, asian: 5, caucasian: 0 } }));
    expect(somme(w, (n) => /^(african|asian|caucasian)-/.test(n))).toBeCloseTo(1, 6);
    expect(somme(w, (n) => n.startsWith("caucasian-"))).toBe(0);
    expect(somme(w, (n) => n.startsWith("african-"))).toBeCloseTo(0.5, 6);
  });

  it("une somme d'ethnies nulle retombe sur un mélange égal", () => {
    const w = macroWeights(macro({ ethnicity: { african: 0, asian: 0, caucasian: 0 } }));
    expect(somme(w, (n) => /^(african|asian|caucasian)-/.test(n))).toBeCloseTo(1, 6);
  });
});

describe("macroWeights — taille", () => {
  it("à 0,5 aucun morph de taille n'est activé", () => {
    // Il n'existe pas de morph « taille moyenne » : c'est le maillage de base.
    // En produire un serait chercher un nom qui n'existe pas.
    const w = macroWeights(macro({ height: 0.5 }));
    expect(somme(w, (n) => n.startsWith("height/"))).toBe(0);
  });

  it("en dessous de 0,5 va vers minheight, au-dessus vers maxheight", () => {
    const bas = macroWeights(macro({ height: 0 }));
    const haut = macroWeights(macro({ height: 1 }));
    expect(somme(bas, (n) => n.endsWith("-minheight"))).toBeCloseTo(1, 6);
    expect(somme(bas, (n) => n.endsWith("-maxheight"))).toBe(0);
    expect(somme(haut, (n) => n.endsWith("-maxheight"))).toBeCloseTo(1, 6);
  });
});

describe("macroWeights — bébés et enfants hors périmètre", () => {
  it("aucun réglage ne peut produire un corps d'enfant", () => {
    // Règle produit, pas détail technique : NARVOS est un MMO à personnages
    // adultes. Les ancres `baby` et `child` existent chez MakeHuman et ne
    // doivent jamais être atteignables depuis les curseurs.
    for (let a = 0; a <= 1.0001; a += 0.05) {
      const w = macroWeights(macro({ age: a }));
      expect(somme(w, (n) => n.includes("baby") || n.includes("child")), `age=${a}`).toBe(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Le contrôle décisif : les noms produits existent-ils dans le pack ?
//
// Un nom erroné ne lève RIEN. `applyMorphs` ne trouve pas le morph, passe son
// chemin, et le corps reste neutre — on croit que les curseurs ne servent à
// rien sans jamais voir d'erreur. Seule une confrontation au pack réel
// l'attrape.
// ══════════════════════════════════════════════════════════════════════════════

const PACK = path.resolve(
  __dirname, "../../../../public/models/personnages/_body/morphs/macrodetails.morphs",
);
const presente = fs.existsSync(PACK);

describe.skipIf(!presente)("macroWeights — noms confrontés au pack réel", () => {
  const noms = (() => {
    if (!presente) return new Set<string>();
    const b = fs.readFileSync(PACK);
    const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    return new Set(parseMorphSet(ab).morphs.keys());
  })();

  it("TOUS les morphs demandés existent, sur tout l'espace des réglages", () => {
    const manquants = new Set<string>();
    for (let g = 0; g <= 1.0001; g += 0.5) {
      for (let a = 0; a <= 1.0001; a += 0.5) {
        for (let mu = 0; mu <= 1.0001; mu += 0.5) {
          for (let we = 0; we <= 1.0001; we += 0.5) {
            for (const h of [0, 0.5, 1]) {
              const w = macroWeights(macro({ gender: g, age: a, muscle: mu, weight: we, height: h }));
              for (const n of Object.keys(w)) if (!noms.has(n)) manquants.add(n);
            }
          }
        }
      }
    }
    expect([...manquants].slice(0, 10)).toEqual([]);
  });

  it("le réglage par défaut active un nombre raisonnable de morphs", () => {
    // Chaque morph actif est une passe sur ses sommets à chaque frame. Un
    // réglage neutre qui en activerait des centaines ferait saccader le curseur.
    const w = macroWeights(DEFAULT_MACRO);
    const actifs = Object.values(w).filter((v) => v > 0).length;
    expect(actifs).toBeGreaterThan(0);
    expect(actifs).toBeLessThan(40);
  });
});
