// ══════════════════════════════════════════════════════════════════════════════
// runtime/spawnSystem.test.ts — Tests du système de spawn robuste
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resolveSpawn,
  resolveSpawnPosition,
  getSpawnConfig,
  SPAWN_CONFIGS,
  SPAWN_PROTECTION_DURATION,
  spawnProtectionEnd,
  isSpawnProtected,
  clampProtectionDuration,
} from "./spawnSystem";

// ── Mock performance.now() ──────────────────────────────────────────────────
// On fixe le temps à un timestamp constant pour que les tests soient
// déterministes.
const NOW = 1000000;

beforeEach(() => {
  vi.spyOn(performance, "now").mockReturnValue(NOW);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * GroundChecker factice qui retourne une hauteur de sol.
 * Par défaut : renvoie `fromY - 0.5` (= sol détecté normalement).
 * Passage de `null` → pas de sol (simule le vide / BVH pas chargé).
 */
function makeGroundY(fixedY: number | null = 100): (x: number, z: number, fromY: number) => number | null {
  return (_x: number, _z: number, _fromY: number) => fixedY;
}

// ── Tests des configs ───────────────────────────────────────────────────────

describe("SPAWN_CONFIGS — toutes les maps ont une config valide", () => {
  const MAP_IDS = ["forge", "orbital", "donjon_furiste", "tower"];

  for (const mapId of MAP_IDS) {
    it(`« ${mapId} » a un point par défaut`, () => {
      const cfg = SPAWN_CONFIGS[mapId];
      expect(cfg).toBeDefined();
      expect(cfg.default).toBeDefined();
      expect(cfg.default.position).toHaveLength(3);
      expect(typeof cfg.default.position[0]).toBe("number");
      expect(typeof cfg.default.position[1]).toBe("number");
      expect(typeof cfg.default.position[2]).toBe("number");
    });
  }

  it("forge a 2 alternatives", () => {
    expect(SPAWN_CONFIGS.forge.alternatives).toHaveLength(2);
  });

  it("orbital a 1 alternative", () => {
    expect(SPAWN_CONFIGS.orbital.alternatives).toHaveLength(1);
  });

  it("donjon_furiste a une protection réduite (3000 ms)", () => {
    expect(SPAWN_CONFIGS.donjon_furiste.antiSpawnKillDuration).toBe(3000);
  });

  it("forge a randomRadius=8", () => {
    expect(SPAWN_CONFIGS.forge.randomRadius).toBe(8);
  });
});

describe("getSpawnConfig — fallback pour map inconnue", () => {
  it("retourne une config par défaut pour une map inconnue", () => {
    const cfg = getSpawnConfig("map_inconnue");
    expect(cfg.default.position).toEqual([0, 5, 0]);
    expect(cfg.center).toEqual([0, 5, 0]);
    expect(cfg.randomRadius).toBe(5);
    expect(cfg.antiSpawnKillDuration).toBe(SPAWN_PROTECTION_DURATION);
  });
});

// ── resolveSpawn : point custom ─────────────────────────────────────────────

describe("resolveSpawn — point custom", () => {
  it("retourne le point custom si fourni et que getGroundY le valide", () => {
    const result = resolveSpawn("forge", makeGroundY(50), [10, 50, 20]);
    expect(result.method).toBe("custom");
    expect(result.position[0]).toBe(10);
    expect(result.position[1]).toBeCloseTo(50.5); // gy + 0.5
    expect(result.position[2]).toBe(20);
  });

  it("retourne le point custom même sans getGroundY", () => {
    const result = resolveSpawn("forge", null, [10, 50, 20]);
    expect(result.method).toBe("custom");
    expect(result.position).toEqual([10, 50, 20]);
  });

  it("si le sol n'est pas trouvé au point custom ni au défaut, passe aux alternatives", () => {
    // getGroundY retourne null partout → on descend la cascade jusqu'au fallback
    const result = resolveSpawn("forge", makeGroundY(null), [10, 50, 20]);
    // Forge a 2 alternatives, random 5 tentatives, puis fallback
    expect(["alternative", "random", "fallback"]).toContain(result.method);
  });

  it("custom null = ignoré", () => {
    const result = resolveSpawn("forge", makeGroundY(50), null);
    expect(result.method).toBe("default");
  });
});

// ── resolveSpawn : point par défaut ─────────────────────────────────────────

describe("resolveSpawn — point par défaut", () => {
  it("forge : spawn par défaut avec getGroundY", () => {
    const result = resolveSpawn("forge", makeGroundY(-27));
    expect(result.method).toBe("default");
    expect(result.label).toBe("Entrée centrale");
    expect(result.position[0]).toBe(0);
    // config Y = -26 > gy(-27)+0.5 = -26.5, donc on garde le Y de la config
    expect(result.position[1]).toBe(-26);
    expect(result.position[2]).toBe(10);
  });

  it("forge : spawn par défaut sans getGroundY (valeur statique)", () => {
    const result = resolveSpawn("forge", null);
    expect(result.method).toBe("default");
    expect(result.position).toEqual([0, -26, 10]);
  });

  it("donjon_furiste : spawn par défaut avec getGroundY", () => {
    const result = resolveSpawn("donjon_furiste", makeGroundY(6));
    expect(result.method).toBe("default");
    expect(result.position[0]).toBe(0);
    expect(result.position[1]).toBeCloseTo(6.5);
    expect(result.position[2]).toBe(34);
    // yaw = PI → regard vers l'arène
    expect(result.yaw).toBeCloseTo(Math.PI);
  });

  it("si le sol n'est pas trouvé au point défaut, passe aux alternatives", () => {
    // getGroundY null → défaut échoué, alternative marche
    const ground = vi
      .fn()
      .mockReturnValueOnce(null)  // default → échoue
      .mockReturnValueOnce(50);    // alternative → OK
    const result = resolveSpawn("orbital", ground, null);
    expect(result.method).toBe("alternative");
    expect(result.label).toBe("Quai secondaire");
  });
});

// ── resolveSpawn : alternatives ─────────────────────────────────────────────

describe("resolveSpawn — alternatives", () => {
  it("orbital : spawn alternatif si le défaut est bloqué", () => {
    // getGroundY null pour le défaut, valide pour l'alternative
    const ground = vi
      .fn()
      .mockReturnValueOnce(null)  // default → échoue
      .mockReturnValueOnce(50);   // alternative → OK
    const result = resolveSpawn("orbital", ground, null);
    expect(result.method).toBe("alternative");
    // alternative = Quai secondaire (1050, 50, 30)
    expect(result.position[0]).toBe(1050);
    expect(result.position[1]).toBeCloseTo(50.5);
    expect(result.position[2]).toBe(30);
  });

  it("forge : 2 alternatives, prend la première qui fonctionne", () => {
    const ground = vi
      .fn()
      .mockReturnValueOnce(null)  // default → échoue
      .mockReturnValueOnce(50)    // alternative 1 → OK, celle-ci est prise
      .mockReturnValueOnce(60);   // alternative 2 → jamais atteinte
    const result = resolveSpawn("forge", ground, null);
    expect(result.method).toBe("alternative");
    // alternative 1 = Côté EST (30, -26, 10)
    expect(result.position[0]).toBe(30);
  });
});

// ── resolveSpawn : aléatoire ────────────────────────────────────────────────

describe("resolveSpawn — spawn aléatoire", () => {
  it("quand défaut + alternatives sont bloqués, tente 5 aléatoires", () => {
    // getGroundY retourne null pour défaut et alternatives,
    // puis une valeur au 2e essai aléatoire
    let callCount = 0;
    const ground = vi.fn((_x: number, _z: number, _fromY: number) => {
      callCount++;
      // custom (1), defaut (2), alt1 (3), alt2 (4) → null
      // random attempt 1 (5) → null
      // random attempt 2 (6) → 50 (OK)
      if (callCount <= 5) return null;
      return 50;
    });
    const result = resolveSpawn("forge", ground, null);
    expect(result.method).toBe("random");
    // La position est aléatoire donc on ne teste pas les valeurs exactes,
    // mais on vérifie que yaw est bien celui du défaut
    expect(result.yaw).toBe(0);
  });

  it("sans getGroundY, retourne le point par défaut (pas de validation)", () => {
    const result = resolveSpawn("forge", null, null);
    expect(result.method).toBe("default");
    expect(result.position).toEqual([0, -26, 10]);
  });

  it("si tous les aléatoires échouent, tombe au fallback centre", () => {
    // getGroundY toujours null
    const ground = vi.fn().mockReturnValue(null);
    const result = resolveSpawn("tower", ground, null);
    expect(result.method).toBe("fallback");
  });
});

// ── resolveSpawn : fallback ─────────────────────────────────────────────────

describe("resolveSpawn — fallback centre", () => {
  it("quand tout échoue, utilise le centre de la map", () => {
    const ground = vi.fn().mockReturnValue(null);
    const result = resolveSpawn("tower", ground, null);
    expect(result.method).toBe("fallback");
    expect(result.position[0]).toBe(0);
    expect(result.position[2]).toBe(0);
    expect(result.yaw).toBe(0);
  });

  it("fallback ultime pour map inconnue", () => {
    const ground = vi.fn().mockReturnValue(null);
    const result = resolveSpawn("__bidon__", ground, null);
    expect(result.method).toBe("fallback");
    expect(result.position).toEqual([0, 5, 0]);
  });

  it("fallback avec centre alternatif si défini", () => {
    // On crée une config qui définit un centre non nul
    const ground = vi.fn().mockReturnValue(null);
    const result = resolveSpawn("orbital", ground, null);
    expect(result.method).toBe("fallback");
    expect(result.position[0]).toBe(1000);
  });
});

// ── resolveSpawnPosition (backward compat) ──────────────────────────────────

describe("resolveSpawnPosition — retourne [x, y, z]", () => {
  it("retourne un tuple de 3 nombres", () => {
    const pos = resolveSpawnPosition("forge", makeGroundY(-27));
    expect(pos).toHaveLength(3);
    expect(typeof pos[0]).toBe("number");
    expect(typeof pos[1]).toBe("number");
    expect(typeof pos[2]).toBe("number");
  });

  it("s'appuie sur resolveSpawn", () => {
    const pos = resolveSpawnPosition("tower", null);
    expect(pos[0]).toBe(0);
    expect(pos[2]).toBe(10);
  });
});

// ── Protection anti-spawn-kill ──────────────────────────────────────────────

describe("spawnProtectionEnd / isSpawnProtected", () => {
  it("spawnProtectionEnd utilise la durée par défaut", () => {
    const end = spawnProtectionEnd();
    expect(end).toBe(NOW + SPAWN_PROTECTION_DURATION);
  });

  it("spawnProtectionEnd accepte une durée custom", () => {
    const end = spawnProtectionEnd(3000);
    expect(end).toBe(NOW + 3000);
  });

  it("clampProtectionDuration : min 1000, max 30000", () => {
    expect(clampProtectionDuration(0)).toBe(1000);
    expect(clampProtectionDuration(500)).toBe(1000);
    expect(clampProtectionDuration(50000)).toBe(30000);
    expect(clampProtectionDuration(5000)).toBe(5000);
  });

  it("isSpawnProtected : retourne true si le timestamp est dans le futur", () => {
    const future = NOW + 1000;
    expect(isSpawnProtected(future)).toBe(true);
  });

  it("isSpawnProtected : retourne false si le timestamp est passé", () => {
    const past = NOW - 1;
    expect(isSpawnProtected(past)).toBe(false);
  });

  it("isSpawnProtected : retourne false si timestamp = 0 (jamais protégé)", () => {
    expect(isSpawnProtected(0)).toBe(false);
  });
});
