import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { mirrorBoneName, mirrorClip } from "./mirrorClip";

describe("mirrorBoneName", () => {
  it("échange les suffixes du rig UE Mannequin", () => {
    // Noms RELEVÉS dans les GLB d'avatars (Wraith, Trooper, Samurai).
    expect(mirrorBoneName("hand_l")).toBe("hand_r");
    expect(mirrorBoneName("hand_r")).toBe("hand_l");
    expect(mirrorBoneName("upperarm_l")).toBe("upperarm_r");
    expect(mirrorBoneName("clavicle_r")).toBe("clavicle_l");
  });

  it("échange aussi la convention Mixamo", () => {
    expect(mirrorBoneName("LeftFoot")).toBe("RightFoot");
    expect(mirrorBoneName("RightHand")).toBe("LeftHand");
  });

  it("laisse les os centraux intacts", () => {
    // Le bassin et la colonne n'ont pas de côté : les toucher tordrait le buste.
    for (const os of ["pelvis", "spine_01", "spine_02", "head", "neck_01", "root"]) {
      expect(mirrorBoneName(os), os).toBe(os);
    }
  });

  it("ne confond pas un `l`/`r` interne avec un suffixe", () => {
    // `spine_01` finit par `1`, pas par `_l` — mais un motif trop large sur la
    // lettre l attraperait `pelvis`. Garde-fou explicite.
    expect(mirrorBoneName("pelvis")).toBe("pelvis");
  });
});

describe("mirrorClip", () => {
  const piste = (nom: string, valeurs: number[], n: number) =>
    nom.includes("quaternion")
      ? new THREE.QuaternionKeyframeTrack(nom, Array.from({ length: n }, (_, i) => i), valeurs)
      : new THREE.VectorKeyframeTrack(nom, Array.from({ length: n }, (_, i) => i), valeurs);

  it("échange les os gauche et droite", () => {
    const c = new THREE.AnimationClip("kick", 1, [
      piste("thigh_r.position", [1, 2, 3], 1),
      piste("thigh_l.position", [4, 5, 6], 1),
    ]);
    const m = mirrorClip(c);
    expect(m.tracks.map((t) => t.name)).toEqual(["thigh_l.position", "thigh_r.position"]);
  });

  it("nie X en position, laisse Y et Z", () => {
    const c = new THREE.AnimationClip("k", 1, [piste("hand_r.position", [1, 2, 3], 1)]);
    const m = mirrorClip(c);
    expect(Array.from(m.tracks[0].values)).toEqual([-1, 2, 3]);
  });

  it("nie Y et Z du quaternion, PAS X ni W", () => {
    // Le piège central : nier X (par analogie avec la position) produit un
    // personnage à l'envers, pas en miroir. La réflexion par diag(-1,1,1)
    // s'écrit (x, y, z, w) → (x, -y, -z, w).
    const c = new THREE.AnimationClip("k", 1, [piste("hand_r.quaternion", [0.1, 0.2, 0.3, 0.9], 1)]);
    const m = mirrorClip(c);
    const v = Array.from(m.tracks[0].values);
    expect(v[0]).toBeCloseTo(0.1);   // x inchangé
    expect(v[1]).toBeCloseTo(-0.2);  // y nié
    expect(v[2]).toBeCloseTo(-0.3);  // z nié
    expect(v[3]).toBeCloseTo(0.9);   // w inchangé
  });

  it("le quaternion miroité reste normalisé", () => {
    // Une réflexion préserve la norme. Si ce test tombe, l'opération n'est plus
    // une rotation valide et Three produira des déformations.
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.7, 1.1)).normalize();
    const c = new THREE.AnimationClip("k", 1, [piste("hand_r.quaternion", [q.x, q.y, q.z, q.w], 1)]);
    const v = Array.from(mirrorClip(c).tracks[0].values);
    const norme = Math.hypot(v[0], v[1], v[2], v[3]);
    expect(norme).toBeCloseTo(1, 6);
  });

  it("ne modifie PAS le clip source", () => {
    // Les clips sont partagés entre tous les personnages : muter la source
    // miroiterait tout le monde.
    const c = new THREE.AnimationClip("k", 1, [piste("hand_r.position", [1, 2, 3], 1)]);
    mirrorClip(c);
    expect(Array.from(c.tracks[0].values)).toEqual([1, 2, 3]);
    expect(c.tracks[0].name).toBe("hand_r.position");
  });

  it("miroiter deux fois revient au clip d'origine", () => {
    // Propriété d'involution — le contrôle le plus fort sur la correction de
    // l'opération : elle doit être son propre inverse.
    const c = new THREE.AnimationClip("k", 1, [
      piste("thigh_r.quaternion", [0.1, 0.2, 0.3, 0.9], 1),
      piste("thigh_r.position", [1, 2, 3], 1),
    ]);
    const aller = mirrorClip(c);
    const retour = mirrorClip(aller);
    expect(retour.tracks.map((t) => t.name)).toEqual(c.tracks.map((t) => t.name));
    for (let i = 0; i < c.tracks.length; i++) {
      expect(Array.from(retour.tracks[i].values)).toEqual(Array.from(c.tracks[i].values));
    }
  });

  it("conserve la durée", () => {
    const c = new THREE.AnimationClip("k", 2.5, [piste("hand_r.position", [1, 2, 3], 1)]);
    expect(mirrorClip(c).duration).toBe(2.5);
  });
});
