// ── Test 3: isFallen / markFallen / fallenIds ──────────────────────────────────
//
// `hardcoreLadder` exporte `fallenIds()` comme API publique pour lister les
// personnages tombés sans lire localStorage directement. Les tests vérifient
// que `markFallen`, `isFallen`, et `fallenIds` fonctionnent correctement.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";

// ═════════════════════════════════════════════════════════════════════════════
// MOCK localStorage (environnement Node → pas de localStorage natif)
// Même pattern que questStore.test.ts
// ═════════════════════════════════════════════════════════════════════════════

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
});

// ═════════════════════════════════════════════════════════════════════════════
// MOCK dbStore — `saveWorldDb` est appelé par markFallen, on ne veut pas
// que ça touche la base en test.
// ═════════════════════════════════════════════════════════════════════════════

vi.mock("../persistence/dbStore", () => ({
  saveWorldDb: vi.fn(),
}));

// ═════════════════════════════════════════════════════════════════════════════

// `fallenIds` devrait être exporté — s'il ne l'est pas, cette ligne provoque
// une erreur à l'import (et donc un échec du test).
import { markFallen, isFallen, fallenIds } from "./hardcoreLadder";

beforeEach(() => {
  storage.clear();
});

describe("hardcoreLadder — fallen characters", () => {
  it("markFallen then isFallen returns true for that character", () => {
    markFallen("char-hero-1");

    expect(isFallen("char-hero-1")).toBe(true);
    expect(isFallen("char-survivor")).toBe(false);
  });

  it("markFallen is idempotent (no duplicates)", () => {
    markFallen("char-hero-2");
    markFallen("char-hero-2");
    markFallen("char-hero-2");

    expect(isFallen("char-hero-2")).toBe(true);

    // Vérifie qu'il n'y a pas de doublons dans localStorage
    const raw = storage.get("narvos:hardcore_fallen");
    const list: string[] = raw ? JSON.parse(raw) : [];
    const matches = list.filter((id: string) => id === "char-hero-2");
    expect(matches).toHaveLength(1);
  });

  it("isFallen returns false for never-marked characters", () => {
    expect(isFallen("unknown-char")).toBe(false);
  });

  // ── Test : fallenIds() liste tous les persos marqués ────────────────────────

  it("fallenIds() returns all fallen character IDs", () => {
    // ═══════════════════════════════════════════════════════════════════════
    //  `fallenIds()` est exporté par hardcoreLadder.ts. Il retourne tous les
    //  IDs marqués par `markFallen` et n'expose pas les IDs non marqués.
    //  Les consommateurs (écran de sélection de personnage, UI du ladder)
    //  peuvent l'utiliser sans accéder à la clé localStorage directement.
    // ═══════════════════════════════════════════════════════════════════════

    markFallen("char-aaa");
    markFallen("char-bbb");
    markFallen("char-ccc");

    const ids = fallenIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toContain("char-aaa");
    expect(ids).toContain("char-bbb");
    expect(ids).toContain("char-ccc");
    expect(ids).not.toContain("char-survivor");
  });

  it("fallenIds() returns empty array when no deaths recorded", () => {
    const ids = fallenIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toHaveLength(0);
  });
});
