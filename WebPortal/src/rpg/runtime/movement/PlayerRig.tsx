// ══════════════════════════════════════════════════════════════════════════════
// movement/PlayerRig.tsx — Chef d'orchestre R3F (la SEULE colle React)
//
// Assemble les 3 modules purs (Input → Mouvement → Caméra) dans UN seul useFrame
// à l'ordre déterministe. Gère deux modes :
//
//   MODE MARCHE (isPiloting=false) :
//     look → vue/zoom → CharacterController.update → FpsCamera.apply
//
//   MODE PILOTAGE (isPiloting=true, shipController fourni) :
//     look → ShipController.update → caméra TPS derrière le vaisseau (lerp smooth)
//
// UN seul InputManager → UN seul pointer-lock → aucun conflit entre les deux modes.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cameraViewStore } from "../../camera/cameraViewStore";
import { PLAYER_CONFIG as C } from "./playerConfig";
import type { PlayerState } from "./playerState";
import { InputManager } from "./InputManager";
import { CharacterController } from "./CharacterController";
import { FpsCamera } from "./FpsCamera";
import type { ShipController } from "../vehicles/ShipController";
import { audioManager } from "../../../utils/AudioManager";
import { staminaStore } from "./staminaStore";
import { DoubleTapDetector } from "./doubleTap";
import { ClimbController, type ClimbProbe } from "./ClimbController";
import { collisionWorld } from "../CollisionWorld";


/**
 * Adaptateur entre le singleton Three.js et l'interface minimale attendue par
 * ClimbController. C'est ce qui permet de tester la machine à états d'escalade
 * sans scène ni DOM — le contrôleur ne connaît que `castRay`.
 */
const CLIMB_ORIGIN = new THREE.Vector3();
const CLIMB_DIR = new THREE.Vector3();
const climbProbe: ClimbProbe = {
  castRay(ox, oy, oz, dx, dy, dz, maxDist) {
    CLIMB_ORIGIN.set(ox, oy, oz);
    CLIMB_DIR.set(dx, dy, dz);
    const hit = collisionWorld.raycastPoint(CLIMB_ORIGIN, CLIMB_DIR);
    if (!hit) return null;
    const d = hit.distanceTo(CLIMB_ORIGIN);
    return d <= maxDist ? d : null;
  },
};

// Distance (m) entre deux pas → cadence des bruits de pas (auto-scale vitesse :
// courir = pas plus rapprochés). 2 m ≈ une foulée de course réaliste.
const FOOTSTEP_STRIDE = 2.0;

// ── Caméra vaisseau (TPS) ─────────────────────────────────────────────────────
// PRINCIPE D'ALIGNEMENT AXIAL STRICT (bug-fix mai 2026) :
//   • La caméra regarde TOUJOURS pile dans la direction du nez (forward du ship).
//   • La position de la caméra est lerpée (suivi smooth = inertie cinématique).
//   • La cible de regard n'est PLUS lerpée → "axe droit visé = vaisseau va droit".
//   Conséquence : appuyer sur W = le vaisseau s'envole exactement là où l'œil
//   regarde, sans retard de visée pendant les virages.
const SHIP_CAM_DIST   = 8.0;   // m derrière le nez
const SHIP_CAM_HEIGHT = 2.5;   // m au-dessus du centre
const SHIP_CAM_AHEAD  = 2.0;   // m devant le vaisseau (point de regard)
const SHIP_CAM_LERP   = 8.0;   // vitesse de suivi en position (exponentiel)

// Vecteurs de travail (zéro allocation par frame)
const TMP_BACK  = new THREE.Vector3();
const TMP_UP    = new THREE.Vector3();
const TMP_IDEAL = new THREE.Vector3();
const TMP_LOOK  = new THREE.Vector3();

interface PlayerRigProps {
  /** Position du joueur (mutée en place, partagée par ref). */
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  /** État partagé (yaw/pitch/view/vitesse…) lu par le perso + le HUD. */
  state: React.MutableRefObject<PlayerState>;
  inputEnabled?: boolean;
  /**
   * La map est-elle ENTIÈREMENT assemblée ?
   *
   * Distinct de `inputEnabled`, qui ne coupe que le clavier/souris : ce drapeau
   * gouverne la PHYSIQUE. Attendre le premier collider ne suffit pas — mesuré :
   * avec seulement le chunk 1 chargé sur 8, `getGroundY` trouvait un sol à
   * −228,8 alors que le point d'apparition est à −26, et le joueur était posé
   * 200 m plus bas, dans une partie basse de la map.
   *
   * Défaut `true` pour ne pas changer le comportement des autres appelants.
   */
  worldReady?: boolean;
  /** Déclenché au saut (pour l'animation du personnage). */
  onJump?: () => void;
  /**
   * Contrôleur du vaisseau en cours de pilotage.
   * Null = mode marche normal.
   */
  shipController?: React.MutableRefObject<ShipController | null>;
  /** Vrai = le joueur pilote un vaisseau (skip CharacterController). */
  isPiloting?: boolean;
}

export function PlayerRig({
  playerPosition, state, inputEnabled = true, worldReady = true, onJump,
  shipController, isPiloting = false,
}: PlayerRigProps) {
  const { gl, size, set } = useThree();
  const camRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const inputRef  = useRef<InputManager | null>(null);
  const ctrlRef   = useRef<CharacterController | null>(null);
  const fpsCamRef = useRef(new FpsCamera());
  const doubleTapRef = useRef(new DoubleTapDetector());
  const climbRef  = useRef(new ClimbController(climbProbe));
  const prevClimbRef = useRef<string>("none");
  const stepDistRef = useRef(0); // distance cumulée pour la cadence des pas
  // Passe à true à la PREMIÈRE frame où un sol existe sous le joueur, et n'en
  // revient jamais : une fois le monde posé, la physique doit tourner même si
  // le joueur saute dans un trou (c'est alors une vraie chute, pas un chargement).
  const worldReadyRef = useRef(false);

  // ── Caméra créée UNE seule fois (plus de recréation au resize) ────────────
  // far = 30000 m : permet de voir les couches d'étoiles ultra-lointaines
  // (jusqu'à 9000m de rayon) sans clipping. near = 0.05 conservé (ratio sain
  // pour la précision Z-buffer).
  useEffect(() => {
    const cam = new THREE.PerspectiveCamera(C.fov, size.width / size.height, 0.05, 30000);
    cam.rotation.order = "YXZ"; // yaw puis pitch — pas de gimbal lock
    camRef.current = cam;
    set({ camera: cam });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize : met à jour l'aspect sans recréer la caméra ──────────────────
  useEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    cam.aspect = size.width / size.height;
    cam.updateProjectionMatrix();
  }, [size.width, size.height]);

  // ── Input + contrôleur : créés au montage, attachés au canvas ─────────────
  useEffect(() => {
    const im = new InputManager();
    im.attach(gl.domElement);
    inputRef.current = im;
    // Le saut consomme de l'endurance. On l'encaisse ici plutôt que dans le
    // contrôleur, qui doit rester sans dépendance à un singleton.
    doubleTapRef.current = new DoubleTapDetector();
    climbRef.current = new ClimbController(climbProbe);
    ctrlRef.current = new CharacterController(playerPosition.current, () => {
      staminaStore.spendJump();
      onJump?.();
    });
    return () => {
      im.detach();
      inputRef.current = null;
      ctrlRef.current  = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl.domElement]);

  // ── Activation/désactivation de l'input (menus, dialogues…) ───────────────
  // En mode pilotage, on garde l'input actif : le pointer-lock reste en place.
  useEffect(() => { inputRef.current?.setEnabled(inputEnabled); }, [inputEnabled]);

  // ── Bridge test automatisé : expose l'état du joueur pour getState() ─────
  useEffect(() => {
    const win = window as any;
    win.__narvosTest?.registerStateProvider(() => ({
      // ⚠️ `playerPos` exposait en réalité la position de la CAMÉRA. Les deux
      // sont désormais distinctes : en TPS elles diffèrent de `tpsDistance`,
      // et c'est précisément l'écart qu'on veut pouvoir lire.
      playerPos: { x: playerPosition.current.x, y: playerPosition.current.y, z: playerPosition.current.z },
      cameraPos: camRef.current
        ? { x: camRef.current.position.x, y: camRef.current.position.y, z: camRef.current.position.z }
        : null,
      cameraView: cameraViewStore.get(),
    }));
  }, []);

  // ── Boucle principale : input → mouvement → caméra ───────────────────────
  useFrame((_, dt) => {
    const cam = camRef.current;
    const im  = inputRef.current;
    if (!cam || !im) return;

    // Drain des états "consume" chaque frame (sinon accumulation entre frames).
    const look  = im.consumeLook();
    const vr    = im.consumeViewRequest();
    const wheel = im.consumeWheel();

    if (isPiloting && shipController?.current) {
      // ══ MODE PILOTAGE ═══════════════════════════════════════════════════
      const ctrl = shipController.current;

      // 0) Toggle de stabilisation (H) — capté en front montant côté InputManager
      if (im.consumeStabilizeToggle()) {
        ctrl.toggleStabilize();
      }

      // 1) Mise à jour physique du vaisseau (reçoit look + axes + modificateurs)
      ctrl.update(
        dt,
        look.dx, look.dy,
        im.moveX, im.moveZ,
        im.sprint, im.jumpHeld, im.flyDown,
      );

      // 2) Synchroniser la position joueur sur celle du vaisseau
      //    (nécessaire pour le LootCollector, les triggers de zone, etc.)
      playerPosition.current.copy(ctrl.position);

      // 3) Caméra TPS derrière le vaisseau (lerp exponentiel = suivi fluide)
      //    "Arrière" = direction opposée au nez (-forward)
      TMP_BACK.copy(ctrl.forward).negate();
      TMP_UP.copy(ctrl.up);
      TMP_IDEAL
        .copy(ctrl.position)
        .addScaledVector(TMP_BACK, SHIP_CAM_DIST)
        .addScaledVector(TMP_UP,   SHIP_CAM_HEIGHT);

      // Lerp exponentiel : independant du framerate
      cam.position.lerp(TMP_IDEAL, 1 - Math.exp(-SHIP_CAM_LERP * dt));

      // Regarde STRICTEMENT dans la direction du nez (alignement axial).
      // Pas de lerp sur la cible → "axe droit visé = vaisseau va droit".
      // L'inertie du suivi vient uniquement de la position lerpée au-dessus.
      TMP_LOOK.copy(ctrl.position).addScaledVector(ctrl.forward, SHIP_CAM_AHEAD);
      cam.lookAt(TMP_LOOK);

    } else {
      // ══ MODE MARCHE NORMAL ═══════════════════════════════════════════════
      const s = state.current;

      // ── GEL PHYSIQUE TANT QUE LE MONDE N'A PAS DE SOL ────────────────────
      //
      // `inputEnabled` ne coupe que le clavier/souris : la GRAVITÉ, elle,
      // tournait dès le montage du Canvas. Or les colliders sont enregistrés
      // chunk par chunk pendant le streaming (14 s par chunk mesuré, 8 chunks).
      // Pendant tout ce temps `getGroundY` renvoyait null, donc le joueur
      // tombait — et `fallThreshold` vaut FALL_HARD_FLOOR (−10000) tant que la
      // map n'a aucune collision : la chute durait jusqu'à −10000 avant le
      // renvoi au point d'apparition.
      //
      // C'est la cause de « le joueur tombe sous la map à la connexion », et de
      // l'écran noir qui l'accompagne : la caméra suit fidèlement un joueur
      // situé sous le décor, donc la sonde P0 ne signale rien (elle est VERTE).
      //
      // On gèle donc jusqu'à ce que le sol existe RÉELLEMENT sous les pieds —
      // pas jusqu'à un simple drapeau de fin de chargement, qui ne garantit pas
      // que le collider du chunk d'apparition soit posé.
      if (!worldReadyRef.current) {
        // DEUX conditions, et la première est indispensable.
        //
        // `worldReady` = map ENTIÈREMENT assemblée. Se contenter du premier
        // collider était une erreur mesurée : avec le seul chunk 1 chargé sur 8,
        // `getGroundY` renvoyait un sol à −228,8 pour un point d'apparition à
        // −26. Le joueur était posé 200 m trop bas, dans une partie basse de la
        // map — exactement le symptôme qu'on cherchait à supprimer.
        const solSousLesPieds = worldReady
          && collisionWorld.colliderCount > 0
          && collisionWorld.getGroundY(playerPosition.current.x, playerPosition.current.z) !== null;

        if (!solSousLesPieds) {
          // Aucun sol : on immobilise complètement plutôt que de laisser la
          // gravité creuser. La caméra reste appliquée pour que la vue soit
          // stable si l'écran de chargement se lève trop tôt.
          s.velocity.set(0, 0, 0);
          s.horizontalSpeed = 0;
          s.grounded = true;
          fpsCamRef.current.apply(cam, s, playerPosition.current, dt);
          return;
        }

        // Premier sol détecté : on POSE le joueur dessus avant de rendre la
        // main à la physique. Sans ce recalage, un point d'apparition défini
        // quelques mètres au-dessus ou en dessous du terrain réel produirait
        // soit une chute, soit un enfoncement, dès la première frame animée.
        const yConfig = playerPosition.current.y; // Y issu de MAP_SPAWN, avant recalage
        const solY = collisionWorld.getGroundY(playerPosition.current.x, playerPosition.current.z);
        if (solY !== null) playerPosition.current.y = solY + 0.05;
        worldReadyRef.current = true;

        if (process.env.NODE_ENV !== "production") {
          console.info(
            `[PlayerRig] monde prêt — ${collisionWorld.colliderCount} colliders, ` +
            `joueur posé à y=${playerPosition.current.y.toFixed(2)}`,
          );

          // GARDE-FOU CONTRE UN POINT D'APPARITION FAUX.
          //
          // Le recalage au sol masque l'erreur : quelle que soit la valeur de
          // MAP_SPAWN, le joueur finit posé quelque part, donc plus rien ne
          // signale qu'elle est absurde. C'est ce qui a permis à la Forge de
          // garder un spawn 200 m au-dessus de la map à travers DEUX
          // corrections successives — l'écart n'était visible nulle part.
          const ecart = Math.abs(yConfig - (solY ?? yConfig));
          if (solY !== null && ecart > 20) {
            // NE PAS écrire « MAP_SPAWN annonce » : cette valeur vient de
            // `playerPos`, qui est initialisé à la position SAUVEGARDÉE du
            // personnage et ne retombe sur MAP_SPAWN qu'à défaut de sauvegarde
            // (cf. RpgGameWorld). Nommer la mauvaise source envoie le prochain
            // débogage corriger un fichier qui n'a rien à se reprocher — c'est
            // arrivé le 31/07 : MAP_SPAWN était à −60 et le log annonçait 161,8.
            console.warn(
              `[PlayerRig] POSITION DE DEPART SUSPECTE — le joueur démarrait à ` +
              `y=${yConfig.toFixed(1)} alors que le sol réel est à y=${solY.toFixed(1)} ` +
              `(écart ${ecart.toFixed(0)} m). Il a été reposé au sol.\n` +
              `  Origine possible : sauvegarde du personnage (progressionStore) ` +
              `OU MAP_SPAWN si le perso n'a jamais été sauvegardé. ` +
              `Cure côté personnage : /respawn.`,
            );
          }
        }
      }

      // 1) Mouse look
      s.yaw   -= look.dx * C.sensitivity;
      s.pitch -= look.dy * C.sensitivity;
      s.pitch  = Math.max(C.pitchMin, Math.min(C.pitchMax, s.pitch));

      // 2) Changement de vue (F1/F3) + zoom molette (TPS)
      // `s.view` reste la source pour la boucle de rendu ; le store est le
      // MIROIR que React peut écouter. Sans lui, basculer en FPS ne re-rendait
      // pas RpgGameWorld, et le viewmodel d'arme n'était jamais monté.
      if (vr) { s.view = vr; cameraViewStore.set(vr); }
      if (wheel && s.view === "tps") {
        s.tpsDistance = THREE.MathUtils.clamp(
          s.tpsDistance + wheel * 0.5, C.tpsDistanceMin, C.tpsDistanceMax,
        );
      }

      // 2b) ESCALADE — évaluée AVANT le mouvement, car elle peut le confisquer.
      //
      // Le double appui se mesure sur le FRONT MONTANT du saut, pas sur la touche
      // maintenue : InputManager filtre désormais l'auto-répétition (`!e.repeat`),
      // sans quoi garder Espace enfoncé déclencherait l'escalade en boucle.
      const jumpEdge = im.consumeJump();
      const doubleJump = jumpEdge ? doubleTapRef.current.tap(performance.now()) : false;
      const climb = climbRef.current.update(dt, {
        doubleJump,
        intentUp: -im.moveZ,                      // W = monter, S = descendre
        release: im.crouchHeld,                   // Ctrl lâche la paroi
        x: playerPosition.current.x,
        y: playerPosition.current.y,
        z: playerPosition.current.z,
        fwdX: -Math.sin(s.yaw),
        fwdZ: -Math.cos(s.yaw),
        grounded: s.grounded,
      });
      // GARDE-FOU — l'escalade confisque TOUT le mouvement, elle ne doit jamais
      // pouvoir rester active par accident.
      //
      // Quand `overridesMovement` est vrai, CharacterController n'est pas appelé :
      // `moveState` garde sa dernière valeur (donc l'animation tourne encore) et
      // `pushForward` continue de déplacer le personnage. Un état coincé produit
      // exactement le symptôme « je relâche les touches et il continue de bouger
      // avec l'animation qui tourne ».
      //
      // On sort de force si le joueur est au sol sans mur devant : c'est une
      // situation où l'escalade n'a aucun sens.
      if (climb.state === "climbing" && s.grounded && climb.pushForward === 0) {
        climbRef.current.reset();
        climb.state = "none";
        climb.overridesMovement = false;
        climb.deltaY = 0;
        climb.pushForward = 0;
      }
      if (process.env.NODE_ENV !== "production" && climb.state !== prevClimbRef.current) {
        console.info(`[Climb] ${prevClimbRef.current} → ${climb.state}`);
        prevClimbRef.current = climb.state;
      }
      s.climbState = climb.state;

      if (climb.overridesMovement) {
        // Le contrôleur d'escalade a la main : on applique sa montée et on saute
        // entièrement le mouvement au sol et la gravité.
        playerPosition.current.y += climb.deltaY;
        // Recentrage sur la paroi. Sans lui le personnage garde la distance
        // qu'il avait au moment de l'accroche : trop près il traverse le mur,
        // trop loin ses mains flottent — c'est le glissement visible au collage.
        if (climb.pushForward !== 0) {
          playerPosition.current.x += -Math.sin(s.yaw) * climb.pushForward;
          playerPosition.current.z += -Math.cos(s.yaw) * climb.pushForward;
        }
        s.horizontalSpeed = 0;
        s.grounded = false;
        s.velocity.set(0, climb.deltaY / Math.max(dt, 1e-4), 0);
        fpsCamRef.current.apply(cam, s, playerPosition.current, dt);
        return;
      }

      // Le saut consommé plus haut doit être rendu au contrôleur, sinon un
      // double appui qui n'accroche aucun mur mangerait le saut du joueur.
      if (jumpEdge) im.injectJump();

      // 3) Endurance AVANT le mouvement : le contrôleur lit `sprintAllowed` pour
      //    décider s'il applique runSpeed ou walkSpeed. Le tiquer après le
      //    mouvement ferait courir le joueur une frame de trop après épuisement.
      //
      //    Le tick vit ici et pas dans CharacterController pour garder celui-ci
      //    PUR : il n'importe aucun singleton et reste testable sans DOM.
      staminaStore.tick(dt, s.running);
      s.sprintAllowed = staminaStore.canRun();

      // Le bloc « PLAYER P2 : consommation d'endurance pour le dash » a été
      // RETIRÉ le 02/08/2026. Il consommait l'endurance d'une capacité qui
      // n'existe pas : `dashEnduranceSpent` et `dashStaminaCost` n'étaient
      // déclarés NULLE PART ailleurs dans `src/` — ni sur `PlayerState`, ni sur
      // `PLAYER_CONFIG` — et aucun code ne posait le drapeau. La condition était
      // donc toujours fausse.
      //
      // Ce qui l'avait rendu invisible : deux `as any` sur la même ligne
      // (`(s as any).dashEnduranceSpent && (C as any).dashStaminaCost`). Sans
      // eux, `tsc` aurait refusé les deux champs dès le premier jour. Le
      // commentaire, lui, affirmait que la fonctionnalité était branchée.
      //
      // Le dash n'est pas implémenté : `CharacterController.ts:8` le range en
      // « extension future », et `MoveState` déclare `"dash"` sans jamais
      // l'assigner. Le jour où il arrivera, la consommation se pose dans le
      // contrôleur avec de VRAIS champs typés — pas ici avec des casts.

      // 4) Mouvement (mute playerPosition en place)
      ctrlRef.current?.update(dt, im, s);

      // 3b) Bruits de pas : un pas tous les FOOTSTEP_STRIDE mètres parcourus au
      //     sol → cadence proportionnelle à la vitesse réelle, sans timer fixe.
      if (s.grounded && s.horizontalSpeed > 1.0) {
        stepDistRef.current += s.horizontalSpeed * dt;
        if (stepDistRef.current >= FOOTSTEP_STRIDE) {
          stepDistRef.current = 0;
          audioManager.playFootstep(0.55);
        }
      } else {
        stepDistRef.current = 0;
      }

      // 4) Caméra FPS/TPS
      fpsCamRef.current.apply(cam, s, playerPosition.current, dt);
    }
  });

  return null;
}
