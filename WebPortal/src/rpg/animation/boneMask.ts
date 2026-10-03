// animation/boneMask.ts — Filtrage de pistes d'animation par os. Logique PURE.
//
// POURQUOI
//
// Une animation ADDITIVE compose ses rotations par MULTIPLICATION de quaternions
// avec la couche du dessous. Sur les os qui bougent déjà beaucoup — le bassin et
// la colonne pendant un cycle de marche — les deux rotations se cumulent au lieu
// de se remplacer : le bassin part en vrille et entraîne les cuisses avec lui.
//
// La pose accroupie a donc besoin des jambes SANS les rotations du tronc : on
// laisse le cycle de marche piloter le buste — plus de multiplication
// concurrente, plus de torsion.
//
// ⚠️ PRÉCISION 02/08/2026 — ce commentaire affirmait que « ce sont les cuisses
// et les mollets qui abaissent le personnage ». C'est faux : `Hips` est le
// PARENT de la chaîne des jambes, donc fléchir cuisse et genou ne fait pas
// descendre le corps, ça remonte les PIEDS vers le bassin.
//
// Ce qui abaisse réellement le personnage est ailleurs, et c'est voulu :
// `OwnAnimPlayerCharacter` applique `og.position.y -= CROUCH_PELVIS_DROP × échelle`.
// Ce report est légitime — mesuré sur `Anim_Crouch_Idle_Hip`, bassin, genou,
// cheville et pointe descendent TOUS de 0,373, la pose se translate en bloc, et
// un offset de groupe la reproduit exactement.
//
// Conséquence pratique : **ne pas laisser passer la position du bassin ici**
// pour « réparer » l'accroupissement. La descente serait comptée deux fois
// (0,373 de groupe + celle de l'os) et le personnage s'enfoncerait dans le sol.
// Le masque exclut bien le bassin, et il a raison de le faire.
//
// C'est l'équivalent d'un Bone Mask de layer Unreal, ramené à ce que permet
// THREE.AnimationMixer : celui-ci n'a pas de notion de couche masquée, mais une
// piste absente d'un clip ne contribue simplement pas.

import * as THREE from "three";

/** Extrait le nom d'os d'un nom de piste (`mixamorig:Hips.quaternion` → `hips`). */
export function boneOfTrack(trackName: string): string {
  const dot = trackName.lastIndexOf(".");
  const raw = dot >= 0 ? trackName.slice(0, dot) : trackName;
  const colon = raw.lastIndexOf(":");
  return (colon >= 0 ? raw.slice(colon + 1) : raw).toLowerCase();
}

/** Extrait la propriété animée (`Hips.position` → `position`). */
export function propOfTrack(trackName: string): string {
  const dot = trackName.lastIndexOf(".");
  return dot >= 0 ? trackName.slice(dot + 1) : "";
}

/**
 * Os du TRONC — ceux qu'une pose additive ne doit pas piloter quand une
 * locomotion tourne en dessous.
 *
 * `root` et `pelvis`/`hips` en tête : ce sont eux dont la rotation se propage à
 * toute la chaîne, donc eux qui produisent la torsion visible.
 */
const TORSO = /^(root|pelvis|hips|spine|spine_?\d*|chest|upperchest|neck|head|clavicle_[lr]|shoulder)/;

/** Os des JAMBES — le strict nécessaire pour abaisser le personnage. */
const LEGS = /^(thigh_[lr]|calf_[lr]|foot_[lr]|ball_[lr]|leftupleg|rightupleg|leftleg|rightleg|leftfoot|rightfoot|lefttoebase|righttoebase)/;

export type MaskMode = "legsOnly" | "excludeTorso";

/**
 * Renvoie une COPIE du clip ne conservant que les pistes autorisées.
 *
 * Le clip source n'est jamais modifié : il peut être partagé entre plusieurs
 * personnages, et le muter contaminerait tous les autres.
 *
 * @param mode `legsOnly` ne garde que les jambes (masque le plus strict) ;
 *             `excludeTorso` garde tout SAUF le tronc (jambes + bras).
 */
export function maskClipToBones(clip: THREE.AnimationClip, mode: MaskMode): THREE.AnimationClip {
  const keep = clip.tracks.filter((t) => {
    const bone = boneOfTrack(t.name);

    if (mode === "legsOnly") return LEGS.test(bone);
    return !TORSO.test(bone);
  });
  // Un masque qui ne laisserait RIEN produirait un clip vide et une pose figée :
  // mieux vaut alors renvoyer le clip intact et laisser le défaut s'appliquer.
  if (keep.length === 0) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, keep, clip.blendMode);
}

/** Noms d'os couverts par le masque, pour diagnostic. */
export function describeMask(clip: THREE.AnimationClip, mode: MaskMode): { kept: number; dropped: number } {
  const masked = maskClipToBones(clip, mode);
  return { kept: masked.tracks.length, dropped: clip.tracks.length - masked.tracks.length };
}
