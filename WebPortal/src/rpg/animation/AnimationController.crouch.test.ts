// AnimationController.crouch.test.ts — d'où vient l'abaissement en accroupi.
//
// ⚠️ CE FICHIER EXISTE POUR EMPÊCHER UNE « CORRECTION » QUI CASSERAIT LE JEU.
//
// L'audit A2 signale que le bassin ne descend jamais dans le squelette :
//   1. `remapOne` supprime TOUTES les pistes `.position` ;
//   2. le masque `legsOnly` exclut le bassin ;
//   3. le clip accroupi porte sa descente dans une piste `.position` de `Hips`.
// Les trois points sont EXACTS. La conclusion — « le crouch est cassé » — ne
// l'est pas.
//
// L'abaissement est restitué un cran plus haut, dans `OwnAnimPlayerCharacter` :
//   og.position.y -= CROUCH_PELVIS_DROP × baseScale × characterScale
//
// Et ce report est exact, pas approximatif. Mesuré par cinématique directe sur
// `Anim_Crouch_Idle_Hip` :
//
//     articulation   debout   accroupi   écart
//     bassin          0,968     0,595     0,373
//     genou           0,574     0,202     0,372
//     cheville        0,583     0,211     0,372
//     pointe          0,393     0,021     0,372
//
// Tous les points descendent du MÊME montant : la pose se translate en bloc, et
// un offset de groupe la reproduit exactement. Les rotations du clip plient les
// jambes, l'offset descend l'ensemble, les pieds retombent au sol.
//
// Ajouter en plus une descente d'os — en réinjectant la piste supprimée ou en
// laissant le bassin passer le masque — compterait l'abaissement DEUX FOIS
// (0,373 + ~0,21 ≈ 0,58 au lieu de 0,373, soit +57 %) et enfoncerait le
// personnage dans le sol. Les tests ci-dessous échouent si quelqu'un le fait.

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { AnimationController } from "./AnimationController";
import { maskClipToBones } from "./boneMask";

/** Rig humanoïde minimal, à l'échelle demandée (hauteur de hanche au repos). */
function makeRig(hipHeight: number): THREE.Object3D {
  const root = new THREE.Object3D();
  root.name = "Armature";

  const hips = new THREE.Bone();
  hips.name = "Hips";
  hips.position.set(0, hipHeight, 0);
  root.add(hips);

  // Chaîne des jambes, enfants du bassin — comme dans un vrai squelette.
  for (const side of ["Left", "Right"]) {
    const upLeg = new THREE.Bone();
    upLeg.name = `${side}UpLeg`;
    const leg = new THREE.Bone();
    leg.name = `${side}Leg`;
    const foot = new THREE.Bone();
    foot.name = `${side}Foot`;
    leg.add(foot);
    upLeg.add(leg);
    hips.add(upLeg);
  }

  const spine = new THREE.Bone();
  spine.name = "Spine";
  hips.add(spine);

  return root;
}

/** Un clip quelconque, juste pour que le contrôleur ait de quoi travailler. */
function idleClip(): THREE.AnimationClip {
  const track = new THREE.QuaternionKeyframeTrack(
    "Spine.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1],
  );
  return new THREE.AnimationClip("idle", 1, [track]);
}

describe("Accroupi — une seule source d'abaissement", () => {
  it("le clip du JOUEUR ne porte AUCUNE descente de bassin (c'est voulu)", () => {
    // `avatarKey` active le remap, qui supprime les pistes `.position`.
    // L'abaissement vient de l'offset de groupe, pas de l'os.
    const ctrl = new AnimationController(makeRig(1.11), [idleClip()], {
      avatarKey: "joueur",
    });

    // Si ce test devient rouge, quelqu'un a réinjecté une descente d'os : elle
    // s'AJOUTERA à `CROUCH_PELVIS_DROP` et le personnage s'enfoncera de ~57 %
    // de trop. Relire l'en-tête de ce fichier avant de « corriger » le test.
    expect(ctrl.crouchPelvisDrop).toBe(0);
  });

  it("le constat reste vrai quelle que soit l'échelle du rig", () => {
    for (const hipHeight of [0.9, 1.11, 96]) {
      const ctrl = new AnimationController(makeRig(hipHeight), [idleClip()], {
        avatarKey: `rig_${hipHeight}`,
      });
      expect(ctrl.crouchPelvisDrop).toBe(0);
    }
  });
});

describe("boneMask — le bassin est exclu, et doit le rester", () => {
  function clipWithPelvis(): THREE.AnimationClip {
    return new THREE.AnimationClip("pose", 1, [
      new THREE.VectorKeyframeTrack("Hips.position", [0, 1], [0, 0, 0, 0, -0.25, 0]),
      new THREE.QuaternionKeyframeTrack("Hips.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      new THREE.QuaternionKeyframeTrack("Spine.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      new THREE.QuaternionKeyframeTrack("LeftUpLeg.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);
  }

  it("legsOnly bloque la ROTATION du bassin et de la colonne", () => {
    // Raison d'être du masque : une rotation additive se MULTIPLIE avec celle du
    // dessous, et sur le bassin elle se propage à toute la chaîne (vrille).
    const names = maskClipToBones(clipWithPelvis(), "legsOnly").tracks.map((t) => t.name);
    expect(names).not.toContain("Hips.quaternion");
    expect(names).not.toContain("Spine.quaternion");
  });

  it("legsOnly bloque AUSSI la position du bassin — anti-double-comptage", () => {
    // Tentant à corriger (« mais c'est elle qui abaisse le personnage ! »), et
    // c'est un piège : l'abaissement est déjà appliqué au groupe. Cf. en-tête.
    const names = maskClipToBones(clipWithPelvis(), "legsOnly").tracks.map((t) => t.name);
    expect(names).not.toContain("Hips.position");
  });

  it("legsOnly garde les jambes", () => {
    const names = maskClipToBones(clipWithPelvis(), "legsOnly").tracks.map((t) => t.name);
    expect(names).toContain("LeftUpLeg.quaternion");
  });
});
