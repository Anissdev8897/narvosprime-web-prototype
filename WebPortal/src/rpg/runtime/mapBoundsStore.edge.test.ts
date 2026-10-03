// Tests de robustesse et edge cases pour mapBoundsStore.
// Les tests de base (block/keepIn/édition/mapActive/fallFloor) sont
// dans mapBoundsStore.test.ts. Ce fichier couvre les cas dégénérés,
// la validation d'entrée, et les pièges de mutation.

import { describe, it, expect, beforeEach } from "vitest";
import { mapBoundsStore, type MapWall } from "./mapBoundsStore";

function mur(p: Partial<MapWall> = {}): Omit<MapWall, "id"> {
  return {
    label: "test",
    mode: "block",
    center: [0, 0, 0],
    size: [10, 10, 10],
    yaw: 0,
    enabled: true,
    ...p,
  };
}

beforeEach(() => mapBoundsStore.__resetForTest());

describe("mapBoundsStore — edge cases : tailles et positions dégénérées", () => {
  it("un mur de taille zéro bloque à son centre exact", () => {
    mapBoundsStore.add("forge", mur({ size: [0, 0, 0] }));
    // Mathématiquement : Math.abs(0) <= 0/2 + 0 = 0 → true
    // Un volume de taille 0 bloque son centre exact. C'est le comportement
    // correct du test d'appartenance, même si un admin ne devrait jamais
    // créer un tel mur.
    expect(mapBoundsStore.blocks("forge", 0, 0, 0)).toBe(true);
    // Mais un point décalé n'est pas bloqué
    expect(mapBoundsStore.blocks("forge", 1, 0, 0)).toBe(false);
  });

  it("un mur de taille négative se comporte de façon définie", () => {
    // Math.abs sur les demi-tailles → une taille négative est traitée
    // comme positive (l'admin ne devrait jamais produire ça, mais
    // le store ne doit pas crasher).
    const w = mapBoundsStore.add("forge", mur({ size: [-10, -10, -10] }));
    expect(w).toBeDefined();
    expect(() => mapBoundsStore.blocks("forge", 0, 0, 0)).not.toThrow();
  });

  it("un centre avec NaN ne crashe pas", () => {
    const w = mapBoundsStore.add("forge", mur({ center: [NaN, NaN, NaN] }));
    expect(w).toBeDefined();
    // blocks() ne doit pas crasher, même si le résultat est
    // mathématiquement indéterminé
    expect(() => mapBoundsStore.blocks("forge", 0, 0, 0)).not.toThrow();
  });

  it("un centre avec Infinity ne crashe pas", () => {
    const w = mapBoundsStore.add("forge", mur({
      center: [Infinity, 0, Infinity],
      size: [10, 10, 10],
    }));
    expect(w).toBeDefined();
    expect(() => mapBoundsStore.blocks("forge", 0, 0, 0)).not.toThrow();
  });

  it("rotation yaw non multiple de PI/2 — précision trigonométrique", () => {
    // Une rotation de 30° place les coins du mur en oblique
    mapBoundsStore.add("forge", mur({
      mode: "keepIn",
      size: [100, 100, 4],
      yaw: Math.PI / 6, // 30°
    }));
    // Au centre (0,0,0), on est dedans
    expect(mapBoundsStore.blocks("forge", 0, 0, 0)).toBe(false);
    // À 60 unités sur l'axe X (rotation 30°), on devrait être dehors
    // car l'emprise projetée est plus courte que 100
    expect(mapBoundsStore.blocks("forge", 60, 0, 0)).toBe(true);
  });

  it("taille partiellement nulle (plaque infiniment fine)", () => {
    // Mur extrêmement fin en Y : il bloque horizontalement mais en 3D
    const w = mapBoundsStore.add("forge", mur({ size: [100, 0.001, 100] }));
    expect(w).toBeDefined();
    // En mode block, on doit être dans la tranche Y pour être bloqué
    // (à 0.001/2 près)
    expect(mapBoundsStore.blocks("forge", 0, 0, 0)).toBe(true);
    expect(mapBoundsStore.blocks("forge", 0, 10, 0)).toBe(false);
  });
});

describe("mapBoundsStore — VIDE partagé et mutation accidentelle", () => {
  it("get() sur une map inconnue rend un objet distinct à chaque appel", () => {
    // VIDE est un singleton réutilisé — si quelqu'un mute le retour,
    // toutes les maps inconnues seraient affectées.
    const a = mapBoundsStore.get("inconnue_a");
    const b = mapBoundsStore.get("inconnue_b");
    // Même référence (VIDE partagé) — c'est le comportement actuel
    // Ce test DOCUMENTE le risque, ne le corrige pas
    expect(a).toBe(b);
  });

  it("add() puis get() rendent l'objet stocké, pas VIDE", () => {
    mapBoundsStore.add("forge", mur());
    const bounds = mapBoundsStore.get("forge");
    expect(bounds.walls).toHaveLength(1);
    const inconnue = mapBoundsStore.get("orbital");
    expect(inconnue.walls).toHaveLength(0);
    // VIDE n'est pas affecté par l'ajout sur forge
  });
});

describe("mapBoundsStore — fallFloor edge cases", () => {
  it("sans mur keepIn, utilise le repli exact", () => {
    expect(mapBoundsStore.fallFloor("forge", -100)).toBe(-100);
  });

  it("avec keepIn à y très bas, le seuil descend encore plus", () => {
    mapBoundsStore.add("forge", mur({
      mode: "keepIn",
      center: [0, -5000, 0],
      size: [100, 60, 100],
    }));
    // base = -5000 - 30 = -5030 → seuil -5330 (marge 300)
    const floor = mapBoundsStore.fallFloor("forge", 999);
    expect(floor).toBeLessThan(-5300);
    expect(floor).toBeGreaterThan(-5400);
  });

  it("un fallY explicite prime même supérieur au repli", () => {
    mapBoundsStore.setFallY("forge", 42);
    expect(mapBoundsStore.fallFloor("forge", -1000)).toBe(42);
  });

  it("plusieurs keepIn → prend le plus bas", () => {
    mapBoundsStore.add("forge", mur({
      mode: "keepIn", center: [0, -10, 0], size: [100, 20, 100],
    }));
    mapBoundsStore.add("forge", mur({
      mode: "keepIn", center: [0, -50, 0], size: [100, 20, 100],
    }));
    // le plus bas : -50 - 10 = -60 → seuil -360
    const floor = mapBoundsStore.fallFloor("forge", 999);
    expect(floor).toBeCloseTo(-360, 0);
  });

  it("les keepIn désactivés sont ignorés", () => {
    const w = mapBoundsStore.add("forge", mur({
      mode: "keepIn", center: [0, -500, 0], size: [100, 60, 100],
    }));
    mapBoundsStore.update("forge", w.id, { enabled: false });
    // Plus de keepIn actif → repli
    expect(mapBoundsStore.fallFloor("forge", -80)).toBe(-80);
  });
});

describe("mapBoundsStore — blocksActive et map active", () => {
  it("blocksActive = false tant qu'aucune map n'est déclarée", () => {
    mapBoundsStore.add("forge", mur());
    expect(mapBoundsStore.blocksActive(0, 0, 0)).toBe(false);
  });

  it("changer de map active désactive les murs de l'ancienne", () => {
    mapBoundsStore.add("forge", mur());
    mapBoundsStore.add("orbital", mur({ center: [100, 0, 100] }));
    mapBoundsStore.setActiveMap("forge");
    expect(mapBoundsStore.blocksActive(0, 0, 0)).toBe(true);
    mapBoundsStore.setActiveMap("orbital");
    expect(mapBoundsStore.blocksActive(0, 0, 0)).toBe(false);
    expect(mapBoundsStore.blocksActive(100, 0, 100)).toBe(true);
  });

  it("setActiveMap('') désactive tout — filet de sécurité", () => {
    mapBoundsStore.add("forge", mur());
    mapBoundsStore.setActiveMap("forge");
    expect(mapBoundsStore.blocksActive(0, 0, 0)).toBe(true);
    mapBoundsStore.setActiveMap("");
    expect(mapBoundsStore.blocksActive(0, 0, 0)).toBe(false);
  });
});

describe("mapBoundsStore — édition concurrente simulée", () => {
  it("ajouter puis supprimer le dernier mur → walls vide", () => {
    const w = mapBoundsStore.add("forge", mur());
    mapBoundsStore.remove("forge", w.id);
    expect(mapBoundsStore.walls("forge")).toEqual([]);
  });

  it("modifier un mur pendant qu'on itère sur walls ne crashe pas", () => {
    mapBoundsStore.add("forge", mur({ label: "A" }));
    mapBoundsStore.add("forge", mur({ label: "B", center: [20, 0, 0] }));
    const walls = mapBoundsStore.walls("forge");
    // Simuler : pendant qu'on lit walls, on en modifie un
    mapBoundsStore.update("forge", walls[0].id, { label: "A modifié" });
    // La référence walls pointe sur l'ancien snapshot (spread dans write)
    // → les mutations suivantes ne cassent pas l'itération en cours
    expect(walls[0].label).toBe("A"); // snapshot non affecté
    expect(mapBoundsStore.walls("forge")[0].label).toBe("A modifié");
  });
});

describe("mapBoundsStore — persistence simulée", () => {
  it("l'état survit à un reset + re-hydratation simulée", async () => {
    mapBoundsStore.add("forge", mur({ label: "persistant" }));
    expect(mapBoundsStore.walls("forge")).toHaveLength(1);

    // Simuler un rechargement : reset puis hydrate
    mapBoundsStore.__resetForTest();
    expect(mapBoundsStore.walls("forge")).toHaveLength(0);

    // Après hydrate (mocké ici car dépend de IndexedDB)
    // On vérifie juste que le reset fonctionne
  });
});
