// modularItems.test.ts — les pièces découpées vues comme objets d'inventaire.
//
// Ce que ces tests protègent : la frontière entre les DEUX vocabulaires
// d'emplacements. Les confondre ferait apparaître une tête dans le panneau
// d'équipement RPG, ou un blouson uniquement dans la composition.

import { describe, it, expect } from "vitest";
import {
  MODULAR_ITEMS, MODULAR_ITEM_PREFIX, itemFromPart, gearSlotForBodySlot,
  getModularItem, isModularItem, partIdOfItem, modularItemsBySlot,
} from "./modularItems";
import { MODULAR_PARTS, getPart } from "../characters/modular/partCatalog";
import { SLOT_CATEGORY } from "../characters/modular/bodySlots";
import { GEAR_SLOTS } from "./gear";

describe("gearSlotForBodySlot", () => {
  it("traduit les vêtements vers le vocabulaire RPG", () => {
    expect(gearSlotForBodySlot("top")).toBe("armor");
    expect(gearSlotForBodySlot("shoes")).toBe("boots");
    expect(gearSlotForBodySlot("headwear")).toBe("helmet");
    expect(gearSlotForBodySlot("back")).toBe("cape");
  });

  it("laisse les JAMBES sans équivalent — trou réel de GearSlot", () => {
    // Mesuré : `GearSlot` est helmet · amulet · armor · cape · gloves · belt ·
    // ring · boots · weapon · offhand. Aucun emplacement jambes. Inventer un
    // mapping ici (vers `belt` par exemple) ferait qu'équiper un pantalon
    // retirerait la ceinture.
    expect(gearSlotForBodySlot("pants")).toBeUndefined();
    expect(GEAR_SLOTS.some((g) => g.accepts === ("legs" as never))).toBe(false);
  });

  it("l'anatomie n'est jamais un équipement", () => {
    for (const s of ["head", "torso", "arms", "hands", "legs", "feet", "hair", "beard", "body"] as const) {
      expect(gearSlotForBodySlot(s), s).toBeUndefined();
    }
  });

  it("ne rend que des emplacements RPG déclarés", () => {
    const connus = new Set(GEAR_SLOTS.map((g) => g.accepts));
    for (const p of MODULAR_PARTS) {
      const g = gearSlotForBodySlot(p.slot);
      if (g) expect(connus.has(g), `${p.slot} → ${g}`).toBe(true);
    }
  });
});

describe("itemFromPart", () => {
  it("préfixe l'identifiant pour ne pas heurter le loot existant", () => {
    const item = itemFromPart(getPart("m_jacket_a")!);
    expect(item.id).toBe(`${MODULAR_ITEM_PREFIX}m_jacket_a`);
  });

  it("un blouson porte LES DEUX emplacements", () => {
    const item = itemFromPart(getPart("m_jacket_a")!);
    expect(item.slot).toBe("armor");
    expect(item.bodySlot).toBe("top");
    expect(item.category).toBe("equipment");
  });

  it("une tête n'a que l'emplacement de composition", () => {
    // La ranger en « equipment » la ferait apparaître dans un panneau incapable
    // de l'équiper.
    const item = itemFromPart(getPart("wraith_head")!);
    expect(item.slot).toBeUndefined();
    expect(item.bodySlot).toBe("head");
    expect(item.category).toBe("material");
  });

  it("aucune pièce ne donne de bonus de stats", () => {
    // Sinon la personnalisation deviendrait un choix d'optimisation : le joueur
    // porterait la tête la plus puissante, pas celle qu'il préfère.
    for (const i of MODULAR_ITEMS) expect(Object.keys(i.statBonus)).toHaveLength(0);
  });

  it("la rareté suit la compatibilité mesurée", () => {
    // `murdock_head` : 17,9 % du poids apparié → ne se lie nulle part.
    expect(itemFromPart(getPart("murdock_head")!).rarity).toBe("legendary");
    // Pack de base : toujours commun.
    expect(itemFromPart(getPart("m_body")!).rarity).toBe("common");
  });

  it("porte la vignette rendue hors-ligne", () => {
    expect(itemFromPart(getPart("wraith_head")!).thumb).toContain("/thumbs/parts/");
  });
});

describe("catalogue d'objets", () => {
  it("un objet par pièce, sans doublon", () => {
    expect(MODULAR_ITEMS).toHaveLength(MODULAR_PARTS.length);
    expect(new Set(MODULAR_ITEMS.map((i) => i.id)).size).toBe(MODULAR_ITEMS.length);
  });

  it("chaque objet référence un emplacement de corps connu", () => {
    for (const i of MODULAR_ITEMS) {
      expect(i.bodySlot).toBeDefined();
      expect(SLOT_CATEGORY[i.bodySlot!], i.id).toBeDefined();
    }
  });

  it("aller-retour identifiant objet ↔ pièce", () => {
    const item = getModularItem(`${MODULAR_ITEM_PREFIX}echo_arms`);
    expect(item).toBeDefined();
    expect(isModularItem(item!.id)).toBe(true);
    expect(partIdOfItem(item!.id)).toBe("echo_arms");
    expect(getPart(partIdOfItem(item!.id)!)).toBeDefined();
  });

  it("ne revendique pas un objet de loot ordinaire", () => {
    expect(isModularItem("plasma_core")).toBe(false);
    expect(partIdOfItem("plasma_core")).toBeUndefined();
  });

  it("le regroupement par emplacement couvre tout le catalogue", () => {
    const parSlot = modularItemsBySlot();
    const total = [...parSlot.values()].reduce((n, l) => n + l.length, 0);
    expect(total).toBe(MODULAR_ITEMS.length);
    expect(parSlot.get("head")!.length).toBeGreaterThan(1);
  });
});
