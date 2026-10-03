// ══════════════════════════════════════════════════════════════════════════════
// movement/CharacterController.ts — Physique du joueur (PURE, sans React)
//
// Responsable UNIQUEMENT du mouvement : accélération/décélération, gravité,
// saut (coyote + buffer), collision capsule multi-hauteurs (glisse le long des
// murs). Mute directement le Vector3 partagé. Aucune dépendance R3F → testable.
//
// Extension future (slide/dash/wallrun) : brancher dans update() en lisant
// state.moveState et en ajoutant des impulsions à `vel` / `velY`.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { PLAYER_CONFIG as C } from "./playerConfig";
import type { PlayerState, MoveState } from "./playerState";
import { talentRuntime } from "../../talents/talentRuntime";
import type { InputManager } from "./InputManager";
import { collisionWorld } from "../CollisionWorld";
import { fastSin, fastCos, fastSinCos } from "../../math/math-fast";
import { noclipUi } from "./noclipUi";
import { mapBoundsStore } from "../mapBoundsStore";
import { mapSpawn } from "../mapConfig";
import { mathWasm } from "../../wasm/MathWasm";

/**
 * Marge sous le sol MESURÉ au point d'apparition, pas sous un Y arbitraire.
 *
 * AVANT : on calculait le seuil depuis `mapSpawn(mapId)[1]`, qui peut être
 * corrompu via `spawnPointStore` — un spawn à Y ≈ 162 donne un seuil à -38,
 * soit à portée de n'importe quelle descente normale. La boucle de chute
 * infinie du 29/07/2026 venait exactement de là.
 *
 * MAINTENANT : on mesure le VRAI sol au point d'apparition via `getGroundY`,
 * et on place le seuil `FALL_MARGIN` mètres SOUS ce sol. Si la mesure échoue
 * (aucune collision au spawn → map pas encore chargée), on utilise le repli
 * de `mapBoundsStore` qui est déjà ultra-conservateur (MARGE_CHUTE = 300).
 * Dans TOUS les cas, on plafonne à -10000 pour avoir un filet de sécurité
 * absolu même sans aucune donnée de map.
 */
const FALL_MARGIN = 200;
const FALL_HARD_FLOOR = -10000;
/** Nombre de renvois depuis le début de la session — sert uniquement à la trace. */
let fallCount = 0;
/** Timestamp du dernier renvoi — détecte les boucles de chute (rebond). */
let lastFallTs = 0;
function fallThreshold(mapId: string): number {
  // ── MESURE DU SOL RÉEL au point d'apparition ──────────────────────────
  const [sx, , sz] = mapSpawn(mapId);
  const measuredGround = collisionWorld.getGroundY(sx, sz, 5000);
  if (measuredGround !== null) {
    // Sol mesuré → seuil = sol − FALL_MARGIN (200 m sous le vrai sol).
    return measuredGround - FALL_MARGIN;
  }
  // ── Sol NON mesurable (map pas encore chargée) → filet dur ────────────
  // NE PAS passer par mapBoundsStore.fallFloor : ses keepIn walls
  // produisent un seuil trop haut (-38 au lieu de -10000) quand la
  // map n'a pas encore de collision → boucle de chute infinie.
  return FALL_HARD_FLOOR;
}

// Vecteurs de travail réutilisés (zéro allocation par frame).
const TMP_FWD = new THREE.Vector3();
const TMP_RIGHT = new THREE.Vector3();
const TMP_WISH = new THREE.Vector3();
const TMP_DELTA = new THREE.Vector3();
const TMP_FROM = new THREE.Vector3();

// Hauteurs de test mural (approx. capsule : pieds / buste / tête).
// Fonction au lieu de constante : C.height est désormais un getter dynamique
// (suit le slider admin). Si on cachait au top-level, la collision resterait
// figée à la valeur de boot et le perso scalé traverserait les murs.
const WALL_HEIGHTS = [0, 0, 0]; // réutilisé (zéro alloc/frame) — mis à jour ci-dessous
/**
 * Hauteurs de sondage des murs, calées sur la capsule COURANTE.
 *
 * La capsule rétrécit en accroupi (`crouchHeightMult`) : sans ça le personnage
 * gardait un volume de collision debout une fois baissé, donc il ne passait
 * sous aucun obstacle bas et se cognait à des murs au-dessus de sa tête.
 *
 * Trois hauteurs proportionnelles à la capsule : cheville (14%), hanche (50%),
 * sommet (−0.15 m). WALL_HEIGHTS[0] était hardcodé à 0.25 — en accroupi la
 * sonde de pied restait à hauteur de hanche → collisions fantômes (Agent #1).
 */
function computeWallHeights(crouching: boolean): number[] {
  const h = crouching ? C.height * C.crouchHeightMult : C.height;
  WALL_HEIGHTS[0] = h * 0.14;  // cheville (proportionnel)
  WALL_HEIGHTS[1] = h * 0.5;   // hanche
  WALL_HEIGHTS[2] = h - 0.15;  // sommet de tête
  return WALL_HEIGHTS;
}

/** Rapproche `current` de `target` d'au plus `maxDelta` (accel/decel linéaire). Utilise WASM si dispo. */
function approach(current: number, target: number, maxDelta: number): number {
  return mathWasm.approach(current, target, maxDelta);
}

/**
 * Seuils recalés sur la nouvelle échelle (marche par défaut, course sur Maj).
 *
 * L'ancienne version comparait à `runSpeed` et `walkSpeed + 0.5` alors que la
 * vitesse sans Maj VALAIT déjà runSpeed : l'état "walk" était donc inatteignable
 * et le personnage jouait toujours la course.
 *
 * On teste le milieu de chaque palier plutôt qu'une borne exacte : la vitesse est
 * lissée par `approach()`, elle frôle sa cible sans jamais l'atteindre pile.
 */
function computeMoveState(grounded: boolean, speed: number, running: boolean): MoveState {
  if (!grounded) return "air";
  if (speed < 0.3) return "idle";
  if (speed > (C.runSpeed + C.sprintSpeed) / 2) return "sprint";
  if (running && speed > (C.walkSpeed + C.runSpeed) / 2) return "run";
  return "walk";
}

export class CharacterController {
  /** Position partagée (mutée en place — c'est le playerPosition du monde). */
  readonly position: THREE.Vector3;
  private vel = new THREE.Vector3(); // horizontale (x,z) ; y géré séparément
  private velY = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private onJump?: () => void;
  // ── Slide state ──
  private isSliding = false;
  private slideTimer = 0;
  private slideCooldown = 0;
  private crouchToggled = false; // toggle Ctrl au lieu de maintenir
  private prevCrouchHeld = false; // front montant : évite le re-slide en boucle touche tenue

  constructor(shared: THREE.Vector3, onJump?: () => void) {
    this.position = shared; // référence partagée (pas de clone)
    this.onJump = onJump;
  }

  update(dt: number, input: InputManager, state: PlayerState): void {
    dt = Math.min(dt, 0.05); // clamp anti-tunneling sur gros lag
    if (!(dt > 0)) return;   // garde NaN / négatif (perte focus, clock skew → crash BVH)
    const pos = this.position;

    // ── 0. Noclip : vol libre pitch-aware, sans collision ni gravité ──────────
    // Regarder EN HAUT + W = monter, EN BAS + W = descendre.
    // Space = monter directement, Ctrl = descendre directement.
    if (state.noclip) {
      input.consumeJump(); // drainer le buffer saut (évite saut fantôme à la désactivation)
      const speed = C.sprintSpeed * (input.sprint ? 2.5 : 1.5) * noclipUi.getSpeed();
      const inFwd = -input.moveZ; // W=+1
      const inRt  =  input.moveX; // D=+1
      const sinYaw   = Math.sin(state.yaw);
      const cosYaw   = Math.cos(state.yaw);
      const cosPitch = Math.cos(state.pitch);
      const sinPitch = Math.sin(state.pitch); // pitch<0 = regarder en haut (convention FPS)
      // Vecteur "avant caméra" 3D :
      const fwdX =  -sinYaw * cosPitch;
      const fwdZ =  -cosYaw * cosPitch;
      // Vecteur "droite" (horizontal uniquement) :
      const rtX  =   cosYaw;
      const rtZ  =  -sinYaw;
      pos.x += (fwdX * inFwd + rtX * inRt) * speed * dt;
      pos.y += (-sinPitch * inFwd) * speed * dt; // pitch<0 → sin<0 → on monte avec W ✓
      pos.z += (fwdZ * inFwd + rtZ * inRt) * speed * dt;
      if (input.jumpHeld) pos.y += speed * dt;   // Space = monter direct
      if (input.flyDown)  pos.y -= speed * dt;   // Ctrl  = descendre direct
      // Reset état physique (évite drift à la désactivation)
      this.velY = 0;
      this.vel.set(0, 0, 0);
      state.grounded = false;
      state.crouching = false;       // pas d'accroupi en vol libre
      this.isSliding = false;        // sinon le slide reprend à la sortie du noclip
      this.slideTimer = 0;
      state.sliding = false;
      state.horizontalSpeed = Math.abs(inFwd) * speed;
      state.velocity.set(0, 0, 0);
      state.moveState = "run";
      return;
    }

    // ── 1. Direction souhaitée (relative au yaw caméra) ──────────────────────
    const inX = input.moveX;          // +droite
    const inZ = input.moveZ;          // +arrière
    const hasInput = inX !== 0 || inZ !== 0;
    const yaw = state.yaw;
    const { sin: sinY, cos: cosY } = fastSinCos(yaw);
    TMP_FWD.set(-sinY, 0, -cosY);   // avant caméra (sol)
    TMP_RIGHT.set(cosY, 0, -sinY);  // droite caméra (sol)
    TMP_WISH.set(0, 0, 0);
    if (hasInput) {
      TMP_WISH.addScaledVector(TMP_FWD, -inZ).addScaledVector(TMP_RIGHT, inX).normalize();
    }

    // MARCHE PAR DÉFAUT, COURSE SUR MAJ.
    // Avant : sans Maj le joueur était déjà à `runSpeed` (6,0 m/s) et Maj donnait
    // `sprintSpeed` (9,5). Tout était donc décalé d'un cran — il n'y avait aucune
    // vitesse de marche atteignable. On recale : rien → walkSpeed, Maj → runSpeed.
    // `sprintSpeed` reste réservé à une allure évènementielle (glissade, dash).
    //
    // La course n'est plus limitée à l'avant : le blend directionnel fournit des
    // clips de course dans les 8 directions, straffer en courant a donc un sens.
    const running = input.sprint && state.sprintAllowed;
    // ×moveSpeedMult : bonus de la branche Mobilité des talents (1 si aucun).
    const speedMult = talentRuntime.moveSpeedMult;
    let targetSpeed = (hasInput ? (running ? C.runSpeed : C.walkSpeed) : 0) * speedMult;

    // Intention LOCALE publiée pour l'animation (voir PlayerState.localMoveX/Z).
    // Normalisée : en diagonale (1,-1) la magnitude vaut 1,41 et fausserait les
    // poids de blend.
    if (hasInput) {
      const inv = 1 / Math.hypot(inX, inZ);
      state.localMoveX = inX * inv;
      state.localMoveZ = inZ * inv;
    } else {
      state.localMoveX = 0;
      state.localMoveZ = 0;
    }
    state.running = running && hasInput;

    // La glissade garde l'exigence d'élan vers l'avant : elle part d'une course.
    const sprinting = running && inZ < 0;

    // ── Glissade (sprint + APPUI crouch → slide avec momentum décroissant) ──
    // Front montant sur crouchHeld : en niveau, la vitesse sprint-accroupi
    // (9.5×0.45 = 4.275) reste au-dessus de slideMinSpeed → re-slide en boucle
    // sans que le joueur relâche la touche. Il faut un nouvel appui.
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    // ── Glissade (sur crouch maintenu pendant sprint, pas toggle) ──────────
    const crouchPressed = input.crouchHeld && !this.prevCrouchHeld;
    this.prevCrouchHeld = input.crouchHeld;
    const wantsSlide = state.grounded && sprinting && crouchPressed
      && !this.isSliding && this.slideCooldown <= 0
      && state.horizontalSpeed > C.slideMinSpeed;
    if (wantsSlide) {
      this.isSliding = true;
      this.slideTimer = C.slideDuration;
    }
    if (this.isSliding) {
      this.slideTimer -= dt;
      const curSpeed = Math.hypot(this.vel.x, this.vel.z);
      if (this.slideTimer <= 0 || curSpeed < C.slideExitSpeed || !state.grounded) {
        this.isSliding = false;
        this.slideCooldown = C.slideCooldown;
      }
    }

    // ── Accroupi (Ctrl) au sol : toggle on press, pas besoin de maintenir. ──
    if (input.consumeCrouch()) {
      this.crouchToggled = !this.crouchToggled;
    }
    const crouching = state.grounded && this.crouchToggled && !this.isSliding;
    if (crouching) targetSpeed *= C.crouchSpeedMult;
    if (this.isSliding) targetSpeed = 0; // momentum décroissant via slideFriction
    state.crouching = crouching;
    state.sliding = this.isSliding;

    // ── 2. Accélération / décélération (sol vs air) ──────────────────────────
    const grounded = state.grounded;
    const rate = this.isSliding ? C.slideFriction
      : !hasInput ? C.groundDecel
      : grounded ? C.groundAccel
      : C.airAccel;
    this.vel.x = approach(this.vel.x, TMP_WISH.x * targetSpeed, rate * dt);
    this.vel.z = approach(this.vel.z, TMP_WISH.z * targetSpeed, rate * dt);

    // ── 3. Déplacement horizontal collision-aware (X puis Z = glisse au mur) ──
    this.moveAxis(pos, this.vel.x * dt, 0, crouching);
    this.moveAxis(pos, 0, this.vel.z * dt, crouching);

    // ── 4. Sol (raycast depuis juste au-dessus de la tête, pas de +50) ───────
    // maxAboveY = pieds + stepHeight : ignore les étages supérieurs qui
    // seraient au-dessus de la marche maximale franchissable. Évite que le
    // perso soit "téléporté" sur un étage en marchant sous un balcon.
    let groundY: number | null = null;
    try {
      groundY = collisionWorld.getGroundY(
        pos.x, pos.z,
        pos.y + (state.crouching ? C.height * C.crouchHeightMult : C.height) + 1,
        pos.y + C.stepHeight,
      );
    } catch (e) {
      console.warn('[CharacterController] getGroundY error — BVH probablement corrompu', e);
      groundY = null;
    }
    const isGrounded = groundY !== null && pos.y <= groundY + C.groundSnap && this.velY <= 0.01;

    // ── 5. Saut : coyote-time + jump-buffer (front montant only) ─────────────
    if (input.consumeJump()) this.jumpBuffer = C.jumpBuffer;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = isGrounded ? C.coyoteTime : Math.max(0, this.coyote - dt);

    if (isGrounded && this.velY <= 0) {
      pos.y = groundY!;
      this.velY = 0;
    }
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.velY = C.jumpVelocity;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onJump?.();
    }

    // ── 6. Gravité ───────────────────────────────────────────────────────────
    if (!isGrounded || this.velY > 0) {
      this.velY = Math.max(-C.maxFall, this.velY - C.gravity * dt);
      pos.y += this.velY * dt;
    }

    // ── 7. Filet anti-chute infinie ──────────────────────────────────────────
    //
    // C'ÉTAIT ICI, LE « MUR INVISIBLE QUI RAMÈNE AU POINT DE DÉPART ».
    //
    // Ce filet tenait dans deux constantes globales : seuil à y < -50, renvoi à
    // (0, 5, 0). Aucune des deux ne survit à une map décalée. Sur la Forge, dont
    // la géométrie porte un offset [181, -401, -47] et dont le sol au point
    // d'apparition est à y ≈ -27,8, il restait moins de 22 unités de marge : le
    // moindre trou de sol — un chunk pas encore chargé, un bord de map, un
    // interstice entre deux morceaux — déclenchait le renvoi. Et le point de
    // renvoi, (0, 5, 0), est dans le vide pour cette map, donc le joueur
    // retombait et repartait pour un tour.
    //
    // Les deux valeurs deviennent des données de map :
    //   • le seuil vient de la mesure du sol RÉEL via getGroundY, pas d'un Y déclaratif ;
    //   • le renvoi utilise `mapSpawn()`, qui respecte déjà le point d'apparition
    //     déplaçable de l'éditeur.
    //
    // ANTI-REBOND (29/07/2026) : si le joueur tombe plus de 2 fois en moins de
    // 5 secondes, on est dans une boucle (spawnPoint corrompu, absence de
    // collision au point d'apparition…). On casse la boucle en téléportant le
    // joueur 500 m AU-DESSUS du spawn — le temps que les chunks chargent, la
    // gravité le ramènera au sol progressivement.
    const REBOND_WINDOW_MS = 5000;
    const REBOND_MAX        = 2;
    const REBOND_ALTITUDE   = 500;
    const mapId = mapBoundsStore.activeMap();
    if (groundY === null && pos.y < fallThreshold(mapId)) {
      const now = performance.now();
      const rebond = (now - lastFallTs < REBOND_WINDOW_MS);
      lastFallTs = now;
      fallCount++;

      const [sx, sy, sz] = mapSpawn(mapId);
      if (rebond && fallCount > REBOND_MAX) {
        // BOUCLE DÉTECTÉE → on casse en téléportant le joueur en altitude.
        // Le warning inclut la position DE CHUTE et le point de spawn pour
        // permettre le diagnostic (spawnPoint corrompu ? zone sans collision ?).
        console.warn(
          `[Chute ${fallCount} REBOND] map « ${mapId} » — ` +
          `tombé depuis (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) ` +
          `· seuil ${fallThreshold(mapId).toFixed(1)} ` +
          `· spawnPoint=(${sx.toFixed(1)}, ${sy.toFixed(1)}, ${sz.toFixed(1)}) ` +
          `→ TÉLÉPORT ALTITUDE +${REBOND_ALTITUDE}m (anti-boucle)`,
        );
        pos.set(sx, sy + REBOND_ALTITUDE, sz);
      } else {
        // TRACE. Ce renvoi ne devrait quasiment jamais se produire : s'il se
        // répète, c'est qu'une zone de la map n'a pas de collision, et le joueur
        // vit ça comme un « trigger qui ramène au départ » sans savoir pourquoi.
        // On dit d'où il est tombé — c'est la seule information qui permette
        // ensuite de retrouver le trou.
        console.warn(
          `[Chute ${fallCount}] map « ${mapId} » — tombé depuis ` +
          `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) ` +
          `· seuil ${fallThreshold(mapId).toFixed(1)} · renvoi au point d'apparition`,
        );
        pos.set(sx, sy, sz);
      }
      this.velY = 0;
      this.vel.set(0, 0, 0);
    }

    // ── 8. Publication de l'état ─────────────────────────────────────────────
    const hSpeed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    state.horizontalSpeed = hSpeed;
    state.grounded = isGrounded;
    state.velocity.set(this.vel.x, this.velY, this.vel.z);
    state.moveState = this.isSliding ? "slide" : computeMoveState(isGrounded, hSpeed, running);
  }

  /** Avance sur un axe seulement si aucun mur (test à 3 hauteurs = capsule). */
  private moveAxis(pos: THREE.Vector3, dx: number, dz: number, crouching = false): void {
    if (dx === 0 && dz === 0) return;
    TMP_DELTA.set(dx, 0, dz);
    // Recalcule à chaque appel pour suivre le scale live (le perso peut
    // rétrécir/grandir en cours de session via l'AdminPanel).
    const wallHeights = computeWallHeights(crouching);
    for (const h of wallHeights) {
      TMP_FROM.set(pos.x, pos.y + h, pos.z);
      // Protection anti-crash : si le BVH est corrompu par un thrash de
      // chargement de chunks, isBlocked peut lever. On log et on laisse
      // passer le mouvement plutôt que de planter.
      try {
        if (collisionWorld.isBlocked(TMP_FROM, TMP_DELTA, C.radius)) return;
      } catch (e) {
        console.warn('[CharacterController] isBlocked error — BVH probablement corrompu, mouvement autorisé', e);
        break; // sortir de la boucle wallHeights, appliquer le mouvement
      }
    }
    // ── Murs invisibles posés en admin (limites de map) ────────────────────
    // Testé sur la position d'ARRIVÉE : sur celle de départ, on ne bloquerait
    // qu'une fois déjà entré dans le mur.
    //
    // MAIS on ne bloque JAMAIS quelqu'un qui est DÉJÀ hors zone. Sans cette
    // clause, un joueur pris à l'extérieur — mur redimensionné sous ses pieds,
    // apparition mal placée, PNJ situé au-delà de la limite — verrait toutes ses
    // directions refusées, y compris celle du retour : figé sur place, sans
    // aucun message. On le laisse alors se déplacer librement ; il sera de
    // nouveau contraint dès qu'il aura repassé la limite.
    if (
      mapBoundsStore.blocksActive(pos.x + dx, pos.y, pos.z + dz, C.radius) &&
      !mapBoundsStore.blocksActive(pos.x, pos.y, pos.z, C.radius)
    ) return;
    pos.x += dx;
    pos.z += dz;
  }
}
