// ══════════════════════════════════════════════════════════════════════════════
// movement/FpsCamera.ts — Logique caméra PURE (FPS + TPS optionnel)
//
// Ne capture AUCUN input (c'est le rôle de l'InputManager). Reçoit l'état + la
// position et positionne/oriente la caméra. FPS = à hauteur des yeux + head-bob ;
// TPS = orbite derrière avec collision anti-clip mur (CollisionWorld).
// Ordre de rotation attendu sur la caméra : "YXZ" (réglé par le rig).
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { PLAYER_CONFIG as C } from "./playerConfig";
import type { PlayerState } from "./playerState";
import { collisionWorld } from "../CollisionWorld";
import { cameraOffsetStore } from "../../characters/cameraOffset";
import { characterScaleStore } from "../../characters/characterScale";
import { cameraCollisionStore } from "../../characters/cameraCollision";
import { screenShake } from "../screenShake";
import { cameraRecoil } from "../../camera/CameraRecoilController";


// Vitesse de lissage de la position TPS (1/s — plus grand = plus réactif).
// 14 ≈ 70 ms pour atteindre 63% de la cible (smoothing perceptible mais réactif).
const TPS_POSITION_LERP = 14;

/**
 * Garde verticale entre le sol et la caméra TPS, en mètres.
 *
 * Assez pour que le plan de coupe proche (`near` = 0.3) ne rase pas le sol et
 * ne laisse pas apparaître l'intérieur des faces.
 */
const CAMERA_GROUND_CLEARANCE = 0.35;

const TMP_HEAD = new THREE.Vector3();
const TMP_DESIRED = new THREE.Vector3();

/** `true` si les trois composantes sont exploitables (ni NaN, ni ±Infinity). */
function isFiniteVec(v: THREE.Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export class FpsCamera {
  private bobPhase = 0;
  private shakePhase = 0;
  // Position TPS lissée (init à null = première frame → snap)
  private tpsSmoothed: THREE.Vector3 | null = null;

  apply(cam: THREE.PerspectiveCamera, state: PlayerState, pos: THREE.Vector3, dt: number): void {
    if (state.view === "tps") {
      this.applyTps(cam, state, pos, dt);
    } else {
      this.applyFps(cam, state, pos, dt);
      this.tpsSmoothed = null; // reset → snap clean au prochain passage TPS
    }
    this.applyShake(cam, dt); // game juice : tremblement sur impact (après positionnement)
  }

  /**
   * Ajoute un offset de tremblement à la caméra DÉJÀ positionnée/orientée.
   * Coût nul quand il n'y a pas de trauma (court-circuit). Mélange une secousse
   * de position (kick) + un léger roulis (rotation.z) → sensation d'impact.
   */
  private applyShake(cam: THREE.PerspectiveCamera, dt: number): void {
    // ── 1) Recul DIRECTIONNEL piloté par animation (Animation Events → impulses) ──
    // Appliqué en repère caméra LOCAL : rotation ajoutée à l'orientation courante,
    // position via translate* (suit le regard). Synchro frame-exacte avec l'anim.
    const recoil = cameraRecoil.tick(dt);
    if (recoil.active) {
      cam.rotation.x += recoil.rot.x;
      cam.rotation.y += recoil.rot.y;
      cam.rotation.z += recoil.rot.z;
      cam.translateX(recoil.pos.x);
      cam.translateY(recoil.pos.y);
      cam.translateZ(recoil.pos.z); // z+ = caméra reculée (regard vers -Z)
    }

    // ── 2) Tremblement "trauma" (impacts NON animés : tirs, dégâts, explosions) ──
    const intensity = screenShake.tick(dt);
    if (intensity < 0.0001) return;
    this.shakePhase += dt * 38; // fréquence du tremblement
    const p = this.shakePhase;
    const posAmp = intensity * 0.10; // m
    cam.position.x += Math.sin(p * 1.00) * posAmp;
    cam.position.y += Math.sin(p * 1.27 + 1.3) * posAmp;
    cam.rotation.z += Math.sin(p * 0.91 + 0.7) * intensity * 0.045; // roulis
  }

  private applyFps(cam: THREE.PerspectiveCamera, s: PlayerState, pos: THREE.Vector3, dt: number): void {
    // ── Clamp pitch anti-gimbal-lock ──
    s.pitch = Math.max(-1.5, Math.min(1.5, s.pitch)); // ±86°, évite la singularité à 90°
    
    let bob = 0;
    if (s.grounded && s.horizontalSpeed > 0.5) {
      this.bobPhase += C.bobSpeed * Math.min(s.horizontalSpeed / C.sprintSpeed, 1) * dt;
      bob = Math.sin(this.bobPhase * 2) * C.bobAmount;
    }
    cam.position.set(pos.x, pos.y + C.eyeHeight + bob, pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(s.pitch, s.yaw, 0);
  }

  private applyTps(cam: THREE.PerspectiveCamera, s: PlayerState, pos: THREE.Vector3, dt: number): void {
    // ── Clamp pitch anti-gimbal-lock ──
    s.pitch = Math.max(-1.5, Math.min(1.5, s.pitch)); // ±86°
    
    // Multiplicateur d'offset admin (slider AdminPanel — défaut 1.0 = neutre).
    // Appliqué APRÈS la molette utilisateur (s.tpsDistance) pour préserver son
    // contrôle. Borné par tpsDistanceMin/Max pour éviter les valeurs absurdes.
    const offset = cameraOffsetStore.get();
    const scale  = characterScaleStore.get();
    const d = Math.max(C.tpsDistanceMin, Math.min(C.tpsDistanceMax, s.tpsDistance * offset));
    const cp = Math.cos(s.pitch);

    // Cible = tête du joueur. Caméra placée DERRIÈRE (sens opposé au regard) :
    // l'avant du joueur est (-sin yaw, -cos yaw) → l'arrière est (sin yaw, cos yaw).
    TMP_HEAD.set(pos.x, pos.y + C.eyeHeight, pos.z);
    TMP_DESIRED.set(
      TMP_HEAD.x + Math.sin(s.yaw) * cp * d,
      TMP_HEAD.y - Math.sin(s.pitch) * d,
      TMP_HEAD.z + Math.cos(s.yaw) * cp * d
    );

    // ── Cible de position (anti-clip) ─────────────────────────────────────
    //
    // RÉACTIVÉ le 31/07/2026 après diagnostic du P0 « TPS écran noir ».
    //
    // L'anti-clip avait été désactivé sur la conclusion qu'il « poussait la
    // caméra dans le terrain quand le joueur regarde vers le haut ». Le
    // symptôme était réel, la conclusion inversée : le coupable était
    // `minDist`, monté à 2.0, qui l'emportait sur le point d'impact dans le
    // `Math.max` de `resolveCameraPosition` — la borne de confort autorisait
    // la traversée. Désactiver l'anti-clip a retiré la dernière protection :
    // la caméra descendait alors librement à d = 4 m sous la roche.
    //
    // Mesuré au spawn forge (sol à y = −26) : dès 16,8° de regard vers le
    // haut, la caméra tombait à y = −28,83, soit 2,83 m dans le sol → écran
    // noir. Couvert par `FpsCamera.tps.test.ts` (« H3 »).
    let target: THREE.Vector3;
    if (cameraCollisionStore.get()) {
      const minDist   = Math.max(0.4, 1.2 * scale);
      const camRadius = Math.max(0.1, 0.3 * scale);
      target = collisionWorld.resolveCameraPosition(TMP_HEAD, TMP_DESIRED, minDist, camRadius);
    } else {
      target = TMP_DESIRED;
    }

    // ── PLANCHER SOL — actif MÊME anti-clip désactivé ─────────────────────
    //
    // `cameraCollisionStore` est OFF par défaut, à la demande explicite de
    // l'utilisateur : il ne veut pas que la caméra se rapproche dès qu'un MUR
    // passe derrière lui. C'est un choix de confort d'exploration, et il est
    // conservé tel quel.
    //
    // Mais « pas d'anti-clip mur » n'a jamais voulu dire « la caméra peut
    // entrer dans le sol ». Sous la roche il n'y a rien à voir : les faces
    // arrière sont cullées, l'écran devient noir, et le joueur perd la vue
    // sans comprendre pourquoi. Ce n'est pas un compromis de réalisme, c'est
    // une vue cassée.
    //
    // Ce plancher est donc INDÉPENDANT du toggle : il ne rapproche jamais la
    // caméra, il l'empêche seulement de descendre sous le sol.
    // GARDE DE COÛT — le raycast ne part QUE si la caméra menace de descendre.
    //
    // `getGroundY` est la requête la plus chère du moteur : `firstHitOnly=false`
    // sur 1000 unités, donc elle COLLECTE tous les impacts au lieu de s'arrêter
    // au premier (CollisionWorld.ts:183). Le CharacterController en fait déjà une
    // par frame ; en ajouter une seconde inconditionnelle la doublait.
    //
    // Or ce plancher ne sert que dans un cas : quand l'orbite envoie la caméra
    // sous les pieds du joueur, c'est-à-dire au-delà de ~17° de regard vers le
    // haut. Le reste du temps — la quasi-totalité du jeu — le test `pos.y` seul
    // suffit à l'écarter, sans toucher au BVH.
    const plancherJoueur = pos.y + CAMERA_GROUND_CLEARANCE;
    if (target.y < plancherJoueur) {
      // Sous les pieds : le sol RÉEL sous la caméra peut être plus haut que le
      // joueur (pente, rebord) — là seulement on paie le raycast.
      const floorY = collisionWorld.getGroundY(target.x, target.z, TMP_HEAD.y + 2);
      const minY = (floorY !== null ? floorY : pos.y) + CAMERA_GROUND_CLEARANCE;
      if (target.y < minY) target.y = minY;
    }

    // ── Lissage exponentiel (élimine les snaps brutaux) ──────────────────
    // Première frame en TPS : snap direct (pas de "venir de l'origine").
    // Frames suivantes : lerp vers la cible — quand la cible saute (changement
    // de zone, perso traverse une géométrie), la caméra glisse au lieu de
    // téléporter brutalement.
    //
    // FILET NON-FINI — un accumulateur ne se répare JAMAIS tout seul.
    // `NaN.lerp(valide, α)` reste NaN : une seule frame polluée verrouille la
    // caméra à vie, et Three.js culle alors toute la scène (écran noir, HUD DOM
    // intact). Le mode FPS y échappe uniquement parce qu'il réécrit la position
    // en entier à chaque frame. Deux gardes, donc : ne rien absorber d'invalide,
    // et se réinitialiser si l'accumulateur a quand même dérivé.
    // Couvert par FpsCamera.tps.test.ts.
    if (isFiniteVec(target)) {
      if (!this.tpsSmoothed) {
        this.tpsSmoothed = target.clone();
      } else {
        const alpha = 1 - Math.exp(-TPS_POSITION_LERP * dt);
        this.tpsSmoothed.lerp(target, alpha);
        // `alpha` non fini (dt corrompu) contamine le lerp malgré une cible saine.
        if (!isFiniteVec(this.tpsSmoothed)) this.tpsSmoothed.copy(target);
      }
    } else if (this.tpsSmoothed && !isFiniteVec(this.tpsSmoothed)) {
      // Cible ET accumulateur invalides : repartir de zéro au prochain
      // `target` sain plutôt que de propager une position morte.
      this.tpsSmoothed = null;
    }

    // Aucune position exploitable pour l'instant → laisser la caméra où elle
    // est. Mieux vaut une vue figée une frame qu'une caméra en NaN définitive.
    if (!this.tpsSmoothed) return;

    cam.position.copy(this.tpsSmoothed);

    // lookAt
    // sur le sens du mouvement et corrige donc l'inversion des touches en TPS.
    cam.lookAt(TMP_HEAD);
  }
}
