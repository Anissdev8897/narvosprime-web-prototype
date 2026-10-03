// UniGLB — derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"

/**
 * Asset kind for subfolder routing during import.
 * When bOrganizeIntoSubfolders is enabled, each asset type goes into its own directory
 * under the import root (e.g. /Game/ModelPort001/MATERIALS/MI_foo).
 */
enum class EUniGLBAssetKind : uint8
{
	Mesh,
	Skeleton,
	Material,
	Texture,
	PhysicsAsset,
	IKRig,
	Retargeter,
	AnimSequence,
	AnimBlueprint,
	Misc
};

/**
 * Returns the package path for an asset inside a typed subfolder.
 *   BaseFolder = "/Game/ModelPort001"
 *   Kind       = Texture
 *   AssetName  = "T_foo"
 *   → "/Game/ModelPort001/TEXTURES/T_foo"
 *
 * When bOrganizeIntoSubfolders is false, returns "BaseFolder/AssetName" (flat, current behaviour).
 */
FString UniGLB_TypedPackagePath(const FString& BaseFolder, EUniGLBAssetKind Kind, const FString& AssetName, bool bOrganizeIntoSubfolders = true);

/**
 * Returns just the subfolder name for a given asset kind (e.g. "MATERIALS", "TEXTURES").
 */
FString UniGLB_SubfolderName(EUniGLBAssetKind Kind);
