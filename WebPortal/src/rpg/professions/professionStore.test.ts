import { describe, it, expect, beforeEach } from "vitest";
import { professionStore, STAMINA_MAX } from "./professionStore";
import { xpForLevel, totalXpForLevel, MAX_PROFESSION_LEVEL } from "./professionTypes";
import { RECIPES } from "./professionCatalog";

describe("xp curve", () => {
  it("croît avec le niveau et est finie sous le cap", () => {
    expect(xpForLevel(1)).toBe(50);
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(49)).toBeGreaterThan(xpForLevel(10));
    expect(Number.isFinite(xpForLevel(49))).toBe(true);
  });
  it("est infinie au niveau max (plus de progression)", () => {
    expect(xpForLevel(MAX_PROFESSION_LEVEL)).toBe(Infinity);
  });
  it("totalXpForLevel cumule les paliers", () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(3)).toBe(xpForLevel(1) + xpForLevel(2));
  });
});

describe("professionStore", () => {
  beforeEach(() => professionStore.setCharacter("")); // reset (pas de persist sans charId)

  it("démarre niveau 1, xp 0, endurance pleine", () => {
    expect(professionStore.level("bucheron")).toBe(1);
    expect(professionStore.xp("bucheron")).toBe(0);
    expect(professionStore.stamina()).toBe(STAMINA_MAX);
  });

  it("addXp fait monter d'un niveau au seuil exact", () => {
    const gained = professionStore.addXp("bucheron", xpForLevel(1));
    expect(gained).toBe(1);
    expect(professionStore.level("bucheron")).toBe(2);
    expect(professionStore.xp("bucheron")).toBe(0);
  });

  it("addXp gère plusieurs niveaux en cascade", () => {
    professionStore.setCharacter("");
    const big = xpForLevel(1) + xpForLevel(2) + 5;
    const gained = professionStore.addXp("mineur", big);
    expect(gained).toBe(2);
    expect(professionStore.level("mineur")).toBe(3);
    expect(professionStore.xp("mineur")).toBe(5);
  });

  it("endurance : dépense bloquée si insuffisante, régén plafonnée", () => {
    expect(professionStore.spendStamina(30)).toBe(true);
    expect(professionStore.stamina()).toBe(STAMINA_MAX - 30);
    expect(professionStore.spendStamina(9999)).toBe(false);
    professionStore.regen(1000); // gros dt
    expect(professionStore.stamina()).toBe(STAMINA_MAX);
  });
});

describe("artisanat (craft)", () => {
  const DAGUE = RECIPES.find((r) => r.id === "f_dague_fer")!;   // 2 fer + 1 bois_use → 1 dague_fer, baseXp 14, niv 1
  const EPEE  = RECIPES.find((r) => r.id === "f_epee_acier")!;  // minLevel 10
  beforeEach(() => professionStore.setCharacter(""));

  it("échoue sans ressources (rien consommé)", () => {
    expect(professionStore.craft(DAGUE).ok).toBe(false);
    expect(professionStore.resource("fer")).toBe(0);
  });

  it("consomme les ingrédients, retourne la sortie, octroie l'XP", () => {
    professionStore.addResource("fer", 5);
    professionStore.addResource("bois_use", 3);
    const res = professionStore.craft(DAGUE);
    expect(res.ok).toBe(true);
    expect(professionStore.resource("fer")).toBe(3);
    expect(professionStore.resource("bois_use")).toBe(2);
    expect(res.output).toEqual({ itemId: "dague_fer", qty: 1 }); // va dans l'inventaire, pas le sac
    expect(professionStore.resource("dague_fer")).toBe(0);
    expect(professionStore.xp("forgeron")).toBe(14);
  });

  it("échoue si niveau insuffisant (rien consommé)", () => {
    professionStore.addResource("acier", 10);
    professionStore.addResource("chene_solide", 10);
    expect(professionStore.craft(EPEE).ok).toBe(false);
    expect(professionStore.resource("acier")).toBe(10);
  });

  it("qualité exceptionnelle : bonus de quantité + multiplicateur d'XP", () => {
    professionStore.addResource("fer", 2);
    professionStore.addResource("bois_use", 1);
    const res = professionStore.craft(DAGUE, 1, 1.6);
    expect(res.ok).toBe(true);
    expect(res.output).toEqual({ itemId: "dague_fer", qty: 2 });    // 1 + bonus 1
    expect(professionStore.xp("forgeron")).toBe(Math.round(14 * 1.6)); // 22
  });
});
