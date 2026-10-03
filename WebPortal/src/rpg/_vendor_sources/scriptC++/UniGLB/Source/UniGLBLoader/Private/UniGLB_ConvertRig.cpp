// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_ConvertRig.h"
#include "UniGLB_Convert.h"
#include "UniGLBAssimpScene.h"
#include "UniGLB_Util.h"

#include "UniGLB_AssetListObject.h"
#include "UniGLB_MetaObject.h"
#include "UniGLB_LoaderBPFunctionLibrary.h"
#include "UniGLB_BPFunctionLibrary.h"

#include "Engine/SkeletalMesh.h"
#include "RenderingThread.h"
#include "Rendering/SkeletalMeshModel.h"
#include "Rendering/SkeletalMeshLODModel.h"
#include "Rendering/SkeletalMeshLODRenderData.h"
#include "Rendering/SkeletalMeshRenderData.h"
#include "Animation/MorphTarget.h"
#include "Animation/NodeMappingContainer.h"
#include "Animation/Skeleton.h"
#include "Components/SkeletalMeshComponent.h"
#include "UObject/UnrealType.h"
// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(5, 4, 0)] all below target floor (5, 7, 0)).

#include "PhysicsEngine/PhysicsAsset.h"
#include "PhysicsEngine/PhysicsConstraintTemplate.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 5, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "PhysicsEngine/SkeletalBodySetup.h"


#include "UniGLB_RigHeader.h"


#if WITH_EDITOR
#include "IPersonaToolkit.h"
#include "PersonaModule.h"
#include "Modules/ModuleManager.h"
#include "Animation/DebugSkelMeshComponent.h"
#endif

#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/mesh.h>
#include <assimp/postprocess.h>
#include <assimp/GltfMaterial.h>
#include <assimp/vrm/vrmmeta.h>

//#include "Engine/.h"

namespace {

	static int GetChildBoneLocal(const FReferenceSkeleton &skeleton, const int32 ParentBoneIndex, TArray<int32> & Children) {
		Children.Reset();
		//auto &r = skeleton->GetReferenceSkeleton();
		auto &r = skeleton;

		const int32 NumBones = r.GetRawBoneNum();
		for (int32 ChildIndex = ParentBoneIndex + 1; ChildIndex < NumBones; ChildIndex++)
		{
			if (ParentBoneIndex == r.GetParentIndex(ChildIndex))
			{
				Children.Add(ChildIndex);
			}
		}
		return Children.Num();
	}

	static bool isSameOrChild(const FReferenceSkeleton &skeleton, const int32 TargetBoneIndex, const int32 SameOrChildBoneIndex) {
		auto &r = skeleton;

		if (TargetBoneIndex < 0 || SameOrChildBoneIndex < 0) {
			return false;
		}

		int32 c = SameOrChildBoneIndex;
		for (int i = 0; i < skeleton.GetRawBoneNum(); ++i) {

			if (c < 0) break;

			if (c == TargetBoneIndex) {
				return true;
			}

			c = skeleton.GetParentIndex(c);
		}
		return false;
	}
}

bool UniGLBConverter::ConvertRig(UUniGLBAssetListObject *uniGLBAssetList) {

	if (UniGLBConverter::Options::Get().IsDebugOneBone()) {
		return true;
	}

	if (uniGLBAssetList->SkeletalMesh == nullptr) {
		return false;
	}

	bool bPlay = false;
	{
		bool b1, b2, b3;
		b1 = b2 = b3 = false;
		UUniGLBBPFunctionLibrary::UniGLBGetPlayMode(b1, b2, b3);
		bPlay = b1;
	}
	if (bPlay) {
	}

	// override bone table
	if (UniGLBConverter::Options::Get().IsVRMAModel()) {
		if (uniGLBAssetList->UniGLBMetaObject) {
			for (auto& t : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {
				t.Value = t.Key;
			}
		}
	}

	auto* k = UniGLBGetSkeleton(uniGLBAssetList->SkeletalMesh);

// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(4, 20, 0), (5, 4, 0)] all below target floor (5, 7, 0)).

	if (UniGLBConverter::Options::Get().IsVRMAModel()) {
		// for expression curve
		for (int i = 0; i < k->GetReferenceSkeleton().GetRawBoneNum(); ++i) {
			k->SetBoneTranslationRetargetingMode(i, EBoneTranslationRetargetingMode::Animation);
		}

		if (uniGLBAssetList && uniGLBAssetList->UniGLBMetaObject) {
			for (auto& t : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {
				auto i = k->GetReferenceSkeleton().FindBoneIndex(*t.Value);
				if (i != INDEX_NONE) {
					if (t.Key.Compare(TEXT("hips"), ESearchCase::IgnoreCase) == 0) {
					} else {
						k->SetBoneTranslationRetargetingMode(i, EBoneTranslationRetargetingMode::Skeleton);
					}
				}
			}
		}
	}else{

		FString PelvisBoneName;
		if (uniGLBAssetList && uniGLBAssetList->UniGLBMetaObject) {
			for (auto& t : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {
				if (t.Key.Compare(TEXT("hips"), ESearchCase::IgnoreCase) == 0) {
					PelvisBoneName = t.Value;
					break;
				}
			}
		}

		int bone = -1;
		for (int i = 0; i < k->GetReferenceSkeleton().GetRawBoneNum(); ++i) {
			//const int32 BoneIndex = k->GetReferenceSkeleton().FindBoneIndex(InBoneName);
			k->SetBoneTranslationRetargetingMode(i, EBoneTranslationRetargetingMode::Skeleton);
			//FAssetNotifications::SkeletonNeedsToBeSaved(k);
			if (k->GetReferenceSkeleton().GetBoneName(i).Compare(*PelvisBoneName) == 0) {
				bone = i;
			}
		}

		bool first = true;
		while (bone >= 0) {
			if (first) {
				k->SetBoneTranslationRetargetingMode(bone, EBoneTranslationRetargetingMode::AnimationScaled);
			}
			else {
				k->SetBoneTranslationRetargetingMode(bone, EBoneTranslationRetargetingMode::Animation);
			}
			first = false;

			bone = k->GetReferenceSkeleton().GetParentIndex(bone);
		}
		{
			FName n[] = {
				TEXT("ik_foot_root"),
				TEXT("ik_foot_l"),
				TEXT("ik_foot_r"),
				TEXT("ik_hand_root"),
				TEXT("ik_hand_gun"),
				TEXT("ik_hand_l"),
				TEXT("ik_hand_r"),
			};

			for (auto& s : n) {
				int32 ind = k->GetReferenceSkeleton().FindBoneIndex(s);
				if (ind < 0) continue;

				k->SetBoneTranslationRetargetingMode(ind, EBoneTranslationRetargetingMode::Animation, false);
			}
		}
		if (UniGLBConverter::Options::Get().IsPMXModel()) {
			// center to animscale
			int32 ind = k->GetReferenceSkeleton().FindBoneIndex(*(UniGLBUtil::table_ue4_pmx[1].BoneVRM));
			if (ind >= 0) {
				k->SetBoneTranslationRetargetingMode(ind, EBoneTranslationRetargetingMode::AnimationScaled, false);
			}
		}
		if (UniGLBConverter::Options::Get().IsBVHModel()) {
			// 0 == root by uniglb dummy
			// 1 == root by model
			k->SetBoneTranslationRetargetingMode(0, EBoneTranslationRetargetingMode::Animation, false);
			k->SetBoneTranslationRetargetingMode(1, EBoneTranslationRetargetingMode::Animation, false);
		}
		if (UniGLBConverter::Options::Get().IsVRMModel() == false) {
			k->SetBoneTranslationRetargetingMode(0, EBoneTranslationRetargetingMode::Animation, false);
		}

	}

	// dummy Collision
	if (uniGLBAssetList) {
		const VRM::VRMMetadata* meta = reinterpret_cast<VRM::VRMMetadata*>(aiData->mVRMMeta);
		USkeletalMesh* sk = uniGLBAssetList->SkeletalMesh;
		UPhysicsAsset* pa = UniGLBGetPhysicsAsset(sk);
		const FString dummy_target[] = {
			TEXT("hips"),
			TEXT("head"),

			TEXT("rightHand"),
			TEXT("leftHand"),
			TEXT("leftMiddleDistal"),
			TEXT("rightMiddleDistal"),


			TEXT("rightFoot"),
			TEXT("leftFoot"),

			TEXT("leftToes"),
			TEXT("rightToes"),

			TEXT("rightLowerArm"),
			TEXT("leftLowerArm"),

			TEXT("rightLowerLeg"),
			TEXT("leftLowerLeg"),
		};
		if (meta && pa) {
			for (const auto& a : meta->humanoidBone) {

				{
					bool bFound = false;
					for (auto& d : dummy_target) {
						if (d.Compare(a.humanBoneName.C_Str()) == 0) {
							bFound = true;
						}
					}
					if (bFound == false) {
						continue;
					}
				}

				{
					bool b = false;
					for (const auto& bs : pa->SkeletalBodySetups) {
						FString s = bs->BoneName.ToString();
						if (s.Compare(a.nodeName.C_Str(), ESearchCase::IgnoreCase) == 0) {
							b = true;
							break;
						}
					}
					if (b) {
						continue;
					}
				}

				const int targetBone = UniGLBGetRefSkeleton(sk).FindRawBoneIndex(a.nodeName.C_Str());
				if (targetBone == INDEX_NONE) {
					break;
				}

				USkeletalBodySetup* bs = nullptr;
				int BodyIndex1 = -1;

				bs = NewObject<USkeletalBodySetup>(pa, *(FString(TEXT("dummy_for_clip")) + a.humanBoneName.C_Str()), RF_Transactional);

				FKAggregateGeom agg;
				FKSphereElem SphereElem;
				SphereElem.Center = FVector(0);
				SphereElem.Radius = 1.f;// center.Size();// 1.f;
				agg.SphereElems.Add(SphereElem);
				SphereElem.SetName(TEXT("dummy_for_clip"));

				bs->Modify();
				bs->BoneName = a.nodeName.C_Str();
				bs->AddCollisionFrom(agg);
				bs->CollisionTraceFlag = CTF_UseSimpleAsComplex;
				// newly created bodies default to simulating
				bs->PhysicsType = PhysType_Kinematic;	// fix
														//bs->get
				bs->CollisionReponse = EBodyCollisionResponse::BodyCollision_Disabled;
				bs->DefaultInstance.InertiaTensorScale.Set(2, 2, 2);
				bs->DefaultInstance.LinearDamping = 0.f;
				bs->DefaultInstance.AngularDamping = 0.f;

				bs->InvalidatePhysicsData();
				bs->CreatePhysicsMeshes();
				BodyIndex1 = pa->SkeletalBodySetups.Add(bs);

				//break;
			}

			pa->UpdateBoundsBodiesArray();
			pa->UpdateBodySetupIndexMap();
			RefreshSkelMeshOnPhysicsAssetChange(sk);
#if WITH_EDITOR
			pa->RefreshPhysicsAssetChange();
#endif

#if WITH_EDITOR
			if (UniGLBConverter::IsImportMode()) {
				pa->PostEditChange();
			}
#endif
		}
	}// collistion

	return true;
}

