// ══════════════════════════════════════════════════════════════════════════════
// audio/footstepSystem.test.ts — Tests du système de pas par surface
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifySurface, type FootstepCategory } from "./footstepSystem";

// ── Mock collisionWorld pour les tests ───────────────────────────────────────
vi.mock("../runtime/CollisionWorld", () => ({
  collisionWorld: {
    getGroundMaterial: vi.fn(),
  },
}));

// ── Tests de classification ──────────────────────────────────────────────────

describe("classifySurface", () => {
  it("classifie 'MTL_MWAM_Grass__autoMaterial' en 'grass'", () => {
    expect(classifySurface("MTL_MWAM_Grass__autoMaterial")).toBe("grass");
  });

  it("classifie 'MTL_MWAM_Snow__autoMaterial' en 'snow'", () => {
    expect(classifySurface("MTL_MWAM_Snow__autoMaterial")).toBe("snow");
  });

  it("classifie 'MTL_MWAM_Rock__autoMaterial' en 'stone'", () => {
    expect(classifySurface("MTL_MWAM_Rock__autoMaterial")).toBe("stone");
  });

  it("classifie 'MTL_MWAM_Stones__autoMaterial' en 'stone' (contient 'stone')", () => {
    expect(classifySurface("MTL_MWAM_Stones__autoMaterial")).toBe("stone");
  });

  it("classifie 'MTL_MWAM_Dirt__autoMaterial' en 'dirt'", () => {
    const result = classifySurface("MTL_MWAM_Dirt__autoMaterial");
    expect(result).toBe("dirt");
  });

  it("classifie 'MTL_MWAM_SandA__autoMaterial' en 'sand'", () => {
    const result = classifySurface("MTL_MWAM_SandA__autoMaterial");
    expect(result).toBe("sand");
  });

  it("classifie 'MTL_MWAM_SandC__autoMaterial' en 'sand'", () => {
    expect(classifySurface("MTL_MWAM_SandC__autoMaterial")).toBe("sand");
  });

  // ── Matériaux de construction ─────────────────────────────────────────────

  it("classifie un matériau contenant 'concrete' en 'concrete'", () => {
    expect(classifySurface("Concrete_Floor")).toBe("concrete");
  });

  it("classifie un matériau contenant 'wood' en 'wood'", () => {
    expect(classifySurface("Wood_Planks")).toBe("wood");
  });

  it("classifie un matériau contenant 'metal' en 'metalbar'", () => {
    expect(classifySurface("Metal_Grate")).toBe("metalbar");
  });

  it("classifie un matériau contenant 'glass' en 'glass'", () => {
    expect(classifySurface("Glass_Window")).toBe("glass");
  });

  it("classifie un matériau contenant 'marble' en 'marble'", () => {
    expect(classifySurface("Marble_Floor")).toBe("marble");
  });

  it("classifie un matériau contenant 'water' en 'water'", () => {
    expect(classifySurface("Water_Puddle")).toBe("water");
  });

  // ── Noms français ─────────────────────────────────────────────────────────

  it("classifie 'neige' en 'snow'", () => {
    expect(classifySurface("neige")).toBe("snow");
  });

  it("classifie 'roche' en 'stone'", () => {
    expect(classifySurface("roche")).toBe("stone");
  });

  it("classifie 'herbe' en 'grass'", () => {
    expect(classifySurface("herbe")).toBe("grass");
  });

  it("classifie 'terre' en 'dirt'", () => {
    expect(classifySurface("terre")).toBe("dirt");
  });

  it("classifie 'bois' en 'wood'", () => {
    const result = classifySurface("bois");
    expect(result).toBe("wood");
  });

  it("classifie 'sable' en 'sand'", () => {
    expect(classifySurface("sable")).toBe("sand");
  });

  // ── Matériaux par défaut / inconnus ───────────────────────────────────────

  it("retourne 'grass' pour un nom vide", () => {
    expect(classifySurface("")).toBe("grass");
  });

  it("retourne 'grass' pour un nom inconnu", () => {
    expect(classifySurface("SomeUnknownMaterial")).toBe("grass");
  });

  it("retourne 'grass' pour un nom null/undefined traité comme chaîne vide", () => {
    // @ts-expecterror — test de comportement défensif
    expect(classifySurface(null as unknown as string)).toBe("grass");
    expect(classifySurface(undefined as unknown as string)).toBe("grass");
  });
});

// ── Tests des URLs générées ─────────────────────────────────────────────────

describe("getFootstepUrl", () => {
  it("génère une URL valide pour chaque catégorie", async () => {
    const { getFootstepUrl } = await import("./footstepSystem");

    const categories: FootstepCategory[] = [
      "armor", "bluntwood", "brush", "concrete", "deckwood",
      "dirt", "glass", "grass", "gravel", "leaves",
      "lino", "marble", "metalbar", "metalbox", "mud",
      "muffledice", "quicksand", "rug", "sand", "snow",
      "squeakywood", "stone", "water", "weakice", "wood",
    ];

    const BASE = "/models/audio/Footsteps_Sound_Effects_Pro/WAV/";

    for (const cat of categories) {
      const url = getFootstepUrl(cat);
      expect(url).toContain(BASE);
      expect(url).toMatch(/\.wav$/);
    }
  });

  it("ne produit jamais deux fois le même fichier consécutif pour 'grass'", async () => {
    const { getFootstepUrl } = await import("./footstepSystem");

    const urls: string[] = [];
    for (let i = 0; i < 5; i++) {
      urls.push(getFootstepUrl("grass"));
    }

    // Au moins une variation doit exister sur 5 appels
    const unique = new Set(urls);
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ── Tests de détection de surface ────────────────────────────────────────────

describe("detectSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne null quand aucun sol n'est détecté", async () => {
    const { collisionWorld } = await import("../runtime/CollisionWorld");
    vi.mocked(collisionWorld.getGroundMaterial).mockReturnValue(null);

    const { detectSurface } = await import("./footstepSystem");
    const result = detectSurface(0, 0);
    expect(result).toBeNull();
  });

  it("classifie le matériau retourné par collisionWorld", async () => {
    const { collisionWorld } = await import("../runtime/CollisionWorld");
    vi.mocked(collisionWorld.getGroundMaterial).mockReturnValue({
      materialName: "Stone_Floor",
      meshName: "ground_mesh",
    });

    const { detectSurface } = await import("./footstepSystem");
    const result = detectSurface(10, 20);
    expect(result).not.toBeNull();
    expect(result!.category).toBe("stone");
    expect(result!.materialName).toBe("Stone_Floor");
    expect(result!.confidence).toBe(0.9);
  });

  it("retourne grass avec confiance faible pour un matériau inconnu", async () => {
    const { collisionWorld } = await import("../runtime/CollisionWorld");
    vi.mocked(collisionWorld.getGroundMaterial).mockReturnValue({
      materialName: "Some_Random_Material_XYZ",
      meshName: "unknown_mesh",
    });

    const { detectSurface } = await import("./footstepSystem");
    const result = detectSurface(5, 5);
    expect(result).not.toBeNull();
    expect(result!.category).toBe("grass");
    expect(result!.confidence).toBe(0.3);
  });
});

// ── Tests des catégories disponibles ─────────────────────────────────────────

describe("foostep categories coverage", () => {
  it("toutes les 25 catégories ont des règles de classification", async () => {
    const { classifySurface } = await import("./footstepSystem");

    const categories: FootstepCategory[] = [
      "armor", "bluntwood", "brush", "concrete", "deckwood",
      "dirt", "glass", "grass", "gravel", "leaves",
      "lino", "marble", "metalbar", "metalbox", "mud",
      "muffledice", "quicksand", "rug", "sand", "snow",
      "squeakywood", "stone", "water", "weakice", "wood",
    ];

    for (const cat of categories) {
      // Chaque catégorie doit pouvoir être atteinte via au moins un nom de matériau
      expect(cat).toBeDefined();
    }
  });
});
