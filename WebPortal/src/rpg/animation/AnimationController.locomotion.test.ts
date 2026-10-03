// AnimationController.locomotion.test.ts — recalage de phase du blend directionnel.
//
// Couvre le bug A1 : « crouchwalk en diagonale = pose figée ».
//
// Le solveur de locomotion raisonne sur 8 directions ; l'accroupi ne dispose que
// de 4 clips. `CROUCH_FALLBACK` répartit donc `forwardRight` sur `forward` +
// `right`. Ce repli existait déjà pour les POIDS — mais la recherche du clip
// DOMINANT, elle, interrogeait toujours la direction brute (`crouchwalk_forwardRight`,
// inexistant). Elle rendait `null`, `phase` valait 0, et le bloc de recalage
// remettait à `time = 0` tout clip non-dominant : les deux clips accroupis, au
// bon poids, restaient épinglés sur leur première image.
//
// ⚠️ Piège de rédaction : dans une boucle `setLocomotionBlend()` puis
// `update(dt)`, le mixer fait avancer le clip de `dt` APRÈS le recalage. Une
// assertion `time > 0` passe donc même quand le bug est présent. Il faut
// comparer le playhead au temps réellement SIMULÉ.

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { AnimationController } from "./AnimationController";

const DT = 1 / 60;
const CLIP_DURATION = 4; // > temps simulé, pour ne pas boucler pendant le test

/** Clip réel mais minimal : une piste de position sur un nœud nommé. */
function makeClip(name: string): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    "Bone.position",
    [0, CLIP_DURATION],
    [0, 0, 0, 0, 1, 0],
  );
  return new THREE.AnimationClip(name, CLIP_DURATION, [track]);
}

function makeRig(): THREE.Object3D {
  const root = new THREE.Object3D();
  const bone = new THREE.Object3D();
  bone.name = "Bone";
  root.add(bone);
  return root;
}

const CARDINALS = ["forward", "back", "left", "right"] as const;
const DIAGONALS = ["forwardRight", "forwardLeft", "backRight", "backLeft"] as const;

/** Accroupi : 4 clips seulement, comme `CROUCH_LOCOMOTION` en production. */
const crouchClips = () => CARDINALS.map((d) => makeClip(`crouchwalk_${d}`));

/** Debout : les 8 directions existent, aucun repli nécessaire. */
const walkClips = () =>
  [...CARDINALS, ...DIAGONALS].map((d) => makeClip(`walk_${d}`));

/** Fait tourner N frames et rend le temps simulé. */
function run(
  ctrl: AnimationController,
  dir: string,
  gait: "walk" | "run" | "crouchwalk",
  frames: number,
): number {
  for (let i = 0; i < frames; i++) {
    ctrl.setLocomotionBlend([{ dir, weight: 1 }], gait, 1, DT);
    ctrl.update(DT);
  }
  return frames * DT;
}

describe("setLocomotionBlend — recalage de phase", () => {
  it("accroupi en diagonale : le poids est réparti sur les deux cardinales", () => {
    const ctrl = new AnimationController(makeRig(), crouchClips());
    run(ctrl, "forwardRight", "crouchwalk", 30);

    const names = ctrl.activeLocomotion.map((a) => a.name).sort();
    expect(names).toEqual(["crouchwalk_forward", "crouchwalk_right"]);
  });

  it("accroupi en diagonale : les clips AVANCENT au lieu de rester à la frame 0", () => {
    const ctrl = new AnimationController(makeRig(), crouchClips());
    const frames = 60;
    const elapsed = run(ctrl, "forwardRight", "crouchwalk", frames);

    const active = ctrl.activeLocomotion;
    expect(active.length).toBe(2);

    // Avec le bug, chaque clip était remis à 0 puis avancé d'UNE frame :
    // `time` plafonnait à DT (~0,0167 s) quel que soit le nombre de frames.
    // On exige donc un playhead comparable au temps simulé, pas simplement > 0.
    for (const a of active) {
      expect(a.time).toBeGreaterThan(elapsed * 0.5);
      expect(a.time).toBeLessThanOrEqual(elapsed + DT);
    }
  });

  it("les deux clips accroupis restent en PHASE (appuis non croisés)", () => {
    const ctrl = new AnimationController(makeRig(), crouchClips());
    run(ctrl, "forwardRight", "crouchwalk", 60);

    const [a, b] = ctrl.activeLocomotion;
    // Même durée de clip des deux côtés → le recalage doit les garder collés.
    expect(Math.abs(a.time - b.time)).toBeLessThan(DT * 2);
  });

  it("chaque diagonale accroupie se répartit sur ses deux voisines", () => {
    const attendu: Record<string, string[]> = {
      forwardRight: ["crouchwalk_forward", "crouchwalk_right"],
      forwardLeft: ["crouchwalk_forward", "crouchwalk_left"],
      backRight: ["crouchwalk_back", "crouchwalk_right"],
      backLeft: ["crouchwalk_back", "crouchwalk_left"],
    };

    for (const dir of DIAGONALS) {
      const ctrl = new AnimationController(makeRig(), crouchClips());
      const elapsed = run(ctrl, dir, "crouchwalk", 60);
      const active = ctrl.activeLocomotion;

      expect(active.map((a) => a.name).sort()).toEqual(attendu[dir]);
      for (const a of active) expect(a.time).toBeGreaterThan(elapsed * 0.5);
    }
  });

  it("accroupi en cardinale : un seul clip, qui avance (cas déjà sain)", () => {
    const ctrl = new AnimationController(makeRig(), crouchClips());
    const elapsed = run(ctrl, "forward", "crouchwalk", 60);

    const active = ctrl.activeLocomotion;
    expect(active.map((a) => a.name)).toEqual(["crouchwalk_forward"]);
    expect(active[0].time).toBeGreaterThan(elapsed * 0.5);
  });

  it("debout en diagonale : témoin — les 8 clips existent, rien à replier", () => {
    // Ce cas passait DÉJÀ avant le correctif : `walk_forwardRight` existe, donc
    // la recherche du dominant aboutissait. Il vaut ici comme témoin — il prouve
    // que le harnais de test est sain et que la panne était propre à l'accroupi.
    const ctrl = new AnimationController(makeRig(), walkClips());
    const elapsed = run(ctrl, "forwardRight", "walk", 60);

    const active = ctrl.activeLocomotion;
    expect(active.map((a) => a.name)).toEqual(["walk_forwardRight"]);
    expect(active[0].time).toBeGreaterThan(elapsed * 0.5);
  });
});
