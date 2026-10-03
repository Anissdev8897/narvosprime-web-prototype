import { describe, it, expect } from "vitest";
import { classifyWeapon, animPackFolderForWeapon, isEquippableWeapon } from "./weaponClassifier";
import { EQUIPPABLE_WEAPONS, WEAPON_CATALOG } from "./weaponCatalog";

describe("weaponClassifier — fichiers réels", () => {
  const cases: [string, string][] = [
    ["uploads_files_5605095_short_sword.fbx", "sword_1h"],
    ["Sword00_mesh.FBX", "sword_1h"],
    ["uploads_files_5605095_claymore.fbx", "sword_2h"],
    ["Meshy_AI_Grande_épée_dark_fa_0603035436_texture.fbx", "sword_2h"],
    ["Knife00_mesh.FBX", "dagger"],
    ["uploads_files_5605095_battle_axe.fbx", "axe"],
    ["uploads_files_5605095_mining_axe.fbx", "axe"],
    ["Mace00_mesh.FBX", "blunt"],
    ["uploads_files_5605095_giant_mace.fbx", "blunt"],
    ["uploads_files_5605095_crudgel.fbx", "blunt"],
    ["Meshy_AI_Marteau_de_guerre_gé_0603042411_texture.fbx", "blunt"],
    ["uploads_files_5605095_spear.fbx", "spear"],
    ["uploads_files_5605095_recurve_bow.fbx", "bow"],
    ["bowready.fbx", "bow"],
    ["Magic+wand.fbx", "staff"],
    ["Staff00_mesh.FBX", "staff"],
    ["Shield00_mesh.FBX", "shield"],
    ["Gun_Pistol.fbx", "gun"],
    ["Gun_Sniper.fbx", "gun"],
  ];
  it.each(cases)("classe %s → %s", (file, expected) => {
    expect(classifyWeapon(file)).toBe(expected);
  });

  it("rejette props / ennemis / munitions", () => {
    expect(classifyWeapon("Prop_Crate.fbx")).toBe("ignore");
    expect(classifyWeapon("Enemy_EyeDrone.fbx")).toBe("ignore");
    expect(classifyWeapon("Prop_Barrel1.fbx")).toBe("ignore");
    expect(classifyWeapon("Gun_Sniper_Ammo.fbx")).toBe("ammo");
    expect(classifyWeapon("Arrow00_mesh.FBX")).toBe("ammo");
    expect(classifyWeapon("Prop_Grenade.fbx")).toBe("throwable");
    expect(isEquippableWeapon("Prop_Crate.fbx")).toBe(false);
  });

  it("mappe chaque type vers le bon pack d'anim (décisions projet)", () => {
    expect(animPackFolderForWeapon("Sword00_mesh.FBX")).toBe("animation_sword_and_shield");
    expect(animPackFolderForWeapon("claymore.fbx")).toBe("animation_meelee");      // 2H → meelee
    expect(animPackFolderForWeapon("recurve_bow.fbx")).toBe("animation_archer");
    expect(animPackFolderForWeapon("Magic+wand.fbx")).toBe("animation_magie");
    expect(animPackFolderForWeapon("Gun_Pistol.fbx")).toBe("animation_shooter");   // gun → pack tireur dédié
  });
});

describe("weaponCatalog", () => {
  it("classe l'inventaire réel et exclut les munitions", () => {
    // Les 2 entrées 'ammo' (Arrow+2, Arrow00) ne sont pas équipables.
    const ammo = WEAPON_CATALOG.filter((w) => w.type === "ammo");
    expect(ammo.length).toBe(2);
    expect(EQUIPPABLE_WEAPONS.length).toBe(WEAPON_CATALOG.length - 2);
    // Toute arme équipable a un pack d'animation.
    expect(EQUIPPABLE_WEAPONS.every((w) => w.animPack !== null)).toBe(true);
  });
});
