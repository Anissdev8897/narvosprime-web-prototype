import { describe, it, expect } from "vitest";
import {
  EMOTE_CATALOG,
  EMOTE_MAP,
  EMOTE_CATEGORIES,
  emotesByCategory,
  type EmoteCategory,
} from "./emoteRegistry";

describe("EMOTE_CATALOG", () => {
  it("contient au moins 20 émotes", () => {
    expect(EMOTE_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it("chaque émote a un id unique", () => {
    const ids = EMOTE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque émote a un glbPath valide (terminé par .glb)", () => {
    for (const e of EMOTE_CATALOG) {
      expect(e.glbPath).toMatch(/\.glb$/);
    }
  });

  it("chaque émote a un label non-vide et une icône", () => {
    for (const e of EMOTE_CATALOG) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.icon.length).toBeGreaterThan(0);
    }
  });

  it("aucune animation de gameplay dans le catalogue", () => {
    const gameplayKeywords = [
      "idle", "walk", "run", "sprint", "jump", "crouch", "attack",
      "cast", "death", "hit", "dodge", "swim", "climb", "aim", "reload",
    ];
    for (const e of EMOTE_CATALOG) {
      const lower = e.id.toLowerCase();
      for (const kw of gameplayKeywords) {
        expect(lower).not.toBe(kw);
      }
    }
  });
});

describe("EMOTE_MAP", () => {
  it("contient autant d'entrées que le catalogue", () => {
    expect(EMOTE_MAP.size).toBe(EMOTE_CATALOG.length);
  });

  it("retrouve une émote par id", () => {
    const first = EMOTE_CATALOG[0];
    expect(EMOTE_MAP.get(first.id)).toBe(first);
  });
});

describe("EMOTE_CATEGORIES", () => {
  it("couvre toutes les catégories présentes dans le catalogue", () => {
    const catsInCatalog = new Set(EMOTE_CATALOG.map((e) => e.category));
    const catsInList = new Set(EMOTE_CATEGORIES.map((c) => c.key));
    for (const c of catsInCatalog) {
      expect(catsInList.has(c)).toBe(true);
    }
  });
});

describe("emotesByCategory", () => {
  it("filtre correctement par catégorie", () => {
    const social = emotesByCategory("social");
    expect(social.length).toBeGreaterThan(0);
    for (const e of social) {
      expect(e.category).toBe("social");
    }
  });

  it("retourne un tableau vide pour une catégorie sans émotes", () => {
    const result = emotesByCategory("nonexistent" as EmoteCategory);
    expect(result).toEqual([]);
  });
});
