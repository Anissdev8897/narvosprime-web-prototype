import { describe, it, expect } from "vitest";
import {
  allMerchantEntries, filterMerchant, groupBySource, merchantSlotsWithParts,
  type MerchantEntry,
} from "./merchantCatalog";
import { SLOT_CATEGORY, slotSource, MERCHANT_SLOTS, type BodySlot } from "../bodySlots";
import type { ModularPart } from "../partCatalog";

/** Entrée de test — seuls les champs interrogés par le filtre sont utiles. */
function entree(p: Partial<ModularPart> & { label: string; source: string; slot: BodySlot }): MerchantEntry {
  return {
    part: { id: `${p.source}_${p.label}`, path: "/x.glb", ...p } as ModularPart,
    slotLabel: "Haut",
  };
}

const JEU: MerchantEntry[] = [
  entree({ label: "Plastron lourd", source: "wraith", slot: "top" }),
  entree({ label: "Épaulières", source: "wraith", slot: "top" }),
  entree({ label: "Casque intégral", source: "murdock", slot: "headwear" }),
  entree({ label: "Bottes de cuir", source: "biker", slot: "shoes" }),
];

describe("catalogue Marchand — contenu", () => {
  it("ne contient QUE de l'équipement, jamais d'anatomie", () => {
    // La règle du cahier des charges, vérifiée sur le vrai catalogue : les
    // modèles découpés vont au Marchand, jamais dans la création du corps.
    for (const e of allMerchantEntries()) {
      expect(SLOT_CATEGORY[e.part.slot], `${e.part.id}`).not.toBe("anatomy");
      expect(slotSource(e.part.slot), `${e.part.id}`).toBe("merchant");
    }
  });

  it("couvre tous les emplacements d'équipement de la taxonomie", () => {
    // Dérivé de `MERCHANT_SLOTS` : un nouvel emplacement d'équipement apparaît
    // ici sans qu'on y pense. Le test échouerait si quelqu'un figeait la liste.
    const vus = new Set(allMerchantEntries().map((e) => e.part.slot));
    for (const s of merchantSlotsWithParts()) expect(vus.has(s), `${s} absent`).toBe(true);
    for (const s of vus) expect(MERCHANT_SLOTS).toContain(s);
  });
});

describe("catalogue Marchand — recherche", () => {
  it("une requête vide rend tout", () => {
    expect(filterMerchant(JEU, "", null)).toHaveLength(4);
    expect(filterMerchant(JEU, "   ", null)).toHaveLength(4);
  });

  it("cherche dans le nom", () => {
    const r = filterMerchant(JEU, "casque", null);
    expect(r.map((e) => e.part.label)).toEqual(["Casque intégral"]);
  });

  it("cherche dans le PACK d'origine", () => {
    // Le geste principal quand on range des découpes : « montre-moi tout ce que
    // Wraith a fourni ».
    const r = filterMerchant(JEU, "wraith", null);
    expect(r).toHaveLength(2);
  });

  it("tous les mots doivent correspondre, pas un seul", () => {
    // Un OU rendrait 3 résultats ici et noierait la recherche.
    expect(filterMerchant(JEU, "wraith plastron", null)).toHaveLength(1);
    expect(filterMerchant(JEU, "wraith casque", null)).toHaveLength(0);
  });

  it("ignore la casse et les accents", () => {
    // Sans ça, « epaulieres » ne trouverait pas « Épaulières » et l'utilisateur
    // conclurait que la pièce n'existe pas.
    expect(filterMerchant(JEU, "EPAULIERES", null)).toHaveLength(1);
    expect(filterMerchant(JEU, "épaulières", null)).toHaveLength(1);
    expect(filterMerchant(JEU, "integral", null)).toHaveLength(1);
  });

  it("le filtre d'emplacement se combine avec le texte", () => {
    expect(filterMerchant(JEU, "", "top")).toHaveLength(2);
    expect(filterMerchant(JEU, "wraith", "headwear")).toHaveLength(0);
    expect(filterMerchant(JEU, "", "shoes")).toHaveLength(1);
  });
});

describe("catalogue Marchand — regroupement par pack", () => {
  it("groupe par origine et trie les packs par nom", () => {
    const g = groupBySource(JEU);
    expect(g.map((x) => x.source)).toEqual(["biker", "murdock", "wraith"]);
    expect(g.find((x) => x.source === "wraith")!.entries).toHaveLength(2);
  });

  it("préserve l'ordre du catalogue à l'intérieur d'un pack", () => {
    // Un tri alphabétique casserait les séries numérotées (« Plaque 01, 02… »).
    const w = groupBySource(JEU).find((x) => x.source === "wraith")!;
    expect(w.entries.map((e) => e.part.label)).toEqual(["Plastron lourd", "Épaulières"]);
  });

  it("une liste vide ne produit aucun groupe", () => {
    expect(groupBySource([])).toEqual([]);
  });
});
