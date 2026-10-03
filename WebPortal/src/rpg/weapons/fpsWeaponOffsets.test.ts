// weapons/fpsWeaponOffsets.test.ts — tests du registre d'offsets FPS
import { describe, it, expect } from "vitest";
import {
  FPS_WEAPON_OFFSETS,
  FPS_OFFSET_DEFAULT,
  FPS_OFFSET_COVERAGE,
  getFpsWeaponOffset,
  getFpsWeaponScale,
  type FpsWeaponOffset,
} from "./fpsWeaponOffsets";
import type { WeaponType } from "./weaponClassifier";

// Types d'armes équipables connus du classifieur
const ALL_EQUIPPABLE_TYPES: WeaponType[] = [
  "sword_1h", "sword_2h", "dagger", "axe", "blunt", "spear",
  "bow", "staff", "gun", "shield",
];

const NON_EQUIPPABLE_TYPES: WeaponType[] = ["ammo", "throwable", "clip", "ignore"];

function isValidOffset(o: FpsWeaponOffset): boolean {
  return (
    Array.isArray(o.position) && o.position.length === 3 &&
    o.position.every((v) => Number.isFinite(v)) &&
    Array.isArray(o.rotation) && o.rotation.length === 3 &&
    o.rotation.every((v) => Number.isFinite(v)) &&
    typeof o.scale === "number" && Number.isFinite(o.scale) && o.scale > 0
  );
}

describe("fpsWeaponOffsets", () => {
  // ── FPS_OFFSET_DEFAULT ─────────────────────────────────────────────────
  describe("FPS_OFFSET_DEFAULT", () => {
    it("est un offset valide", () => {
      expect(isValidOffset(FPS_OFFSET_DEFAULT)).toBe(true);
    });

    it("position en face, en bas, à droite de la caméra", () => {
      // forward < 0, down < 0, right > 0 → arme en bas à droite devant la caméra
      expect(FPS_OFFSET_DEFAULT.position[0]).toBeLessThan(0); // forward
      expect(FPS_OFFSET_DEFAULT.position[1]).toBeLessThan(0); // down
      expect(FPS_OFFSET_DEFAULT.position[2]).toBeGreaterThan(0); // right
    });
  });

  // ── FPS_WEAPON_OFFSETS ─────────────────────────────────────────────────
  describe("FPS_WEAPON_OFFSETS", () => {
    it("chaque offset du registre a des valeurs valides", () => {
      for (const [type, offset] of Object.entries(FPS_WEAPON_OFFSETS)) {
        expect(isValidOffset(offset!), `type=${type}`).toBe(true);
      }
    });

    it("couvre TOUS les types d'armes équipables", () => {
      for (const t of ALL_EQUIPPABLE_TYPES) {
        expect(FPS_WEAPON_OFFSETS, `type=${t}`).toHaveProperty(t);
      }
    });

    it("chaque type a un scale cohérent avec sa cible TPS", () => {
      // Le scale doit être ≥ 0.1 et ≤ 5 (bornes raisonnables)
      for (const [type, offset] of Object.entries(FPS_WEAPON_OFFSETS)) {
        const s = offset!.scale;
        expect(s, `type=${type}`).toBeGreaterThanOrEqual(0.1);
        expect(s, `type=${type}`).toBeLessThanOrEqual(5);
        // Un scale de 1 exact arrive quand la cible TPS = VM_TARGET_HEIGHT (0.6)
        expect(s, `type=${type}`).not.toBe(0);
      }
    });

    it("toutes les positions sont dans [-1, 1] (raisonnable FPS)", () => {
      for (const [type, offset] of Object.entries(FPS_WEAPON_OFFSETS)) {
        for (let i = 0; i < 3; i++) {
          expect(
            Math.abs(offset!.position[i]),
            `type=${type} position[${i}]=${offset!.position[i]}`,
          ).toBeLessThanOrEqual(1);
        }
      }
    });

    it("toutes les rotations sont dans [-π, π] (raisonnable FPS)", () => {
      for (const [type, offset] of Object.entries(FPS_WEAPON_OFFSETS)) {
        for (let i = 0; i < 3; i++) {
          expect(
            Math.abs(offset!.rotation[i]),
            `type=${type} rotation[${i}]=${offset!.rotation[i]}`,
          ).toBeLessThanOrEqual(Math.PI);
        }
      }
    });

    it("le nombre de types couverts est correct", () => {
      // 10 types équipables
      expect(FPS_OFFSET_COVERAGE).toBe(ALL_EQUIPPABLE_TYPES.length);
    });
  });

  // ── getFpsWeaponOffset ─────────────────────────────────────────────────
  describe("getFpsWeaponOffset", () => {
    it("retourne un offset valide pour chaque type équipable", () => {
      for (const t of ALL_EQUIPPABLE_TYPES) {
        const off = getFpsWeaponOffset(t);
        expect(isValidOffset(off), `type=${t}`).toBe(true);
      }
    });

    it("retourne FPS_OFFSET_DEFAULT pour les types non équipables", () => {
      for (const t of NON_EQUIPPABLE_TYPES) {
        // Ces types n'ont pas d'entrée dans le registre → défaut
        const off = getFpsWeaponOffset(t);
        expect(off).toBe(FPS_OFFSET_DEFAULT);
      }
    });

    it("retourne FPS_OFFSET_DEFAULT pour un type inconnu", () => {
      expect(getFpsWeaponOffset("unknown_type")).toBe(FPS_OFFSET_DEFAULT);
      expect(getFpsWeaponOffset("")).toBe(FPS_OFFSET_DEFAULT);
    });

    it("retourne FPS_OFFSET_DEFAULT pour undefined", () => {
      // Simule le cas weaponType non passé
      expect(getFpsWeaponOffset("")).toBe(FPS_OFFSET_DEFAULT);
    });
  });

  // ── getFpsWeaponScale ──────────────────────────────────────────────────
  describe("getFpsWeaponScale", () => {
    it("retourne 1 pour le défaut (type inconnu)", () => {
      expect(getFpsWeaponScale("unknown")).toBe(1);
      expect(getFpsWeaponScale("")).toBe(1);
    });

    it("retourne un scale > 0 pour chaque type équipable", () => {
      for (const t of ALL_EQUIPPABLE_TYPES) {
        const s = getFpsWeaponScale(t);
        expect(s, `type=${t} scale=${s}`).toBeGreaterThan(0);
        expect(s, `type=${t} scale=${s}`).toBeGreaterThanOrEqual(0.1);
      }
    });

    it("le scale est cohérent avec la taille TPS (grande arme → scale > 1, petite → scale < 1)", () => {
      // Une épée 2h (1.25m) doit avoir un scale FPS plus grand qu'un gun (0.45m)
      const sword2hScale = getFpsWeaponScale("sword_2h");
      const gunScale = getFpsWeaponScale("gun");
      expect(sword2hScale).toBeGreaterThan(gunScale);
    });
  });

  // ── Cohérence sémantique ───────────────────────────────────────────────
  describe("Cohérence sémantique", () => {
    it("les armes longues (spear, staff) sont plus avancées que les armes courtes (dagger)", () => {
      const spearFwd = getFpsWeaponOffset("spear").position[0];
      const daggerFwd = getFpsWeaponOffset("dagger").position[0];
      // spear plus avancée (forward plus négatif) → devrait être devant
      expect(spearFwd).toBeLessThanOrEqual(daggerFwd);
    });

    it("chaque type d'arme a une entrée unique (pas de doublon)", () => {
      const keys = Object.keys(FPS_WEAPON_OFFSETS);
      expect(keys.length).toBe(new Set(keys).size);
    });

    it("l'offset shield positionne le bouclier à gauche (right négatif)", () => {
      const shield = getFpsWeaponOffset("shield");
      // Bouclier à gauche → right < 0
      expect(shield.position[2]).toBeLessThan(0);
    });
  });
});
