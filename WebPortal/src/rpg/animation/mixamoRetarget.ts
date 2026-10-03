// ══════════════════════════════════════════════════════════════════════════════
// animation/mixamoRetarget.ts — Retargeting Mixamo → squelettes Meshy (par préfixe).
//
// Les animations Mixamo ciblent des os nommés "mixamorig:Hips", "mixamorig:LeftArm"…
// Les modèles Meshy du projet (PNJ, soldats) portent EXACTEMENT les mêmes os mais
// SANS le préfixe : "Hips", "LeftArm"… Three.js lie les pistes d'animation par
// nom d'os → il suffit donc de retirer le préfixe "mixamorig:" des pistes pour
// qu'un clip Mixamo s'applique à un mesh Meshy. Aucune conversion de format,
// aucun re-rig : un simple renommage de pistes.
//
// IMPORTANT : on CLONE les pistes (les clips de useFBX/useGLTF sont mis en cache et
// partagés — muter leur nom corromprait le cache pour tous les autres usages).
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { humanoidSlotOf, indexSkeletonBySlot, detectConvention, type HumanoidSlot } from "./humanoidBones";

export const MIXAMO_PREFIX = "mixamorig:";

/**
 * Retourne un NOUVEAU clip dont les pistes "mixamorig:Bone.prop" deviennent
 * "Bone.prop". Les pistes sans préfixe sont laissées intactes. Le clip d'origine
 * (potentiellement en cache) n'est pas modifié.
 */
export function stripMixamoPrefix(clip: THREE.AnimationClip): THREE.AnimationClip {
  let changed = false;
  const tracks = clip.tracks.map((t) => {
    if (!t.name.startsWith(MIXAMO_PREFIX)) return t;
    changed = true;
    const renamed = t.clone();
    renamed.name = t.name.slice(MIXAMO_PREFIX.length);
    return renamed;
  });
  if (!changed) return clip; // déjà sans préfixe → on évite une copie inutile
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

/**
 * Retire les pistes `.scale`. Une anim humanoïde Mixamo n'anime JAMAIS l'échelle des
 * os : une piste scale est toujours un artefact de conversion FBX→GLB (cm→m baké) qui
 * CONTORSIONNE le perso quand le clip est rejoué sur un autre rig (ex: idle d'arme
 * dégainée). On la supprime systématiquement. (Le root-motion `.position` est, lui,
 * géré côté perso — stripRootMotion.) Renvoie le clip d'origine si rien à retirer.
 */
export function dropScaleTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => !t.name.endsWith(".scale"));
  if (tracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

/**
 * CUIT la rotation de l'ARMATURE du pack dans les pistes du BONE RACINE (Hips).
 *
 * POURQUOI : les packs FBX→GLB (conversion 2026-06-05) portent une Armature pivotée
 * (+90° X) avec les pistes Hips exprimées dans CE repère. Les rigs Meshy des PNJ ont une
 * Armature NON pivotée → jouer ces clips bruts effondre tout le squelette en un amas de
 * ~0,3 m sous le sol = « monstre invisible, nom qui flotte » (Tosus, golem, mycelium…).
 * Pré-multiplier la rotation/position du root par le quaternion de l'Armature remet le
 * clip dans le repère attendu (validé : Grunt+shooter Idle → debout, y∈[0 ; 1,36 m]).
 * Seul le ROOT a besoin de la cuisson (les enfants sont en rotations locales).
 * CLONE les pistes modifiées (les clips useGLTF sont en cache partagé).
 */
export function bakeArmatureRotation(clip: THREE.AnimationClip, armQuat: THREE.Quaternion): THREE.AnimationClip {
  // Armature quasi-identité → rien à cuire (évite cloner pour rien).
  if (Math.abs(armQuat.w) > 0.9999) return clip;
  const isRoot = (bone: string) => /(^|:)hips$/i.test(bone);
  const q = armQuat.clone();
  const v = new THREE.Vector3();
  const kq = new THREE.Quaternion();
  let changed = false;
  const tracks = clip.tracks.map((t) => {
    const dot = t.name.lastIndexOf(".");
    if (dot < 0) return t;
    const bone = t.name.slice(0, dot);
    const prop = t.name.slice(dot + 1);
    if (!isRoot(bone)) return t;
    if (prop === "position") {
      const nt = t.clone();
      const a = nt.values as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        v.set(a[i], a[i + 1], a[i + 2]).applyQuaternion(q);
        a[i] = v.x; a[i + 1] = v.y; a[i + 2] = v.z;
      }
      changed = true;
      return nt;
    }
    if (prop === "quaternion") {
      const nt = t.clone();
      const a = nt.values as Float32Array;
      for (let i = 0; i < a.length; i += 4) {
        kq.set(a[i], a[i + 1], a[i + 2], a[i + 3]).premultiply(q);
        a[i] = kq.x; a[i + 1] = kq.y; a[i + 2] = kq.z; a[i + 3] = kq.w;
      }
      changed = true;
      return nt;
    }
    return t;
  });
  return changed ? new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode) : clip;
}

/** Strip du préfixe + renommage du clip avec un nom d'action canonique (idle/run/…). */
export function asAction(clip: THREE.AnimationClip, actionName: string): THREE.AnimationClip {
  const c = dropScaleTracks(stripMixamoPrefix(clip));
  // stripMixamoPrefix/dropScaleTracks peuvent renvoyer le clip d'origine (cache) si
  // rien n'a changé : on clone alors le conteneur avant de renommer, jamais l'instance partagée.
  const out = c === clip ? new THREE.AnimationClip(clip.name, clip.duration, clip.tracks, clip.blendMode) : c;
  out.name = actionName;
  return out;
}

/** Applique le retargeting à une liste de clips (préfixe retiré, noms conservés). */
export function retargetClips(clips: THREE.AnimationClip[]): THREE.AnimationClip[] {
  return clips.map(stripMixamoPrefix);
}

/** Forme canonique d'un nom d'os : sans prefixe "mixamorig"(:?), en minuscule.
 *  "mixamorig:RightHand" -> "righthand" · "RightHand" -> "righthand" · "mixamorigHips" -> "hips". */
function normalizeBoneName(name: string): string {
  return name.replace(/^mixamorig:?/i, "").toLowerCase();
}

/**
 * RE-MAPPING UNIVERSEL : renomme chaque piste d'animation vers le nom d'os REELLEMENT
 * present dans `root`, en comparant la forme normalisee. Rend un clip Mixamo jouable
 * sur N'IMPORTE quel rig humanoide (Sorcier "mixamorig:*", Meshy/Ninja "*" sans prefixe,
 * ou "mixamorig*" colon-strippe) sans connaitre la convention a l'avance. Les pistes
 * sans os correspondant dans le rig sont SUPPRIMEES (ex: doigts d'un mesh simplifie) →
 * evite le spam "THREE.PropertyBinding: No target node found" + un binding inutile.
 */
// ── Cross-skeleton aliases (Meshy/Mixamo ↔ UE4 Paragon) ─────────────────────
// Permet à remapClipsToRig de retargeter des clips Meshy sur un squelette UE4
// (et inversement) sans conversion externe. Chaque paire [meshyNorm, ue4Norm].
const SKELETON_ALIASES: [string, string][] = [
  ["hips", "pelvis"],
  ["spine", "spine_01"],
  ["spine1", "spine_02"],
  ["spine01", "spine_02"],
  ["spine2", "spine_03"],
  ["spine02", "spine_03"],
  ["neck", "neck_01"],
  ["leftshoulder", "clavicle_l"],
  ["leftarm", "upperarm_l"],
  ["leftforearm", "lowerarm_l"],
  ["lefthand", "hand_l"],
  ["rightshoulder", "clavicle_r"],
  ["rightarm", "upperarm_r"],
  ["rightforearm", "lowerarm_r"],
  ["righthand", "hand_r"],
  ["leftupleg", "thigh_l"],
  ["leftleg", "calf_l"],
  ["leftfoot", "foot_l"],
  ["lefttoebase", "ball_l"],
  ["rightupleg", "thigh_r"],
  ["rightleg", "calf_r"],
  ["rightfoot", "foot_r"],
  ["righttoebase", "ball_r"],
  ["lefthandthumb1", "thumb_01_l"], ["lefthandthumb2", "thumb_02_l"], ["lefthandthumb3", "thumb_03_l"],
  ["lefthandindex1", "index_01_l"], ["lefthandindex2", "index_02_l"], ["lefthandindex3", "index_03_l"],
  ["lefthandmiddle1", "middle_01_l"], ["lefthandmiddle2", "middle_02_l"], ["lefthandmiddle3", "middle_03_l"],
  ["lefthandring1", "ring_01_l"], ["lefthandring2", "ring_02_l"], ["lefthandring3", "ring_03_l"],
  ["lefthandpinky1", "pinky_01_l"], ["lefthandpinky2", "pinky_02_l"], ["lefthandpinky3", "pinky_03_l"],
  ["righthandthumb1", "thumb_01_r"], ["righthandthumb2", "thumb_02_r"], ["righthandthumb3", "thumb_03_r"],
  ["righthandindex1", "index_01_r"], ["righthandindex2", "index_02_r"], ["righthandindex3", "index_03_r"],
  ["righthandmiddle1", "middle_01_r"], ["righthandmiddle2", "middle_02_r"], ["righthandmiddle3", "middle_03_r"],
  ["righthandring1", "ring_01_r"], ["righthandring2", "ring_02_r"], ["righthandring3", "ring_03_r"],
  ["righthandpinky1", "pinky_01_r"], ["righthandpinky2", "pinky_02_r"], ["righthandpinky3", "pinky_03_r"],
];

const _aliasMap = new Map<string, string>();
for (const [a, b] of SKELETON_ALIASES) { _aliasMap.set(a, b); _aliasMap.set(b, a); }

// Caches par RIG (root stable par perso) : la table d'os + les clips déjà re-mappés.
// → les reconstructions du contrôleur (ex: dégainer/ranger) ne re-clonent plus les pistes.
const rigBoneCache = new WeakMap<THREE.Object3D, Map<string, string>>();
const rigSlotCache = new WeakMap<THREE.Object3D, Map<HumanoidSlot, string>>();
const rigClipCache = new WeakMap<THREE.Object3D, WeakMap<THREE.AnimationClip, THREE.AnimationClip>>();

function boneMapFor(root: THREE.Object3D): Map<string, string> {
  let m = rigBoneCache.get(root);
  if (m) return m;
  m = new Map();
  root.traverse((o) => {
    const n = normalizeBoneName(o.name);
    if (n && !m!.has(n)) m!.set(n, o.name); // 1re occurrence (os avant meshes)
  });
  rigBoneCache.set(root, m);
  return m;
}

/** Index emplacement humanoïde → nom d'os RÉEL du rig. Caché par rig. */
function slotMapFor(root: THREE.Object3D): Map<HumanoidSlot, string> {
  let m = rigSlotCache.get(root);
  if (m) return m;
  const names: string[] = [];
  root.traverse((o) => { if (o.name) names.push(o.name); });
  m = indexSkeletonBySlot(names);
  rigSlotCache.set(root, m);
  return m;
}

function remapOne(
  clip: THREE.AnimationClip,
  byNorm: Map<string, string>,
  bySlot: Map<HumanoidSlot, string>,
): THREE.AnimationClip {
  let changed = false;
  const tracks: THREE.KeyframeTrack[] = [];
  // Convention du clip SOURCE, déduite de ses propres noms d'os. Nécessaire pour
  // lever l'ambiguïté spine01/02/03, qui existe dans les DEUX conventions avec
  // des significations différentes (chest chez Meshy, spine chez UE).
  const srcConv = detectConvention(
    clip.tracks.map((t) => {
      const d = t.name.lastIndexOf(".");
      return d < 0 ? t.name : t.name.slice(0, d);
    }),
  );
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf(".");
    if (dot < 0) { tracks.push(t); continue; }
    const bone = t.name.slice(0, dot);
    const prop = t.name.slice(dot + 1);
    // ── PISTES .position : SUPPRIMÉES ────────────────────────────────────────
    // Un remap n'est qu'un RENOMMAGE : aucune valeur n'est convertie. Or les
    // offsets d'os et les UNITÉS diffèrent d'un rig à l'autre — mesuré sur ce
    // projet : le GLB Meshy `soldat_humain` est en CENTIMÈTRES (Hips au repos
    // Y ≈ 96) alors que les rigs Paragon sont en MÈTRES (pelvis Y ≈ 1.11).
    // Recopier une position telle quelle projetait le squelette à ~60 m.
    // Le déplacement du personnage est de toute façon piloté par le contrôleur
    // (playerPosition / NpcController), jamais par le root motion du clip.
    if (prop === "position") { changed = true; continue; }
    const norm = normalizeBoneName(bone);
    let actual = byNorm.get(norm);
    // Traduction par EMPLACEMENT humanoïde canonique : couvre n'importe quel
    // couple de conventions (Meshy↔UE4↔VRM) sans table deux-à-deux.
    if (!actual) {
      const slot = humanoidSlotOf(bone, srcConv);
      if (slot) actual = bySlot.get(slot);
    }
    // Repli historique sur la table de paires (os hors squelette humanoïde
    // qui figuraient quand même dans SKELETON_ALIASES).
    if (!actual) {
      const alias = _aliasMap.get(norm);
      if (alias) actual = byNorm.get(alias);
    }
    if (!actual) { changed = true; continue; }          // os ABSENT du rig → on DROPPE la piste
    if (actual !== bone) {                                // os présent sous un autre nom → renomme
      changed = true;
      const nt = t.clone();
      nt.name = actual + t.name.slice(dot);
      tracks.push(nt);
    } else {
      tracks.push(t);                                     // déjà au bon nom
    }
  }
  return changed ? new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode) : clip;
}

export function remapClipsToRig(root: THREE.Object3D, clips: THREE.AnimationClip[]): THREE.AnimationClip[] {
  const byNorm = boneMapFor(root);
  const bySlot = slotMapFor(root);
  if (byNorm.size === 0) return clips;
  let cc = rigClipCache.get(root);
  if (!cc) { cc = new WeakMap(); rigClipCache.set(root, cc); }
  return clips.map((clip) => {
    const hit = cc!.get(clip);
    if (hit) return hit;
    // dropScaleTracks AVANT remapOne : une anim humanoïde n'anime jamais
    // l'échelle des os ; une piste .scale est un artefact de conversion FBX→GLB.
    //
    // NOTE — correction d'un commentaire précédemment FAUX : il était écrit ici
    // que « sans cette étape, idle fonctionne mais run/walk/sprint s'effondrent ».
    // Mesure faite sur `soldat_humain` : les pistes .scale y valent toutes
    // exactement 1.0000, donc cette étape y est neutre. Le vrai coupable de
    // l'effondrement était les pistes .position en centimètres (cf. remapOne).
    const cleaned = dropScaleTracks(clip);
    const out = remapOne(cleaned, byNorm, bySlot);
    cc!.set(clip, out);
    return out;
  });
}

/**
 * Renomme un clip SANS toucher aux pistes (garde le préfixe "mixamorig:").
 * Pour les rigs Mixamo natifs (Sorcier) où les os portent déjà le préfixe — strip
 * ferait perdre la liaison. Nouveau conteneur, pistes partagées (lecture seule).
 */
export function renameClip(clip: THREE.AnimationClip, actionName: string): THREE.AnimationClip {
  return new THREE.AnimationClip(actionName, clip.duration, clip.tracks, clip.blendMode);
}
