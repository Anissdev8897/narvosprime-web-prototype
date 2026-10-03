// ══════════════════════════════════════════════════════════════════════════════
// npc/Npc.tsx — PNJ animé + IA de combat + lancer de sorts (R3F)
//
// • Charge le GLB Meshy (clips : Idle_11/Idle_3 / Walking / Running / Dead /
//   Rifle_Aim_Turn_Right). L'aim sert de geste d'incantation (pas de clip cast).
// • IA via NpcController : idle ↔ chase/Run ↔ attack(cast) ↔ death
// • Ennemis : poursuivent puis LANCENT leur sort de classe sur le joueur.
//     - sort projectile (à distance)  → engage de loin (grande portée)
//     - sort de zone/contact (corps-à-corps) → engage à 10 m
// • Barre de vie billboard (ennemis) + label nom
// • S'enregistre dans npcRegistry → cible des sorts du joueur
// ══════════════════════════════════════════════════════════════════════════════

import { Component, memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useGLTF, Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import { getNpcModelPath } from "../loaders/assetManifest";
import { qualityVariant } from "../loaders/assetQuality";
import { AnimationController } from "../animation/AnimationController";
import { useGltfAnimationPack } from "../animation/useFbxAnimationPack";
import { resolveMonsterAnimPack } from "./monsterAnimationAssignment";
import type { FbxAnimSpec } from "../animation/animationPacks";
import { collisionWorld } from "../runtime/CollisionWorld";
import { screenShake } from "../runtime/screenShake";
import { getNpc, type NpcDef } from "./npcCatalog";
import { NpcController } from "./NpcController";
import { npcRegistry, type NpcHandle, type CorpseLoot } from "./npcRegistry";
import { statusEffects } from "../combat/statusEffects";
import { audioEvents } from "../audio/audioEventManager";
import { getSpellsForClass } from "../spells/spellCatalog";
import type { BossAoe } from "../spells/BossAoeZone";
import type { SpellDef } from "../spells/SpellDef";
import type { ElementId } from "../types";
import { rollLoot, LOOT_CATALOG } from "../loot/LootRegistry";
import { dungeonRun } from "../runtime/donjon/dungeonRun";
import { CLASSES } from "../classes/classes";
import { ELEMENTS } from "../elements/elements";
import {
  enemyHpMultiplier, enemyDamageMultiplier, xpForKill, levelTierColor,
} from "./npcLeveling";
import { useCharacterScale } from "../characters/useCharacterScale";
import { audioManager } from "../../utils/AudioManager";
import { distanceBand, Band } from "../runtime/perf/distanceBand";
import { registerDisposable } from "../runtime/loading/assetDisposal";
import { REACTIONS_PACK } from "../animation/animationPacks";
import { npcHitReact } from "../combat/npcHitReact";
import { respawnManager } from "./respawnManager";
import { damageEvents } from "../combat/damageEvents";
import { wasmNpcBridge } from "../wasm/WasmNpcBridge";
import { isEngineLoaded } from "../wasm/WasmBridge";
import { AIAction } from "../wasm/AICommandSync";
import { requestPath, hasPath, getNextWaypoint, cancelPath } from "../wasm/NavMeshBridge";

// Billboards de barre de vie + label : positions Y native du modèle (échelle 1.0)
// multipliées par le scale LIVE pour suivre la tête du PNJ même quand l'admin
// redimensionne tous les personnages en cours de session.
const HP_BAR_Y_NATIVE = 2.45;
const LABEL_Y_NATIVE  = 2.78;

// ── Réglages d'engagement ─────────────────────────────────────────────────────
// Sorts à DISTANCE (projectile) : grande portée d'attaque + détection lointaine.
const RANGED_ATTACK_RANGE = 18;
const RANGED_AGGRO        = 30;
// Sorts au CORPS-À-CORPS (zone/contact) : engagement à 10 m (demande utilisateur).
const MELEE_ATTACK_RANGE  = 10;
const MELEE_AGGRO         = 20;

const BASE_MOVE_SPEED = 3.2;  // m/s, modulé par baseStats.moveSpeed
const NPC_DMG_SCALE   = 0.35; // les sorts PNJ font moins mal que ceux du joueur (équilibrage)
const HP_BAR_WIDTH    = 1.0;

// Vecteurs de travail pour le raycast de ligne de vue (zéro alloc/frame).
// Partagés : chaque useFrame PNJ s'exécute séquentiellement et les consomme
// dans la même passe → aucun conflit.
const TMP_EYE = new THREE.Vector3();
const TMP_TGT = new THREE.Vector3();
const TMP_LOS = new THREE.Vector3();

// Source d'animation CANONIQUE pour tous les PNJ.
// Pourquoi : Meshy a nommé les clips dans un ORDRE différent selon le modèle —
// "Idle_11" contient la vraie idle sur certains, mais la marche/mort sur d'autres.
// Tous les PNJ partageant le MÊME squelette Mixamo (26 os, mêmes noms), on lie
// un set d'anims fiable (soldat_humain) à chaque squelette → mapping correct partout.
const NPC_ANIM_SOURCE = getNpcModelPath("soldat_humain");
// Précharge le set d'anims partagé → le 1er PNJ ne bloque pas dessus.
useGLTF.preload(NPC_ANIM_SOURCE);

/** Sort d'attaque principal : projectile en priorité, sinon 1er sort offensif. */
function pickPrimaryAttackSpell(classId: string): SpellDef | null {
  const spells = getSpellsForClass(classId);
  const proj = spells.find((s) => s.archetype === "projectile" && s.damage > 0);
  if (proj) return proj;
  return spells.find((s) => s.damage > 0) ?? null;
}

interface NpcProps {
  /** Identifiant stable unique (pour le registre). */
  id: string;
  folder: string;
  position: [number, number, number];
  /** Position du joueur (ref) pour l'IA + le look-at. */
  playerPosition?: React.MutableRefObject<THREE.Vector3>;
  /** Une attaque/sort PNJ porte → inflige des dégâts au joueur (élément pour la résistance,
   *  label de l'attaquant pour le ladder mort définitive). */
  onHitPlayer?: (damage: number, element?: ElementId, attackerLabel?: string) => void;
  /** Le PNJ lance un sort → spawn du VFX dans la scène (origine → joueur). */
  onNpcCast?: (spell: SpellDef, origin: THREE.Vector3, dir: THREE.Vector3) => void;
  /** Zone (pour le tirage de butin pondéré). */
  zoneId?: string;
  /** Le PNJ meurt → octroie XP + folder pour la réputation faction.
   *  factionOverride (3e param) : si défini, utiliser cette faction au lieu du catalogue. */
  onDeath?: (xp: number, folder: string, factionOverride?: string) => void;
  /** Distance de look-at pour les PNJ non hostiles. */
  lookAtRange?: number;
  /**
   * Niveau du PNJ/monstre. Échelle ses PV, ses dégâts, la puissance de ses sorts
   * et l'XP octroyée à sa mort ; affiché dans le nom ([Lvl N]). Défaut : 1.
   */
  level?: number;
  /** Multiplicateur de taille visuelle (admin). Défaut 1. */
  scaleMult?: number;
  /** Multiplicateur de PV (admin). Défaut 1. */
  hpMult?: number;
  /** Résistance aux dégâts reçus 0..0.9 (admin). Défaut 0. */
  resistMult?: number;
  /** Rang Boss → marqueur visuel (nom doré 👑 + aura). Défaut false. */
  boss?: boolean;
  /** Rotation euler (radians) du groupe racine (gizmo admin). Défaut [0,0,0]. L'IA peut la surcharger en jeu. */
  rotation?: [number, number, number];
  /** Boss : émet une zone d'AoE télégraphiée (ultime violet / déflagration rouge). */
  onBossAoe?: (aoe: BossAoe) => void;
  /** Override faction catalogue (admin). */
  factionOverride?: string;
  /** Override classId catalogue (admin) — détermine sorts, stats, élément. */
  classIdOverride?: string;
  /** Portée de détection custom (admin). */
  aggroRange?: number;
  /** Portée d'attaque custom (admin). */
  attackRange?: number;
}

function NpcCore({
  id, folder, position, playerPosition, onHitPlayer, onNpcCast,
  zoneId = "forge", onDeath, lookAtRange = 6, level = 1,
  scaleMult = 1, hpMult = 1, resistMult = 0, boss = false, rotation = [0, 0, 0], onBossAoe,
  factionOverride, classIdOverride, aggroRange: aggroRangeOverride, attackRange: attackRangeOverride,
  packClips,
}: NpcProps & { packClips: THREE.AnimationClip[] }) {
  const def: NpcDef | undefined = getNpc(folder);
  const resolvedClassId = classIdOverride ?? def?.classId ?? "warrior_bruiser";
  // qualityVariant : résout vers .med.glb / .low.glb si dispo, sinon fallback
  // sur le path high. Path identique au cache du AssetPreloader → 1 seul download.
  const path = qualityVariant(def?.modelPath ?? getNpcModelPath(folder, def?.assetRoot, def?.modelFile));
  const { scene, animations: ownAnims } = useGLTF(path);
  // Échelle live : le mesh + les billboards (barre vie / label) suivent le
  // slider admin sans reload. Le combat/IA reste indépendant du scale visuel.
  const characterScale = useCharacterScale();
  // Anims canoniques (mapping de noms fiable) — repli sur les anims du modèle si besoin.
  const { animations: refAnims } = useGLTF(NPC_ANIM_SOURCE);
  // Résolution des clips, par PRIORITÉ :
  //   1. ownAnims (quadrupèdes) → anims PROPRES du modèle (squelette non-biped Meshy).
  //   2. packClips (FBX dédié, ex: creature_melee) → si le def a un animPack assigné.
  //   3. refAnims (set canonique soldat_humain) → défaut partagé pour tous les bipèdes.
  //   4. ownAnims → ultime repli si aucune anim partagée.
  const clips = def?.ownAnims
    ? ownAnims
    : packClips.length > 0
      ? packClips
      : refAnims.length > 0
        ? refAnims
        : ownAnims;
  // Réactions universelles (K.O. = Stunned) ajoutées au set du PNJ. Rig Meshy (os sans préfixe)
  // → strip "mixamorig:". Permet de jouer "stun" quand le finisher du joueur étourdit l'ennemi.
  const reactionClips = useGltfAnimationPack(REACTIONS_PACK, true);
  const clipsAll = useMemo(() => [...clips, ...reactionClips], [clips, reactionClips]);
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  // Enregistre la scène SOURCE (partagée par tous les clones de ce dossier) pour que
  // l'éviction PER-MAP libère réellement son GPU (geo/mat/tex) — cf. assetDisposal.
  useEffect(() => { registerDisposable(path, scene); }, [path, scene]);

  const group     = useRef<THREE.Group>(null);
  const animCtrl  = useRef<AnimationController | null>(null);
  const hpBarRoot = useRef<THREE.Group>(null);
  const hpBarFg   = useRef<THREE.Mesh>(null);
  const fxBurnRef  = useRef<THREE.Group>(null);
  const fxRootRef  = useRef<THREE.Group>(null);
  const fxStunRef  = useRef<THREE.Group>(null);
  const currentYaw = useRef(0);
  const npcStepDist = useRef(0);
  const pathTimer = useRef(999);

  // Position monde LIVE (mutée en place — l'IA la déplace ; le registre la lit).
  const posRef = useRef(new THREE.Vector3(position[0], position[1], position[2]));

  // Butin déposé à la mort (pillable par le joueur) + détection du front de mort.
  const lootRef  = useRef<CorpseLoot | null>(null);
  const wasAlive = useRef(true);
  const snapped  = useRef(false); // sol calé : 1× à l'init, puis seulement en mouvement
  // LOD : compteur de frame (offset aléatoire par PNJ → étale les raycasts LOS), cache LOS,
  // et ref du billboard label pour le culling à distance.
  const frameTick = useRef(Math.floor(Math.random() * 5));
  const losCache  = useRef(true);
  const labelRoot = useRef<THREE.Group>(null);

  // ── Sort principal + classification distance/contact ─────────────────────
  const primarySpell = useMemo(
    () => pickPrimaryAttackSpell(resolvedClassId),
    [resolvedClassId]
  );
  const isRanged = !!primarySpell && primarySpell.speed > 0;

  // ── Cerveau IA + santé (dérivés de la classe + type de sort) ─────────────
  const ctrl = useMemo(() => {
    const classDef = CLASSES[resolvedClassId as keyof typeof CLASSES] ?? CLASSES.warrior_bruiser;
    const base     = classDef.baseStats;
    const lvlHp   = enemyHpMultiplier(level);
    const dmgMult = enemyDamageMultiplier(level);
    const rawDmg  = (primarySpell?.damage ?? base.attackPower) * NPC_DMG_SCALE;
    return new NpcController({
      maxHp:          Math.round(base.hp * lvlHp * hpMult),
      moveSpeed:      BASE_MOVE_SPEED * base.moveSpeed,
      aggroRange:     aggroRangeOverride ?? (isRanged ? RANGED_AGGRO : MELEE_AGGRO),
      attackRange:    attackRangeOverride ?? (isRanged ? RANGED_ATTACK_RANGE : MELEE_ATTACK_RANGE),
      attackCooldown: Math.max(primarySpell?.cooldown ?? 1.6, 1.8),
      attackDamage:   rawDmg * dmgMult,
      hostile:        def?.role === "enemy",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, level, hpMult, resolvedClassId, aggroRangeOverride, attackRangeOverride]);

  const labelColor = useMemo(() => {
    const classDef = CLASSES[resolvedClassId as keyof typeof CLASSES];
    if (!classDef) return "#ffffff";
    return ELEMENTS[classDef.element].color;
  }, [resolvedClassId]);

  // Défense de la cible (atténue les dégâts d'archétype du joueur) : base de classe
  // × montée par niveau (douce). Exposée au registre via un ref (pas de ré-enregistrement).
  const resolvedClass = CLASSES[resolvedClassId as keyof typeof CLASSES] ?? CLASSES.warrior_bruiser;
  const enemyDefense = Math.round(resolvedClass.baseStats.defense * (1 + (level - 1) * 0.05));
  const enemyDefenseRef = useRef(enemyDefense);
  enemyDefenseRef.current = enemyDefense;

  // ── Init mesh + AnimationController ───────────────────────────────────────
  useEffect(() => {
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; }
    });
    if (clipsAll.length > 0 && group.current) {
      animCtrl.current = new AnimationController(group.current, clipsAll, {
        initial: "idle",
        remapToRig: def?.remapRig, // rigs UE4/Paragon : sinon aucune piste ne se lie
      });
      return () => animCtrl.current?.dispose();
    }
    // Fallback : si aucune animation embarquée, on utilise au moins les clips
    // de réaction (stun/hit) pour éviter la T-pose figée. Un PNJ sans animation
    // ne bouge pas mais reste sur sa pose de repos au lieu de se figer en croix.
    if (reactionClips.length > 0 && group.current) {
      console.warn(`[Npc] "${folder}" sans clip d'animation → fallback reactions.`);
      animCtrl.current = new AnimationController(group.current, reactionClips, { initial: "idle" });
      return () => animCtrl.current?.dispose();
    }
    console.warn(`[Npc] "${folder}" sans clip d'animation → fige en T-pose.`);
  }, [cloned, clipsAll, folder]);

  // ── Enregistrement runtime (cible des sorts du joueur) ───────────────────
  useEffect(() => {
    const handle: NpcHandle = {
      id,
      role:        def?.role ?? "enemy",
      getPosition: () => posRef.current,
      isAlive:     () => ctrl.alive,
      applyDamage: (n) => {
        const dealt = n * (1 - resistMult);
        // CHIFFRES FLOTTANTS : point d'émission UNIQUE — toutes les sources de dégâts
        // (flèches, sorts, mêlée, poings, DoT) passent par ce handle. Le drapeau crit
        // est posé par la source synchrone juste avant (rollDamage → markNextCrit).
        if (ctrl.alive) {
          const kind = damageEvents.consumeNextCrit() ? "crit" : "hit";
          damageEvents.emit(posRef.current.x, posRef.current.y, posRef.current.z, dealt, kind);
        }
        ctrl.applyDamage(dealt);
      },
      getDefense:  () => enemyDefenseRef.current,
      getLoot:     () => lootRef.current,
      takeLoot:    () => { const l = lootRef.current; lootRef.current = null; return l; },
      getLabel:     () => def?.label ?? id,
      getHpFraction: () => ctrl.hpFraction,
      getMaxHp:     () => ctrl.maxHp,
      getLevel:     () => level,
    };
    npcRegistry.register(handle);
    return () => npcRegistry.unregister(id);
  }, [id, ctrl, def?.role, def?.label, resistMult, level]);

  // ── Entité WASM (broadphase, trigger zones, damage events C++) ────────────
  useEffect(() => {
    if (!isEngineLoaded()) return;
    const role = def?.role ?? "enemy";
    wasmNpcBridge.registerNpc(id, position[0], position[1], position[2], role, ctrl.maxHp, boss ? "boss" : undefined);
    return () => wasmNpcBridge.unregisterNpc(id);
  }, [id, position[0], position[1], position[2], def?.role, ctrl.maxHp, boss]);

  // ── État boss (timers AoE + paliers d'enrage) ─────────────────────────────
  const bossUltTimer = useRef(0);
  const bossEnrage   = useRef(0);   // nb de paliers 75/50/25% déjà franchis (0..3)
  const bossUltCount = useRef(0);

  // ── Boucle de jeu ─────────────────────────────────────────────────────────
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // Distance horizontale au joueur — calculée AVANT l'anim → pilote le LOD.
    let dist = Infinity;
    let dx = 0, dz = 0;
    if (playerPosition) {
      const pp = playerPosition.current;
      dx = pp.x - posRef.current.x;
      dz = pp.z - posRef.current.z;
      dist = Math.hypot(dx, dz);
    }
    const band = distanceBand(dist * dist);
    frameTick.current++;

    // Anim LOD : NEAR = chaque frame ; MID = 1 frame/2 (dt×2) ; FAR = gelé (pose figée).
    if (band === Band.NEAR) {
      animCtrl.current?.update(dt);
    } else if (band === Band.MID) {
      if ((frameTick.current & 1) === 0) animCtrl.current?.update(dt * 2);
    } // FAR : pas d'update → pose figée (zéro coût mixer)

    // K.O. (stun) infligé par le finisher mains nues du joueur : gèle l'IA (ni déplacement,
    // ni attaque, ni cast) et joue Stunned tant que le statut dure. L'anim a déjà avancé
    // ci-dessus. `ctrl.alive` requis : un PNJ MORT doit jouer sa mort, jamais Stunned.
    if (ctrl.alive && statusEffects.isStunned(id)) {
      animCtrl.current?.play("stun");
      g.position.copy(posRef.current);
      return;
    }

    // Réaction d'IMPACT (déclenchée par les coups du joueur) : joue "hit" (léger) ou
    // "bighit" (lourd) en one-shot — l'IA continue (pas de gel), seule l'anim réagit.
    if (ctrl.alive) {
      const react = npcHitReact.consume(id);
      if (react) animCtrl.current?.play(react);
    }

    // ── Ligne de vue : le PNJ ne tire PAS à travers un mur ───────────────────
    // Raycast de l'œil du PNJ vers le buste du joueur contre la géométrie de map
    // (collisionWorld ne contient QUE le décor — ni PNJ ni joueur). Recalcul THROTTLÉ
    // (1 frame/5, décalé par PNJ) : le combat n'a pas besoin de 60 Hz de ligne de vue.
    // FAR → conserve le cache (pas de raycast). Démarre à true (visible par défaut).
    let canSee = losCache.current;
    if (band !== Band.FAR && ctrl.hostile && playerPosition && dist < RANGED_AGGRO * 1.6 &&
        frameTick.current % 5 === 0) {
      TMP_EYE.copy(posRef.current); TMP_EYE.y += 1.4;
      TMP_TGT.copy(playerPosition.current); TMP_TGT.y += 1.2;
      TMP_LOS.subVectors(TMP_TGT, TMP_EYE);
      canSee = !collisionWorld.isBlocked(TMP_EYE, TMP_LOS, 0.2);
      losCache.current = canSee;
    }

    // Machine à états (désengage si joueur mort OU INVISIBLE, n'attaque pas sans
    // ligne de vue). playerTargetable=false pendant l'invisibilité → le PNJ perd
    // sa cible comme si le joueur avait disparu.
    const engageable = npcRegistry.playerAlive && npcRegistry.playerTargetable;
    const jsRes = ctrl.update(dt, dist, { canSee, playerAlive: engageable });
    let res = jsRes;
    if (isEngineLoaded() && ctrl.hostile) {
      const cmd = wasmNpcBridge.getCommand(id);
      if (cmd && cmd.action !== AIAction.None) {
        const moving = cmd.action === AIAction.MoveTo || cmd.action === AIAction.FindCover || cmd.action === AIAction.Retreat;
        res = {
          action: moving ? "run" : cmd.action === AIAction.Attack ? "attack" : cmd.action === AIAction.Die ? "death" : jsRes.action,
          moving,
          attackFired: cmd.action === AIAction.Attack,
        };
      }
    }

    // Front de mort (alive → dead) : XP au joueur + butin déposé sur le cadavre
    if (wasAlive.current && !ctrl.alive) {
      wasAlive.current = false;
      if (ctrl.hostile) {
        // Butin + XP basés sur le VRAI niveau (zone + distance), pas un proxy PV.
        const items = rollLoot(zoneId, level, 1);
        // Clé du Donjon Furiste : drop ~5 % sur les monstres ≥ niv 15 (source farmable).
        if (level >= 15 && Math.random() < 0.05) {
          const key = LOOT_CATALOG.key_donjon_furiste;
          if (key) items.push(key);
        }
        lootRef.current = { items, credits: 10 + level * 5 };
        onDeath?.(xpForKill(level), folder, factionOverride);
        // RESPAWN : notifie le point de spawn (id de copie = `${placementId}#k`). No-op
        // pour les PNJ non placés (bots, marchands) — point jamais configuré.
        respawnManager.notifyDeath(id.split("#")[0], id, performance.now());
        // DONJON : la mort du BOSS clôt le combat du run → le coffre apparaît à sa position.
        if (boss) dungeonRun.bossKilled([posRef.current.x, posRef.current.y, posRef.current.z]);
      }
    }

    // Déplacement (poursuite uniquement). Bloqué si IMMOBILISÉ (root du Guerrier) :
    // le PNJ reste cloué sur place (il peut toujours attaquer/se tourner).
    if (res.moving && dist > 0.01 && !statusEffects.isRooted(id)) {
      const step = ctrl.moveSpeed * dt;

      let moveDx = dx;
      let moveDz = dz;
      let moveDist = dist;

      const entity = isEngineLoaded() ? wasmNpcBridge.getEntity(id) : 0;
      if (entity > 0) {
        pathTimer.current += dt;
        if (pathTimer.current > 0.8 && playerPosition) {
          const pp = playerPosition.current;
          requestPath(entity, pp.x, pp.y, pp.z);
          pathTimer.current = 0;
        }
        if (hasPath(entity)) {
          const [wx, , wz] = getNextWaypoint(entity);
          const wdx = wx - posRef.current.x;
          const wdz = wz - posRef.current.z;
          const wdist = Math.sqrt(wdx * wdx + wdz * wdz);
          if (wdist > 0.3) {
            moveDx = wdx;
            moveDz = wdz;
            moveDist = wdist;
          }
        }
      }

      posRef.current.x += (moveDx / moveDist) * step;
      posRef.current.z += (moveDz / moveDist) * step;

      npcStepDist.current += step;
      if (npcStepDist.current >= 2.0) {
        npcStepDist.current = 0;
        const vol = Math.max(0, 1 - dist / 18) * 0.4;
        if (vol > 0.02) audioManager.playFootstep(vol);
      }
    } else {
      npcStepDist.current = 0;
      if (isEngineLoaded()) {
        const entity = wasmNpcBridge.getEntity(id);
        if (entity > 0) cancelPath(entity);
      }
    }

    // Snap au sol : une fois à l'init, puis seulement quand le PNJ se déplace
    // (évite un raycast/frame pour les PNJ immobiles).
    if (!snapped.current || res.moving) {
      const gy = collisionWorld.getGroundY(posRef.current.x, posRef.current.z, posRef.current.y + 3);
      if (gy !== null) {
        posRef.current.y = gy;
        snapped.current = true;
      }
    }
    g.position.copy(posRef.current);
    if (isEngineLoaded()) wasmNpcBridge.syncNpcPosition(id, posRef.current.x, posRef.current.y, posRef.current.z);
    if (res.moving) npcRegistry.refreshPosition(id); // grille spatiale à jour (broadphase)

    // ── Animation + lancer de sort ─────────────────────────────────────────
    const cur = animCtrl.current?.currentAction;
    if (!ctrl.alive) {
      animCtrl.current?.play("death");                       // une fois, fige
    } else if (res.attackFired) {
      animCtrl.current?.play(primarySpell ? "cast" : "attack"); // pose de visée
      // Lance le sort vers le joueur
      if (primarySpell && onNpcCast && dist < Infinity) {
        const origin = posRef.current.clone();
        origin.y += 1.4;
        const dir = new THREE.Vector3(dx, 0, dz);
        if (dir.lengthSq() > 0) dir.normalize();
        onNpcCast(primarySpell, origin, dir);
      }
      onHitPlayer?.(ctrl.attackDamage, primarySpell?.element, def?.label); // dégâts + élément + attaquant
    } else if (cur !== "attack" && cur !== "cast" && cur !== "hit" && cur !== "bighit") {
      // (hit/bighit = réactions d'impact one-shot → la locomotion ne doit pas les écraser)
      animCtrl.current?.play(res.moving ? "run" : "idle");
    }

    // Orientation : face au joueur si engagé (ennemi) ou proche (allié)
    const shouldFace =
      dist > 0.1 &&
      (ctrl.hostile
        ? (ctrl.state === "chase" || ctrl.state === "attack")
        : dist < lookAtRange);
    if (shouldFace) {
      const targetYaw = Math.atan2(dx, dz);
      currentYaw.current = THREE.MathUtils.lerp(currentYaw.current, targetYaw, 1 - Math.exp(-8 * dt));
      g.rotation.y = currentYaw.current;
    }

    // ── Mécaniques de BOSS : AoE télégraphiées (à esquiver) ───────────────
    if (boss && ctrl.hostile && ctrl.alive && onBossAoe && playerPosition &&
        dist < RANGED_AGGRO * 1.4 && engageable) {
      // Entrée en combat du boss → alerte AoE (jouée 1× par boss, dédupliquée).
      audioEvents.bossEngaged(id);
      const baseDmg = ctrl.attackDamage;
      // Paliers d'enrage 75/50/25% → déflagration (couronne de cercles rouges)
      const THRESH = [0.75, 0.5, 0.25];
      if (bossEnrage.current < 3 && ctrl.hpFraction <= THRESH[bossEnrage.current]) {
        bossEnrage.current += 1;
        const N = 8, spread = 8.5;
        for (let i = 0; i < N; i++) {
          const a = (Math.PI * 2 * i) / N;
          onBossAoe({
            id: `aoe_${id}_def${bossEnrage.current}_${i}`,
            pos: [posRef.current.x + Math.cos(a) * spread, 0, posRef.current.z + Math.sin(a) * spread],
            radius: 2.6, kind: "deflagration", windup: 1.4, damage: baseDmg * 2,
          });
        }
        screenShake.add(0.6);
      }
      // Ultime périodique : grand cercle violet SOUS le joueur (~9 s)
      bossUltTimer.current += dt;
      if (bossUltTimer.current >= 9) {
        bossUltTimer.current = 0;
        const pp = playerPosition.current;
        onBossAoe({
          id: `aoe_${id}_ult${bossUltCount.current++}`,
          pos: [pp.x, 0, pp.z],
          radius: 5.5, kind: "ultimate", windup: 1.6, damage: baseDmg * 3,
        });
      }
    }

    // Barre de vie (ennemis)
    const fg = hpBarFg.current;
    if (fg && hpBarRoot.current) {
      const f = ctrl.hpFraction;
      fg.scale.x = Math.max(0.0001, f);
      fg.position.x = -(1 - f) * (HP_BAR_WIDTH / 2);
      (fg.material as THREE.MeshBasicMaterial).color.setRGB(1 - f * 0.7, 0.25 + f * 0.6, 0.2);
      hpBarRoot.current.visible = ctrl.alive;
    }

    // Indicateurs de statut (burn/root/stun) — toggle via refs (pas de re-render).
    if (ctrl.hostile && ctrl.alive && band !== Band.FAR) {
      if (fxBurnRef.current) fxBurnRef.current.visible = statusEffects.isBurning(id);
      if (fxRootRef.current) fxRootRef.current.visible = statusEffects.isRooted(id);
      if (fxStunRef.current) fxStunRef.current.visible = statusEffects.isStunned(id);
    } else {
      if (fxBurnRef.current) fxBurnRef.current.visible = false;
      if (fxRootRef.current) fxRootRef.current.visible = false;
      if (fxStunRef.current) fxStunRef.current.visible = false;
    }

    // Cull labels : visibles seulement NEAR/MID (le SDF <Text> est coûteux/illisible au loin).
    if (labelRoot.current) labelRoot.current.visible = band !== Band.FAR;
  });

  return (
    // `userData.npcId` : seule façon de retrouver le mesh d'un PNJ depuis la
    // scène. Sans ce marqueur, impossible de dire si un PNJ invisible est
    // « pas monté » ou « monté mais masqué » — cf. npcVisibilityDiagnostic.
    <group ref={group} position={position} rotation={rotation} dispose={null} userData={{ npcId: id }}>
      <primitive object={cloned} scale={characterScale * scaleMult * (def?.modelScaleMult ?? 1)} />
      {boss && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.7 * characterScale * scaleMult, 1.05 * characterScale * scaleMult, 32]} />
          <meshBasicMaterial color="#ffcf4d" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}

      {/* Barre de vie — ennemis uniquement (Y suit l'échelle live du modèle) */}
      {ctrl.hostile && (
        <Billboard ref={hpBarRoot} position={[0, HP_BAR_Y_NATIVE * characterScale * scaleMult, 0]}>
          <mesh>
            <planeGeometry args={[HP_BAR_WIDTH + 0.06, 0.16]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.6} depthWrite={false} />
          </mesh>
          <mesh ref={hpBarFg} position={[0, 0, 0.001]}>
            <planeGeometry args={[HP_BAR_WIDTH, 0.1]} />
            <meshBasicMaterial color="#46d160" depthWrite={false} />
          </mesh>
        </Billboard>
      )}

      {/* Indicateurs de statut (burn/root/stun) — sous la barre de vie */}
      {ctrl.hostile && (
        <Billboard position={[0, (HP_BAR_Y_NATIVE - 0.22) * characterScale * scaleMult, 0]}>
          <group ref={fxBurnRef} visible={false} position={[-0.2, 0, 0]}>
            <Text fontSize={0.18} color="#ff6b35" outlineWidth={0.008} outlineColor="#000" anchorX="center">🔥</Text>
          </group>
          <group ref={fxRootRef} visible={false} position={[0, 0, 0]}>
            <Text fontSize={0.18} color="#22c55e" outlineWidth={0.008} outlineColor="#000" anchorX="center">⛓️</Text>
          </group>
          <group ref={fxStunRef} visible={false} position={[0.2, 0, 0]}>
            <Text fontSize={0.18} color="#fbbf24" outlineWidth={0.008} outlineColor="#000" anchorX="center">💫</Text>
          </group>
        </Billboard>
      )}

      {/* Label nom + niveau (couleur du niveau = palier de danger) */}
      {def && (
        <Billboard ref={labelRoot} position={[0, LABEL_Y_NATIVE * characterScale * scaleMult, 0]}>
          <Text
            position={[0, 0.13, 0]} fontSize={0.22} color={boss ? "#ffcf4d" : labelColor}
            outlineWidth={0.012} outlineColor="#000000" anchorX="center"
          >
            {boss ? `👑 ${def.label}` : def.label}
          </Text>
          <Text
            position={[0, -0.1, 0]} fontSize={0.165} color={levelTierColor(level)}
            outlineWidth={0.01} outlineColor="#000000" anchorX="center"
          >
            [Lvl {level}]
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ── Sélection du pack d'anim (dispatch par COMPOSANT, pas de hook conditionnel) ──
const NO_PACK_CLIPS: THREE.AnimationClip[] = [];

// Variante SANS pack → clips canoniques/own par défaut (comportement historique).
function NpcNoPack(props: NpcProps) {
  return <NpcCore {...props} packClips={NO_PACK_CLIPS} />;
}

// Variante AVEC pack GLB (ex: creature_melee, anim-only converti) → charge + retarget.
// strip=true (défaut) : rigs Meshy (os SANS préfixe). strip=false : rigs Mixamo natifs
// prefixés (boss mutant) → on garde "mixamorig:" pour que les noms d'os matchent.
// useGLTF parse HORS thread principal (plus de freeze) et ne LÈVE pas.
function NpcWithPack({ pack, strip, ...props }: NpcProps & { pack: FbxAnimSpec[]; strip: boolean }) {
  const packClips = useGltfAnimationPack(pack, strip);
  return <NpcCore {...props} packClips={packClips} />;
}

// Repli si un FBX du pack échoue au chargement (useLoader LÈVE, contrairement à
// useGLTF) : on retombe sur les anims partagées au lieu de figer le PNJ en T-pose.
class FbxPackBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("[Npc] pack FBX non chargé → anims par défaut :", e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// Dispatcher : choisit la variante selon l'animPack du catalogue (valeur stable).
function NpcDispatch(props: NpcProps) {
  const def = getNpc(props.folder);
  const pack = def ? resolveMonsterAnimPack(def) : null;
  if (!pack || pack.length === 0) return <NpcNoPack {...props} />;
  const strip = def?.animPackStrip ?? true; // false = rig mutant prefixé (boss) → garde "mixamorig:"
  return (
    <FbxPackBoundary fallback={<NpcNoPack {...props} />}>
      <NpcWithPack {...props} pack={pack} strip={strip} />
    </FbxPackBoundary>
  );
}

// Mémoïsé : ne se re-rend pas quand RpgGameWorld re-rend (props stables).
export const Npc = memo(NpcDispatch);
