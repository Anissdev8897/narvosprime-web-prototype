// skeleton/UniversalRetargeter.ts — Retarget d'animation entre rigs quelconques
//
// Unifie la logique dispersée entre mixamoRetarget.ts et AnimatedModularCharacter.tsx :
//   1. Prefix stripping (mixamorig:)
//   2. Track remapping par nom normalisé
//   3. Compensation bind-pose (quaternion correction)
//   4. Scale track dropping (artefact FBX→GLB)
//   5. T-pose frame trimming
//
// Toutes les opérations CLONENT les pistes — les clips en cache drei ne sont jamais mutés.
// Cache par WeakMap<rigRoot, WeakMap<clip, result>> pour performance.

import * as THREE from "three";
import type { CanonicalBone } from "./canonicalBones";
import type { SkeletonProfile } from "./SkeletonMapper";
import { profileRig } from "./SkeletonMapper";

// ── Cache ───────────────────────────────────────────────────────────────────
type ClipCache = WeakMap<THREE.AnimationClip, THREE.AnimationClip>;
const retargetCache = new WeakMap<THREE.Object3D, ClipCache>();

function getOrCreateCache(root: THREE.Object3D): ClipCache {
  let cc = retargetCache.get(root);
  if (!cc) { cc = new WeakMap(); retargetCache.set(root, cc); }
  return cc;
}

// ── Utilitaires internes ────────────────────────────────────────────────────

const MIXAMO_PREFIX_RE = /^mixamorig[:]?/i;

function stripPrefix(name: string): string {
  return name.replace(MIXAMO_PREFIX_RE, "");
}

function normalizeBoneName(name: string): string {
  return stripPrefix(name).toLowerCase();
}

// ── Retarget d'un clip unique ───────────────────────────────────────────────

interface RetargetOpts {
  /** Profil du rig SOURCE (celui qui a produit les clips). null = auto-strip mixamo + remap. */
  source?: SkeletonProfile;
  /** Profil du rig CIBLE (celui qui jouera les clips). */
  target: SkeletonProfile;
  /** Retirer les pistes .scale (artefact FBX→GLB). Défaut: true. */
  dropScale?: boolean;
  /** Retirer le keyframe T-pose initial (frame 0 Mixamo). Défaut: false. */
  trimTpose?: boolean;
  /** Exclure le bone racine (hips/pelvis) du retarget quaternion. Défaut: true. */
  excludeRoot?: boolean;
}

/**
 * Retargète un seul clip vers le rig cible.
 *
 * Si `source` est fourni : compensation bind-pose complète
 *   q_corrected = q_target_rest × inv(q_source_rest) × q_source_anim
 *
 * Si `source` est absent : remap par nom normalisé (suffisant quand source et cible
 * partagent la même convention ou quand le source est Mixamo stripped).
 */
export function retargetClip(clip: THREE.AnimationClip, opts: RetargetOpts): THREE.AnimationClip {
  const { source, target, dropScale = true, trimTpose = false, excludeRoot = true } = opts;
  const _q = new THREE.Quaternion();
  const tracks: THREE.KeyframeTrack[] = [];
  let changed = false;

  // Table normalisée → nom réel dans le rig cible
  const targetByNorm = new Map<string, string>();
  for (const actual of target.allBones) {
    const n = normalizeBoneName(actual);
    if (!targetByNorm.has(n)) targetByNorm.set(n, actual);
  }

  // Table canonical du source (pour cross-convention : "Hips" → canonical "hips" → target "pelvis")
  const sourceCanonicalToNorm = new Map<string, CanonicalBone>();
  if (source) {
    for (const [canonical, actual] of source.toActual) {
      sourceCanonicalToNorm.set(normalizeBoneName(actual), canonical);
    }
  }
  // Fallback : conventions connues où norm donne directement un nom Mixamo standard
  const MIXAMO_NORM_TO_CANONICAL: Record<string, CanonicalBone> = {
    hips: "hips", spine: "spine", spine1: "spine1", spine2: "spine2",
    neck: "neck", head: "head",
    leftshoulder: "shoulder_l", leftarm: "upperarm_l", leftforearm: "forearm_l", lefthand: "hand_l",
    rightshoulder: "shoulder_r", rightarm: "upperarm_r", rightforearm: "forearm_r", righthand: "hand_r",
    leftupleg: "thigh_l", leftleg: "shin_l", leftfoot: "foot_l", lefttoebase: "toe_l",
    rightupleg: "thigh_r", rightleg: "shin_r", rightfoot: "foot_r", righttoebase: "toe_r",
  };

  const hasBindPose = source != null && source.restQuats.size > 0 && target.restQuats.size > 0;

  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf(".");
    if (dot < 0) { tracks.push(track); continue; }
    const rawBone = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);

    if (dropScale && prop === "scale") { changed = true; continue; }

    const strippedBone = stripPrefix(rawBone);
    const norm = strippedBone.toLowerCase();

    // 1. Lookup direct par nom normalisé
    let actualTarget = targetByNorm.get(norm);

    // 2. Fallback : passer par le canonical bone (cross-convention)
    if (!actualTarget) {
      const canonical = source
        ? sourceCanonicalToNorm.get(norm)
        : MIXAMO_NORM_TO_CANONICAL[norm];
      if (canonical) actualTarget = target.toActual.get(canonical);
    }

    if (!actualTarget) { changed = true; continue; }

    // Skip root bone rotation si demandé
    const canonicalTarget = target.toCanonical.get(actualTarget);
    if (excludeRoot && canonicalTarget === "hips" && prop === "quaternion") {
      changed = true; continue;
    }

    // Clone la piste et renomme
    const nt = (actualTarget !== rawBone || changed) ? track.clone() : track;
    if (actualTarget !== rawBone) {
      const cloned = nt === track ? track.clone() : nt;
      cloned.name = actualTarget + "." + prop;
      changed = true;

      // ── Bind-pose compensation (quaternions uniquement) ──────────────
      if (hasBindPose && prop === "quaternion" && canonicalTarget) {
        const qTargetRest = target.restQuats.get(canonicalTarget);
        const qSourceRest = source!.restQuats.get(canonicalTarget);
        if (qTargetRest && qSourceRest) {
          const qInvSource = qSourceRest.clone().invert();
          const vals = cloned.values as Float32Array;
          for (let i = 0; i < vals.length; i += 4) {
            _q.set(vals[i], vals[i + 1], vals[i + 2], vals[i + 3]);
            _q.premultiply(qInvSource);
            _q.premultiply(qTargetRest);
            vals[i] = _q.x; vals[i + 1] = _q.y; vals[i + 2] = _q.z; vals[i + 3] = _q.w;
          }
        }
      }

      tracks.push(cloned);
      continue;
    }

    tracks.push(nt);
  }

  let result = changed
    ? new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode)
    : clip;

  if (trimTpose) result = trimInitFrame(result);

  return result;
}

/**
 * Retargète un batch de clips vers un rig cible, avec cache WeakMap.
 * API principale pour les composants R3F.
 */
export function retargetClips(
  targetRoot: THREE.Object3D,
  clips: THREE.AnimationClip[],
  sourceRoot?: THREE.Object3D,
  options?: Partial<RetargetOpts>,
): THREE.AnimationClip[] {
  const cc = getOrCreateCache(targetRoot);
  const targetProfile = profileRig(targetRoot);
  const sourceProfile = sourceRoot ? profileRig(sourceRoot) : undefined;

  return clips.map((clip) => {
    const hit = cc.get(clip);
    if (hit) return hit;
    const out = retargetClip(clip, {
      source: sourceProfile,
      target: targetProfile,
      ...options,
    });
    cc.set(clip, out);
    return out;
  });
}

/**
 * Remap rapide par nom normalisé uniquement (pas de bind-pose compensation).
 * Équivalent optimisé de remapClipsToRig() dans mixamoRetarget.ts.
 */
export function remapClipsToRig(
  targetRoot: THREE.Object3D,
  clips: THREE.AnimationClip[],
): THREE.AnimationClip[] {
  const targetProfile = profileRig(targetRoot);
  return retargetClips(targetRoot, clips, undefined, {
    dropScale: true,
    trimTpose: false,
    excludeRoot: false,
  });
}

// ── T-pose trim ─────────────────────────────────────────────────────────────

function trimInitFrame(clip: THREE.AnimationClip): THREE.AnimationClip {
  if (!clip.tracks.length) return clip;
  const firstTimes = clip.tracks[0].times;
  if (firstTimes.length < 2) return clip;

  const trimTime = firstTimes[1];
  const newTracks = clip.tracks.map((track) => {
    const tc = track.clone();
    const vSize = track.getValueSize();
    let si = 0;
    while (si < tc.times.length && tc.times[si] < trimTime - 1e-5) si++;
    if (si === 0) return tc;
    const dt = tc.times[si];
    const newTimes = new Float32Array(tc.times.length - si);
    for (let i = 0; i < newTimes.length; i++) newTimes[i] = tc.times[si + i] - dt;
    (tc as any).times = newTimes;
    (tc as any).values = (tc.values as Float32Array).slice(si * vSize);
    return tc;
  });
  return new THREE.AnimationClip(clip.name, clip.duration - trimTime, newTracks);
}

// ── Utilitaires re-exportés pour compatibilité ──────────────────────────────

export { stripPrefix as stripMixamoPrefix };

export function dropScaleTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => !t.name.endsWith(".scale"));
  if (tracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

export function bakeArmatureRotation(clip: THREE.AnimationClip, armQuat: THREE.Quaternion): THREE.AnimationClip {
  if (Math.abs(armQuat.w) > 0.9999) return clip;
  const isRoot = (bone: string) => /(^|:)hips$/i.test(bone);
  const q = armQuat.clone();
  const v = new THREE.Vector3();
  const kq = new THREE.Quaternion();
  let modified = false;
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
      modified = true;
      return nt;
    }
    if (prop === "quaternion") {
      const nt = t.clone();
      const a = nt.values as Float32Array;
      for (let i = 0; i < a.length; i += 4) {
        kq.set(a[i], a[i + 1], a[i + 2], a[i + 3]).premultiply(q);
        a[i] = kq.x; a[i + 1] = kq.y; a[i + 2] = kq.z; a[i + 3] = kq.w;
      }
      modified = true;
      return nt;
    }
    return t;
  });
  return modified ? new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode) : clip;
}

/**
 * Vide le cache de retargeting pour un rig (recyclage d'objet).
 */
export function clearRetargetCache(root: THREE.Object3D): void {
  retargetCache.delete(root);
}
