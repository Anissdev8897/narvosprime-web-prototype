// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.
// Sub-project B1: regenerate skin weights onto the mesh's (Manny) skeleton via UE's geodesic-voxel binder.
#include "UniGLB_Convert.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLBLoaderLog.h"
#include "Engine/SkeletalMesh.h"

#if WITH_EDITOR
#include "Animation/Skeleton.h"
#include "UDynamicMesh.h"
#include "GeometryScript/GeometryScriptTypes.h"
#include "GeometryScript/MeshAssetFunctions.h"
#include "GeometryScript/MeshBoneWeightFunctions.h"
#include "SkinnedAssetCompiler.h"
#include "Misc/MessageDialog.h"
#endif

bool UniGLBConverter::AutoSkinToManny(UUniGLBAssetListObject* uniGLBAssetList)
{
#if WITH_EDITOR
	if (uniGLBAssetList == nullptr || uniGLBAssetList->SkeletalMesh == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoSkinToManny: no SkeletalMesh; abort."));
		return false;
	}
	USkeletalMesh* SkelMesh = uniGLBAssetList->SkeletalMesh;
	USkeleton* Skeleton = SkelMesh->GetSkeleton();
	if (Skeleton == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoSkinToManny: SkeletalMesh has no skeleton; abort."));
		return false;
	}

	UDynamicMesh* Dyn = NewObject<UDynamicMesh>();

	// 1. SkeletalMesh geometry -> UDynamicMesh.
	EGeometryScriptOutcomePins Outcome = EGeometryScriptOutcomePins::Failure;
	FGeometryScriptCopyMeshFromAssetOptions FromOpts;
	FGeometryScriptMeshReadLOD ReadLOD;   // defaults to LOD0
	UGeometryScriptLibrary_StaticMeshFunctions::CopyMeshFromSkeletalMesh(SkelMesh, Dyn, FromOpts, ReadLOD, Outcome);
	if (Outcome != EGeometryScriptOutcomePins::Success)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoSkinToManny: CopyMeshFromSkeletalMesh failed; abort."));
		return false;
	}

	// 2. Geodesic-voxel auto-skin against the (Manny) skeleton. (No Outcome param on this function.)
	FGeometryScriptSmoothBoneWeightsOptions BindOpts;
	BindOpts.DistanceWeighingType = EGeometryScriptSmoothBoneWeightsType::GeodesicVoxel;
	BindOpts.MaxInfluences = 8;
	BindOpts.VoxelResolution = 128;
	FGeometryScriptBoneWeightProfile Profile;   // default profile
	UGeometryScriptLibrary_MeshBoneWeightFunctions::ComputeSmoothBoneWeights(Dyn, Skeleton, BindOpts, Profile);

	// 3. Write geometry + new weights back into the SkeletalMesh.
	FGeometryScriptCopyMeshToAssetOptions ToOpts;
	ToOpts.bEnableRecomputeNormals = false;
	ToOpts.bEnableRecomputeTangents = false;
	FGeometryScriptMeshWriteLOD WriteLOD;   // defaults to LOD0
	EGeometryScriptOutcomePins WriteOutcome = EGeometryScriptOutcomePins::Failure;
	UGeometryScriptLibrary_StaticMeshFunctions::CopyMeshToSkeletalMesh(Dyn, SkelMesh, ToOpts, WriteLOD, WriteOutcome);
	if (WriteOutcome != EGeometryScriptOutcomePins::Success)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AutoSkinToManny: CopyMeshToSkeletalMesh failed; abort."));
		return false;
	}

	UE_LOG(LogUniGLBLoader, Display, TEXT("AutoSkinToManny: regenerated geodesic-voxel skin weights on '%s'."), *SkelMesh->GetName());
	return true;
#else
	return false;
#endif
}

// Sub-project B0 — POST-import entry. Runs after the import fully completes (OnAssetPostImport), on the
// fully-built mesh, so the geometry-script conversion does not hit the mid-import MeshConversion crash.
// Dispatches: no usable skeleton -> auto-rig (B2); has a Manny-like skeleton -> re-skin (B1).
bool UniGLBConverter::AdaptToMannyPostImport(UUniGLBAssetListObject* uniGLBAssetList)
{
#if WITH_EDITOR
	if (uniGLBAssetList == nullptr || uniGLBAssetList->SkeletalMesh == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("AdaptToMannyPostImport: no mesh; abort."));
		return false;
	}

	// Make sure the imported skeletal mesh has finished building before we read its geometry.
	FSkinnedAssetCompilingManager::Get().FinishAllCompilation();

	// Route by the MODE set at import time, NOT by bone count. The unrecognized-rig fallback
	// (FitMannyFromMesh) ALWAYS fits the canonical Manny onto the mesh + geodesic re-skin, regardless of
	// how many (unmappable) source bones it has - routing by bone count would send a >=10-bone unknown
	// rig into AutoSkinToManny, which would re-skin against the WRONG (source) skeleton.
	if (uniGLBAssetList->UniGLBAdaptMode == UUniGLBAssetListObject::EUniGLBAdapt::FitMannyFromMesh)
	{
		const bool bOk = AutoRigToManny(uniGLBAssetList);
		if (!bOk)
		{
			// Tier-1: the fit self-aborted (non-upright / fused legs / non-human proportions). Never ship a
			// broken rig - tell the user to re-rig with a humanoid auto-rigger (the message that used to fire
			// at import time, moved here so it only shows when the auto-fit genuinely can't proceed).
			UE_LOG(LogUniGLBLoader, Error, TEXT("AdaptToMannyPostImport: auto-rig fallback could not fit this mesh; advising manual re-rig."));
			FMessageDialog::Open(EAppMsgType::Ok, FText::FromString(TEXT(
				"UniGLB could not auto-fit the Manny skeleton to this model\n"
				"(it may be non-upright, have fused legs, or non-humanoid proportions).\n\n"
				"Re-rig it with a humanoid auto-rigger, then re-import:\n"
				"  - Mixamo (free):  https://www.mixamo.com\n"
				"  - or AccuRig (free), Meshy, Anything World.")));
		}
		return bOk;
	}

	// Legacy bone-count heuristic (unused by the hybrid dispatcher; kept for the standalone auto-skin path).
	USkeleton* Skeleton = uniGLBAssetList->SkeletalMesh->GetSkeleton();
	const int32 BoneNum = (Skeleton != nullptr) ? Skeleton->GetReferenceSkeleton().GetRawBoneNum() : 0;
	if (BoneNum < 10)
	{
		return AutoRigToManny(uniGLBAssetList);
	}
	return AutoSkinToManny(uniGLBAssetList);
#else
	return false;
#endif
}
