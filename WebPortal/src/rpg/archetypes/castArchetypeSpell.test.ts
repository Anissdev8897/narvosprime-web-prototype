import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { executeArchetypeSpell } from "./castArchetypeSpell";
import { ARCHETYPES } from "./archetypeCatalog";
import { statusEffects } from "../combat/statusEffects";
import { cooldownStore } from "../combat/cooldownStore";
import { npcRegistry, type NpcHandle } from "../npc/npcRegistry";

const ctx = { playerPos: new THREE.Vector3(), playerMaxHp: 100, playerAtk: 0, onAoe: () => {} };
const invisSpell = ARCHETYPES.guerrier.spells.find((s) => s.effect === "invisibility")!;
const frappe = ARCHETYPES.guerrier.spells.find((s) => s.effect === "root_aoe")!;

function fakeEnemy(id: string, pos: THREE.Vector3, defense = 0) {
  let hp = 1000;
  const handle: NpcHandle = {
    id, role: "enemy", getPosition: () => pos, isAlive: () => hp > 0,
    applyDamage: (a) => { hp -= a; }, getDefense: () => defense,
    getLoot: () => null, takeLoot: () => null,
  };
  return { handle, hp: () => hp };
}

describe("executeArchetypeSpell", () => {
  beforeEach(() => { statusEffects.reset(); cooldownStore.reset(); npcRegistry.clear(); });

  it("invisibilité : applique l'effet + déclenche le cooldown", () => {
    const r = executeArchetypeSpell(invisSpell, ctx);
    expect(r.ok).toBe(true);
    expect(statusEffects.isPlayerInvisible()).toBe(true);
    expect(cooldownStore.isReady(invisSpell.id)).toBe(false);
  });

  it("ultime en cooldown → refus", () => {
    executeArchetypeSpell(invisSpell, ctx);
    const r2 = executeArchetypeSpell(invisSpell, ctx);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("cooldown");
  });

  it("Frappe Dévastatrice : dégâts %PV + immobilisation des ennemis du rayon", () => {
    const e = fakeEnemy("e1", new THREE.Vector3(1, 0, 0)); // dist 1 < rayon 4
    npcRegistry.register(e.handle);
    const r = executeArchetypeSpell(frappe, ctx);
    expect(r.ok).toBe(true);
    expect(r.hits).toBe(1);
    expect(e.hp()).toBe(1000 - 20); // 0.20 × 100 PV × (atk 0) = 20
    expect(statusEffects.isRooted("e1")).toBe(true);
  });

  it("Frappe : la DÉFENSE de la cible atténue les dégâts (joueur ET ennemi)", () => {
    const e = fakeEnemy("ed", new THREE.Vector3(1, 0, 0), 100); // def 100 → mitigation 0.5
    npcRegistry.register(e.handle);
    executeArchetypeSpell(frappe, ctx);
    expect(e.hp()).toBe(1000 - 10); // 20 × 100/(100+100) = 10
  });

  it("Frappe : n'atteint pas un ennemi hors du rayon", () => {
    const e = fakeEnemy("e2", new THREE.Vector3(50, 0, 0));
    npcRegistry.register(e.handle);
    const r = executeArchetypeSpell(frappe, ctx);
    expect(r.hits).toBe(0);
    expect(e.hp()).toBe(1000);
  });
});
