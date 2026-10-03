// ══════════════════════════════════════════════════════════════════════════════
// FpsCamera.tps.test.ts — Sonde de diagnostic P0 « TPS écran noir ».
//
// FpsCamera était le SEUL maillon de la chaîne caméra sans test, alors que son
// jumeau `camera/cameraPose.ts` (même formule d'orbite) en a. Ces tests
// verrouillent la moitié caméra du bug : si la position TPS calculée est saine,
// l'écran noir ne vient PAS du placement de caméra.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as THREE from "three";
import { FpsCamera } from "./FpsCamera";
import { createPlayerState } from "./playerState";
import { PLAYER_CONFIG as C } from "./playerConfig";
import { collisionWorld } from "../CollisionWorld";

/** Reproduit les conditions exactes du spawn forge : MAP_SPAWN.forge = [0,-26,10]. */
function spawnForge() {
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.3, 2000);
  const state = createPlayerState();
  const pos = new THREE.Vector3(0, -26, 10);
  return { cam, state, pos, rig: new FpsCamera() };
}

/**
 * Sol plein à y = -26, comme sous le point d'apparition de la Forge.
 *
 * Sans lui, `collisionWorld` est vide : l'anti-clip ne trouve aucun impact et
 * laisse passer la caméra. Le test « la caméra ne traverse pas le sol » n'aurait
 * alors aucun sol à ne pas traverser — il passerait pour de mauvaises raisons
 * avant le correctif comme après (cf. narvos-measure-first, règle 1).
 */
function installGround(y: number): void {
  const geo = new THREE.PlaneGeometry(400, 400);
  const ground = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  ground.rotation.x = -Math.PI / 2; // horizontal, normale vers +Y
  ground.position.set(0, y, 0);
  ground.updateMatrixWorld(true);
  collisionWorld.add(ground);
}

beforeEach(() => { collisionWorld.clear(); });
afterEach(() => { collisionWorld.clear(); });

describe("FpsCamera — vue TPS au spawn forge", () => {
  it("place la caméra à une position finie (aucun NaN)", () => {
    const { cam, state, pos, rig } = spawnForge();

    rig.apply(cam, state, pos, 1 / 60);

    expect(Number.isFinite(cam.position.x)).toBe(true);
    expect(Number.isFinite(cam.position.y)).toBe(true);
    expect(Number.isFinite(cam.position.z)).toBe(true);
  });

  it("place la caméra DERRIÈRE la tête, à la distance demandée", () => {
    const { cam, state, pos, rig } = spawnForge();
    // yaw=0 → le joueur regarde vers -Z, donc l'arrière est +Z.
    state.yaw = 0;
    state.pitch = 0;

    rig.apply(cam, state, pos, 1 / 60);

    const head = new THREE.Vector3(pos.x, pos.y + C.eyeHeight, pos.z);
    expect(cam.position.distanceTo(head)).toBeCloseTo(state.tpsDistance, 2);
    expect(cam.position.z).toBeGreaterThan(head.z); // bien derrière
  });

  it("ne laisse JAMAIS la caméra à l'origine du monde (0,0,0)", () => {
    // Une caméra restée en (0,0,0) alors que le joueur est à y=-26 regarderait
    // l'intérieur du terrain → écran noir. C'est le symptôme à exclure.
    const { cam, state, pos, rig } = spawnForge();

    rig.apply(cam, state, pos, 1 / 60);

    expect(cam.position.length()).toBeGreaterThan(1);
  });

  it("H3 — ne passe PAS sous les pieds du joueur quand il regarde vers le haut", () => {
    // Convention : PlayerRig fait `s.pitch -= look.dy * sensitivity`, donc
    // pitch > 0 = le joueur regarde vers le HAUT. L'orbite place alors la caméra
    // SOUS lui : `cam.y = head.y - sin(pitch) * d`.
    //
    // Au spawn forge (y = -26) le joueur est POSÉ sur le sol : tout ce qui passe
    // sous y = -26 est dans la roche. Sans anti-clip, la caméra y entre.
    const { cam, state, pos, rig } = spawnForge();
    installGround(pos.y);
    state.pitch = 1.5; // regard vers le haut (valeur clampée par applyTps)

    rig.apply(cam, state, pos, 1 / 60);

    expect(cam.position.y).toBeGreaterThanOrEqual(pos.y);
  });

  it("H3 — reste au-dessus du sol à TOUS les angles de regard", () => {
    // Sans le plancher, l'orbite passe sous les pieds dès
    // pitch > asin(eyeHeight / d) — soit 16,8° au spawn forge. C'était la
    // cause mesurée de l'écran noir. Balayer toute la plage vaut mieux que
    // tester le seuil : un correctif qui ne tiendrait qu'à un angle précis
    // serait un correctif qui ne tient pas.
    const seuilDeg = (Math.asin(C.eyeHeight / createPlayerState().tpsDistance) * 180) / Math.PI;
    const sousLeSol: string[] = [];

    for (let deg = -90; deg <= 90; deg += 5) {
      const { cam, state, pos, rig } = spawnForge();
      installGround(pos.y);
      state.pitch = (deg * Math.PI) / 180;
      state.yaw = 0.7; // yaw quelconque : le plancher ne doit pas en dépendre
      rig.apply(cam, state, pos, 1 / 60);
      if (cam.position.y < pos.y) sousLeSol.push(`${deg}° → y=${cam.position.y.toFixed(2)}`);
    }

    expect(
      sousLeSol,
      `Sans plancher, la caméra passait sous le sol dès ${seuilDeg.toFixed(1)}°. ` +
      `Angles encore fautifs : ${sousLeSol.join(", ")}`,
    ).toEqual([]);
  });

  it("ne reste pas verrouillée sur NaN après UNE frame de position invalide", () => {
    // `tpsSmoothed` est un accumulateur persistant : une seule frame NaN peut le
    // contaminer définitivement, alors que le FPS (position réécrite à chaque
    // frame) se répare tout seul. C'est exactement l'asymétrie FPS/TPS observée.
    const { cam, state, rig } = spawnForge();

    rig.apply(cam, state, new THREE.Vector3(NaN, NaN, NaN), 1 / 60);
    // Frames suivantes avec une position parfaitement valide :
    for (let i = 0; i < 30; i++) {
      rig.apply(cam, state, new THREE.Vector3(0, -26, 10), 1 / 60);
    }

    expect(Number.isFinite(cam.position.x)).toBe(true);
    expect(Number.isFinite(cam.position.y)).toBe(true);
    expect(Number.isFinite(cam.position.z)).toBe(true);
  });
});
