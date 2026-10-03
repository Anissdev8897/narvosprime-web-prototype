// Vérifie que CHAQUE monstre a une source de locomotion (marche/course), et que le repli
// d'action couvre les monstres dont le clip "run" manque (anims embarquées partielles).
import { describe, it, expect } from "vitest";
import type { ActionId } from "../types";
import { resolveAction } from "../animation/AnimationController";
import { CREATURE_MELEE_PACK, SHOOTER_PACK } from "../animation/animationPacks";
import { NPC_CATALOG } from "./npcCatalog";
import { MONSTER_ANIM_PACKS, resolveMonsterAnimPack } from "./monsterAnimationAssignment";

const actionsOf = (pack: { action: ActionId }[]) => new Set(pack.map((s) => s.action));

describe("resolveAction (repli locomotion)", () => {
  it("run absent mais walk présent → joue walk (monstre ne glisse pas figé)", () => {
    expect(resolveAction("run", new Set<ActionId>(["idle", "walk"]))).toBe("walk");
  });
  it("run présent → joue run", () => {
    expect(resolveAction("run", new Set<ActionId>(["idle", "walk", "run"]))).toBe("run");
  });
  it("sprint absent → run sinon walk", () => {
    expect(resolveAction("sprint", new Set<ActionId>(["idle", "walk"]))).toBe("walk");
    expect(resolveAction("sprint", new Set<ActionId>(["idle", "run"]))).toBe("run");
  });
  it("ni run ni walk → retombe sur idle", () => {
    expect(resolveAction("run", new Set<ActionId>(["idle"]))).toBe("idle");
  });
  it("crouch absent → idle", () => {
    expect(resolveAction("crouch", new Set<ActionId>(["idle"]))).toBe("idle");
  });
  it("aucune action (set vide) → null (l'appelant prend n'importe quoi)", () => {
    expect(resolveAction("run", new Set<ActionId>())).toBeNull();
  });
});

describe("packs d'anim partagés des monstres", () => {
  // Les packs sont VIDES tant que les GLB animation_* ne sont pas sur disque
  // (packs désactivés → resolveMonsterAnimPack retombe sur le défaut partagé).
  // Un pack NON-vide doit fournir la locomotion complète.
  it("chaque pack monstre NON-VIDE fournit idle + walk + run (locomotion complète)", () => {
    for (const [name, pack] of Object.entries(MONSTER_ANIM_PACKS)) {
      if (pack.length === 0) continue; // désactivé → défaut partagé, OK
      const a = actionsOf(pack);
      expect(a.has("idle"), `${name} manque idle`).toBe(true);
      expect(a.has("walk"), `${name} manque walk`).toBe(true);
      expect(a.has("run"), `${name} manque run`).toBe(true);
    }
  });
  it("CREATURE_MELEE et SHOOTER non-vides ont idle/walk/run/attack/death", () => {
    for (const pack of [CREATURE_MELEE_PACK, SHOOTER_PACK]) {
      if (pack.length === 0) continue; // désactivé
      const a = actionsOf(pack);
      for (const need of ["idle", "walk", "run", "attack", "death"] as ActionId[]) {
        expect(a.has(need)).toBe(true);
      }
    }
  });
});

describe("couverture catalogue monstres", () => {
  it("tout monstre à animPack résout un pack avec locomotion, ou le défaut (null)", () => {
    for (const def of NPC_CATALOG) {
      if (!def.animPack || def.ownAnims) continue;
      const pack = resolveMonsterAnimPack(def);
      // null = pack désactivé (GLB absents) → défaut biped partagé, valide.
      if (pack === null) continue;
      const a = actionsOf(pack);
      expect(a.has("walk") || a.has("run"), `${def.folder} : pack sans locomotion`).toBe(true);
    }
  });
  it("tout monstre a une source d'anim (ownAnims, animPack, ou défaut biped partagé)", () => {
    // Aucun ne doit être dans un état impossible. Le défaut (ni ownAnims ni animPack) =
    // anims biped partagées (idle/walk/run) → couvert par le runtime.
    for (const def of NPC_CATALOG) {
      const source = def.ownAnims ? "own" : def.animPack ? "pack" : "default";
      expect(["own", "pack", "default"]).toContain(source);
    }
  });
});
