// weapons/rigProfiles.ts — socket logique → regex de nom d'os, par famille de rig
import type { RigFamily, SocketName } from "./weaponTypes";

export const RIG_PROFILES: Record<RigFamily, Record<SocketName, RegExp>> = {
  mixamo: {
    // Ancrage par SUFFIXE uniquement → robuste à toutes les variantes de préfixe :
    // "RightHand", "mixamorig:RightHand" ET "mixamorigRightHand" (colon retiré par le
    // loader FBX). Le "$" évite quand même de matcher les doigts (…Index1, …Thumb4).
    RightHand: /RightHand$/i,
    LeftHand:  /LeftHand$/i,
    Spine:     /Spine\d*$/i,
    Head:      /Head$/i,
  },
  quaternius: {
    RightHand: /hand_r$/i,
    LeftHand:  /hand_l$/i,
    Spine:     /spine(_?\d+)?$/i,
    Head:      /head$/i,
  },
  custom: {
    RightHand: /(right.?hand|hand_r)$/i,   // ValveBiped.Hand_R finit par hand_r
    LeftHand:  /(left.?hand|hand_l)$/i,
    Spine:     /spine/i,
    Head:      /head/i,
  },
};
