import { describe, it, expect, beforeEach } from "vitest";
import { expeditionLedger } from "./expeditionLedger";
import type { LootItem } from "../loot/LootRegistry";

function item(id: string): LootItem {
  return { id, label: id, rarity: "common", value: 1, statBonus: {}, icon: "x" };
}

describe("expeditionLedger", () => {
  beforeEach(() => expeditionLedger.reset());

  it("sans snapshot (jamais passé au hub) → aucune perte", () => {
    const loss = expeditionLedger.computeLoss([item("a")], 500);
    expect(loss.lostCount).toBe(0);
    expect(loss.lostCredits).toBe(0);
  });

  it("perd uniquement le DIFF acquis depuis le hub (items + crédits)", () => {
    expeditionLedger.secure([item("potion"), item("potion")], 200); // 2 potions sécurisées
    const cur = [item("potion"), item("potion"), item("potion"), item("epee")]; // +1 potion +1 épée
    const loss = expeditionLedger.computeLoss(cur, 350);
    expect(loss.lostCount).toBe(2);                 // la 3e potion + l'épée
    expect(loss.lostItemIndices).toEqual([2, 3]);   // les exemplaires AU-DELÀ du sécurisé
    expect(loss.lostCredits).toBe(150);             // 350 - 200
  });

  it("plancher : dépenser/perdre sous le snapshot ne crée pas de dette", () => {
    expeditionLedger.secure([item("a")], 500);
    const loss = expeditionLedger.computeLoss([], 100); // a vendu/dépensé en expédition
    expect(loss.lostCount).toBe(0);
    expect(loss.lostCredits).toBe(0);
  });

  it("unsecured reflète le diff courant (pastille HUD)", () => {
    expeditionLedger.secure([item("a")], 100);
    const u = expeditionLedger.unsecured([item("a"), item("b")], 160);
    expect(u).toEqual({ items: 1, credits: 60 });
  });
});
