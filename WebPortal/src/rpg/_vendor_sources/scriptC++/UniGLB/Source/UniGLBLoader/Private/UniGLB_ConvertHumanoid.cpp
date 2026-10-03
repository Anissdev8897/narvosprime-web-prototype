// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_ConvertHumanoid.h"
#include "UniGLB_Convert.h"
#include "UniGLBAssimpScene.h"
#include "UniGLB_Util.h"
#include "UniGLBLoaderLog.h"

#include "UniGLB_AssetListObject.h"
#include "UniGLB_MetaObject.h"

#include "Engine/SkeletalMesh.h"
#include "RenderingThread.h"
#include "Rendering/SkeletalMeshModel.h"
#include "Rendering/SkeletalMeshLODModel.h"
#include "Rendering/SkeletalMeshLODRenderData.h"
#include "Rendering/SkeletalMeshRenderData.h"
#include "Animation/MorphTarget.h"
#include "Animation/Skeleton.h"
#include "Animation/NodeMappingContainer.h"

#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/mesh.h>
#include <assimp/postprocess.h>
#include <assimp/GltfMaterial.h>
#include <assimp/vrm/vrmmeta.h>


static void renameToHumanoidBone(USkeletalMesh *targetSK, const UUniGLBMetaObject *meta, const USkeletalMesh *srcSK) {

	USkeleton *targetSkeleton = UniGLBGetSkeleton(targetSK);
	UNodeMappingContainer* rig = nullptr;
	if (UniGLBGetNodeMappingData(targetSK).Num()) {
		rig = UniGLBGetNodeMappingData(targetSK)[0];
	}
	UNodeMappingContainer* src_rig = nullptr;
	if (UniGLBGetNodeMappingData(srcSK).Num()) {
		src_rig = UniGLBGetNodeMappingData(srcSK)[0];
	}

	if (meta == nullptr) {
		return;
	}
	//k->RemoveBonesFromSkeleton()
	auto &allbone = const_cast<TArray<FMeshBoneInfo> &>(targetSkeleton->GetReferenceSkeleton().GetRawRefBoneInfo());

	if (allbone.Num() == 0) {
		UE_LOG(LogUniGLBLoader, Error, TEXT("renameToHumanoidBone: target skeleton has 0 bones; aborting rename (avoids 'array index 0 / size 0')."));
		return;
	}

	TMap<FName, FName> changeTable;

	{
		bool bHasRoot = false;
		for (auto& a : allbone) {
			if (a.Name == TEXT("Root")) {
				a.Name = TEXT("root");
#if WITH_EDITORONLY_DATA
				a.ExportName = TEXT("root");
#endif
				bHasRoot = true;
				break;
			}
		}
		if (bHasRoot == false) {
			if (allbone[0].Name != TEXT("hip")) {
				allbone[0].Name = TEXT("root");
#if WITH_EDITORONLY_DATA
				allbone[0].ExportName = TEXT("root");
#endif
			}
		}
	}

	for (auto &a : allbone) {
		auto p = meta->humanoidBoneTable.FindKey(a.Name.ToString());
		if (p == nullptr) {
			continue;
		}
		if (p->IsEmpty()) {
			continue;
		}
		for (auto &b : allbone) {
			if (a == b) continue;
			if (b.Name == **p) {
				b.Name = *(b.Name.ToString() + TEXT("_renamed_uniglb"));
			}
		}
		changeTable.Add(a.Name, **p);

		a.Name = **p;
#if WITH_EDITORONLY_DATA
		a.ExportName = **p;
#endif
	}

	const_cast<FReferenceSkeleton&>(targetSkeleton->GetReferenceSkeleton()).RebuildRefSkeleton(targetSkeleton, true);

	UniGLBSetRefSkeleton(targetSK, targetSkeleton->GetReferenceSkeleton());

#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0), (5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
	//  ue5.4 no rig data
#endif
}

void UniGLBConvertHumanoid::renameToUE4Bone(USkeletalMesh *targetSK, UUniGLBMetaObject *meta, const USkeletalMesh *srcSK) {

	USkeleton *targetSkeleton = UniGLBGetSkeleton(targetSK);
	UNodeMappingContainer* rig = nullptr;
	if (UniGLBGetNodeMappingData(targetSK).Num()) {
		rig = UniGLBGetNodeMappingData(targetSK)[0];
	}
	UNodeMappingContainer* src_rig = nullptr;
	if (UniGLBGetNodeMappingData(srcSK).Num()) {
		src_rig = UniGLBGetNodeMappingData(srcSK)[0];
	}

	//k->RemoveBonesFromSkeleton()
	auto &allbone = const_cast<TArray<FMeshBoneInfo> &>(targetSkeleton->GetReferenceSkeleton().GetRawRefBoneInfo());

	if (allbone.Num() == 0) {
		UE_LOG(LogUniGLBLoader, Error, TEXT("renameToUE4Bone: target skeleton has 0 bones; aborting rename (avoids 'array index 0 / size 0'). Leave the 'Skeleton' field empty on import."));
		return;
	}

	TMap<FName, FName> changeTable;

	// Only force the first bone to "root" when it is NOT itself a mapped humanoid bone. VRM / VRoid
	// has a synthetic armature/root at index 0, so renaming it to "root" is correct. Many FBX/GLB
	// rigs (Mixamo, ReadyPlayerMe) have NO separate root: bone 0 IS the hips -- clobbering it there
	// would destroy the hips->pelvis mapping and break the whole rebuild.
	bool bFirstBoneIsHumanoid = false;
	{
		const FString FirstBoneName = allbone[0].Name.ToString();
		for (const auto& Kv : meta->humanoidBoneTable) {
			if (Kv.Value.Equals(FirstBoneName, ESearchCase::IgnoreCase)) { bFirstBoneIsHumanoid = true; break; }
		}
	}
	if (!bFirstBoneIsHumanoid) {
		allbone[0].Name = TEXT("root");
#if WITH_EDITORONLY_DATA
		allbone[0].ExportName = TEXT("root");
#endif
	}

	for (auto &a : allbone) {

		FString toVRMBone;
		for (auto& tmp : meta->humanoidBoneTable) {
			if (a.Name.ToString().ToLower() != tmp.Value.ToLower()) continue;

			toVRMBone = tmp.Key;
			break;
		}
		if (toVRMBone == "") continue;

		FString toUE4Bone;
		for (auto& tmp : UniGLBUtil::table_ue4_vrm) {
			if (toVRMBone.ToLower() != tmp.BoneVRM.ToLower()) continue;

			toUE4Bone = tmp.BoneUE4;
			break;
		}
		if (toUE4Bone == "") continue;

		FString newName = toUE4Bone;

		for (auto &b : allbone) {
			if (a == b) continue;
			if (b.Name == *(newName.ToLower())) {
				b.Name = *(b.Name.ToString() + TEXT("_renamed_uniglb"));
			}
		}
		changeTable.Add(a.Name, *newName);

		a.Name = *newName;
#if WITH_EDITORONLY_DATA
		a.ExportName = *newName;
#endif
	}

	const_cast<FReferenceSkeleton&>(targetSkeleton->GetReferenceSkeleton()).RebuildRefSkeleton(targetSkeleton, true);

	UniGLBSetRefSkeleton(targetSK, targetSkeleton->GetReferenceSkeleton());

#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0), (5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
	// ue5.4 no rig data
#endif
}



bool UniGLBConverter::ConvertHumanoid(UUniGLBAssetListObject *uniGLBAssetList) {
	if (Options::Get().IsGenerateHumanoidRenamedMesh() == false) {
		return true;
	}
	const USkeletalMesh *src_sk = uniGLBAssetList->SkeletalMesh;
	const USkeleton *src_k = UniGLBGetSkeleton(src_sk);
	const UNodeMappingContainer *src_rig = nullptr;
	if (UniGLBGetNodeMappingData(src_sk).Num()) {
		src_rig = UniGLBGetNodeMappingData(src_sk)[0];
	}

	USkeletalMesh *new_sk[2] = {};
	USkeleton *new_k[2] = {};
	UNodeMappingContainer *new_rig[2] = {};

	// 0: humanoid
	// 1: ue4mannequin
	for (int i = 0; i < 2; ++i) {
		FString name_skeleton;
		FString name_mesh;
		FString name_rig;

		if (i == 0) {
			name_skeleton = (TEXT("SKEL_") + uniGLBAssetList->BaseFileName + TEXT("_humanoid"));
			name_mesh = (FString(TEXT("SK_")) + uniGLBAssetList->BaseFileName + TEXT("_humanoid"));
			name_rig = (FString(TEXT("RIG_")) + uniGLBAssetList->BaseFileName + TEXT("_humanoid"));
		} else {
			name_skeleton = (TEXT("SKEL_") + uniGLBAssetList->BaseFileName + TEXT("_ue4mannequin"));
			name_mesh = (FString(TEXT("SK_")) + uniGLBAssetList->BaseFileName + TEXT("_ue4mannequin"));
			name_rig = (FString(TEXT("RIG_")) + uniGLBAssetList->BaseFileName + TEXT("_ue4mannequin"));
		}

		USkeleton *base = nullptr;
		USkeletalMesh *ss = nullptr;
		UNodeMappingContainer *rr = nullptr;

#if WITH_EDITOR
		{
			auto p = uniGLBAssetList->Package;

			if (i == 0) {
				ss = UniGLB_DuplicateObject<USkeletalMesh>(src_sk, p, *name_mesh);
				base = UniGLB_DuplicateObject<USkeleton>(src_k, p, *name_skeleton);
				if (src_rig) {
					rr = UniGLB_NewObject<UNodeMappingContainer>(p, *name_rig, RF_Public | RF_Standalone);
				}
			}else {
				ss = UniGLB_DuplicateObject<USkeletalMesh>(src_sk, p, *name_mesh);
				base = UniGLB_DuplicateObject<USkeleton>(src_k, p, *name_skeleton);
				if (src_rig) {
					rr = UniGLB_NewObject<UNodeMappingContainer>(p, *name_rig, RF_Public | RF_Standalone);
				}
			}
		}
#else
		ss = const_cast<USkeletalMesh*>(src_sk);
		base = const_cast<USkeleton*>(src_k);
		if (i == 1) continue;
#endif

		new_sk[i] = ss;
		new_k[i] = base;
		new_rig[i] = rr;

		UniGLBSetSkeleton(ss, base);
		UniGLBGetNodeMappingData(ss).Empty();
		UniGLBGetNodeMappingData(ss).Add(rr);


		if (i == 0) {
			// org -> humanoid
			renameToHumanoidBone(ss, uniGLBAssetList->UniGLBMetaObject, src_sk);
		} else {
			// humanoid -> ue4mannequin
			UniGLBConvertHumanoid::renameToUE4Bone(ss, uniGLBAssetList->UniGLBMetaObject, src_sk);
		}

		ss->CalculateInvRefMatrices();
		ss->CalculateExtendedBounds();
#if WITH_EDITORONLY_DATA
		ss->ConvertLegacyLODScreenSize();
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.
		ss->UpdateGenerateUpToData();
#endif

#if WITH_EDITORONLY_DATA
		base->SetPreviewMesh(ss);
#endif
		base->RecreateBoneTree(ss);

		// retarget mode
		for (int bon = 0; bon < base->GetReferenceSkeleton().GetRawBoneNum(); ++bon) {
			auto type = src_k->GetBoneTranslationRetargetingMode(bon);
			base->SetBoneTranslationRetargetingMode(bon, type);
		}

		if (i == 0) {
			uniGLBAssetList->HumanoidSkeletalMesh = ss;
			uniGLBAssetList->UniGLBHumanoidMetaObject->SkeletalMesh = ss;
		} else {
			uniGLBAssetList->UE4SkeletalMesh = ss;
			uniGLBAssetList->UniGLBMannequinMetaObject->SkeletalMesh = ss;
		}
	}

	// meta rename check
	// 0: humanoid
	// 1: ue4mannequin
	for (int i = 0; i < 2; ++i) {

		USkeleton* base = nullptr;
		USkeletalMesh* ss = nullptr;
		UNodeMappingContainer* rr = nullptr;
		UUniGLBMetaObject* meta = nullptr;

		if (i == 0) {
			ss = uniGLBAssetList->HumanoidSkeletalMesh;
			base = UniGLBGetSkeleton(ss);
			meta = uniGLBAssetList->UniGLBHumanoidMetaObject;
		} else {
			ss = uniGLBAssetList->UE4SkeletalMesh;
			base = UniGLBGetSkeleton(ss);
			meta = uniGLBAssetList->UniGLBMannequinMetaObject;
		}

		int boneNo = 0;
		TPair<FString, FString> prev;
		for (auto& a : meta->humanoidBoneTable) {
			if (ss==nullptr) break;
			auto ind = UniGLBGetRefSkeleton(ss).FindBoneIndex(*(a.Value));

			if (boneNo == 0) {
				prev = a;
			}

			if (ind == INDEX_NONE && a.Value!="") {
				// set prev bone name
				a.Value = prev.Value;
			}
			prev = a;
			++boneNo;
		}
	}


	return true;
}

UniGLBConvertHumanoid::UniGLBConvertHumanoid()
{
}

UniGLBConvertHumanoid::~UniGLBConvertHumanoid()
{
}
