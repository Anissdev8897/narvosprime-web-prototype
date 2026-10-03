// skeleton/index.ts — API publique du système de squelette universel
export type { CanonicalBone, RigConvention } from "./canonicalBones";
export {
  ALL_CANONICAL_BONES,
  detectConvention,
  detectConventionFromScene,
  getConventionMap,
  canonicalMapForScene,
} from "./canonicalBones";

export type { SkeletonProfile } from "./SkeletonMapper";
export {
  profileRig,
  buildBoneMap,
  bindPartToMaster,
  clearProfileCache,
} from "./SkeletonMapper";

export {
  retargetClip,
  retargetClips,
  remapClipsToRig,
  dropScaleTracks,
  bakeArmatureRotation,
  stripMixamoPrefix,
  clearRetargetCache,
} from "./UniversalRetargeter";

export type { UniversalCharacterProps } from "./UniversalCharacter";
export {
  UniversalCharacter,
  useRigConvention,
  useSocket,
} from "./UniversalCharacter";
