// ══════════════════════════════════════════════════════════════════════════════
// tests pour items/ItemDefinition.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { RARITY_COLORS, RARITY_LABELS, EQUIP_SLOT_LABELS, ITEM_TYPE_LABELS } from "../ItemDefinition";

describe("ItemDefinition - constantes", () => {
  it("RARITY_COLORS couvre toutes les raretés", () => {
    expect(RARITY_COLORS.common).toBe("#aaaaaa");
    expect(RARITY_COLORS.rare).toBe("#4a9eff");
    expect(RARITY_COLORS.epic).toBe("#a855f7");
    expect(RARITY_COLORS.legendary).toBe("#f59e0b");
    expect(RARITY_COLORS.mythic).toBe("#ef4444");
    expect(RARITY_COLORS.alien).toBe("#22c55e");
    expect(RARITY_COLORS.divine).toBe("#ff00ff");
  });

  it("RARITY_LABELS couvre toutes les raretés", () => {
    expect(RARITY_LABELS.common).toBe("Commun");
    expect(RARITY_LABELS.legendary).toBe("Légendaire");
  });

  it("EQUIP_SLOT_LABELS couvre les 6 slots", () => {
    expect(Object.keys(EQUIP_SLOT_LABELS)).toHaveLength(6);
    expect(EQUIP_SLOT_LABELS.helmet).toBe("Casque");
    expect(EQUIP_SLOT_LABELS.accessory).toBe("Accessoire");
  });
});
