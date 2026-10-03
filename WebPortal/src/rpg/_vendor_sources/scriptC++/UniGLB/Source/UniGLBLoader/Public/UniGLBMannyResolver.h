// UniGLB — derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"

class USkeletalMesh;
class USkeleton;

/**
 * Resolves the reference Manny (SKM_Manny_Simple) SkeletalMesh from the project.
 * Searches stock paths first, then falls back to an AssetRegistry name+signature scan.
 * Returns nullptr if no Manny mesh is found in the project.
 */
UNIGLBLOADER_API USkeletalMesh* UniGLB_ResolveMannySkeletalMesh();

/**
 * The canonical, ordered list of Manny-family SkeletalMesh object paths this project may ship
 * (ThirdPerson template, stock /Game/Characters, Game Animation Sample). Single source of truth
 * shared by the resolver and the IK-rig/retarget code so the pipelines never disagree.
 */
UNIGLBLOADER_API const TArray<FString>& UniGLB_GetMannyMeshCandidatePaths();

/**
 * Registers every Manny-family skeleton present in the project as a compatible skeleton ON `Target`
 * (plus `PrimaryManny` if given), so stock/GASP animations authored against any of them play on the
 * imported character. Never mutates the Manny skeletons themselves. No-op entries (missing assets,
 * self, duplicates) are skipped. Used by BOTH the Native and the Universal/AutoRig pipelines so their
 * compatibility lists are identical.
 */
UNIGLBLOADER_API void UniGLB_RegisterCompatibleMannySkeletons(USkeleton* Target, USkeleton* PrimaryManny);
