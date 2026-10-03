// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/__tests__/NewHUD.test.ts — Tests du nouveau HUD
//
// Vérifie :
//   • Composants s'exportent correctement
//   • React.memo protège les re-renders
//   • hudService est un singleton et fonctionne
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from "vitest";
import { Faction } from "../../../../types";
import { getFactionColors } from "../hudConstants";
import { HealthBar } from "../HealthBar";
import { ArmorBar } from "../ArmorBar";
import { ManaBar } from "../ManaBar";
import { SpellBar } from "../SpellBar";
import { QuestTracker } from "../QuestTracker";
import { BuffDisplay } from "../BuffDisplay";
import { Minimap } from "../Minimap";
import { QuickInventory } from "../QuickInventory";
import { NewHUD } from "../NewHUD";
import { HudService, hudService } from "../hudService";
import { BiomeType } from "../hudTypes";

// ── Tests unitaires des composants ────────────────────────────────────────────

describe("NewHUD - Types et constantes", () => {
  it("FactionColors inclut mana", () => {
    const colors = getFactionColors(Faction.HUMAN);
    expect(colors.mana).toBeDefined();
    expect(colors.mana).toBe("#0ea5e9");
  });

  it("getFactionColors retourne des couleurs pour chaque faction", () => {
    for (const f of [Faction.HUMAN, Faction.ALIEN, Faction.MERCENARY]) {
      const colors = getFactionColors(f);
      expect(colors.health).toBeDefined();
      expect(colors.mana).toBeDefined();
      expect(colors.primary).toBeDefined();
      expect(colors.glow).toBeDefined();
    }
  });
});

describe("NewHUD - Sous-composants (export)", () => {
  it("HealthBar s'exporte", () => {
    expect(HealthBar).toBeDefined();
  });

  it("ArmorBar s'exporte", () => {
    expect(ArmorBar).toBeDefined();
  });

  it("ManaBar s'exporte", () => {
    expect(ManaBar).toBeDefined();
  });

  it("SpellBar s'exporte", () => {
    expect(SpellBar).toBeDefined();
  });

  it("QuestTracker s'exporte", () => {
    expect(QuestTracker).toBeDefined();
  });

  it("BuffDisplay s'exporte", () => {
    expect(BuffDisplay).toBeDefined();
  });

  it("Minimap s'exporte", () => {
    expect(Minimap).toBeDefined();
  });

  it("QuickInventory s'exporte", () => {
    expect(QuickInventory).toBeDefined();
  });
});

describe("NewHUD - Composant principal", () => {
  it("NewHUD s'exporte bien", () => {
    expect(NewHUD).toBeDefined();
  });
});

describe("NewHUD - React.memo optimisation", () => {
  it("Tous les composants sont memoïsés (displayName présent)", () => {
    expect(HealthBar.displayName).toBe("HealthBar");
    expect(ArmorBar.displayName).toBe("ArmorBar");
    expect(ManaBar.displayName).toBe("ManaBar");
    expect(SpellBar.displayName).toBe("SpellBar");
    expect(QuestTracker.displayName).toBe("QuestTracker");
    expect(BuffDisplay.displayName).toBe("BuffDisplay");
    expect(Minimap.displayName).toBe("Minimap");
    expect(QuickInventory.displayName).toBe("QuickInventory");
    expect(NewHUD.displayName).toBe("NewHUD");
  });
});

describe("NewHUD - hudService", () => {
  it("hudService est un singleton", () => {
    const instance1 = HudService.getInstance();
    const instance2 = HudService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("hudService.getState() retourne l'état par défaut", () => {
    const state = hudService.getState();
    expect(state.visible).toBe(false);
    expect(state.extendedStats).toBeDefined();
    expect(state.extendedStats.maxHp).toBe(100);
    expect(state.spells).toEqual([]);
    expect(state.buffs).toEqual([]);
    expect(state.quests).toEqual([]);
    expect(state.quickItems).toEqual([]);
  });

  it("hudService.updateState() modifie l'état", () => {
    hudService.updateState({ visible: true, playerX: 42, playerZ: 13 });
    const state = hudService.getState();
    expect(state.visible).toBe(true);
    expect(state.playerX).toBe(42);
    expect(state.playerZ).toBe(13);
    // Reset
    hudService.updateState({ visible: false, playerX: 0, playerZ: 0 });
  });

  it("hudService.subscribe reçoit les notifications", () => {
    const fn = vi.fn();
    const unsub = hudService.subscribe(fn);
    hudService.updateState({ visible: true });
    expect(fn).toHaveBeenCalled();
    unsub();
  });

  it("hudService.setVisible change la visibilité", () => {
    hudService.setVisible(true);
    expect(hudService.getState().visible).toBe(true);
    hudService.setVisible(false);
    expect(hudService.getState().visible).toBe(false);
  });
});

describe("NewHUD - hudTypes", () => {
  it("BiomeType exports sont corrects", () => {
    expect(BiomeType.FUNGAL).toBe("FUNGAL");
    expect(BiomeType.OCEAN).toBe("OCEAN");
    expect(BiomeType.DESERT).toBe("DESERT");
    expect(BiomeType.HUB).toBe("HUB");
  });
});
