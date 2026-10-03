import { describe, it, expect } from "vitest";
import {
  INPUT_ACTION_DEFS,
  INPUT_ACTION_DEFS_BY_ID,
  getActionDef,
  getActionGroups,
  getActionsByGroup,
  getDefaultMappings,
} from "./InputActionDefs";
import { EInputValueType, ETriggerType } from "./types";

describe("InputActionDefs", () => {
  it("contient les actions essentielles", () => {
    const ids = INPUT_ACTION_DEFS.map((d) => d.id);
    expect(ids).toContain("move");
    expect(ids).toContain("look");
    expect(ids).toContain("jump");
    expect(ids).toContain("sprint");
    expect(ids).toContain("crouch");
    expect(ids).toContain("attack");
    expect(ids).toContain("ability1");
    expect(ids).toContain("ability2");
    expect(ids).toContain("ability3");
    expect(ids).toContain("ability4");
    expect(ids).toContain("reload");
    expect(ids).toContain("interact");
    expect(ids).toContain("pause");
  });

  it("a des IDs uniques", () => {
    const ids = INPUT_ACTION_DEFS.map((d) => d.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("a des IDs non vides", () => {
    for (const def of INPUT_ACTION_DEFS) {
      expect(def.id).toBeTruthy();
      expect(def.displayName).toBeTruthy();
      expect(def.group).toBeTruthy();
    }
  });

  it("a les bons types de valeur", () => {
    expect(getActionDef("move")!.valueType).toBe(EInputValueType.Axis2D);
    expect(getActionDef("look")!.valueType).toBe(EInputValueType.Axis2D);
    expect(getActionDef("jump")!.valueType).toBe(EInputValueType.Digital);
    expect(getActionDef("sprint")!.valueType).toBe(EInputValueType.Digital);
    expect(getActionDef("crouch")!.valueType).toBe(EInputValueType.Digital);
    expect(getActionDef("attack")!.valueType).toBe(EInputValueType.Digital);
  });

  it("a des touches par défaut définies", () => {
    const defs = getDefaultMappings();
    expect(defs["move"]).toEqual(["KeyW", "KeyS", "KeyA", "KeyD"]);
    expect(defs["jump"]).toEqual(["Space"]);
    expect(defs["sprint"]).toEqual(["ShiftLeft", "ShiftRight"]);
    expect(defs["attack"]).toEqual(["Mouse0"]);
    expect(defs["ability1"]).toEqual(["Digit1"]);
    expect(defs["pause"]).toEqual(["Escape"]);
  });

  it("index par ID complet", () => {
    expect(INPUT_ACTION_DEFS_BY_ID.size).toBe(INPUT_ACTION_DEFS.length);
    expect(INPUT_ACTION_DEFS_BY_ID.get("move")).toBeDefined();
    expect(INPUT_ACTION_DEFS_BY_ID.get("nonexistent")).toBeUndefined();
  });

  it("getActionDef retourne la définition", () => {
    const def = getActionDef("jump");
    expect(def).toBeDefined();
    expect(def!.displayName).toBe("Saut");
  });

  it("getActionDef retourne undefined pour inconnu", () => {
    expect(getActionDef("unknown")).toBeUndefined();
  });

  it("getActionGroups retourne tous les groupes", () => {
    const groups = getActionGroups();
    expect(groups).toContain("Déplacement");
    expect(groups).toContain("Combat");
    expect(groups).toContain("Compétences");
    expect(groups).toContain("Interface");
    expect(groups).toContain("Caméra");
    expect(groups).toContain("Debug");
  });

  it("getActionsByGroup filtre par groupe", () => {
    const combat = getActionsByGroup("Combat");
    expect(combat.length).toBeGreaterThan(0);
    for (const a of combat) {
      expect(a.group).toBe("Combat");
    }
  });

  it("jump a un trigger Tap par défaut", () => {
    const def = getActionDef("jump");
    expect(def!.defaultTrigger).toBeDefined();
    expect(def!.defaultTrigger!.type).toBe(ETriggerType.Tap);
  });

  it("sprint a un trigger Pressed par défaut", () => {
    const def = getActionDef("sprint");
    expect(def!.defaultTrigger).toBeDefined();
    expect(def!.defaultTrigger!.type).toBe(ETriggerType.Pressed);
  });

  it("vérifie que toutes les actions ont un groupe valide", () => {
    const validGroups = ["Déplacement", "Combat", "Compétences", "Caméra", "Interface", "Debug"];
    for (const def of INPUT_ACTION_DEFS) {
      expect(validGroups).toContain(def.group);
    }
  });
});
