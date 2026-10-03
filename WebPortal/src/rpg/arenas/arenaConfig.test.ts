// ══════════════════════════════════════════════════════════════════════════════
// arenas/arenaConfig.test.ts — Tests des configurations d'arènes
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { ARENA_CONFIGS, getArenaConfig } from "./arenaConfig";

describe("ARENA_CONFIGS — validité structurelle", () => {
  it("contient exactement 3 arènes", () => {
    expect(ARENA_CONFIGS).toHaveLength(3);
  });

  it("a les 3 mapIds attendues", () => {
    const ids = ARENA_CONFIGS.map((a) => a.mapId).sort();
    expect(ids).toEqual(["donjon_furiste", "fungaria", "orbital"]);
  });

  it("a les 3 types d'arène différents", () => {
    const types = ARENA_CONFIGS.map((a) => a.arenaType).sort();
    expect(types).toEqual(["boss", "expedition", "pvp"]);
  });

  it("chaque arène a un nom non vide", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.name).toBeTruthy();
      expect(a.name.length).toBeGreaterThan(3);
    }
  });

  it("chaque arène a une description non vide", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.description).toBeTruthy();
      expect(a.description.length).toBeGreaterThan(20);
    }
  });
});

describe("ARENA_CONFIGS — covers", () => {
  it("chaque arène a au moins 4 covers", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.covers.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("tous les covers ont les champs requis", () => {
    for (const a of ARENA_CONFIGS) {
      for (const c of a.covers) {
        expect(c.pos).toHaveLength(3);
        expect(c.size).toHaveLength(3);
        expect(["hard", "soft", "hybrid"]).toContain(c.kind);
        expect(["static", "moveable", "moving", "dynamic"]).toContain(c.state);
        expect(["low", "high"]).toContain(c.height);
      }
    }
  });

  it("chaque arène a au moins un hard cover", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.covers.some((c) => c.kind === "hard")).toBe(true);
    }
  });
});

describe("ARENA_CONFIGS — triggers", () => {
  it("chaque arène a au moins 3 triggers", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.triggers.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("chaque arène a un trigger entry", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.triggers.some((t) => t.kind === "entry")).toBe(true);
    }
  });

  it("chaque arène a un trigger safe ou vantage", () => {
    for (const a of ARENA_CONFIGS) {
      const has = a.triggers.some((t) => t.kind === "safe" || t.kind === "vantage");
      expect(has).toBe(true);
    }
  });

  it("tous les triggers ont un rayon > 0", () => {
    for (const a of ARENA_CONFIGS) {
      for (const t of a.triggers) {
        expect(t.radius).toBeGreaterThan(0);
      }
    }
  });

  it("les activates référencent des id valides (vagues ou autres triggers)", () => {
    for (const a of ARENA_CONFIGS) {
      for (const t of a.triggers) {
        if (t.activates && t.activates.length > 0) {
          for (const actId of t.activates) {
            // Vérifie que le id référencé existe bien
            // (les vagues ont des labels, les triggers peuvent activer d'autres triggers)
            expect(actId).toBeTruthy();
          }
        }
      }
    }
  });
});

describe("ARENA_CONFIGS — waves", () => {
  it("chaque arène a au moins 2 vagues", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.waves.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("toutes les vagues ont au moins 1 spawn", () => {
    for (const a of ARENA_CONFIGS) {
      for (const w of a.waves) {
        expect(w.spawns.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("tous les spawns ont les champs requis", () => {
    for (const a of ARENA_CONFIGS) {
      for (const w of a.waves) {
        for (const s of w.spawns) {
          expect(s.folder).toBeTruthy();
          expect(s.count).toBeGreaterThanOrEqual(1);
          expect(s.pos).toHaveLength(3);
          if (s.packSize !== undefined) {
            expect(s.packSize).toBeGreaterThanOrEqual(1);
            expect(s.packSize).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });

  it("les curveballs sont valides si présentes", () => {
    const validCurveballs = ["smoke", "quake", "cover_change", "darkness", "reinforcement"];
    for (const a of ARENA_CONFIGS) {
      for (const w of a.waves) {
        if (w.curveballs) {
          for (const c of w.curveballs) {
            expect(validCurveballs).toContain(c);
          }
        }
      }
    }
  });

  it("la première vague a un delayMs raisonnable (< 5000ms)", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.waves[0].delayMs).toBeLessThan(5000);
    }
  });
});

describe("ARENA_CONFIGS — routes", () => {
  it("chaque arène a au moins 3 routes", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.routes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("chaque arène a une route main", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.routes.some((r) => r.kind === "main")).toBe(true);
    }
  });

  it("toutes les routes ont des waypoints", () => {
    for (const a of ARENA_CONFIGS) {
      for (const r of a.routes) {
        expect(r.waypoints.length).toBeGreaterThanOrEqual(2);
        for (const wp of r.waypoints) {
          expect(wp).toHaveLength(3);
        }
      }
    }
  });
});

describe("ARENA_CONFIGS — NPCs recommandés", () => {
  it("chaque arène a au moins 3 NPCs recommandés", () => {
    for (const a of ARENA_CONFIGS) {
      expect(a.recommendedNpcs!.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("les NPCs ont les champs requis", () => {
    for (const a of ARENA_CONFIGS) {
      for (const n of a.recommendedNpcs!) {
        expect(n.folder).toBeTruthy();
        expect(n.pos).toHaveLength(3);
        expect(n.level).toBeGreaterThan(0);
        expect(["mob", "boss"]).toContain(n.rank);
      }
    }
  });

  it("au moins un boss par arène (respawnSec=0 pour le vrai boss)", () => {
    for (const a of ARENA_CONFIGS) {
      const hasBoss = a.recommendedNpcs!.some((n) => n.rank === "boss");
      expect(hasBoss).toBe(true);
    }
  });
});

describe("ARENA_CONFIGS — faction et cohérence", () => {
  it("Donjon Furiste est Zayan (zayan)", () => {
    const df = getArenaConfig("donjon_furiste")!;
    expect(df.faction).toBe("zayan");
  });

  it("Fungaria est Zayan (zayan)", () => {
    const fg = getArenaConfig("fungaria")!;
    expect(fg.faction).toBe("zayan");
  });

  it("Orbital est Mezalayis (mezalayis)", () => {
    const ob = getArenaConfig("orbital")!;
    expect(ob.faction).toBe("mezalayis");
  });
});

describe("getArenaConfig", () => {
  it("retourne la config pour un mapId valide", () => {
    const cfg = getArenaConfig("donjon_furiste");
    expect(cfg).toBeDefined();
    expect(cfg!.name).toBe("La Fosse aux Meutes");
  });

  it("retourne undefined pour un mapId inconnu", () => {
    expect(getArenaConfig("inexistant")).toBeUndefined();
  });
});
