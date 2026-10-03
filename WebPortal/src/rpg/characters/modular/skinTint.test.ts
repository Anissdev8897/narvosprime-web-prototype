// skinTint.test.ts — teinte de peau : isolation des matériaux et non-dérive.
//
// Les deux tests qui comptent sont « ne touche pas le matériau d'origine » et
// « ne dérive pas » : ce sont deux corruptions silencieuses. La première teinte
// tous les personnages partageant le GLB, la seconde assombrit le personnage un
// peu plus à chaque changement de pastille.

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { isSkinSlot, prepareTintable, applyTint, isNeutralTint, EYE_MATERIAL, isIrisMaterial } from "./skinTint";

// ══════════════════════════════════════════════════════════════════════════════
// Reconnaissance de l'iris — noms RÉELS relevés dans les corps Biker
// (`scripts/check-eye-and-slider-bones.mjs`), pas des noms inventés.
//
// `EYE_MATERIAL = "Eyes"` ne correspondait à aucun d'eux : la couleur des yeux
// ne s'appliquait à rien, sur les deux genres, sans la moindre erreur.
// ══════════════════════════════════════════════════════════════════════════════

describe("isIrisMaterial", () => {
  it("reconnaît l'iris des deux corps de base", () => {
    expect(isIrisMaterial("M_EyeRefractive_SK_ma_UE5_meta_body")).toBe(true);
    expect(isIrisMaterial("MI_eye_Brown_SK_fe_UE5_meta_body_muscular_IK")).toBe(true);
  });

  it("écarte les leurres qui contiennent aussi « eye »", () => {
    // Les teinter colorerait les cils et l'ombre de l'orbite en bleu.
    expect(isIrisMaterial("MI_eyelashes_dark_SK_ma_UE5_meta_body")).toBe(false);
    expect(isIrisMaterial("MI_ma_eye_occlusion")).toBe(false);
    expect(isIrisMaterial("M_eye_occlusion")).toBe(false);
    expect(isIrisMaterial("MI_tearline_SK_fe_UE5_meta_body_muscular_IK")).toBe(false);
  });

  it("laisse la peau et les dents en dehors", () => {
    expect(isIrisMaterial("MI_ma_body_tatoo_v1")).toBe(false);
    expect(isIrisMaterial("MI_teeth")).toBe(false);
  });

  it("un iris BRUN reste un iris — « Brown » n'est pas « eyebrow »", () => {
    // Premier jet du prédicat : il excluait `/brow/`, donc `MI_eye_Brown_…`
    // — l'iris féminin — était rejeté. Un sourcil s'écrit `eyebrow` en entier.
    expect(isIrisMaterial("MI_eye_Brown_SK_fe_UE5_meta_body_muscular_IK")).toBe(true);
    expect(isIrisMaterial("MI_eyebrow_dark")).toBe(false);
  });

  it("mode `flat` : la teinte remplace la texture, pupille comprise", () => {
    // La pupille est NOIRE dans la texture d'iris. En multipliant, `0 × teinte`
    // reste `0` : elle ne pouvait pas changer de couleur. `flat` écarte la
    // texture, donc la teinte couvre tout le matériau.
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ name: "MI_eye_Brown_x", map: new THREE.Texture() }),
    );
    const root = new THREE.Group();
    root.add(mesh);
    prepareTintable(root);

    const mat = () => mesh.material as THREE.MeshStandardMaterial;
    expect(mat().map, "texture absente au départ").toBeTruthy();

    applyTint(root, "#2255ff", { onlyMatch: isIrisMaterial, flat: true });
    expect(mat().map, "la texture masque encore la pupille").toBeNull();
    expect(mat().color.getHexString()).toBe("2255ff");
  });

  it("mode `flat` : une teinte NEUTRE rend la texture d'origine", () => {
    // Sans ça, revenir à « couleur d'origine » laisserait un œil peint en aplat.
    const tex = new THREE.Texture();
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ name: "M_EyeRefractive_x", map: tex }),
    );
    const root = new THREE.Group();
    root.add(mesh);
    prepareTintable(root);

    applyTint(root, "#2255ff", { onlyMatch: isIrisMaterial, flat: true });
    applyTint(root, "#ffffff", { onlyMatch: isIrisMaterial, flat: true });

    expect((mesh.material as THREE.MeshStandardMaterial).map, "texture non restaurée").toBe(tex);
  });

  it("EYE_MATERIAL correspondrait au motif, mais n'existe dans AUCUN corps", () => {
    // Le nom est plausible — c'est pour ça que le défaut a survécu si longtemps.
    // Ce qui manquait n'était pas le motif, c'était de vérifier les noms réels.
    expect(isIrisMaterial(EYE_MATERIAL)).toBe(true);
  });
});

/** Mesh portant un matériau PARTAGÉ, comme après `SkeletonUtils.clone`. */
function sceneWithSharedMaterial(shared: THREE.MeshStandardMaterial): THREE.Object3D {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), shared);
  root.add(mesh);
  return root;
}

describe("isSkinSlot", () => {
  it("l'anatomie est de la peau", () => {
    for (const s of ["body", "head", "torso", "arms", "hands", "legs", "feet"] as const) {
      expect(isSkinSlot(s), s).toBe(true);
    }
  });

  it("cheveux et barbe ne sont PAS de la peau", () => {
    // Sinon la teinte du visage colorerait aussi la chevelure — deux réglages
    // distincts qui n'ont aucune raison de partager une couleur.
    expect(isSkinSlot("hair")).toBe(false);
    expect(isSkinSlot("beard")).toBe(false);
  });

  it("les vêtements relèvent de `tint`, pas de `skinTint`", () => {
    for (const s of ["top", "pants", "shoes", "gloves", "headwear"] as const) {
      expect(isSkinSlot(s), s).toBe(false);
    }
  });
});

describe("prepareTintable", () => {
  it("détache le matériau de l'original partagé", () => {
    // LE test : `SkeletonUtils.clone` partage les matériaux avec le cache de
    // `useGLTF`. Sans clonage, teinter un personnage teinterait tous les autres
    // utilisant le même GLB — y compris les PNJ du monde.
    const partagé = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const scène = sceneWithSharedMaterial(partagé);

    prepareTintable(scène);
    applyTint(scène, "#ff0000");

    expect(partagé.color.getHex()).toBe(0xffffff);
  });

  it("mémorise la couleur d'origine", () => {
    const scène = sceneWithSharedMaterial(new THREE.MeshStandardMaterial({ color: 0x808080 }));
    expect(prepareTintable(scène)).toBe(1);
    const m = (scène.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect((m.userData.narvosBaseColor as THREE.Color).getHex()).toBe(0x808080);
  });

  it("est idempotent — une 2e passe ne re-mémorise pas la couleur teintée", () => {
    // Sinon la teinte courante deviendrait la nouvelle référence, et revenir au
    // neutre ne restaurerait jamais l'aspect d'origine.
    const scène = sceneWithSharedMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff }));
    prepareTintable(scène);
    applyTint(scène, "#804020");
    expect(prepareTintable(scène)).toBe(0);

    applyTint(scène, "#ffffff");
    const m = (scène.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(m.color.getHex()).toBe(0xffffff);
  });

  it("ignore un matériau sans couleur", () => {
    // `MeshNormalMaterial` n'expose aucun `color`. (`ShadowMaterial`, lui, en a
    // un — vérifié : il sert à colorer l'ombre projetée.)
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial()));
    expect(prepareTintable(root)).toBe(0);
  });

  it("traite les meshes multi-matériaux", () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), [
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
    ]));
    expect(prepareTintable(root)).toBe(2);
  });
});

describe("applyTint", () => {
  it("multiplie au lieu d'écraser", () => {
    // La couleur du matériau multiplie sa texture. L'affecter écraserait le
    // facteur d'origine des assets UE et aplatirait le rendu.
    const scène = sceneWithSharedMaterial(new THREE.MeshStandardMaterial({ color: 0x808080 }));
    prepareTintable(scène);
    applyTint(scène, "#ffffff");
    const m = (scène.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(m.color.getHex()).toBe(0x808080);
  });

  it("ne dérive pas entre deux applications successives", () => {
    // Multiplier sans repartir de la base : 0,5 × 0,5 = 0,25 — le personnage
    // s'assombrirait à chaque clic sur une pastille.
    const scène = sceneWithSharedMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff }));
    prepareTintable(scène);

    applyTint(scène, "#808080");
    const après1 = ((scène.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex();
    applyTint(scène, "#808080");
    const après2 = ((scène.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex();

    expect(après2).toBe(après1);
  });

  it("revenir au neutre restaure l'aspect d'origine", () => {
    const scène = sceneWithSharedMaterial(new THREE.MeshStandardMaterial({ color: 0xc0a080 }));
    prepareTintable(scène);
    applyTint(scène, "#3050ff");
    applyTint(scène, "#ffffff");
    const m = (scène.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(m.color.getHex()).toBe(0xc0a080);
  });

  it("ne fait rien sur un sous-arbre non préparé", () => {
    // Garde-fou d'ordre : teinter sans préparer écrirait sur le matériau partagé.
    const partagé = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const scène = sceneWithSharedMaterial(partagé);
    expect(applyTint(scène, "#ff0000")).toBe(0);
    expect(partagé.color.getHex()).toBe(0xffffff);
  });

  it("teinte les SkinnedMesh comme les Mesh", () => {
    const root = new THREE.Group();
    const sm = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    root.add(sm);
    prepareTintable(root);
    expect(applyTint(root, "#ff0000")).toBe(1);
    expect((sm.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
  });
});

describe("filtre par matériau — peau et yeux sur le même maillage", () => {
  /** Corps de base : deux primitives, deux matériaux, un seul sous-arbre. */
  function corpsAvecYeux() {
    const root = new THREE.Group();
    const peau = new THREE.MeshStandardMaterial({ color: 0xffffff });
    peau.name = "Body";
    const yeux = new THREE.MeshStandardMaterial({ color: 0xffffff });
    yeux.name = EYE_MATERIAL;
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), peau));
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), yeux));
    prepareTintable(root);
    return root;
  }

  const matOf = (root: THREE.Object3D, i: number) =>
    (root.children[i] as THREE.Mesh).material as THREE.MeshStandardMaterial;

  it("la teinte de peau ne colore PAS les yeux", () => {
    // Sans le filtre, impossible d'avoir un teint sombre et des yeux clairs :
    // les deux primitives partagent le même sous-arbre.
    const root = corpsAvecYeux();
    applyTint(root, "#804020", { except: [EYE_MATERIAL] });

    expect(matOf(root, 0).color.getHex()).not.toBe(0xffffff);   // peau teintée
    expect(matOf(root, 1).color.getHex()).toBe(0xffffff);       // yeux intacts
  });

  it("la teinte d'yeux ne colore QUE les yeux", () => {
    const root = corpsAvecYeux();
    applyTint(root, "#2255ff", { only: [EYE_MATERIAL] });

    expect(matOf(root, 0).color.getHex()).toBe(0xffffff);       // peau intacte
    expect(matOf(root, 1).color.getHex()).toBe(0x2255ff);       // yeux teintés
  });

  it("les deux teintes coexistent sans s'écraser", () => {
    const root = corpsAvecYeux();
    applyTint(root, "#804020", { except: [EYE_MATERIAL] });
    applyTint(root, "#2255ff", { only: [EYE_MATERIAL] });

    expect(matOf(root, 0).color.getHex()).toBe(0x804020);
    expect(matOf(root, 1).color.getHex()).toBe(0x2255ff);
  });

  it("changer la peau ne réinitialise pas les yeux", () => {
    // Chaque teinte repart de SA couleur mémorisée, pas de l'état courant.
    const root = corpsAvecYeux();
    applyTint(root, "#2255ff", { only: [EYE_MATERIAL] });
    applyTint(root, "#f3d3bd", { except: [EYE_MATERIAL] });
    applyTint(root, "#5c3a21", { except: [EYE_MATERIAL] });

    expect(matOf(root, 1).color.getHex()).toBe(0x2255ff);
  });

  it("sans filtre, tout est teinté — comportement historique préservé", () => {
    const root = corpsAvecYeux();
    expect(applyTint(root, "#ff0000")).toBe(2);
  });

  it("un nom de matériau inconnu ne teinte rien", () => {
    const root = corpsAvecYeux();
    expect(applyTint(root, "#ff0000", { only: ["Inexistant"] })).toBe(0);
  });
});

describe("isNeutralTint", () => {
  it("reconnaît le blanc sous ses différentes écritures", () => {
    expect(isNeutralTint("#ffffff")).toBe(true);
    expect(isNeutralTint("#FFFFFF")).toBe(true);
    expect(isNeutralTint("white")).toBe(true);
  });

  it("rejette toute autre couleur", () => {
    expect(isNeutralTint("#fffffe")).toBe(false);
    expect(isNeutralTint("#000000")).toBe(false);
  });
});
