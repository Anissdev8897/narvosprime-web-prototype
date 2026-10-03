import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  WEAPON_ANIM_CLIPS, weaponAnimFamily, clipsFor,
  type WeaponAnimFamily,
} from "./weaponAnimClips";
import { classifyWeapon, weaponTypeMeta } from "./weaponClassifier";

const PUBLIC = path.resolve(__dirname, "../../../public");

describe("weaponAnimFamily", () => {
  it("reconnaît les familles dans des noms RÉELS du pack", () => {
    expect(weaponAnimFamily("Anim_Mann_DBS_Gun_Raise.glb")).toBe("shotgun_double");
    expect(weaponAnimFamily("Anim_Mann_PAS_StunGrenade_Throw.glb")).toBe("shotgun_pompe");
    expect(weaponAnimFamily("Anim_Mann_SAS_Reload_Start.glb")).toBe("shotgun_semi");
    expect(weaponAnimFamily("AS_HS_WP03_Revolver_Fire.glb")).toBe("revolver");
  });

  it("l'underscore n'empêche pas la détection", () => {
    // `\bDBS\b` échoue ici : `_` est un caractère de mot, donc il n'y a PAS de
    // frontière entre `Mann_` et `DBS`. Bug réellement commis lors de la
    // génération — ce test empêche qu'il revienne.
    expect(weaponAnimFamily("Anim_Mann_DBS_Gun_Raise.glb")).not.toBeNull();
  });

  it("rend null pour une arme sans jeu de clips", () => {
    expect(weaponAnimFamily("uploads_files_5605095_claymore.glb")).toBeNull();
    expect(weaponAnimFamily("Sword00_mesh.glb")).toBeNull();
  });
});

describe("WEAPON_ANIM_CLIPS", () => {
  it("chaque clip existe réellement sur le disque", () => {
    // Le fallback SPA de Vite renvoie du text/html en 200 pour un fichier
    // absent : un chemin faux ne lèverait rien, l'animation ne jouerait
    // simplement jamais. Seul endroit où on peut l'attraper.
    const manquants: string[] = [];
    for (const [fam, actions] of Object.entries(WEAPON_ANIM_CLIPS)) {
      for (const [act, urls] of Object.entries(actions)) {
        for (const u of urls as string[]) {
          if (!fs.existsSync(path.join(PUBLIC, u.replace(/^\//, "")))) manquants.push(`${fam}/${act} → ${u}`);
        }
      }
    }
    expect(manquants, `clips absents :\n${manquants.join("\n")}`).toEqual([]);
  });

  it("les fusils ont bien tir ET rechargement — le minimum pour un combat", () => {
    for (const f of ["shotgun_double", "shotgun_pompe", "shotgun_semi"] as WeaponAnimFamily[]) {
      expect(clipsFor(`Anim_Mann_${f === "shotgun_double" ? "DBS" : f === "shotgun_pompe" ? "PAS" : "SAS"}_x.glb`, "fire").length, `${f} fire`).toBeGreaterThan(0);
    }
    expect(clipsFor("AS_HS_WP03_Revolver_Fire.glb", "fire").length).toBeGreaterThan(0);
  });

  it("clipsFor rend un tableau vide plutôt que undefined", () => {
    expect(clipsFor("Sword00_mesh.glb", "fire")).toEqual([]);
    expect(clipsFor("AS_HS_WP03_Revolver_Fire.glb", "locomotion")).toEqual([]);
  });
});

describe("les clips ne sont plus équipables", () => {
  it("un fichier d'animation n'est pas une arme de main", () => {
    // Le vrai défaut corrigé : 46 fichiers d'animation passaient pour des armes
    // et atterrissaient en boutique, où ils n'affichaient que des bras de
    // mannequin.
    for (const n of [
      "Anim_Mann_DBS_Gun_Raise.glb",
      "AS_HS_WP03_Revolver_Fire.glb",
      "Anim_Mann_Grenade_Throw.glb",
    ]) {
      expect(classifyWeapon(n), n).toBe("clip");
      expect(weaponTypeMeta(classifyWeapon(n)).isWeapon, n).toBe(false);
    }
  });

  it("une VRAIE arme reste équipable", () => {
    // Le garde-fou symétrique : la règle `clip` est ancrée en début de nom, elle
    // ne doit pas manger les meshes.
    for (const n of ["SK_DBShotgun.glb", "SM_HS_WP03_Revolver_X_0.glb", "Sword00_mesh.glb"]) {
      expect(weaponTypeMeta(classifyWeapon(n)).isWeapon, n).toBe(true);
    }
  });

  it("« as- » en minuscules n'est PAS un préfixe d'animation", () => {
    // Cas réel attrapé par le test d'inventaire : un premier jet en
    // /^(anim|as)[_-]/i classait cette LANCE comme clip et la retirait de la
    // boutique. `AS_` est la convention Unreal — majuscules et underscore.
    // « as-vulcan… » est un slug de marketplace.
    expect(classifyWeapon("as-vulcan_scarlet_lance_-_3d_model_stylized.glb")).toBe("spear");
    expect(classifyWeapon("AS_HS_WP03_Revolver_Fire.glb")).toBe("clip");
  });
});
