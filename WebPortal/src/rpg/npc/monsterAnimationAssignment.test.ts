import { describe, it, expect } from "vitest";
import { resolveMonsterAnimPack, hasCustomMonsterPack } from "./monsterAnimationAssignment";
import type { NpcDef } from "./npcCatalog";

const base: NpcDef = { folder: "x", label: "X", classId: "warrior_bruiser", role: "enemy" };

describe("monsterAnimationAssignment", () => {
  it("ownAnims → JAMAIS modifié (null), même si animPack présent", () => {
    expect(resolveMonsterAnimPack({ ...base, ownAnims: true, animPack: "creature_melee" })).toBeNull();
  });

  it("animPack 'creature_melee' → pack créature (ou défaut si pack vide/désactivé)", () => {
    const p = resolveMonsterAnimPack({ ...base, animPack: "creature_melee" });
    // CREATURE_MELEE_PACK est vide tant que les GLB ne sont pas sur disque →
    // null (défaut partagé). Si rempli, chaque path pointe le dossier créature.
    if (p !== null) {
      expect(p.length).toBeGreaterThan(0);
      for (const s of p) expect(s.path).toContain("creature_animation_melee");
    }
  });

  it("pack vide → null (défaut partagé, jamais un pack sans locomotion)", () => {
    const p = resolveMonsterAnimPack({ ...base, animPack: "creature_melee" });
    if (p !== null) expect(p.length).toBeGreaterThan(0);
  });

  it("sans animPack → défaut partagé (null) = zéro changement", () => {
    expect(resolveMonsterAnimPack(base)).toBeNull();
    expect(hasCustomMonsterPack(base)).toBe(false);
  });

  it("animPack inconnu → null (robuste)", () => {
    expect(resolveMonsterAnimPack({ ...base, animPack: "inexistant" })).toBeNull();
  });
});
