// UniGLB — derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.

#include "UniGLBAssetPaths.h"

FString UniGLB_SubfolderName(EUniGLBAssetKind Kind)
{
	switch (Kind)
	{
	case EUniGLBAssetKind::Mesh:         return TEXT("MESH");
	case EUniGLBAssetKind::Skeleton:     return TEXT("SKELETON");
	case EUniGLBAssetKind::Material:     return TEXT("MATERIALS");
	case EUniGLBAssetKind::Texture:      return TEXT("TEXTURES");
	case EUniGLBAssetKind::PhysicsAsset: return TEXT("PHYSICS");
	case EUniGLBAssetKind::IKRig:        return TEXT("IK");
	case EUniGLBAssetKind::Retargeter:   return TEXT("IK");
	case EUniGLBAssetKind::AnimSequence: return TEXT("ANIM");
	case EUniGLBAssetKind::AnimBlueprint:return TEXT("ANIM");
	case EUniGLBAssetKind::Misc:
	default:                             return TEXT("");
	}
}

FString UniGLB_TypedPackagePath(const FString& BaseFolder, EUniGLBAssetKind Kind, const FString& AssetName, bool bOrganizeIntoSubfolders)
{
	if (!bOrganizeIntoSubfolders)
	{
		return BaseFolder + TEXT("/") + AssetName;
	}

	const FString Sub = UniGLB_SubfolderName(Kind);
	if (Sub.IsEmpty())
	{
		return BaseFolder + TEXT("/") + AssetName;
	}
	return BaseFolder + TEXT("/") + Sub + TEXT("/") + AssetName;
}
