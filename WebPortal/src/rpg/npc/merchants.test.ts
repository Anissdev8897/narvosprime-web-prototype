// merchants.test.ts — l'équipementier vend ce que le créateur ne donne plus.
//
// Depuis le 03/08/2026, casques / plastrons / gants / bottes / sacs sortent du
// créateur de personnage (`slotSource`) et s'achètent en jeu. Les deux règles
// dérivent de la MÊME source, donc le vrai risque n'est pas qu'un objet soit du
// mauvais côté : c'est qu'il ne soit d'AUCUN côté, et disparaisse en silence.

import { describe, it, expect } from "vitest";
import { MERCHANTS, getMerchant, merchantStock, modularGearIds, buyPrice } from "./merchants";
import { partIdOfItem, isModularItem } from "../loot/modularItems";
import { getPart } from "../characters/modular/partCatalog";
import { slotSource, type BodySlot } from "../characters/modular/bodySlots";
import { isCreatorPart } from "../characters/modular/anatomySources";

const EQUIPEMENTIER = "mer_equipement";

describe("équipementier", () => {
  it("existe et son rayon n'est pas vide", () => {
    // LE test qui compte. `modularGearIds()` filtre sur `slotSource` ; une
    // erreur de filtre rendrait `[]` — un marchand présent, avec une boutique
    // vide, sans la moindre erreur.
    const m = getMerchant(EQUIPEMENTIER);
    expect(m).toBeTruthy();
    expect(merchantStock(m!).length).toBeGreaterThan(0);
  });

  it("ne vend jamais d'anatomie — mais bien les vêtements rangés en slot anatomique", () => {
    // On n'achète pas un torse nu ni une paire de mains.
    //
    // ⚠ Ce test testait `slotSource(part.slot) === "merchant"`. Ça ne suffit
    // plus : le découpeur classe une pièce par la RÉGION qu'elle couvre, donc
    // une veste de zombie vit dans le slot `torso`. Depuis la liste blanche
    // d'anatomie (05/08/2026), le créateur la refuse et le marchand la prend —
    // vérifier le slot seul redonnerait « anatomie » sur une veste.
    //
    // Le critère juste est la NATURE de la pièce : `isCreatorPart`.
    for (const id of modularGearIds()) {
      const partId = partIdOfItem(id);
      expect(partId, `${id} n'est pas une pièce modulaire`).toBeTruthy();
      const part = getPart(partId!);
      expect(part, `${partId} absent du catalogue`).toBeTruthy();
      const estAnatomie = slotSource(part!.slot as BodySlot) === "creator" && isCreatorPart(part!);
      expect(estAnatomie, `${partId} est un corps nu, il ne se vend pas`).toBe(false);
    }
  });

  it("chaque id du rayon se résout en objet — aucun id fantôme", () => {
    // `merchantStock` filtre les ids inconnus : un id mal formé disparaîtrait
    // du rayon sans bruit. On compare donc les deux longueurs.
    const m = getMerchant(EQUIPEMENTIER)!;
    expect(merchantStock(m).length).toBe(m.stock.length);
  });

  it("les pièces modulaires portent le préfixe qui les distingue du butin", () => {
    for (const id of modularGearIds()) expect(isModularItem(id)).toBe(true);
  });

  it("tout objet du rayon a un prix d'achat strictement positif", () => {
    // Un objet à 0 crédit serait gratuit — et incohérent avec la boucle de jeu
    // qui veut qu'on parte avec une tenue de pauvre et qu'on s'équipe ensuite.
    for (const item of merchantStock(getMerchant(EQUIPEMENTIER)!)) {
      expect(buyPrice(item), `${item.id} gratuit`).toBeGreaterThan(0);
    }
  });

  it("aucun autre marchand ne vend de pièce modulaire", () => {
    // Sinon le même casque s'achèterait à deux endroits à deux prix.
    for (const m of MERCHANTS.filter((x) => x.id !== EQUIPEMENTIER)) {
      expect(m.stock.filter(isModularItem), `${m.id} vend du modulaire`).toEqual([]);
    }
  });
});
