// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/bridge.test.ts — Tests du pont modulaire (TDD).
//
// Vérifie :
//   1. Migration CustomCharacter v1→v2 (equipped absent → defaults)
//   2. Résolution de l'équipement pour un CustomCharacter (v1 + v2)
//   3. Discriminateur isModularCustomCharacter
//   4. Cohabitation v1/v2 dans le même store
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import type { CustomCharacter } from "../customCharacterStore";
import {
  migrateCustomCharacter,
  resolveEquipped,
  isModularCustomCharacter,
  MODULAR_BODY_ID,
  STORAGE_KEY_V2,
} from "./bridge";
import { starterOutfit } from "./partCatalog";
import { REQUIRED_SLOTS } from "./bodySlots";
import type { BodySlot } from "./bodySlots";

// ── Helpers de test ──────────────────────────────────────────────────────────

function makeV1(overrides: Partial<CustomCharacter> = {}): CustomCharacter {
  return {
    id: "cc_testv1",
    name: "Test v1",
    baseAvatar: "wraith",
    attachments: [],
    tint: "#ffffff",
    scaleMult: 1,
    updatedAt: Date.now(),
    ...overrides,
  } as CustomCharacter;
}

function makeV2(overrides: Partial<CustomCharacter> = {}): CustomCharacter {
  return {
    id: "cc_testv2",
    name: "Test v2",
    baseAvatar: MODULAR_BODY_ID,
    attachments: [],
    tint: "#ffffff",
    scaleMult: 1,
    updatedAt: Date.now(),
    equipped: { body: "m_body", head: "m_head_01" },
    ...overrides,
  };
}

describe("MODULAR_BODY_ID", () => {
  it("est 'modular' — le discriminant dans baseAvatar", () => {
    expect(MODULAR_BODY_ID).toBe("modular");
  });
});

describe("STORAGE_KEY_V2", () => {
  it("est différent de la clé v1", () => {
    expect(STORAGE_KEY_V2).not.toBe("narvos:custom_characters:v1");
  });

  it("contient 'v2' pour le versionnement", () => {
    expect(STORAGE_KEY_V2).toContain("v2");
  });
});

describe("migrateCustomCharacter", () => {
  it("ajoute equipped=starterOutfit à un perso v1 sans equipped", () => {
    const v1 = makeV1();
    const migrated = migrateCustomCharacter(v1, "male");
    expect(migrated.equipped).toBeDefined();
    expect(migrated.equipped!.body).toBeDefined();
    expect(migrated.equipped!.head).toBeDefined();
    // La migration est non destructive — les autres champs intacts
    expect(migrated.id).toBe(v1.id);
    expect(migrated.name).toBe(v1.name);
    expect(migrated.attachments).toBe(v1.attachments);
  });

  it("ne modifie PAS equipped s'il est déjà défini", () => {
    const v2 = makeV2({ equipped: { body: "f_body", head: "m_head_02" } });
    const migrated = migrateCustomCharacter(v2, "male");
    expect(migrated.equipped).toEqual({ body: "f_body", head: "m_head_02" });
  });

  it("utilise les defaults féminins pour gender='female'", () => {
    const v1 = makeV1();
    const migrated = migrateCustomCharacter(v1, "female");
    const femDefaults = starterOutfit("female");
    expect(migrated.equipped!.body).toBe(femDefaults.body);
  });

  it("utilise les defaults masculins quand le genre est inconnu", () => {
    const v1 = makeV1();
    // Test de fallback robuste : undefined → default "male"
    const migrated = migrateCustomCharacter(v1, undefined);
    const maleDefaults = starterOutfit("male");
    expect(migrated.equipped!.body).toBe(maleDefaults.body);
  });

  it("préserve les champs existants du CustomCharacter", () => {
    const v1 = makeV1({ baseAvatar: "murdock", tint: "#ff0000", scaleMult: 1.5 });
    const migrated = migrateCustomCharacter(v1, "male");
    expect(migrated.baseAvatar).toBe("murdock");
    expect(migrated.tint).toBe("#ff0000");
    expect(migrated.scaleMult).toBe(1.5);
  });

  it("ne mute PAS l'objet original (immutabilité)", () => {
    const v1 = makeV1();
    const originalEquipped = (v1 as any).equipped;
    migrateCustomCharacter(v1, "male");
    expect((v1 as any).equipped).toBe(originalEquipped); // inchangé
  });
});

describe("resolveEquipped", () => {
  it("retourne equipped tel quel pour un perso v2", () => {
    const v2 = makeV2({ equipped: { body: "f_body", head: "m_head_02", gloves: "m_gloves" } });
    const resolved = resolveEquipped(v2, "male");
    expect(resolved).toEqual({ body: "f_body", head: "m_head_02", gloves: "m_gloves" });
  });

  it("fournit les defaults pour un perso v1 sans equipped", () => {
    const v1 = makeV1();
    const resolved = resolveEquipped(v1 as CustomCharacter, "male");
    const maleDefaults = starterOutfit("male");
    // Au minimum body + head (REQUIRED_SLOTS)
    expect(resolved.body).toBe(maleDefaults.body);
    expect(resolved.head).toBe(maleDefaults.head);
  });

  it("fusionne equipped PARTIEL avec les defaults (seulement REQUIRED_SLOTS manquants)", () => {
    const partial = makeV2({ equipped: { torso: "m_jacket_a", legs: "m_jeans" } });
    const resolved = resolveEquipped(partial, "male");
    expect(resolved.torso).toBe("m_jacket_a");
    expect(resolved.legs).toBe("m_jeans");
    // Les REQUIRED_SLOTS absents sont complétés
    for (const slot of REQUIRED_SLOTS) expect(resolved[slot], slot).toBeDefined();
    // Les autres slots NE sont PAS remplis (choix explicite de l'utilisateur)
    expect(resolved.hair).toBeUndefined();
    expect(resolved.feet).toBeUndefined();
  });

  it("`head` n'est PAS complété d'office — décision D1", () => {
    // `resolveEquipped` forçait `["body","head"]` en dur alors que
    // `REQUIRED_SLOTS` ne contient que `body`. Deux raisons de s'aligner :
    //   • mesuré : `m_body` porte 43 % de sommets skinnés sur l'os `head`,
    //     `f_body` 50 % — les corps sont complets, `head` est une VARIANTE ;
    //   • le catalogue féminin n'a aucune pièce `head` : l'exiger était
    //     insatisfiable pour la moitié des personnages.
    expect(REQUIRED_SLOTS).not.toContain("head");
    const sansTete = makeV2({ equipped: { top: "m_tanktop" } });
    expect(resolveEquipped(sansTete, "male").head).toBeUndefined();
  });

  it("un personnage féminin partiel se résout sans exiger de tête", () => {
    // Le cas qui cassait : aucune pièce `head` féminine n'existe au catalogue.
    const f = makeV2({ equipped: { top: "f_tanktop" } });
    const resolved = resolveEquipped(f, "female");
    expect(resolved.body).toBeDefined();
    expect(resolved.top).toBe("f_tanktop");
  });

  it("le champ equipped vide {} reçoit la tenue de départ complète", () => {
    const empty = makeV2({ equipped: {} });
    const resolved = resolveEquipped(empty, "male");
    expect(resolved).toEqual(starterOutfit("male"));
  });
});

describe("isModularCustomCharacter", () => {
  it("true quand baseAvatar === 'modular'", () => {
    expect(isModularCustomCharacter(makeV2({ baseAvatar: "modular" }))).toBe(true);
  });

  it("false pour un perso v1 (baseAvatar = 'wraith')", () => {
    expect(isModularCustomCharacter(makeV1({ baseAvatar: "wraith" }))).toBe(false);
  });

  it("false pour baseAvatar = 'murdock'", () => {
    expect(isModularCustomCharacter(makeV1({ baseAvatar: "murdock" }))).toBe(false);
  });

  it("false pour undefined", () => {
    expect(isModularCustomCharacter(undefined as any)).toBe(false);
  });
});

describe("Cohabitation v1/v2 dans le même store", () => {
  it("un perso v1 et un perso v2 coexistent sans erreur de typage", () => {
    const roster: CustomCharacter[] = [
      makeV1({ id: "cc_v1a" }),
      makeV2({ id: "cc_v2a" }),
      makeV1({ id: "cc_v1b", baseAvatar: "murdock" }),
    ];

    const resolved = roster.map((c) => ({
      id: c.id,
      baseAvatar: c.baseAvatar,
      isModular: isModularCustomCharacter(c),
      equipped: resolveEquipped(c, "male"),
    }));

    expect(resolved[0].isModular).toBe(false);
    expect(resolved[0].equipped.body).toBeDefined(); // defaults appliqués

    expect(resolved[1].isModular).toBe(true);
    expect(resolved[1].equipped.head).toBe("m_head_01"); // explicite

    expect(resolved[2].isModular).toBe(false);
    expect(resolved[2].baseAvatar).toBe("murdock");
  });
});
