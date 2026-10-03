// ══════════════════════════════════════════════════════════════════════════════
// animation/AnimationController.ts — Contrôleur d'animation Three.js (impératif)
//
// Wrapper autour de THREE.AnimationMixer :
//   • résout chaque ActionId vers un clip (fallback multi-noms : Mixamo/Meshy/GLB)
//   • crossfade fluide entre actions (blending)
//   • one-shot (cast/jump/hit/death) avec retour auto à l'état précédent
//   • update(dt) à appeler chaque frame
//
// Utilisable depuis n'importe quel composant R3F via useFrame.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { ActionId } from "../types";
import { eventsForAction, type AnimEvent } from "./animEvents";
import { remapClipsToRig } from "./mixamoRetarget";
import { maskClipToBones } from "./boneMask";
import { animClipStore } from "./animClipStore";

// ── Os du bas du corps (normalisés, sans préfixe) ─────────────────────────────
// Sert à créer des clips "upper-body only" pour les overlays combat.
const LOWER_BODY_BONES = new Set([
  "leftupleg", "rightupleg", "leftleg", "rightleg",
  "leftfoot", "rightfoot", "lefttoebase", "righttoebase",
  "thigh_l", "thigh_r", "calf_l", "calf_r",
  "foot_l", "foot_r", "ball_l", "ball_r",
]);

/** Retire les pistes du bas du corps d'un clip pour un overlay upper-body.
 *  Garde la rotation des Hips (torsion torse), retire la position (root motion). */
function stripLowerBodyTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => {
    const dot = t.name.lastIndexOf(".");
    if (dot < 0) return true;
    const prop = t.name.slice(dot + 1);
    const raw = t.name.slice(0, dot);
    const bone = raw.replace(/^mixamorig:?/i, "").toLowerCase();
    if (bone === "hips" || bone === "pelvis") {
      return prop === "quaternion";
    }
    return !LOWER_BODY_BONES.has(bone);
  });
  if (tracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name + "_upper", clip.duration, tracks, clip.blendMode);
}

/** Actions éligibles à un overlay upper-body (combat sans bloquer la locomotion). */
const OVERLAY_ELIGIBLE: Set<ActionId> = new Set(["attack", "cast", "channeling"]);

/** Reconnaît le bassin, toutes conventions confondues (Meshy, Mixamo, UE). */
const PELVIS_BONE = /^(mixamorig:?)?(hips|pelvis)$/i;

/** Crée un clip additif procédural de crouch (2 keyframes : neutre → accroupi). */
function createCrouchClip(): THREE.AnimationClip {
  const dur = 0.5;
  const t = new Float32Array([0, dur]);
  const tracks: THREE.KeyframeTrack[] = [];

  const q0 = new THREE.Quaternion();
  // Hips : descente de 0.25 m
  tracks.push(new THREE.VectorKeyframeTrack(
    "Hips.position", t, new Float32Array([0, 0, 0, 0, -0.25, 0]),
  ));
  // Spine : inclinaison avant ~12°
  const qSpine = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0));
  tracks.push(new THREE.QuaternionKeyframeTrack(
    "Spine.quaternion", t,
    new Float32Array([q0.x, q0.y, q0.z, q0.w, qSpine.x, qSpine.y, qSpine.z, qSpine.w]),
  ));
  // Cuisses : flexion hanche ~-30°
  const qHip = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, 0));
  // Genoux : flexion ~50°
  const qKnee = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, 0, 0));
  for (const side of ["Left", "Right"]) {
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${side}UpLeg.quaternion`, t,
      new Float32Array([q0.x, q0.y, q0.z, q0.w, qHip.x, qHip.y, qHip.z, qHip.w]),
    ));
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${side}Leg.quaternion`, t,
      new Float32Array([q0.x, q0.y, q0.z, q0.w, qKnee.x, qKnee.y, qKnee.z, qKnee.w]),
    ));
  }
  return new THREE.AnimationClip("_crouch_additive", dur, tracks);
}

/** Noms de clips candidats par action (essayés dans l'ordre, 1er trouvé gagne). */
export const CLIP_CANDIDATES: Record<ActionId, string[]> = {
  idle: ["idle", "Idle", "iddle", "Idle_11", "Idle_3", "Breathing Idle", "Standing Idle", "mixamo.com",
    "idle_pose", "idle_breathing", "idle_break"],
  walk:       ["walk", "Walking", "Standing Walk Forward", "walk_forward"],
  run:        ["run", "Running", "Standing Run Forward", "run_forward"],
  sprint:     ["sprint", "Standing Sprint Forward", "Running"],
  jump:       ["jump", "Standing Jump", "Jump", "jump_airborne"],
  // `crouch_pose` EN TÊTE, et c'est indispensable : findClip essaie exact puis
  // sous-chaîne, candidat par candidat. Avec "crouch" en premier, aucun clip ne
  // s'appelle exactement ainsi → on tombait sur la branche SOUS-CHAÎNE, qui
  // matche indifféremment `crouch_pose`, `crouch_enter`, `crouch_exit` et
  // `crouchwalk_*`. Le gagnant était le premier ARRIVÉ dans un tableau rempli par
  // des chargements ASYNCHRONES : la pose accroupie changeait d'une session à
  // l'autre (chevilles mesurées de 0,175 à 0,784 selon le tirage). Un nom exact
  // en tête supprime le hasard.
  crouch:     ["crouch_pose", "crouch", "Crouch", "Crouching", "Crouch Idle", "Crouching Idle", "crouch_idle", "sneak", "Sneak", "Stealth Idle"],
  // "Rifle_Aim_Turn_Right" = pose de visée des PNJ Meshy (militaires) : sert de
  //   geste d'attaque/incantation faute de clip dédié. Placé en DERNIER → le
  //   Sorcier (qui a ses vrais clips Mixamo) n'est pas affecté.
  attack:     ["attack", "atk", "Standing 1H Magic Attack 01", "Standing Melee Attack", "Punch", "Rifle_Aim_Turn_Right"],
  cast:       ["cast", "Standing 2H Magic Attack 01", "Standing 1H Magic Attack 01", "Spellcast", "Rifle_Aim_Turn_Right"],
  channeling: ["channel", "Standing 2H Cast Spell 01", "Standing 2H Magic Attack 01", "Rifle_Aim_Turn_Right"],
  hit:        ["hit", "Hit Reaction", "Big Hit To Head", "Standing React Small From Front", "React", "Hit"],
  death:      ["death", "Dead", "die", "Dying", "Standing React Death Forward", "death_back"],
  dodge:      ["dodge", "roll", "Standing Jump", "Standing Walk Back"],
  ultimate:   ["ultimate", "Standing 2H Magic Area Attack 01", "Standing 2H Cast Spell 01"],
  // Les clips `attack_*_[LR]hand_*` viennent du pack FPP_combat_fists : 36 clips
  // latéralisés à la source (jab / hook / uppercut × gauche / droite × 3
  // vitesses). Ils passent AVANT les noms génériques pour que l'alternance
  // gauche-droite du combo soit réellement visible — cf. combat/unarmedStrikes.
  punch1:        ["attack_jab_fast_Rhand_01", "attack_jab_Rhand_01", "punch1", "Punching"],
  punch2:        ["attack_hook_Lhand_01", "attack_hook_fast_Lhand_01", "punch2", "Cross Punch"],
  punch3:        ["attack_uppercut_Rhand_01", "attack_uppercut_Lhand_01", "punch3", "Uppercut"],
  punch_charged: ["attack_uppercut_slow_Rhand_01", "punch_charged", "Punch Combo"],
  // Un SEUL coup de pied existe dans toute la bibliothèque (vérifié sur
  // animations/, assets_character/, systemes/, personnages/). Le pied gauche
  // s'obtient par `mirrorClip`, pas par un second fichier.
  kick:          ["attack_special_kick", "kick", "Roundhouse Kick"],
  kick_charged:  ["attack_special_kick", "kick_charged", "Martelo"],
  bighit:        ["bighit", "Big Hit To Head"],
  block:         ["block", "hit", "Hit Reaction"],
  stun:          ["stun", "Stunned"],
  fall:          ["fall", "Falling", "Falling Idle", "falling_idle"],
  landing:       ["landing", "Landing", "Hard Landing", "Standing Land"],
  ability_e:              ["Ability_E_0", "Ability_E"],
  ability_e_recovery:     ["Ability_E_Recovery_0", "Ability_E_Recovery"],
  ability_e_targeting_loop:  ["Ability_E_Targeting_Loop_0", "Ability_E_Targeting_Loop"],
  ability_e_targeting_start: ["Ability_E_Targeting_Start_0", "Ability_E_Targeting_Start"],
  ability_q:              ["Ability_Q_Fire_0", "Ability_Q_Fire"],
  slide:      ["slide", "Slide", "Sliding", "crouch", "Crouch", "Crouching"],
  // Les clips d'escalade arrivent déjà renommés par UTA_TRAVERSAL : le nom
  // d'action EST le nom du clip, d'où une liste de candidats à une seule entrée.
  climb_start: ["climb_start"],
  climb_idle:  ["climb_idle"],
  climb_up_l:  ["climb_up_l"],
  climb_up_r:  ["climb_up_r"],
  climb_top:   ["climb_top"],
};

/** Repli d'action quand le clip demandé est ABSENT : essaie ces actions dans l'ordre AVANT
 *  de retomber sur idle. Cas clé : un monstre (anims embarquées) sans clip "run" mais avec
 *  "walk" → quand l'IA demande "run" (Npc joue run dès qu'il bouge), on joue "walk" au lieu de
 *  glisser figé en idle. Idem sprint↔run↔walk + crouch→idle. */
export const ACTION_FALLBACK: Partial<Record<ActionId, ActionId[]>> = {
  run:    ["walk", "sprint"],
  sprint: ["run", "walk"],
  walk:   ["run"],
  crouch: ["idle"],
  slide:  ["crouch", "run", "idle"],
  // Si un clip d'escalade manque, mieux vaut la pose d'accroche que l'idle
  // debout : le personnage reste plaqué au mur au lieu de flotter droit.
  climb_start: ["climb_idle", "jump", "idle"],
  climb_up_l:  ["climb_idle", "idle"],
  climb_up_r:  ["climb_idle", "idle"],
  climb_top:   ["climb_idle", "landing", "idle"],
  fall:    ["idle"],
  landing: ["idle"],
};

/** Résout l'action réellement jouable : la demandée si dispo, sinon le 1er repli dispo,
 *  sinon "idle" si dispo, sinon null (l'appelant prend n'importe quelle action). Pur → testable. */
export function resolveAction(action: ActionId, available: ReadonlySet<ActionId>): ActionId | null {
  if (available.has(action)) return action;
  for (const alt of ACTION_FALLBACK[action] ?? []) if (available.has(alt)) return alt;
  return available.has("idle") ? "idle" : null;
}

/** Actions one-shot (ne bouclent pas, reviennent à l'état précédent). */
const ONE_SHOT: Set<ActionId> = new Set([
  "attack", "cast", "channeling", "hit", "jump", "dodge", "ultimate",
  "punch1", "punch2", "punch3", "punch_charged", "kick", "kick_charged", "bighit", "block", "landing",
  "ability_e", "ability_e_recovery", "ability_e_targeting_start", "ability_q",
]);

/**
 * Repli des DIAGONALES vers les cardinales, pour l'accroupi.
 *
 * `solveLocomotion` raisonne sur 8 directions (un cran tous les 45°), mais
 * `CROUCH_LOCOMOTION` ne fournit que 4 clips : forward, back, left, right.
 * Sans ce repli, une clé `crouchwalk_forwardRight` ne correspond à aucune
 * action : son poids disparaît, et le personnage se déplace en diagonale avec
 * une animation qui ne le montre pas.
 *
 * Chaque diagonale est donc répartie à parts égales sur les deux cardinales qui
 * l'encadrent — la moyenne de deux clips voisins reste lisible, là où la perte
 * pure produisait un glissement.
 */
const CROUCH_FALLBACK: Record<string, ReadonlyArray<readonly [string, number]>> = {
  forwardRight: [["forward", 0.5], ["right", 0.5]],
  forwardLeft:  [["forward", 0.5], ["left", 0.5]],
  backRight:    [["back", 0.5],    ["right", 0.5]],
  backLeft:     [["back", 0.5],    ["left", 0.5]],
};

export interface AnimationControllerOptions {
  /** Durée de crossfade par défaut (s). */
  fadeDuration?: number;
  /** Action de départ. */
  initial?: ActionId;
  /**
   * Callback déclenché quand le playhead du MIXER franchit un AnimEvent (cf.
   * animEvents.ts). Frame-exact, lié à l'horloge de l'animation — PAS à un timer
   * global. Sert au recoil caméra (camera/recoilDispatcher), futurs sfx/vfx.
   */
  onEvent?: (ev: AnimEvent) => void;
  /** Clé avatar : enregistre les clips dispo (éditeur) + applique les overrides d'anim. */
  avatarKey?: string;
  /** État du perso : "base" (arme rangée) ou "drawn" (dégainée) → clips/override distincts. */
  avatarMode?: string;
  /**
   * Force le re-mapping des pistes vers les os RÉELS du rig, SANS les effets de
   * bord d'`avatarKey` (enregistrement éditeur, overrides d'anim).
   *
   * Nécessaire pour un PNJ dont le squelette n'est PAS en convention Meshy —
   * typiquement un rig UE4/Paragon (`pelvis`, `spine_01`…) qui reçoit le set de
   * clips partagé `soldat_humain` (`Hips`, `Spine`…). Sans remap, aucune piste
   * ne se lie et le PNJ reste figé en T-pose.
   */
  remapToRig?: boolean;
}

export class AnimationController {
  private root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<ActionId, THREE.AnimationAction>();
  /** Clips directionnels (`walk_forward`, `run_left`…), mélangés par poids. */
  private locoActions = new Map<string, THREE.AnimationAction>();
  /** Poids courant de la couche de locomotion, lissé pour éviter les à-coups. */
  private locoLayerWeight = 0;
  /** Dernière répartition non vide — rejouée pendant le fondu d'arrêt. */
  private lastLocoWeights: ReadonlyArray<{ dir: string; weight: number }> = [];
  // Mémorise aussi "crouchwalk" : sur un arrêt, `weights` se vide et cette
  // valeur sert de repli pendant le fondu descendant. La garder en "walk"
  // rebasculerait le personnage debout sur la dernière frame d'un arrêt accroupi.
  private lastLocoGait: "walk" | "run" | "crouchwalk" = "walk";
  private current: ActionId | null = null;
  private fadingOut: THREE.AnimationAction | null = null; // action en fondu-sortie d'un swap
  private previousLooping: ActionId = "idle";
  private fade: number;
  private oneShotTimer = 0;
  // ── Animation Events (frame-exact, horloge du mixer) ──────────────────────────
  private onEvent?: (ev: AnimEvent) => void;
  private events: AnimEvent[] = [];   // events de l'action courante
  private eventCursor = 0;            // dernier temps normalisé (0..1) traité
  /**
   * Action DONT ON LIT le playhead pour déclencher les events.
   *
   * Ce n'est pas toujours `actions.get(this.current)` : un overlay upper-body
   * joue son propre clip, sur sa propre horloge, sans jamais toucher `current`.
   * Sans cette référence, les events d'une attaque étaient cadencés par le cycle
   * de MARCHE en cours — un recul réglé à 30 % du clip d'attaque partait à 30 %
   * du pas. La source était déduite à deux endroits, de deux façons différentes.
   */
  private eventAction: THREE.AnimationAction | null = null;
  private avatarKey?: string;         // pour les overrides d'anim (éditeur)
  private avatarMode = "base";        // "base" (rangé) / "drawn" (dégainé)
  private remapToRig = false;         // remap des pistes sans les effets d'avatarKey

  // ── Overlay upper-body (combat sans bloquer la locomotion) ──────────────────
  private upperBodyActions = new Map<ActionId, THREE.AnimationAction>();
  private overlayAction: THREE.AnimationAction | null = null;
  private overlayTimer = 0;
  private overlayTarget: ActionId | null = null;

  // ── Crouch additif (pose procédurale blendée par-dessus la locomotion) ──────
  private crouchAction: THREE.AnimationAction | null = null;
  private crouchWeight = 0;
  private crouchTarget = 0;
  /** true si la pose accroupie vient du repli procédural (exposé au HUD debug). */
  private crouchIsProcedural = false;

  constructor(
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    opts: AnimationControllerOptions = {}
  ) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    this.fade = opts.fadeDuration ?? 0.2;
    this.onEvent = opts.onEvent;
    this.avatarKey = opts.avatarKey;
    this.avatarMode = opts.avatarMode ?? "base";
    this.remapToRig = opts.remapToRig ?? false;
    this.loadClips(clips);
    const start = opts.initial ?? "idle";
    this.play(start, 0);
  }

  /** (Re)résout le jeu de clips sur le MÊME mixer (remap joueur caché + résolution
   *  des actions). Ne recrée PAS le mixer → réutilisable par setClips sans hitch. */
  private loadClips(clips: THREE.AnimationClip[]) {
    // RE-MAPPING UNIVERSEL : adapte les pistes aux os RÉELS de `root`. COÛTEUX (traverse
    // du squelette + normalisation) → JOUEUR uniquement (avatarKey). Caché par WeakMap
    // (mixamoRetarget) → un 2e appel sur les mêmes clips est quasi gratuit.
    const remapped = (this.avatarKey || this.remapToRig) ? remapClipsToRig(this.root, clips) : clips;
    if (this.avatarKey) animClipStore.registerClips(this.avatarKey, this.avatarMode, remapped.map((c) => c.name));
    this.actions.clear();
    this.resolveActions(remapped);
    if (this.avatarKey) {
      const resolved = [...this.actions.keys()];
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[AnimCtrl] ${this.avatarKey}: ${clips.length} clips in, ${remapped.length} remapped, actions=[${resolved.join(",")}]`);
        for (const c of remapped) {
          const scaleCount = c.tracks.filter((t) => t.name.endsWith(".scale")).length;
          const posCount = c.tracks.filter((t) => t.name.endsWith(".position")).length;
          const quatCount = c.tracks.filter((t) => t.name.endsWith(".quaternion")).length;
          console.info(`  [AnimCtrl]   clip="${c.name}" tracks=${c.tracks.length} (pos=${posCount} quat=${quatCount} scale=${scaleCount}) dur=${c.duration.toFixed(2)}s`);
        }
      }
      this.debugBindings();
    }
  }

  /**
   * Remplace le jeu de clips SANS recréer le mixer (≠ dispose+new) → élimine le hitch
   * au dégainage/rengainage (qui rebâtissait mixer + 780 bindings à chaque touche F).
   * Re-résout les actions et FAIT UN CROSSFADE de l'action courante vers sa nouvelle
   * version (ex: idle de base → idle d'arme) en synchronisant le playhead (pas de snap).
   * @param avatarMode bascule "base"↔"drawn" (résolution des overrides) en même temps.
   */
  setClips(clips: THREE.AnimationClip[], avatarMode?: string) {
    if (avatarMode !== undefined) this.avatarMode = avatarMode;
    // Stoppe l'action en fondu-sortie du swap PRÉCÉDENT (crossFadeTo ne la stoppe pas tout
    // seul → sinon des actions à poids 0 mais `enabled` s'accumulent et le mixer les évalue).
    if (this.fadingOut) { this.fadingOut.stop(); this.fadingOut = null; }
    const prevAction = this.current ? this.actions.get(this.current) : undefined;
    const prevTime = prevAction?.time ?? 0;
    this.loadClips(clips);
    const cur = this.current ?? "idle";
    const next = this.actions.get(cur) ?? this.actions.get("idle") ?? this.actions.values().next().value;
    if (!next || next === prevAction) return; // même clip → rien à transférer
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1.0);
    // Sync du playhead (clips de locomotion ≈ même durée) → pas de saut visuel.
    if (prevAction && !ONE_SHOT.has(cur) && cur !== "death") {
      next.time = prevTime % Math.max(0.0001, next.getClip().duration);
    } else {
      next.reset();
    }
    next.play();
    // One-shot remplacé en cours (clip différent par mode) → re-cale le timer de retour.
    if (ONE_SHOT.has(cur)) this.oneShotTimer = next.getClip().duration;
    if (prevAction && prevAction !== next) {
      prevAction.crossFadeTo(next, this.fade, false);
      this.fadingOut = prevAction; // stoppée au prochain setClips (borne à 1 action résiduelle)
    }
  }

  /**
   * (Ré)arme la liste d'events pour une action, en calant le curseur sur le
   * playhead courant (évite de re-déclencher des events déjà passés).
   *
   * @param act L'action RÉELLEMENT jouée, quand ce n'est pas `actions.get(action)`.
   *            C'est le cas d'un overlay upper-body : son clip vit dans
   *            `upperBodyActions`, et l'action full-body du même nom ne tourne
   *            pas. Caler le curseur sur cette dernière revenait à le lire sur
   *            une horloge arrêtée.
   */
  private armEvents(action: ActionId, act?: THREE.AnimationAction): void {
    this.events = this.onEvent ? eventsForAction(action) : [];
    this.eventAction = act ?? this.actions.get(action) ?? null;
    if (this.events.length === 0) { this.eventCursor = 1; return; }
    const src = this.eventAction;
    const dur = src?.getClip().duration || 1;
    this.eventCursor = src ? Math.min(1, src.time / dur) : 0;
  }

  /** Associe chaque ActionId à une AnimationAction (fallback multi-noms). */
  private resolveActions(clips: THREE.AnimationClip[]) {
    const findClip = (candidates: string[]): THREE.AnimationClip | null => {
      for (const name of candidates) {
        const lower = name.toLowerCase();
        const exact = clips.find((c) => c.name === name);
        if (exact) return exact;
        const ci = clips.find((c) => c.name.toLowerCase() === lower);
        if (ci) return ci;
        const incl = clips.find((c) => c.name.toLowerCase().includes(lower));
        if (incl) return incl;
      }
      return null;
    };

    (Object.keys(CLIP_CANDIDATES) as ActionId[]).forEach((action) => {
      // Override d'anim (éditeur) prioritaire : si l'utilisateur a assigné un clip précis
      // à cette action pour cet avatar, on le cherche EN PREMIER.
      const ov = this.avatarKey ? animClipStore.getOverride(this.avatarKey, this.avatarMode, action) : undefined;
      const clip = findClip(ov ? [ov, ...CLIP_CANDIDATES[action]] : CLIP_CANDIDATES[action]);
      if (clip) {
        const act = this.mixer.clipAction(clip);
        if (ONE_SHOT.has(action)) {
          act.setLoop(THREE.LoopOnce, 1);
          act.clampWhenFinished = true;
        } else if (action === "death") {
          // La mort se joue UNE fois et fige sur la dernière frame (pas de boucle,
          // pas de retour auto vers idle : death n'est pas dans ONE_SHOT).
          act.setLoop(THREE.LoopOnce, 1);
          act.clampWhenFinished = true;
        } else {
          act.setLoop(THREE.LoopRepeat, Infinity);
        }
        this.actions.set(action, act);
      }
    });

    // ── Clips de locomotion DIRECTIONNELS ────────────────────────────────────
    // Nommés `walk_forward`, `run_backLeft`… Ils vivent dans une map SÉPARÉE de
    // `actions` : les ajouter à CLIP_CANDIDATES obligerait à étendre ActionId de
    // 16 entrées, chacune avec sa liste de candidats, pour un système qui ne se
    // pilote pas par `play()` mais par poids simultanés.
    this.locoActions.clear();
    for (const clip of clips) {
      if (!/^(walk|run|crouchwalk)_[a-zA-Z]+$/.test(clip.name)) continue;
      const act = this.mixer.clipAction(clip);
      act.setLoop(THREE.LoopRepeat, Infinity);
      act.enabled = true;
      act.setEffectiveWeight(0); // inactif tant que setLocomotionBlend ne l'active pas
      act.play();                // toujours en lecture : seul le poids varie
      this.locoActions.set(clip.name, act);
    }

    // Filet de sécurité : si pas d'idle trouvé mais des clips existent,
    // mappe idle sur le 1er clip (évite un perso figé).
    //
    // ⚠ CE FILET MASQUE LES PANNES. Quand AUCUNE action ne se résout, le perso
    // joue quand même clips[0] en boucle — vu de l'extérieur, « seul l'idle
    // fonctionne ». Ce symptôme a déjà coûté trois cycles de correction sur de
    // fausses pistes. On l'annonce donc explicitement.
    if (!this.actions.has("idle") && clips.length > 0) {
      // NE JAMAIS replier "idle" sur un clip de FRAPPE.
      //
      // Les clips arrivent par paliers, dans l'ordre où le réseau les termine —
      // pas dans l'ordre du catalogue. Les clips de poing étant les plus légers
      // (0,83 Mo après dégraissage) ils arrivent EN PREMIER, si bien que
      // `clips[0]` valait `punch1` : le personnage prenait une pose de coup de
      // poing en guise d'idle pendant tout le chargement.
      //
      // Un clip one-shot est par nature le pire repli possible pour une action
      // qui doit boucler. On prend donc le premier clip qui n'en est pas un.
      const estFrappe = (nom: string) =>
        [...ONE_SHOT].some((a) => (CLIP_CANDIDATES[a] ?? []).includes(nom)) ||
        /^(punch|kick|attack|hit|block|dodge)/i.test(nom);
      const repli = clips.find((c) => !estFrappe(c.name)) ?? clips[0];

      const act = this.mixer.clipAction(repli);
      act.setLoop(THREE.LoopRepeat, Infinity);
      this.actions.set("idle", act);
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[AnimCtrl] AUCUN clip "idle" résolu → repli sur "${repli.name}". ` +
          `Actions réellement résolues : [${[...this.actions.keys()].join(", ")}] ` +
          `sur ${clips.length} clips fournis : [${clips.map((c) => c.name).join(", ")}]`,
        );
      }
    }

    // Diagnostic de LOCOMOTION : c'est le cas qui casse en silence le plus
    // souvent, et celui que l'utilisateur voit en premier.
    if (process.env.NODE_ENV !== "production") {
      const missing = (["walk", "run", "sprint"] as ActionId[]).filter((a) => !this.actions.has(a));
      if (missing.length > 0) {
        console.warn(
          `[AnimCtrl] locomotion INCOMPLÈTE — aucune action pour [${missing.join(", ")}]. ` +
          `Le perso glissera sans animer. Clips disponibles : [${clips.map((c) => c.name).join(", ")}]`,
        );
      }
    }

    // ── Upper-body overlays : clips combat sans pistes jambes ────────────────
    this.upperBodyActions.clear();
    for (const actionId of OVERLAY_ELIGIBLE) {
      const baseAction = this.actions.get(actionId);
      if (!baseAction) continue;
      const baseClip = baseAction.getClip();
      const upper = stripLowerBodyTracks(baseClip);
      if (upper === baseClip) continue;
      const act = this.mixer.clipAction(upper);
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      this.upperBodyActions.set(actionId, act);
    }

    // ── Crouch additif procédural (si aucun vrai clip trouvé) ────────────────
    // resolveActions() est rejoué à chaque setClips() (dégainer/ranger) : SANS le
    // stop+uncache ci-dessous, chaque passage empile une action additive au poids
    // courant → pose accroupie permanente qui se cumule à chaque appui sur F.
    // L'ADDITIF SE CONSTRUIT DÈS QU'ON A UNE POSE CAPTURÉE — pas seulement quand
    // aucune action "crouch" n'existe.
    //
    // L'ancienne garde était `if (!this.actions.has("crouch"))`. Or
    // CLIP_CANDIDATES résout par SOUS-CHAÎNE : le clip `crouch_pose`, qui n'est
    // là que pour servir de source à l'additif, se faisait aussi enregistrer
    // comme action "crouch". La garde sautait donc, `crouchAction` restait null,
    // et `setCrouch()` devenait un no-op silencieux — plus aucun accroupissement.
    //
    // Les deux mécanismes sont complémentaires et doivent coexister :
    //   • l'ACTION "crouch" = pose complète, jouée à l'arrêt
    //   • l'ADDITIF         = superposé à la locomotion, pour marcher accroupi
    const hasCapturedCrouch = this.findRawClip(clips, "crouch_pose") !== undefined;
    if (hasCapturedCrouch || !this.actions.has("crouch")) {
      if (this.crouchAction) {
        this.crouchAction.stop();
        this.mixer.uncacheClip(this.crouchAction.getClip());
      }

      // POSE ACCROUPIE — capturée de préférence, générée en dernier recours.
      //
      // `createCrouchClip()` fabrique des rotations d'os à la main. Additionnée
      // à un cycle de marche, elle TORD les jambes : ce sont des angles estimés,
      // pas une pose réelle, et l'erreur se cumule avec celle du clip de base.
      //
      // Quand le pack UTA est chargé on dispose d'un vrai squat capturé sur le
      // même rig. On le convertit en additif via `makeClipAdditive`, qui soustrait
      // une pose de RÉFÉRENCE — ici l'idle du MÊME pack, donc exactement la pose
      // neutre dont le squat est l'écart. C'est ce qui rend l'addition correcte
      // au lieu d'approximative.
      const captured = this.findRawClip(clips, "crouch_pose");
      const reference = this.findRawClip(clips, "idle_uta");
      let raw: THREE.AnimationClip;
      if (captured && reference) {
        // Signature Three.js : (targetClip, referenceFrame, referenceClip, fps).
        //
        // Le 4ᵉ argument est un FRAMERATE — il sert uniquement à convertir
        // `referenceFrame` (un indice d'image) en instant : `referenceFrame / fps`.
        // On lui passait `this.mixer.timeScale`, qui vaut ~1 : un timeScale n'est
        // pas un framerate, et l'écart est d'un facteur 30.
        //
        // Inoffensif AUJOURD'HUI parce que `referenceFrame` vaut 0 et que 0/1
        // égale 0/30. Mais le jour où quelqu'un veut prendre la pose de référence
        // ailleurs qu'à la première image, la soustraction viserait un instant 30×
        // trop loin — et l'additif serait faux sans que rien ne le signale.
        //
        // On laisse donc le défaut (30). La pose de référence reste la PREMIÈRE
        // image de `reference`, ce qui est bien l'intention : `idle_uta` est la
        // pose neutre dont le squat est l'écart.
        const additive = THREE.AnimationUtils.makeClipAdditive(
          captured.clone(), 0, reference,
        );
        // MASQUE D'OS — sans lui, l'additif reste faux même avec la bonne
        // référence. Une couche additive MULTIPLIE ses quaternions avec ceux du
        // dessous ; sur le bassin et la colonne, qui tournent déjà beaucoup en
        // marchant, les deux rotations se cumulent et la vrille se propage aux
        // cuisses. On ne garde donc que les jambes : ce sont elles qui abaissent
        // le personnage, et le cycle de marche garde la main sur le buste.
        raw = maskClipToBones(additive, "legsOnly");
        this.crouchIsProcedural = false;
      } else {
        raw = createCrouchClip();
        this.crouchIsProcedural = true;
        // On n'avertit QUE si des clips sont réellement arrivés : au tout premier
        // montage la liste est vide (chargement asynchrone en cours) et un
        // avertissement ici serait un faux positif à chaque partie.
        // On n'avertit QUE pour un personnage doté du pack de locomotion complet.
        // Les PNJ (marchand, maître d'armes) n'ont que 4-5 clips et n'ont jamais
        // vocation à s'accroupir : les signaler noyait la console d'alertes sans
        // objet, une par PNJ monté.
        const hasFullPack = clips.some((c) => /^walk_/.test(c.name));
        // Les clips sont PUBLIÉS PAR PALIERS (OwnAnimPlayerCharacter publie tous
        // les 8 fichiers chargés). `setClips` est donc appelé plusieurs fois avec
        // une liste qui grossit, et `crouch_pose` arrive au 3ᵉ palier. Avertir dès
        // le 1ᵉʳ annonçait « déformations attendues » pour un état qui se corrige
        // 200 ms plus tard, à chaque partie — un faux positif qui envoie le
        // prochain débogage sur une fausse piste. On n'avertit donc qu'une fois
        // le pack de traversée arrivé : s'il est là et que la pose manque encore,
        // c'est un vrai problème d'asset.
        const traversalArrived = clips.some((c) => /^(jump_start|climb_start)$/.test(c.name));
        if (process.env.NODE_ENV !== "production" && hasFullPack && traversalArrived) {
          console.warn(
            "[AnimCtrl] pose accroupie PROCÉDURALE (clip 'crouch_pose' absent des " +
            `${clips.length} clips chargés) — déformations attendues en marche accroupie`,
          );
        }
      }
      const remapped = this.avatarKey ? remapClipsToRig(this.root, [raw])[0] : raw;
      const act = this.mixer.clipAction(remapped);
      act.setLoop(THREE.LoopRepeat, Infinity);
      act.blendMode = THREE.AdditiveAnimationBlendMode;
      act.setEffectiveWeight(this.crouchWeight);
      act.setEffectiveTimeScale(0);
      act.time = remapped.duration - 0.001; // évite le wrap LoopRepeat (duration → 0)
      act.play();
      this.crouchAction = act;
    }
  }

  /**
   * Joue une action avec crossfade. Résout le fallback : si l'action n'a pas de
   * clip, remonte vers idle.
   */
  play(action: ActionId, fade = this.fade) {
    let target = action;
    let next = this.actions.get(target);
    if (!next) {
      // Repli intelligent : run→walk→sprint→idle (cf. ACTION_FALLBACK) AVANT de retomber
      // sur idle/n'importe-quoi → un monstre sans clip "run" marche au lieu de glisser figé.
      const resolved = resolveAction(action, new Set(this.actions.keys()));
      target = resolved ?? "idle";
      next = (resolved ? this.actions.get(resolved) : undefined) ?? this.actions.values().next().value;
      if (!next) return;
    }
    if (target === this.current) {
      // Action déjà courante. Pour un LOOP → no-op. Pour un ONE-SHOT (cast/attack
      // spammé) → on le RELANCE depuis le début, sinon une 2e incantation rapide
      // ne rejouerait jamais l'animation d'attaque ("attaque qui ne réagit pas").
      if (!ONE_SHOT.has(target)) return;
      next.reset();
      next.enabled = true;
      next.setEffectiveWeight(1);
      next.play();
      this.oneShotTimer = next.getClip().duration;
      this.armEvents(target); // relance one-shot → ré-arme les events depuis le début
      return;
    }

    const prev = this.current ? this.actions.get(this.current) : undefined;

    // Ne reset le temps QUE si l'action était arrêtée ou clampée en fin.
    // Sinon, laisser le playhead où il était → élimine le flash T-pose
    // du frame 0 pendant les crossfades.
    const wasStopped = !next.isRunning() || (next.clampWhenFinished && next.time >= next.getClip().duration - 0.02);
    if (wasStopped) {
      next.reset();
    }
    next.enabled = true;
    next.setEffectiveWeight(1);
    // timeScale neutre : la locomotion (walk/sprint) est pilotée par setLocomotionTimeScale
    // (vitesse réelle) → éviter le double-write qui faisait « lutter » deux sources (jitter).
    next.setEffectiveTimeScale(1.0);
    next.play();
    if (prev && prev !== next) {
      prev.crossFadeTo(next, fade, false);
    }

    if (this.avatarKey) {
      const clip = next.getClip();
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[AnimCtrl] ${this.avatarKey}: ${String(this.current)}→${target} clip="${clip.name}" tracks=${clip.tracks.length} dur=${clip.duration.toFixed(2)}s`);
      }
    }
    this.current = target;
    if (!ONE_SHOT.has(target)) {
      this.previousLooping = target;
      this.oneShotTimer = 0;
    } else {
      // Durée du one-shot (pour revenir à l'état loop ensuite)
      const clip = next.getClip();
      this.oneShotTimer = clip.duration;
    }
    this.armEvents(target);
  }

  /** À appeler chaque frame. Gère le retour auto après un one-shot. */
  update(dt: number) {
    this.mixer.update(dt);

    // ── Animation Events : déclenchement à la frame exacte (horloge mixer) ──────
    // Le playhead de l'action courante a avancé de `dt × timeScale` ; on émet les
    // events dont le temps normalisé `at` vient d'être franchi. Les actions à
    // events sont des one-shots (cast/attack/ultimate) → progression monotone 0→1.
    // La source est `eventAction`, posée par `armEvents` — PAS re-déduite depuis
    // `this.current`. Un overlay ne modifie pas `current` : le relire ici faisait
    // cadencer les events d'attaque par le cycle de locomotion.
    if (this.onEvent && this.events.length > 0 && this.eventAction) {
      const act = this.eventAction;
      const dur = act.getClip().duration || 1;
      const norm = Math.min(1, act.time / dur);
      if (norm > this.eventCursor) {
        for (const ev of this.events) {
          if (ev.at > this.eventCursor && ev.at <= norm) this.onEvent(ev);
        }
        this.eventCursor = norm;
      }
    }

    if (this.oneShotTimer > 0 && this.current && ONE_SHOT.has(this.current)) {
      this.oneShotTimer -= dt;
      if (this.oneShotTimer <= 0) {
        this.play(this.previousLooping, 0.15);
      }
    }

    // ── Overlay upper-body : retour auto à la fin du clip ──────────────────────
    if (this.overlayAction && this.overlayTimer > 0) {
      this.overlayTimer -= dt;
      if (this.overlayTimer <= 0) {
        this.overlayAction.fadeOut(0.15);
        // Désarmer les events AVEC l'overlay : son action continue de tourner
        // pendant le fondu, et en boucle son playhead repasserait par 0 — les
        // events de l'attaque se redéclencheraient au tour suivant.
        if (this.eventAction === this.overlayAction) {
          this.events = [];
          this.eventCursor = 1;
          this.eventAction = null;
        }
        this.overlayAction = null;
        this.overlayTarget = null;
      }
    }

    // ── Crouch additif : lerp fluide du poids ─────────────────────────────────
    if (this.crouchAction && this.crouchWeight !== this.crouchTarget) {
      this.crouchWeight = THREE.MathUtils.lerp(
        this.crouchWeight, this.crouchTarget, 1 - Math.exp(-10 * dt),
      );
      if (Math.abs(this.crouchWeight - this.crouchTarget) < 0.01) this.crouchWeight = this.crouchTarget;
      this.crouchAction.setEffectiveWeight(this.crouchWeight);
    }

    // Émote one-shot : retour auto quand le clip est terminé.
    if (this.emotePlaying && this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.cancelEmote(0.2);
    }
  }

  /** Action loop courante (idle/walk/run/sprint). */
  get currentAction(): ActionId | null {
    return this.current;
  }

  /**
   * Synchronise la VITESSE DE LECTURE de l'action de locomotion courante à la
   * vitesse réelle du perso. Sans ça, le clip "Running" (auteuré pour ~6 m/s)
   * joué à vitesse de marche donne une "course frénétique sur place".
   * Sans effet sur les one-shots, idle et death (leur cadence est fixe).
   */
  setLocomotionTimeScale(scale: number): void {
    const cur = this.current;
    if (!cur || cur === "idle" || cur === "death" || ONE_SHOT.has(cur)) return;
    this.actions.get(cur)?.setEffectiveTimeScale(scale);
  }

  /**
   * Joue un clip de combat en OVERLAY upper-body : la locomotion bas du corps
   * continue pendant que le torse/bras jouent l'attaque. Retour auto à la fin.
   * Fallback full-body si pas de clip upper-body dispo.
   */
  playOverlay(action: ActionId, fade = this.fade): void {
    const next = this.upperBodyActions.get(action);
    if (!next) {
      this.play(action, fade);
      return;
    }
    if (this.overlayAction && this.overlayAction !== next) {
      this.overlayAction.fadeOut(fade);
    }
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(3);
    next.setEffectiveTimeScale(1);
    next.play();
    this.overlayAction = next;
    this.overlayTimer = next.getClip().duration;
    this.overlayTarget = action;
    // `next` explicitement : c'est le clip upper-body qui tourne, pas l'action
    // full-body du même nom.
    this.armEvents(action, next);
  }

  /** true si un overlay upper-body est en cours. */
  get isOverlayPlaying(): boolean { return this.overlayAction !== null && this.overlayTimer > 0; }

  /** Active/désactive la pose de crouch additive (lerp fluide). */
  /** Retrouve un clip BRUT par son nom exact dans le lot fourni à setClips. */
  private findRawClip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | undefined {
    return clips.find((c) => c.name === name);
  }

  /** Le blend directionnel est-il utilisable (clips chargés) ? */
  get hasLocomotionBlend(): boolean { return this.locoActions.size > 0; }
  /** Nombre de clips directionnels enregistrés — diagnostic. */
  get locomotionClipCount(): number { return this.locoActions.size; }
  /**
   * Les clips de marche ACCROUPIE sont-ils chargés ?
   *
   * `hasLocomotionBlend` ne suffit pas : il est vrai dès qu'un seul clip
   * directionnel existe, accroupi ou non. Sans ce getter, `OwnAnimPlayerCharacter`
   * ne pouvait pas choisir entre les vrais clips accroupis et le repli additif
   * (qui déforme la pose) — il l'appelait quand même, d'où deux erreurs tsc.
   */
  get hasCrouchwalkLocomotion(): boolean {
    for (const name of this.locoActions.keys()) {
      if (name.startsWith("crouchwalk_")) return true;
    }
    return false;
  }

  // ── Introspection pour le HUD de debug ──────────────────────────────────────
  /** La pose accroupie est-elle le repli procédural (donc déformante) ? */
  get isCrouchProcedural(): boolean { return this.crouchIsProcedural; }

  /**
   * Descente de bassin portée par le CLIP accroupi lui-même, en unités du rig.
   *
   * ⚠️ Vaut normalement `0` chez le joueur, et c'est CORRECT — ne pas s'en
   * servir pour conclure « le crouch est cassé ». `remapOne` supprime toutes les
   * pistes `.position`, mais l'abaissement est restitué un cran plus haut par
   * `OwnAnimPlayerCharacter` (`og.position.y -= CROUCH_PELVIS_DROP × échelle`).
   *
   * Ce report est légitime : mesuré sur `Anim_Crouch_Idle_Hip`, bassin, genou,
   * cheville et pointe descendent TOUS de 0,373 — la pose se translate en bloc,
   * donc un offset de groupe la reproduit exactement. Ajouter en plus une
   * descente d'os doublerait l'abaissement et enfoncerait le personnage.
   *
   * Utile pour distinguer les deux sources quand une pose accroupie paraît
   * fausse : `0` ⇒ c'est l'offset de groupe qui travaille ; `> 0` ⇒ le clip
   * porte sa propre descente (cas des rigs non remappés, PNJ).
   */
  get crouchPelvisDrop(): number {
    if (!this.crouchAction) return 0;
    for (const t of this.crouchAction.getClip().tracks) {
      const dot = t.name.lastIndexOf(".");
      if (dot < 0 || t.name.slice(dot + 1) !== "position") continue;
      if (!PELVIS_BONE.test(t.name.slice(0, dot))) continue;
      // Écart vertical le plus négatif de la piste = amplitude de la descente.
      let minY = 0;
      for (let i = 1; i < t.values.length; i += 3) minY = Math.min(minY, t.values[i]);
      return -minY;
    }
    return 0;
  }
  /** Actions réellement résolues à un clip. */
  get resolvedActions(): string[] { return [...this.actions.keys()]; }
  /**
   * Clips directionnels actifs, leur poids et leur playhead (> 0 seulement).
   *
   * `time` a été ajouté après le bug A1 : des clips au BON poids restaient
   * épinglés sur leur première image parce que le recalage de phase les remettait
   * à 0 chaque frame. Sans le playhead, le HUD affichait « forward 0.5 · right
   * 0.5 » — c'est-à-dire exactement ce qu'on attend — pendant que le personnage
   * glissait en statue. Un poids juste ne prouve pas qu'un clip AVANCE.
   */
  get activeLocomotion(): { name: string; weight: number; time: number }[] {
    const out: { name: string; weight: number; time: number }[] = [];
    for (const [name, act] of this.locoActions) {
      const w = act.getEffectiveWeight();
      if (w > 0.001) out.push({ name, weight: w, time: act.time });
    }
    return out.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Applique un mélange de locomotion directionnel.
   *
   * Contrairement à `play()`, qui fait un crossfade vers UNE action, cette
   * méthode fait tourner plusieurs clips en parallèle et ne joue que sur leurs
   * POIDS. C'est ce qui permet d'obtenir une diagonale : 50 % avant + 50 % droite,
   * plutôt qu'un troisième clip dédié.
   *
   * Deux détails sans lesquels le rendu est mauvais :
   *
   * 1. PHASE SYNCHRONISÉE — les clips mélangés doivent avoir le même temps de
   *    lecture, sinon le pied gauche d'un clip croise le pied droit de l'autre
   *    et le personnage patine. On aligne donc `act.time` sur une phase commune,
   *    proportionnelle à la durée de chaque clip (ils n'ont pas la même longueur).
   *
   * 2. FONDU DE COUCHE — au démarrage et à l'arrêt on ne coupe pas net : le poids
   *    global de la couche monte et descend progressivement, ce qui enchaîne
   *    idle → marche sans saut de pose.
   *
   * 3. FONDU D'ALLURE — `runBlend` mélange les jeux marche ET course au lieu de
   *    basculer de l'un à l'autre. Sans lui, franchir le seuil de vitesse
   *    échangerait 8 clips d'un coup : un saut de pose visible à chaque appui
   *    ou relâchement de Maj.
   *
   * @param weights   clips et poids (somme = 1), issus de `solveLocomotion`
   * @param gait      allure dominante, sert de référence de phase
   * @param timeScale vitesse de lecture (évite le glissement des pieds)
   * @param dt        delta frame, pour le lissage du poids de couche
   * @param runBlend  0 = marche pure, 1 = course pure, intermédiaire = mélange
   */
  setLocomotionBlend(
    weights: ReadonlyArray<{ dir: string; weight: number }>,
    gait: "walk" | "run" | "crouchwalk",
    timeScale: number,
    dt: number,
    runBlend = gait === "run" ? 1 : 0,
  ): void {
    if (this.locoActions.size === 0) return;

    // Sur un arrêt, `weights` devient vide d'un coup. Si on l'appliquait tel quel,
    // les clips tomberaient à 0 INSTANTANÉMENT pendant que la base remonte en
    // 0,15 s — le pas serait tranché en plein milieu au lieu de se fondre.
    // On garde donc la dernière répartition connue le temps du fondu descendant.
    if (weights.length > 0) {
      this.lastLocoWeights = weights;
      this.lastLocoGait = gait;
    }
    const activeWeights = weights.length > 0 ? weights : this.lastLocoWeights;
    const activeGait = weights.length > 0 ? gait : this.lastLocoGait;

    const target = weights.length > 0 ? 1 : 0;
    // ~0.15 s pour atteindre la cible : assez court pour être réactif, assez
    // long pour ne pas claquer.
    const rate = dt / 0.15;
    this.locoLayerWeight += Math.sign(target - this.locoLayerWeight) *
      Math.min(Math.abs(target - this.locoLayerWeight), rate);

    // ── 1. Répartition des poids sur les clips RÉELLEMENT chargés ────────────
    //
    // Cette table est construite AVANT le choix du clip dominant, et c'est tout
    // l'enjeu : elle est la seule source de vérité sur « quels clips jouent, à
    // quel poids ». La version précédente dérivait l'information DEUX fois — une
    // fois ici avec le repli accroupi, une fois plus haut pour le dominant, sans
    // le repli. Voir le commentaire du bloc 2.
    //
    // Les deux jeux d'allure coexistent, pondérés par runBlend : la transition
    // marche ↔ course est continue au lieu d'un échange sec de 8 clips.
    const rb = Math.min(1, Math.max(0, runBlend));
    const byName = new Map<string, number>();
    const add = (name: string, w: number) => {
      byName.set(name, (byName.get(name) ?? 0) + w);
    };

    for (const w of activeWeights) {
      const share = w.weight * this.locoLayerWeight;

      if (activeGait === "crouchwalk") {
        // ACCROUPI — 4 clips seulement, contre 8 directions produites par le
        // solveur (`CROUCH_LOCOMOTION` : forward/back/left/right).
        //
        // Demander `crouchwalk_forwardRight` ne trouvait rien : le poids était
        // simplement PERDU, et le personnage glissait dans une direction que son
        // animation ne montrait pas. C'est la cause de « l'accroupi vers l'avant
        // ne suit pas la direction ». Les diagonales sont donc réparties sur les
        // deux cardinales qui les encadrent, à parts égales.
        for (const [card, part] of CROUCH_FALLBACK[w.dir] ?? [[w.dir, 1]]) {
          add(`crouchwalk_${card}`, share * part);
        }
        continue; // pas de mélange marche/course en accroupi
      }

      if (rb < 1) add(`walk_${w.dir}`, share * (1 - rb));
      if (rb > 0) add(`run_${w.dir}`, share * rb);
    }

    // ── 2. Clip dominant — choisi PARMI LES CLIPS RÉELS ──────────────────────
    //
    // Il se choisit dans `byName`, donc APRÈS application du repli accroupi.
    //
    // Avant, la recherche se faisait sur `${activeGait}_${w.dir}`, c'est-à-dire
    // sur la direction BRUTE du solveur. En accroupi et en diagonale, cela
    // demandait `crouchwalk_forwardRight` — un clip qui n'existe pas — donc
    // `dominant` restait `null` et `phase` valait 0. Or le bloc 3 recale sur
    // `phase` tout clip qui n'est PAS le dominant : avec `dominant = null`, les
    // deux clips accroupis correctement pondérés étaient remis à `time = 0` à
    // chaque frame. Poids justes, pose figée — le personnage glissait en statue.
    //
    // La leçon vaut au-delà de l'accroupi : dès qu'une table de correspondance
    // existe entre ce que demande le solveur et ce que le jeu possède, TOUT
    // consommateur doit passer par elle. Ici on supprime le second chemin.
    let phase = 0;
    let dominant: THREE.AnimationAction | null = null;
    let dominantWeight = -1;
    for (const [name, w] of byName) {
      const act = this.locoActions.get(name);
      if (act && w > dominantWeight) { dominantWeight = w; dominant = act; }
    }
    if (dominant) {
      const dur = dominant.getClip().duration || 1;
      phase = (dominant.time % dur) / dur;
    }

    // ── 3. Atténuation de la couche de base — indispensable ──────────────────
    // Sans elle, l'action simple jouée par `play()` (ex. "walk") continue à
    // poids 1 pendant que la couche directionnelle tourne aussi à poids 1 : deux
    // cycles de marche de durées différentes s'additionnent sur les mêmes os, et
    // le pas ne boucle jamais. Les deux couches partagent donc un budget de 1.
    //
    // Effet de bord bienvenu : pendant le fondu, base et blend se répartissent le
    // poids, ce qui donne une transition idle → marche continue.
    const baseAction = this.current ? this.actions.get(this.current) : undefined;
    if (baseAction) baseAction.setEffectiveWeight(1 - this.locoLayerWeight);

    // ── 4. Application ───────────────────────────────────────────────────────
    for (const [name, act] of this.locoActions) {
      const w = byName.get(name) ?? 0;
      act.setEffectiveWeight(w);
      act.setEffectiveTimeScale(timeScale);
      if (w > 0 && act !== dominant) {
        // Recale la phase — sans ça les clips dérivent et les appuis se croisent.
        act.time = phase * (act.getClip().duration || 1);
      }
    }
  }

  /** Coupe la couche de locomotion (mort, émote, véhicule…) et rend la main à la base. */
  clearLocomotionBlend(): void {
    if (this.locoActions.size === 0) return;
    this.locoLayerWeight = 0;
    for (const act of this.locoActions.values()) act.setEffectiveWeight(0);
    // Sans cette restitution, l'action de base resterait au poids atténué qu'elle
    // avait au moment de la coupure — le personnage se figerait à moitié posé.
    const base = this.current ? this.actions.get(this.current) : undefined;
    if (base) base.setEffectiveWeight(1);
  }

  setCrouch(active: boolean): void {
    this.crouchTarget = active ? 1 : 0;
  }

  // ── Émotes (clips externes hors du système ActionId) ──────────────────────
  private emoteAction: THREE.AnimationAction | null = null;
  private emoteTimer = 0;
  private emotePlaying = false;

  /** true si une émote est en cours de lecture (le gameplay loop doit skip). */
  get isEmotePlaying(): boolean { return this.emotePlaying; }

  /**
   * Joue un clip d'émote EXTERNE (pas dans CLIP_CANDIDATES). Crossfade depuis
   * l'action courante, puis retour auto à previousLooping quand terminé (one-shot)
   * ou quand cancelEmote() est appelé (loop).
   */
  playEmote(clip: THREE.AnimationClip, loop: boolean, fade = this.fade): void {
    const outgoing = this.emotePlaying && this.emoteAction
      ? this.emoteAction
      : (this.current ? this.actions.get(this.current) : undefined);

    if (this.emotePlaying && this.emoteAction) {
      this.emoteAction = null;
      this.emotePlaying = false;
      this.emoteTimer = 0;
    }

    const act = this.mixer.clipAction(clip);
    act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    act.clampWhenFinished = !loop;
    act.reset();
    act.enabled = true;
    act.setEffectiveWeight(1);
    act.setEffectiveTimeScale(1);
    act.play();

    if (outgoing && outgoing !== act) {
      outgoing.crossFadeTo(act, fade, false);
    }

    this.emoteAction = act;
    this.emotePlaying = true;
    this.emoteTimer = loop ? 0 : clip.duration;
  }

  /** Annule l'émote en cours et retourne à l'action loop précédente. */
  cancelEmote(fade = this.fade): void {
    if (!this.emotePlaying || !this.emoteAction) return;
    const ret = this.actions.get(this.previousLooping);
    if (ret) {
      const wasStopped = !ret.isRunning()
        || (ret.clampWhenFinished && ret.time >= ret.getClip().duration - 0.02);
      if (wasStopped) ret.reset();
      ret.enabled = true;
      ret.setEffectiveWeight(1);
      ret.setEffectiveTimeScale(1);
      ret.play();
      this.emoteAction.crossFadeTo(ret, fade, false);
    } else {
      this.emoteAction.fadeOut(fade);
    }
    this.emoteAction = null;
    this.emotePlaying = false;
    this.emoteTimer = 0;
  }

  /** Diagnostic : vérifie que les tracks des clips résolus se lient aux os du rig. */
  private debugBindings(): void {
    const key = this.avatarKey ?? "?";
    for (const [action, act] of this.actions) {
      const clip = act.getClip();
      let bound = 0;
      let unbound = 0;
      const missing: string[] = [];
      for (const track of clip.tracks) {
        const dot = track.name.lastIndexOf(".");
        const nodeName = dot > 0 ? track.name.slice(0, dot) : track.name;
        const found = this.root.getObjectByName(nodeName);
        if (found) { bound++; } else { unbound++; if (missing.length < 5) missing.push(nodeName); }
      }
      if (unbound > 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[AnimCtrl] ${key}/${action}: ${bound}/${bound + unbound} tracks bound. Missing: ${missing.join(", ")}${unbound > 5 ? "..." : ""}`);
        }
      }
    }
  }

  /** Libère le mixer (à appeler au démontage). */
  dispose() {
    this.cancelEmote(0);
    this.mixer.stopAllAction();
    this.actions.clear();
    this.upperBodyActions.clear();
    this.overlayAction = null;
    this.crouchAction = null;
    this.fadingOut = null;
  }
}
