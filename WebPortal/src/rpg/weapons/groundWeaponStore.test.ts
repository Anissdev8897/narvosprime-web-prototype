import { describe, it, expect, beforeEach } from "vitest";
import { groundWeaponStore, PICKUP_RANGE, type GroundWeapon } from "./groundWeaponStore";

const arme = (pos: [number, number, number], label = "Fusil"): Omit<GroundWeapon, "id"> => ({
  weaponPath: "/models/armes/CG_ShotgunPack/Weapons/Meshes/SK_DBShotgun.glb",
  label, pos, rot: [0, 0, 0],
});

beforeEach(() => { groundWeaponStore.__resetForTest(); });

describe("poser et retirer", () => {
  it("une map sans arme rend un tableau VIDE, jamais undefined", () => {
    // Un `undefined` ici ferait planter le `.map()` du rendu.
    expect(groundWeaponStore.list("forge")).toEqual([]);
  });

  it("deux armes identiques posées ont des ids DISTINCTS", () => {
    // Sinon ramasser l'une retirerait les deux : l'id identifie l'INSTANCE
    // posée, pas le type d'arme.
    const a = groundWeaponStore.drop("forge", arme([0, 0, 0]));
    const b = groundWeaponStore.drop("forge", arme([5, 0, 0]));
    expect(a.id).not.toBe(b.id);
    expect(groundWeaponStore.list("forge")).toHaveLength(2);
  });

  it("ramasser retire du sol et rend l'arme", () => {
    const a = groundWeaponStore.drop("forge", arme([0, 0, 0]));
    expect(groundWeaponStore.take("forge", a.id)).toMatchObject({ id: a.id });
    expect(groundWeaponStore.list("forge")).toEqual([]);
  });

  it("ramasser deux fois la même arme rend null la seconde fois", () => {
    // Le garde-fou contre le double ramassage : deux pressions rapprochées de
    // la touche ne doivent pas dupliquer l'arme dans l'inventaire.
    const a = groundWeaponStore.drop("forge", arme([0, 0, 0]));
    expect(groundWeaponStore.take("forge", a.id)).not.toBeNull();
    expect(groundWeaponStore.take("forge", a.id)).toBeNull();
  });

  it("les maps sont cloisonnées", () => {
    groundWeaponStore.drop("forge", arme([0, 0, 0]));
    expect(groundWeaponStore.list("orbital")).toEqual([]);
    groundWeaponStore.clear("orbital");
    expect(groundWeaponStore.list("forge")).toHaveLength(1);
  });
});

describe("nearest", () => {
  it("trouve l'arme à portée", () => {
    const a = groundWeaponStore.drop("forge", arme([1, 0, 0]));
    expect(groundWeaponStore.nearest("forge", 0, 0, 0)?.id).toBe(a.id);
  });

  it("ignore une arme hors de portée", () => {
    groundWeaponStore.drop("forge", arme([PICKUP_RANGE + 1, 0, 0]));
    expect(groundWeaponStore.nearest("forge", 0, 0, 0)).toBeNull();
  });

  it("rend la PLUS PROCHE quand plusieurs sont à portée", () => {
    groundWeaponStore.drop("forge", arme([2, 0, 0], "loin"));
    const proche = groundWeaponStore.drop("forge", arme([0.5, 0, 0], "proche"));
    expect(groundWeaponStore.nearest("forge", 0, 0, 0)?.id).toBe(proche.id);
  });

  it("mesure en 3D — une arme sur une passerelle n'est pas ramassable d'en bas", () => {
    // Une distance horizontale seule rendrait ramassable ce qui est 10 m plus
    // haut, à l'aplomb du joueur.
    groundWeaponStore.drop("forge", arme([0, 10, 0]));
    expect(groundWeaponStore.nearest("forge", 0, 0, 0)).toBeNull();
  });

  it("la limite de portée est INCLUSIVE", () => {
    groundWeaponStore.drop("forge", arme([PICKUP_RANGE, 0, 0]));
    expect(groundWeaponStore.nearest("forge", 0, 0, 0)).not.toBeNull();
  });

  it("rend null sur une map vide", () => {
    expect(groundWeaponStore.nearest("inconnue", 0, 0, 0)).toBeNull();
  });
});

describe("notification", () => {
  it("poser ET ramasser notifient les abonnés", () => {
    let n = 0;
    const stop = groundWeaponStore.subscribe(() => { n++; });
    const a = groundWeaponStore.drop("forge", arme([0, 0, 0]));
    expect(n).toBe(1);
    groundWeaponStore.take("forge", a.id);
    expect(n).toBe(2);
    stop();
  });

  it("un ramassage RATÉ ne notifie pas", () => {
    // Sinon chaque pression infructueuse re-rendrait tout le monde de jeu.
    groundWeaponStore.drop("forge", arme([0, 0, 0]));
    let n = 0;
    const stop = groundWeaponStore.subscribe(() => { n++; });
    groundWeaponStore.take("forge", "inexistant");
    groundWeaponStore.clear("orbital");
    expect(n).toBe(0);
    stop();
  });

  it("la version change à chaque mutation — c'est le signal de useSyncExternalStore", () => {
    const v0 = groundWeaponStore.getVersion();
    groundWeaponStore.drop("forge", arme([0, 0, 0]));
    expect(groundWeaponStore.getVersion()).toBeGreaterThan(v0);
  });
});
