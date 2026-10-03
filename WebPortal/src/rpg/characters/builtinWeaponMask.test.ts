import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { isBuiltinWeaponMaterial, setBuiltinWeaponVisible } from "./builtinWeaponMask";

/** Noms RELEVÉS dans les GLB, pas inventés. */
const REELS_ARME = [
  "M_Wraith_Gun_Wraith",
  "M_Murdock_Weapons_Murdock",
  "M_Murdock_WeaponExecutioner_Murdock_Executioner",
];
const REELS_CORPS = [
  "M_Wraith_Lowerbody_Wraith", "M_Wraith_Upperbody_Wraith", "M_Wraith_Backpack_Wraith",
  "M_Murdock_Body_Murdock", "M_Murdock_Head_Murdock", "M_Murdock_Arms_Murdock",
  "M_Murdock_Legs_Murdock", "MIC_MurdockVisorGlass_Murdock", "M_Murdock_Glass_Murdock",
];

function mesh(matName: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  (m.material as THREE.Material).name = matName;
  return m;
}

describe("isBuiltinWeaponMaterial", () => {
  it("reconnaît les armes intégrées relevées dans les GLB", () => {
    for (const n of REELS_ARME) expect(isBuiltinWeaponMaterial(n), n).toBe(true);
  });

  it("ne touche à aucune partie de corps réelle", () => {
    for (const n of REELS_CORPS) expect(isBuiltinWeaponMaterial(n), n).toBe(false);
  });

  it("ne se déclenche pas sur un matériau d'armure au nom trompeur", () => {
    // Le piège d'un motif large : « gunmetal » est une couleur d'armure, pas une
    // arme. D'où l'exigence de séparateurs autour du mot.
    for (const n of ["M_Armor_Gunmetal_Plate", "shotgun_plating", "M_Blades_Of_Grass"]) {
      expect(isBuiltinWeaponMaterial(n), n).toBe(false);
    }
  });

  it("supporte un nom absent", () => {
    expect(isBuiltinWeaponMaterial(undefined)).toBe(false);
    expect(isBuiltinWeaponMaterial("")).toBe(false);
  });
});

describe("setBuiltinWeaponVisible", () => {
  it("masque l'arme et laisse le corps intact", () => {
    const root = new THREE.Group();
    const gun = mesh("M_Wraith_Gun_Wraith");
    const corps = mesh("M_Wraith_Upperbody_Wraith");
    root.add(gun, corps);

    expect(setBuiltinWeaponVisible(root, false)).toBe(1);
    expect(gun.visible).toBe(false);
    expect(corps.visible, "le corps ne doit jamais disparaître").toBe(true);

    expect(setBuiltinWeaponVisible(root, true)).toBe(1);
    expect(gun.visible).toBe(true);
  });

  it("rend 0 quand rien ne correspond — un motif qui n'attrape rien doit se voir", () => {
    const root = new THREE.Group();
    root.add(mesh("M_Murdock_Body_Murdock"));
    expect(setBuiltinWeaponVisible(root, false)).toBe(0);
  });

  it("épargne un mesh fusionné qui mêle corps et arme", () => {
    // Masquer un tel mesh emporterait du corps avec l'arme : on préfère laisser
    // l'arme visible plutôt que trouer le personnage.
    const m = new THREE.Mesh(new THREE.BufferGeometry(), [
      new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(),
    ]);
    (m.material as THREE.Material[])[0].name = "M_Wraith_Gun_Wraith";
    (m.material as THREE.Material[])[1].name = "M_Wraith_Upperbody_Wraith";
    const root = new THREE.Group(); root.add(m);
    expect(setBuiltinWeaponVisible(root, false)).toBe(0);
    expect(m.visible).toBe(true);
  });
});
