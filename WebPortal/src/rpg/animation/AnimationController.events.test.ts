// AnimationController.events.test.ts — cadence des Animation Events en overlay.
//
// Couvre le bug A3 : « les events d'overlay sont cadencés par la locomotion ».
//
// `playOverlay()` joue un clip upper-body qui vit dans `upperBodyActions`, et ne
// touche JAMAIS `this.current`. Deux conséquences se cumulaient :
//   • `armEvents(action)` calait le curseur sur `actions.get(action)` — l'action
//     FULL-BODY du même nom, qui ne tourne pas : horloge arrêtée ;
//   • `update()` lisait le playhead de `actions.get(this.current)`, donc du clip
//     de marche ou d'idle en cours.
// Un recul de caméra réglé à 30 % du clip d'attaque partait donc à 30 % du PAS.
//
// Le test rend la différence flagrante : on laisse l'idle tourner à mi-cycle
// AVANT de déclencher l'attaque. Avec le bug, `norm` vaut d'emblée 0,5 > 0,30 et
// l'event part à la première frame. Avec le correctif, il attend que l'attaque
// elle-même ait atteint 30 %.

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { AnimationController } from "./AnimationController";
import type { AnimEvent } from "./animEvents";

const IDLE_DURATION = 10;
const ATTACK_DURATION = 1;
/** `ANIM_EVENTS.attack` déclenche un recul à 30 % du clip. */
const ATTACK_EVENT_AT = 0.3;

function makeRig(): THREE.Object3D {
  const root = new THREE.Object3D();
  for (const name of ["Spine", "LeftUpLeg", "RightUpLeg"]) {
    const b = new THREE.Bone();
    b.name = name;
    root.add(b);
  }
  return root;
}

function quatTrack(bone: string, dur: number): THREE.QuaternionKeyframeTrack {
  return new THREE.QuaternionKeyframeTrack(
    `${bone}.quaternion`, [0, dur], [0, 0, 0, 1, 0, 0, 0, 1],
  );
}

function makeClips(): THREE.AnimationClip[] {
  return [
    new THREE.AnimationClip("idle", IDLE_DURATION, [quatTrack("Spine", IDLE_DURATION)]),
    // L'attaque DOIT porter des pistes jambes : `stripLowerBodyTracks` ne produit
    // un clip upper-body distinct que s'il a quelque chose à retirer. Sans ça,
    // `upperBodyActions` reste vide et `playOverlay` retombe sur `play()`.
    new THREE.AnimationClip("attack", ATTACK_DURATION, [
      quatTrack("Spine", ATTACK_DURATION),
      quatTrack("LeftUpLeg", ATTACK_DURATION),
      quatTrack("RightUpLeg", ATTACK_DURATION),
    ]),
  ];
}

function setup() {
  const fired: AnimEvent[] = [];
  const ctrl = new AnimationController(makeRig(), makeClips(), {
    onEvent: (ev) => fired.push(ev),
  });
  return { ctrl, fired };
}

/** Avance de `seconds` par pas de 1/60 s, comme la boucle de jeu. */
function advance(ctrl: AnimationController, seconds: number): void {
  const dt = 1 / 60;
  for (let t = 0; t < seconds - 1e-9; t += dt) ctrl.update(dt);
}

describe("Animation Events — overlay upper-body", () => {
  it("l'event d'attaque ne part PAS tant que l'attaque n'a pas atteint son seuil", () => {
    const { ctrl, fired } = setup();

    ctrl.play("idle");
    advance(ctrl, IDLE_DURATION / 2); // idle à 50 % de son cycle
    expect(fired).toHaveLength(0);

    ctrl.playOverlay("attack");
    // 20 % du clip d'attaque — sous le seuil de 30 %.
    advance(ctrl, ATTACK_DURATION * 0.2);

    // Avec le bug, le playhead lu était celui de l'idle (norm = 0,5 > 0,30) et
    // l'event partait dès la première frame après `playOverlay`.
    expect(fired).toHaveLength(0);
  });

  it("l'event part quand l'ATTAQUE franchit son seuil, une seule fois", () => {
    const { ctrl, fired } = setup();

    ctrl.play("idle");
    advance(ctrl, IDLE_DURATION / 2);
    ctrl.playOverlay("attack");

    advance(ctrl, ATTACK_DURATION * (ATTACK_EVENT_AT + 0.1));
    expect(fired).toHaveLength(1);
    expect(fired[0].type).toBe("recoil");
    expect(fired[0].at).toBe(ATTACK_EVENT_AT);
  });

  it("l'event ne se redéclenche pas après la fin de l'overlay", () => {
    const { ctrl, fired } = setup();

    ctrl.play("idle");
    ctrl.playOverlay("attack");

    // Bien au-delà de la durée du clip d'attaque : l'overlay se termine, son
    // action continue de tourner pendant le fondu. Sans désarmement explicite,
    // un playhead qui repasse par 0 relancerait l'event.
    advance(ctrl, ATTACK_DURATION * 4);
    expect(fired).toHaveLength(1);
  });

  it("aucun event pour une action qui n'en déclare pas", () => {
    const { ctrl, fired } = setup();

    ctrl.play("idle");
    advance(ctrl, IDLE_DURATION);
    expect(fired).toHaveLength(0);
  });
});
