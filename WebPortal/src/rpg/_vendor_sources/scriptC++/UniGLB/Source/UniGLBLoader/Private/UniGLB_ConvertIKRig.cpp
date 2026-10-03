// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_ConvertIKRig.h"
#include "UniGLB_Convert.h"
#include "UniGLBAssimpScene.h"
#include "UniGLB_Util.h"

#include "UniGLB_AssetListObject.h"
#include "UniGLB_MetaObject.h"
#include "UniGLB_LoaderBPFunctionLibrary.h"
#include "UniGLB_BPFunctionLibrary.h"

#include "Engine/SkeletalMesh.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetRegistry/IAssetRegistry.h"
#include "UniGLBMannyResolver.h"
#include "UniGLBLoaderLog.h"
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

#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
#define UniGLB_USE_AUTOALIGN 1
#endif

#ifndef UniGLB_USE_AUTOALIGN
#define UniGLB_USE_AUTOALIGN 0
#endif


#define UniGLB_USE_EDITOR_RIG WITH_EDITOR

namespace {

#if UniGLB_USE_EDITOR_RIG && WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.

	static void LocalSolverSetup(UIKRigController* rigcon, UUniGLBAssetListObject *assetList, int table_no=0xFFFF) {
		if (rigcon == nullptr) return;

		int sol_index = 0;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
		auto* sol = rigcon->GetSolverAtIndex(sol_index);

		if (sol == nullptr) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0), (5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
			sol_index = rigcon->AddSolver(FIKRigFullBodyIKSolver::StaticStruct());
			sol = rigcon->GetSolverAtIndex(sol_index);
			if (sol) {
				auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
				if (sc) {
					auto s = sc->GetSolverSettings();
					s.RootBehavior = EPBIKRootBehavior::PinToInput;
					s.GlobalPullChainAlpha = 0;
					sol->SetSolverSettings(&s);
				}
			}
		}
		if (sol == nullptr) return;


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
		sol->SetEnabled(true);

		// hip
		for (auto& modelName : assetList->UniGLBMetaObject->humanoidBoneTable) {
			if (modelName.Key == "" || modelName.Value == "") {
				continue;
			}
			if (modelName.Key == TEXT("hips")) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
				sol->SetStartBone(*modelName.Value);

			}
		}

		{
			TArray<FString> a = {
				TEXT("leftHand"),
				TEXT("rightHand"),
				TEXT("leftToes"),
				TEXT("rightToes"),
			};

			if (table_no == 0){
				// not change
			}else if (table_no == 1){
				TArray < FString > tmp = {
					TEXT("leftHand"),
					TEXT("rightHand"),
					TEXT("leftFoot"),
					TEXT("rightFoot"),
				};
				a = tmp;
			}


			if (UniGLBConverter::Options::Get().IsBVHModel()) {
				{
					TArray < FString > tmp = {
						TEXT("l_hand"),
						TEXT("r_hand"),
						TEXT("l_foot"),
						TEXT("r_foot"),
					};
					a = tmp;
				}
				
				if (table_no == 1) {
					TArray < FString > tmp = {
						TEXT("l_hand"),
						TEXT("r_hand"),
						TEXT("l_toes"),
						TEXT("r_toes"),
					};
					a = tmp;
				}
			}

			for (int i = 0; i < a.Num(); ++i) {
				for (auto& t : assetList->UniGLBMetaObject->humanoidBoneTable) {
					if (t.Key.ToLower() == a[i].ToLower()) {

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0), (5, 2, 0), (5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
						auto goal = rigcon->AddNewGoal(*(a[i] + TEXT("_Goal")), *t.Value);
						if (goal != NAME_None) {
							rigcon->ConnectGoalToSolver(goal, sol_index);

							// arm chain
							if (i == 0 || i == 1) {
								auto *sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));

								if (sc) {
									auto settings = sc->GetGoalSettings(goal);
									settings.PullChainAlpha = 0.f;
									sc->SetGoalSettings(goal, settings);
								}
							}

							const auto& chain = rigcon->GetRetargetChains();
							for (auto& c : chain) {
								if (c.EndBone.BoneName == *t.Value) {
									rigcon->SetRetargetChainGoal(c.ChainName, goal);
								}
							}
						}
					}
				}
			}
			// BVH
			if (UniGLBConverter::Options::Get().IsBVHModel()) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0), (5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
				for (int i = 0; i < a.Num(); ++i) {

					USkeletalMesh* sk = assetList->SkeletalMesh;

					//auto boneList = UniGLBGetRefSkeleton(sk).GetRefBonePose();
					auto ind = UniGLBGetRefSkeleton(sk).FindBoneIndex(*a[i]);

					if (ind < 0) continue;

					auto goal = rigcon->AddNewGoal(*(a[i] + TEXT("_Goal")), *a[i]);
					if (goal != NAME_None) {
						rigcon->ConnectGoalToSolver(goal, sol_index);

						// arm chain
						if (i == 0 || i == 1) {
							auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));

							if (sc) {
								auto settings = sc->GetGoalSettings(goal);
								settings.PullChainAlpha = 0.f;
								sc->SetGoalSettings(goal, settings);
							}

							//UIKRig_FBIKEffector* e = Cast<UIKRig_FBIKEffector>(sol->GetGoalSettings(goal));
							//if (e) {
							//	e->PullChainAlpha = 0.f;
							//}
						}

						const auto& chain = rigcon->GetRetargetChains();
						for (auto& c : chain) {
							if (c.EndBone.BoneName == *a[i]) {
								rigcon->SetRetargetChainGoal(c.ChainName, goal);
							}
						}
					}

				}
			}// bvh
		}
		{
			TArray<FString> a = {
				TEXT("leftShoulder"),
				TEXT("rightShoulder"),
				TEXT("leftLowerArm"),
				TEXT("rightLowerArm"),

				TEXT("leftUpperLeg"),
				TEXT("rightUpperLeg"),
				TEXT("leftLowerLeg"),
				TEXT("rightLowerLeg"),

				TEXT("leftFoot"),
				TEXT("rightFoot"),
				

				TEXT("hips"),
				TEXT("spine"),
				TEXT("chest"),
				TEXT("upperChest"),
			};
			for (int i = 0; i < a.Num(); ++i) {
				for (auto& t : assetList->UniGLBMetaObject->humanoidBoneTable) {
					if (t.Key.ToLower() == a[i].ToLower()) {

						if (t.Value == "") continue;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
						typedef UIKRig_FBIKBoneSettings UIKRig_PBIKBoneSettings;

						// shoulder
						if (i == 0 || i == 1) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
							sol->AddSettingsToBone(*t.Value);
							auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
							if (sc) {
								auto settings = sc->GetBoneSettings(*t.Value);
								settings.RotationStiffness = 0.95f;
								sc->SetBoneSettings(*t.Value, settings);
							}
						}

						// arm
						if (i == 2 || i == 3) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
							sol->AddSettingsToBone(*t.Value);
							auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
							if (sc) {
								auto settings = sc->GetBoneSettings(*t.Value);
								settings.bUsePreferredAngles = true;
								if (i == 2) {
									settings.PreferredAngles.Set(0, 0, 90);
								} else {
									settings.PreferredAngles.Set(0, 0, -90);
								}
								sc->SetBoneSettings(*t.Value, settings);
							}
						}

						// only lower leg
						if (i == 6 || i == 7) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
							sol->AddSettingsToBone(*t.Value);
							auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
							if (sc) {
								auto settings = sc->GetBoneSettings(*t.Value);
								//settings.bUsePreferredAngles = true;
								if (i == 4 || i == 5) {
									settings.PreferredAngles.Set(-180, 0, 0);
								}
								else {
									settings.PreferredAngles.Set(180, 0, 0);
									settings.Y = EPBIKLimitType::Locked;
									settings.Z = EPBIKLimitType::Locked;
								}
								sc->SetBoneSettings(*t.Value, settings);
							}
						}

						// foot
						if (i == 8 || i == 9) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
							sol->AddSettingsToBone(*t.Value);
							auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
							if (sc) {
								auto settings = sc->GetBoneSettings(*t.Value);
								settings.RotationStiffness = 0.85f;
								sc->SetBoneSettings(*t.Value, settings);
							}
						}

						// spine
						if (i >= 10) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
							sol->AddSettingsToBone(*t.Value);
							auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
							if (sc) {
								auto settings = sc->GetBoneSettings(*t.Value);
								if (i == 10) {
									settings.RotationStiffness = 1.f;
								}
								else {
									settings.RotationStiffness = 0.9f;
								}
								sc->SetBoneSettings(*t.Value, settings);
							}
						}

					}
				}
			}
		}
	}
#endif
}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.

#if WITH_EDITOR
#else
class UIKRetargeterController {
public:
	static void setSourceRig(UIKRetargeter* retargeter, UIKRigDefinition* rig){
		retargeter->SourceIKRigAsset = rig;
	}
};
#endif


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.

class SimpleRetargeterController {
	//friend class UIKRetargeter;

	UIKRetargeter *Retargeter = nullptr;
public:
	SimpleRetargeterController(UIKRetargeter* rig) {
		Retargeter = rig;
	}

	FName CreateRetargetPose(const FName& NewPoseName, const ERetargetSourceOrTarget SourceOrTarget) const {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.

#if UniGLB_USE_EDITOR_RIG
		UIKRetargeterController* c = UIKRetargeterController::GetController(Retargeter);
		return c->CreateRetargetPose(NewPoseName, SourceOrTarget);
#else
		return NewPoseName;
#endif

	}

	FIKRetargetPose* GetRetargetPosesByName(const ERetargetSourceOrTarget SourceOrTarget, FName poseName) const
	{
#if UniGLB_USE_EDITOR_RIG
		//FScopeLock Lock(&ControllerLock);
		UIKRetargeterController* c = UIKRetargeterController::GetController(Retargeter);
		return &c->GetRetargetPoses(SourceOrTarget)[poseName];
#else
		//return SourceOrTarget == ERetargetSourceOrTarget::Source ? Retargeter->SourceRetargetPoses : Retargeter->TargetRetargetPoses;
		return const_cast<FIKRetargetPose*>(Retargeter->GetRetargetPoseByName(SourceOrTarget, poseName));

#endif
		//return SourceOrTarget == ERetargetSourceOrTarget::Source ? GetAsset()->SourceRetargetPoses : GetAsset()->TargetRetargetPoses;
	}


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
	void SetIKRig(const ERetargetSourceOrTarget SourceOrTarget, UIKRigDefinition* IKRig) const {
#if UniGLB_USE_EDITOR_RIG
		UIKRetargeterController* c = UIKRetargeterController::GetController(Retargeter);
		c->SetIKRig(SourceOrTarget, IKRig);
#else
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
		// no rig
#endif
	}

	void AutoAlignAllBones(const ERetargetSourceOrTarget SourceOrTarget) const {
#if	!WITH_EDITOR // UE_VERSION_OLDER_THAN(5,4,0) branch removed: target floor is 5.7, always false here
#else
		UIKRetargeterController* c = UIKRetargeterController::GetController(Retargeter);
		c->AutoAlignAllBones(SourceOrTarget);
#endif
	}

	void SetCurrentRetargetPose(FName NewCurrentPose, const ERetargetSourceOrTarget SourceOrTarget) const {
#if	!WITH_EDITOR // UE_VERSION_OLDER_THAN(5,4,0) branch removed: target floor is 5.7, always false here
#else
		UIKRetargeterController* c = UIKRetargeterController::GetController(Retargeter);
		c->SetCurrentRetargetPose(NewCurrentPose, SourceOrTarget);
#endif
	}

	TMap<FName, FIKRetargetPose>& GetRetargetPoses(const ERetargetSourceOrTarget SourceOrTarget) const {
#if	!WITH_EDITOR // UE_VERSION_OLDER_THAN(5,4,0) branch removed: target floor is 5.7, always false here
		static TMap<FName, FIKRetargetPose> a;
		return a;
#else
		UIKRetargeterController* c = UIKRetargeterController::GetController(Retargeter);
		return c->GetRetargetPoses(SourceOrTarget);
#endif
	};
	void SetRotationOffsetForRetargetPoseBone(
		const FName& BoneName,
		const FQuat& RotationOffset,
		const ERetargetSourceOrTarget SourceOrTarget) const {
#if	!WITH_EDITOR // UE_VERSION_OLDER_THAN(5,4,0) branch removed: target floor is 5.7, always false here
		return;
#else
		UIKRetargeterController* c = UIKRetargeterController::GetController(Retargeter);
		return c->SetRotationOffsetForRetargetPoseBone(BoneName, RotationOffset, SourceOrTarget);
#endif

	}


	void SetChainSetting() {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
#if UniGLB_USE_EDITOR_RIG
		UIKRetargeterController* c = UIKRetargeterController::GetController(Retargeter);
PRAGMA_DISABLE_DEPRECATION_WARNINGS
		{
			auto cs = c->GetRetargetChainSettings(TEXT("Root"));
			cs.FK.TranslationMode = ERetargetTranslationMode::GloballyScaled;
			c->SetRetargetChainSettings(TEXT("Root"), cs);
		}
		{
			TArray<FString> table = {
				TEXT("FootRootIK"),
				TEXT("LeftFootIK"),
				TEXT("RightFootIK"),
				TEXT("HandRootIK"),
				TEXT("LeftHandIK"),
				TEXT("RightHandIK"),
			};
			for (auto s : table) {
				auto cs = c->GetRetargetChainSettings(*s);
				cs.FK.TranslationMode = ERetargetTranslationMode::GloballyScaled;
				c->SetRetargetChainSettings(*s, cs);
			}
		}
PRAGMA_ENABLE_DEPRECATION_WARNINGS
		/*
		{
			TArray<FString> table = {
				TEXT("LeftLeg"),
				TEXT("RightLeg"),
				TEXT("LeftArm"),
				TEXT("RightArm"),
			};
			for (auto s : table) {
				auto cs = c->GetRetargetChainSettings(*s);
				cs.FK.PoleVectorMatching = 1.f;
				c->SetRetargetChainSettings(*s, cs);
			}
		}
		{
			TArray<FString> table = {
				TEXT("LeftArm"),
				TEXT("RightArm"),
			};
			for (auto s : table) {
				auto cs = c->GetRetargetChainSettings(*s);
				cs.IK.bAffectedByIKWarping = false;
				c->SetRetargetChainSettings(*s, cs);
			}
		}
		*/

#else
		auto r = Retargeter->GetChainMapByName(TEXT("Root"));
		r->Settings.FK.TranslationMode = ERetargetTranslationMode::GloballyScaled;
#endif // rig
	}
};

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.

class SimpleRigController {

public:
	UIKRigDefinition* RigDefinition = nullptr;

	SimpleRigController(UIKRigDefinition* rig) {
		RigDefinition = rig;
	}

#if UniGLB_USE_EDITOR_RIG

	UIKRigController* LocalGetController(UIKRigDefinition* rig) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
		return UIKRigController::GetController(rig);
	}
	UIKRigController* LocalGetController(UIKRigDefinition* rig) const {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
		return UIKRigController::GetController(rig);
	}


#endif


	void SetSkeletalMesh(USkeletalMesh* sk) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.

#if UniGLB_USE_EDITOR_RIG
		auto *r = LocalGetController(RigDefinition);
		r->SetSkeletalMesh(sk);
#else
		RigDefinition->PreviewSkeletalMesh = sk;
		const_cast<FIKRigSkeleton*>(&RigDefinition->GetSkeleton())->SetInputSkeleton(sk, RigDefinition->GetSkeleton().ExcludedBones);
		ResetInitialGoalTransforms();
#endif
	}

	bool SetRetargetRoot(const FName RootBoneName) const
	{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
#if UniGLB_USE_EDITOR_RIG
		auto* r = LocalGetController(RigDefinition);
		return r->SetRetargetRoot(RootBoneName);
#else

		FName NewRootBone = RootBoneName;
		if (RootBoneName != NAME_None && RigDefinition->GetSkeleton().GetBoneIndexFromName(RootBoneName) == INDEX_NONE)
		{
			NewRootBone = NAME_None;
		}

		//FScopedTransaction Transaction(LOCTEXT("SetRetargetRootBone_Label", "Set Retarget Root Bone"));
		RigDefinition->Modify();

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.

		//BroadcastNeedsReinitialized();

		return true;
#endif
	}

	FName UniGLBAddRetargetChain(FName name, FName begin, FName end) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
		FBoneChain c;
		FBoneReference r1, r2;
		r1.BoneName = begin;
		r2.BoneName = end;

		auto k = RigDefinition->GetPreviewMesh()->GetSkeleton();

		r1.Initialize(k);
		r2.Initialize(k);

		c.ChainName = name;
		c.StartBone = r1;
		c.EndBone = r2;

#if UniGLB_USE_EDITOR_RIG
		auto* r = LocalGetController(RigDefinition);
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
		r->AddRetargetChain(name, begin, end, NAME_None);
		return NAME_None;
#else
		if (c.StartBone.BoneName != NAME_None && RigDefinition->GetSkeleton().GetBoneIndexFromName(c.StartBone.BoneName) == INDEX_NONE)
		{
			//UE_LOG(LogIKRigEditor, Warning, TEXT("Could not create retarget chain. Start Bone does not exist, %s."), *c.StartBone.BoneName.ToString());
			return NAME_None; // bone doesn't exist
		}

		if (c.EndBone.BoneName != NAME_None && RigDefinition->GetSkeleton().GetBoneIndexFromName(c.EndBone.BoneName) == INDEX_NONE)
		{
			//UE_LOG(LogIKRigEditor, Warning, TEXT("Could not create retarget chain. End Bone does not exist, %s."), *c.EndBone.BoneName.ToString());
			return NAME_None; // bone doesn't exist
		}

		FBoneChain ChainToAdd = c;

		// if no name specified, use a default
		if (ChainToAdd.ChainName == NAME_None)
		{
			const FName DefaultChainName = FName("DefaultChainName");
			ChainToAdd.ChainName = DefaultChainName;
		}

		ChainToAdd.ChainName = GetUniqueRetargetChainName(c.ChainName);

		//FScopedTransaction Transaction(LOCTEXT("AddRetargetChain_Label", "Add Retarget Chain"));
		RigDefinition->Modify();

		const int32 NewChainIndex = const_cast<TArray<FBoneChain>*>(&RigDefinition->GetRetargetChains())->Emplace(ChainToAdd);

		//RetargetChainAdded.Broadcast(RigDefinition);
		//BroadcastNeedsReinitialized();

		return NAME_None;// RigDefinition->RetargetDefinition.BoneChains[NewChainIndex].ChainName;
#endif
	}
	void LocalSolverSetup(UUniGLBAssetListObject *uniGLBAssetList, int table_no=0xFFFF) {
#if UniGLB_USE_EDITOR_RIG
		auto* r = LocalGetController(RigDefinition);
		::LocalSolverSetup(r, uniGLBAssetList, table_no);
#else
#endif
	}


	FTransform GetRefPoseTransformOfBone(const FName BoneName) const
	{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
		const int32 BoneIndex = RigDefinition->GetSkeleton().GetBoneIndexFromName(BoneName);
		if (BoneIndex == INDEX_NONE)
		{
			//UE_LOG(LogIKRigEditor, Warning, TEXT("Tried to get the ref pose of bone that is not loaded into this rig."));
			return FTransform::Identity;
		}

		return RigDefinition->GetSkeleton().RefPoseGlobal[BoneIndex];
	}
	void ResetInitialGoalTransforms() const
	{
		for (UIKRigEffectorGoal* Goal : RigDefinition->GetGoalArray())
		{
			// record the current delta rotation
			const FQuat DeltaRotation = Goal->CurrentTransform.GetRotation() * Goal->InitialTransform.GetRotation().Inverse();
			// update the initial transform based on the new ref pose
			const FTransform InitialTransform = GetRefPoseTransformOfBone(Goal->BoneName);
			Goal->InitialTransform = InitialTransform;
			// restore the current transform
			Goal->CurrentTransform.SetRotation(Goal->InitialTransform.GetRotation() * DeltaRotation);
		}
	}
	FName GetUniqueRetargetChainName(const FName NameToMakeUnique) const
	{
		auto IsNameBeingUsed = [this](const FName NameToTry)->bool
			{
				for (const FBoneChain& Chain : RigDefinition->GetRetargetChains())
				{
					if (Chain.ChainName == NameToTry)
					{
						return true;
					}
				}
				return false;
			};

		// check if name is already unique
		if (!IsNameBeingUsed(NameToMakeUnique))
		{
			return NameToMakeUnique;
		}

		// keep concatenating an incremented integer suffix until name is unique
		int32 Number = NameToMakeUnique.GetNumber() + 1;
		while (IsNameBeingUsed(FName(NameToMakeUnique, Number)))
		{
			Number++;
		}

		return FName(NameToMakeUnique, Number);
	}
};



#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
static UIKRigDefinition* GenerateMannequinIK(UUniGLBAssetListObject* uniGLBAssetList, FString path_forSK, FString Footer) {

	UObject* u = nullptr;
	{
		FSoftObjectPath r2(path_forSK);
		u = r2.TryLoad();

		if (u == nullptr) return nullptr;
	}

	USkeletalMesh* sk = nullptr;
	if (u) {
		auto r2 = Cast<USkeletalMesh>(u);
		if (r2) {
			sk = r2;
		}
	}
	if (sk == nullptr) return nullptr;

	FString name = FString(TEXT("IK_")) + TEXT("UniGLB_") + Footer;

	UIKRigDefinition* rig_ik = nullptr;
	{
		// 生成済なら返す
		FSoftObjectPath r2(name);
		rig_ik = Cast <UIKRigDefinition>(r2.TryLoad());
		if (rig_ik) return rig_ik;
	}

	rig_ik = UniGLB_NewObject<UIKRigDefinition>(uniGLBAssetList->Package, *name, RF_Public | RF_Standalone);

	{
		SimpleRigController rigcon = SimpleRigController(rig_ik);
		rigcon.SetSkeletalMesh(sk);

		// root
		{
			auto s = UniGLBGetRefSkeleton(sk).GetBoneName(0);
			rigcon.UniGLBAddRetargetChain(TEXT("Root"), s, s);
		}

		struct TT {
			FString chain;
			FString s1;
			FString s2;
			uint32_t mask = 0xFFFF;
		};

		TArray<FString> AddedChainList;

		TArray<TT> table = {
			{TEXT("Spine"),		TEXT("spine_01"),				TEXT("spine_05"),},
			{TEXT("Neck"),		TEXT("neck_01"),				TEXT("neck_02"),},
			{TEXT("Head"),		TEXT("head"),				TEXT("head"),},

			{TEXT("LeftClavicle"),	TEXT("clavicle_l"),		TEXT("clavicle_l"),},
			{TEXT("LeftArm"),		TEXT("upperarm_l"),		TEXT("hand_l"),},

			{TEXT("RightClavicle"),	TEXT("clavicle_r"),		TEXT("clavicle_r"),},
			{TEXT("RightArm"),		TEXT("upperarm_r"),		TEXT("hand_r"),},


			{TEXT("LeftIndexMetacarpal"),	TEXT("index_metacarpal_l"),		TEXT("index_metacarpal_l"),},
			{TEXT("LeftIndex"),				TEXT("index_01_l"),				TEXT("index_03_l"),},
			{TEXT("LeftMiddleMetacarpal"),	TEXT("middle_metacarpal_l"),	TEXT("middle_metacarpal_l"),},
			{TEXT("LeftMiddle"),			TEXT("middle_01_l"),			TEXT("middle_03_l"),},
			{TEXT("LeftThumb"),				TEXT("thumb_01_l"),				TEXT("thumb_03_l"),},
			{TEXT("LeftPinkyMetacarpal"),	TEXT("pinky_metacarpal_l"),		TEXT("pinky_metacarpal_l"),},
			{TEXT("LeftPinky"),				TEXT("pinky_01_l"),				TEXT("pinky_03_l"),},
			{TEXT("LeftRingMetacarpal"),	TEXT("ring_metacarpal_l"),		TEXT("ring_metacarpal_l"),},
			{TEXT("LeftRing"),				TEXT("ring_01_l"),				TEXT("ring_03_l"),},

			{TEXT("RightIndexMetacarpal"),	TEXT("index_metacarpal_r"),		TEXT("index_metacarpal_r"),},
			{TEXT("RightIndex"),			TEXT("index_01_r"),				TEXT("index_03_r"),},
			{TEXT("RightMiddleMetacarpal"),	TEXT("middle_metacarpal_r"),	TEXT("middle_metacarpal_r"),},
			{TEXT("RightMiddle"),			TEXT("middle_01_r"),			TEXT("middle_03_r"),},
			{TEXT("RightThumb"),			TEXT("thumb_01_r"),				TEXT("thumb_03_r"),},
			{TEXT("RightPinkyMetacarpal"),	TEXT("pinky_metacarpal_r"),		TEXT("pinky_metacarpal_r"),},
			{TEXT("RightPinky"),			TEXT("pinky_01_r"),				TEXT("pinky_03_r"),},
			{TEXT("RightRingMetacarpal"),	TEXT("ring_metacarpal_r"),		TEXT("ring_metacarpal_r"),},
			{TEXT("RightRing"),				TEXT("ring_01_r"),				TEXT("ring_03_r"),},

			{TEXT("LeftLeg"),	TEXT("thigh_l"),		TEXT("ball_l"),},
			{TEXT("RightLeg"),	TEXT("thigh_r"),		TEXT("ball_r"),},

		};

		for (auto& t : table) {
			rigcon.UniGLBAddRetargetChain(*t.chain, *t.s1, *t.s2);
		}
	}

	{
		auto* rigcon = UIKRigController::GetController(rig_ik);

		int sol_index = 0;

		sol_index = rigcon->AddSolver(FIKRigFullBodyIKSolver::StaticStruct());
		auto *sol = rigcon->GetSolverAtIndex(sol_index);

		{
			auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
			auto s = sc->GetSolverSettings();
			s.RootBehavior = EPBIKRootBehavior::Free;
			s.GlobalPullChainAlpha = 0;
			sol->SetSolverSettings(&s);
		}

		sol->SetEnabled(true);
		{
			FName boneName = TEXT("pelvis");
			sol->SetStartBone(boneName);
			rigcon->SetRetargetRoot(boneName);
		}
		{
			FName boneList[] = {
				TEXT("pelvis"),
				TEXT("clavicle_l"),
				TEXT("clavicle_r"),
			};

			for (auto& boneName : boneList) {
				sol->AddSettingsToBone(boneName);
				auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
				if (sc) {
					auto settings = sc->GetBoneSettings(boneName);
					settings.RotationStiffness = 0.95f;
					sc->SetBoneSettings(boneName, settings);
				}
			}
		}
		{
			FName boneList[] = {
				TEXT("lowerarm_r"),
				TEXT("lowerarm_l"),
				TEXT("calf_r"),
				TEXT("calf_l"),
			};

			for (auto& boneName : boneList) {
				sol->AddSettingsToBone(boneName);
				auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
				if (sc) {
					auto settings = sc->GetBoneSettings(boneName);
					settings.X = EPBIKLimitType::Locked;
					settings.Y = EPBIKLimitType::Locked;
					settings.RotationStiffness = 0.5f;
					settings.bUsePreferredAngles = true;
					settings.PreferredAngles.Set(0, 0, 45);
					sc->SetBoneSettings(boneName, settings);
				}
			}
		}
		{
			FName boneList[] = {
				TEXT("foot_r"),
				TEXT("foot_l"),
			};

			for (auto& boneName : boneList) {
				sol->AddSettingsToBone(boneName);
				auto* sc = Cast<UIKRigFBIKController>(rigcon->GetSolverController(sol_index));
				if (sc) {
					auto settings = sc->GetBoneSettings(boneName);
					settings.X = EPBIKLimitType::Locked;
					settings.Y = EPBIKLimitType::Locked;
					settings.RotationStiffness = 0.5f;
					settings.bUsePreferredAngles = true;
					settings.PreferredAngles.Set(0, 0, 45);
					sc->SetBoneSettings(boneName, settings);
				}
			}
		}

		{
			auto goal = rigcon->AddNewGoal(TEXT("RightHandIK"), TEXT("hand_r"));
			rigcon->SetRetargetChainGoal(TEXT("RightArm"), goal);
			rigcon->ConnectGoalToSolver(goal, sol_index);
		}
		{
			auto goal = rigcon->AddNewGoal(TEXT("LeftHandIK"), TEXT("hand_l"));
			rigcon->SetRetargetChainGoal(TEXT("LeftArm"), goal);
			rigcon->ConnectGoalToSolver(goal, sol_index);
		}
		{
			auto goal = rigcon->AddNewGoal(TEXT("RightFootIK"), TEXT("foot_r"));
			rigcon->SetRetargetChainGoal(TEXT("RightLeg"), goal);
			rigcon->ConnectGoalToSolver(goal, sol_index);
		}
		{
			auto goal = rigcon->AddNewGoal(TEXT("LeftFootIK"), TEXT("foot_l"));
			rigcon->SetRetargetChainGoal(TEXT("LeftLeg"), goal);
			rigcon->ConnectGoalToSolver(goal, sol_index);
		}
	}
	return rig_ik;
}
#endif


// Single source of truth for the Manny-family SkeletalMesh candidate paths. Ordered: the ThirdPerson
// template ships here in this project; the stock /Game/Characters path is the engine default; the
// Game Animation Sample variants are added so a GASP setup is found with zero config.
const TArray<FString>& UniGLB_GetMannyMeshCandidatePaths()
{
	static const TArray<FString> Paths = {
		TEXT("/Game/ThirdPerson/Characters/Mannequins/Meshes/SKM_Manny_Simple.SKM_Manny_Simple"),
		TEXT("/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple.SKM_Manny_Simple"),
		TEXT("/Game/GameAnimationSample/Characters/UE5_Mannequins/Meshes/SKM_Manny_Simple.SKM_Manny_Simple"),
		TEXT("/Game/ThirdPerson/Characters/Mannequins/Meshes/SKM_Manny.SKM_Manny"),
		TEXT("/Game/Characters/Mannequins/Meshes/SKM_Manny.SKM_Manny"),
		TEXT("/Game/GameAnimationSample/Characters/UE5_Mannequins/Meshes/SKM_Manny.SKM_Manny"),
	};
	return Paths;
}

// The Manny-family SKELETON object paths registered as compatible skeletons. SK_Mannequin under
// .../Mannequins/Meshes IS the USkeleton asset in the UE5 template; the GASP sample ships its own.
static const TArray<FString>& UniGLB_GetMannySkeletonCandidatePaths()
{
	static const TArray<FString> Paths = {
		TEXT("/Game/ThirdPerson/Characters/Mannequins/Meshes/SK_Mannequin.SK_Mannequin"),
		TEXT("/Game/Characters/Mannequins/Meshes/SK_Mannequin.SK_Mannequin"),
		TEXT("/Game/GameAnimationSample/Characters/UE5_Mannequins/Meshes/SK_Mannequin.SK_Mannequin"),
	};
	return Paths;
}

void UniGLB_RegisterCompatibleMannySkeletons(USkeleton* Target, USkeleton* PrimaryManny)
{
	if (Target == nullptr)
	{
		return;
	}
	auto Register = [Target](USkeleton* Extra)
	{
		if (Extra && Extra != Target)
		{
			// Always mutate the Target (the imported character), never the shared Manny asset.
			Target->AddCompatibleSkeleton(Extra);
			Target->MarkPackageDirty();
		}
	};
	Register(PrimaryManny);
	for (const FString& Path : UniGLB_GetMannySkeletonCandidatePaths())
	{
		Register(Cast<USkeleton>(FSoftObjectPath(Path).TryLoad()));
	}
}

// Resolves this project's Manny SkeletalMesh from the shared candidate list, then falls back to an
// AssetRegistry name+signature scan. External linkage so the anim-retarget bake and AutoRig reuse it.
// Returns nullptr if none load.
USkeletalMesh* UniGLB_ResolveMannySkeletalMesh()
{
	// 1. Known stock locations (fast path, no registry scan).
	for (const FString& P : UniGLB_GetMannyMeshCandidatePaths())
	{
		if (USkeletalMesh* M = Cast<USkeletalMesh>(FSoftObjectPath(P).TryLoad()))
		{
			return M;
		}
	}

	// A SkeletalMesh "is Manny" when its skeleton carries Manny's signature bone names (these are
	// Manny-specific: a Mixamo/Meshy/VRoid source uses different names, so this won't false-match a
	// previously-imported character).
	auto LooksLikeManny = [](USkeletalMesh* M) -> bool {
		if (M == nullptr) return false;
		const FReferenceSkeleton& R = M->GetRefSkeleton();
		return R.FindBoneIndex(TEXT("pelvis")) != INDEX_NONE
			&& R.FindBoneIndex(TEXT("clavicle_l")) != INDEX_NONE
			&& R.FindBoneIndex(TEXT("thigh_l")) != INDEX_NONE
			&& R.FindBoneIndex(TEXT("spine_05")) != INDEX_NONE;
	};

	// 2. Fallback: scan the AssetRegistry for any SkeletalMesh whose NAME says Manny/Mannequin and
	//    whose skeleton matches. Lets the user drop their own Manny (e.g. an imported
	//    SK_Mannequin_MANNY_APOSE) ANYWHERE under /Game and have it picked up with zero config.
	FAssetRegistryModule& ARM = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
	IAssetRegistry& AR = ARM.Get();
	TArray<FAssetData> Assets;
	AR.GetAssetsByClass(USkeletalMesh::StaticClass()->GetClassPathName(), Assets);
	for (const FAssetData& A : Assets)
	{
		const FString Name = A.AssetName.ToString().ToLower();
		if (!Name.Contains(TEXT("manny")) && !Name.Contains(TEXT("mannequin"))) continue;
		if (USkeletalMesh* M = Cast<USkeletalMesh>(A.GetAsset()))
		{
			if (LooksLikeManny(M))
			{
				UE_LOG(LogUniGLBLoader, Display, TEXT("UniGLB: resolved Manny via AssetRegistry name match: %s"), *A.GetSoftObjectPath().ToString());
				return M;
			}
		}
	}
	return nullptr;
}

bool UniGLBConverter::ConvertIKRig(UUniGLBAssetListObject *uniGLBAssetList) {

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

	if (uniGLBAssetList && UniGLBConverter::Options::Get().IsGenerateRigIK()) {
		// ikrig
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		const VRM::VRMMetadata* meta = reinterpret_cast<VRM::VRMMetadata*>(aiData->mVRMMeta);
		USkeletalMesh* sk = uniGLBAssetList->SkeletalMesh;

		UIKRigDefinition* rig = nullptr;
		{
			FString name = FString(TEXT("IK_")) + uniGLBAssetList->BaseFileName + TEXT("_UniGLBHumanoid");
			rig = UniGLB_NewObject<UIKRigDefinition>(uniGLBAssetList->Package, *name, RF_Public | RF_Standalone);

			SimpleRigController rigcon(rig);
			rigcon.SetSkeletalMesh(sk);

			if (uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Num() == 0) {
				// immediate generate bone table
				/*
				if (mc) {
					for (auto& boneMap : UniGLBUtil::table_ue4_vrm) {
						FString s;
						for (auto& table : mc->GetNodeMappingTable()) {
							if (table.Key.ToString().ToLower() == boneMap.BoneUE4.ToLower()) {
								s = table.Value.ToString();
							}
						}

						if (s != "" && boneMap.BoneVRM != "") {
							uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Add(boneMap.BoneVRM, s);
						}
					}
				}
				*/
			}
			{
				auto s = UniGLBGetRefSkeleton(sk).GetBoneName(0);
				rigcon.UniGLBAddRetargetChain(TEXT("root"), s, s);
			}
			for (auto& modelName : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {
				if (modelName.Key == "" || modelName.Value == "") {
					continue;
				}

				// spine
				int type = 0;
				if (modelName.Key == TEXT("spine")) {
					type = 1;
				}
				if (modelName.Key == TEXT("chest") || modelName.Key == TEXT("upperChest")) {
					type = 2;
				}

				switch (type) {
				case 0:
					rigcon.UniGLBAddRetargetChain(*modelName.Key, *modelName.Value, *modelName.Value);
					break;
				case 1:
				{
					auto *s = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Find(TEXT("upperChest"));
					if (s == nullptr) {
						s = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Find(TEXT("chest"));
					}

					if (s) {
						// spine chain
						rigcon.UniGLBAddRetargetChain(*modelName.Key, *modelName.Value, **s);
					}
				}
					break;
				default:
					break;
				}


				if (modelName.Key == TEXT("hips")) {
					rigcon.SetRetargetRoot(*modelName.Value);
				}
			}
		}

		{
			UIKRigDefinition* rig_epic = nullptr;

			FString name = FString(TEXT("IK_")) + uniGLBAssetList->BaseFileName + TEXT("_MannequinBone");
			rig_epic = UniGLB_NewObject<UIKRigDefinition>(uniGLBAssetList->Package, *name, RF_Public | RF_Standalone);

			SimpleRigController rigcon = SimpleRigController(rig_epic);
			rigcon.SetSkeletalMesh(sk);

			{
				auto s = UniGLBGetRefSkeleton(sk).GetBoneName(0);
				rigcon.UniGLBAddRetargetChain(TEXT("root"), s, s);
			}
			for (auto& modelName : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {
				if (modelName.Key == "" || modelName.Value == "") {
					continue;
				}
				for (auto& a : UniGLBUtil::table_ue4_vrm) {
					if (a.BoneUE4 == "" || a.BoneVRM == "") {
						continue;
					}
					if (a.BoneVRM.ToLower() == modelName.Key.ToLower()) {
						rigcon.UniGLBAddRetargetChain(*a.BoneUE4, *modelName.Value, *modelName.Value);
						if (modelName.Key == TEXT("hips")) {
							rigcon.SetRetargetRoot(*modelName.Value);
						}
						break;
					}
				}
			}
		}

		UIKRigDefinition* table_rig_ik[2] = {};
		{
			FString table_name[2] = {
				FString(TEXT("IK_")) + uniGLBAssetList->BaseFileName + TEXT("_Mannequin"),
				FString(TEXT("IK_UEFN_")) + uniGLBAssetList->BaseFileName + TEXT("_Mannequin"),
			};

			for (int ik_no=0; ik_no<2; ik_no++){
				FString name = table_name[ik_no];
				table_rig_ik[ik_no] = UniGLB_NewObject<UIKRigDefinition>(uniGLBAssetList->Package, *name, RF_Public | RF_Standalone);
				auto rig_ik = table_rig_ik[ik_no];

				SimpleRigController rigcon = SimpleRigController(rig_ik);
				rigcon.SetSkeletalMesh(sk);

				{
					auto s = UniGLBGetRefSkeleton(sk).GetBoneName(0);
					rigcon.UniGLBAddRetargetChain(TEXT("Root"), s, s);
				}
				struct TT {
					FString chain;
					FString s1;
					FString s2;
					uint32_t mask = 0xFFFF;
				};

				TArray<FString> AddedChainList;

				TArray<TT> table = {
					{TEXT("Spine"),		TEXT("spine"),				TEXT("chest"),},
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
					{TEXT("Neck"),		TEXT("neck"),				TEXT("neck"),},
					{TEXT("Head"),		TEXT("head"),				TEXT("head"),},
					{TEXT("RightArm"),	TEXT("rightUpperArm"),		TEXT("rightHand"),},
					{TEXT("LeftArm"),	TEXT("leftUpperArm"),		TEXT("leftHand"),},

					// 0
					{TEXT("RightLeg"),	TEXT("rightUpperLeg"),		TEXT("rightToes"),	0x01},
					{TEXT("LeftLeg"),	TEXT("leftUpperLeg"),		TEXT("leftToes"),	0x01},

					// 1
					{TEXT("RightLeg"),	TEXT("rightUpperLeg"),		TEXT("rightFoot"),	0x02},
					{TEXT("LeftLeg"),	TEXT("leftUpperLeg"),		TEXT("leftFoot"),	0x02},
					{TEXT("RightToe"),	TEXT("rightToes"),		TEXT("rightToes"),		0x02},
					{TEXT("LeftToe"),	TEXT("leftToes"),		TEXT("leftToes"),		0x02},

					{TEXT("LeftThumb"),		TEXT("leftThumbMetacarpal"),	TEXT("leftThumbDistal"),},	// vrm1 thumb
					{TEXT("LeftThumb"),		TEXT("leftThumbProximal"),		TEXT("leftThumbDistal"),},
					{TEXT("LeftIndex"),		TEXT("leftIndexProximal"),		TEXT("leftIndexDistal"),},
					{TEXT("LeftMiddle"),	TEXT("leftMiddleProximal"),	TEXT("leftMiddleDistal"),},
					{TEXT("LeftRing"),		TEXT("leftRingProximal"),		TEXT("leftRingDistal"),},
					{TEXT("LeftPinky"),		TEXT("leftLittleProximal"),	TEXT("leftLittleDistal"),},

					{TEXT("RightThumb"),	TEXT("rightThumbMetacarpal"),	TEXT("rightThumbDistal"),},	// vrm1 thumb
					{TEXT("RightThumb"),	TEXT("rightThumbProximal"),	TEXT("rightThumbDistal"),},
					{TEXT("RightIndex"),	TEXT("rightIndexProximal"),	TEXT("rightIndexDistal"),},
					{TEXT("RightMiddle"),	TEXT("rightMiddleProximal"),	TEXT("rightMiddleDistal"),},
					{TEXT("RightRing"),		TEXT("rightRingProximal"),		TEXT("rightRingDistal"),},
					{TEXT("RightPinky"),	TEXT("rightLittleProximal"),	TEXT("rightLittleDistal"),},

					{TEXT("LeftClavicle"),		TEXT("leftShoulder"),	TEXT("leftShoulder"),},
					{TEXT("RightClavicle"),		TEXT("rightShoulder"),	TEXT("rightShoulder"),},

					{TEXT("LeftHandIK"),		TEXT("ik_hand_l"),	TEXT("ik_hand_l"),},
					{TEXT("RightHandIK"),		TEXT("ik_hand_r"),	TEXT("ik_hand_r"),},
					{TEXT("HandGunIK"),			TEXT("ik_hand_gun"),	TEXT("ik_hand_gun"),},
					{TEXT("FootRootIK"),		TEXT("ik_foot_root"),	TEXT("ik_foot_root"),},
					{TEXT("HandRootIK"),		TEXT("ik_hand_root"),	TEXT("ik_hand_root"),},
				};

				TArray<TT> table_BVH = {
					{TEXT("Spine"),		TEXT("torso_1"),				TEXT("torso_7"),},
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
					{TEXT("Neck"),		TEXT("neck_1"),				TEXT("neck_2"),},
					{TEXT("Head"),		TEXT("head"),				TEXT("head"),},
					{TEXT("RightArm"),	TEXT("r_up_arm"),		TEXT("r_hand"),},
					{TEXT("LeftArm"),	TEXT("l_up_arm"),		TEXT("l_hand"),},

					// 0
					{TEXT("RightLeg"),	TEXT("r_up_leg"),		TEXT("r_toes"),	0x01},
					{TEXT("LeftLeg"),	TEXT("l_up_leg"),		TEXT("l_toes"),	0x01},

					// 1
					{TEXT("RightLeg"),	TEXT("r_up_leg"),		TEXT("r_foot"),	0x02},
					{TEXT("LeftLeg"),	TEXT("l_up_leg"),		TEXT("l_foot"),	0x02},
					{TEXT("RightToe"),	TEXT("r_toes"),		TEXT("r_toes"),		0x02},
					{TEXT("LeftToe"),	TEXT("l_toes"),		TEXT("l_toes"),		0x02},

					{TEXT("LeftClavicle"),		TEXT("l_shoulder"),	TEXT("l_shoulder"),},
					{TEXT("RightClavicle"),		TEXT("r_shoulder"),	TEXT("r_shoulder"),},
				};

				// mocopi bvh  bone name
				if (Options::Get().IsBVHModel()) {
					table.Append(table_BVH);

					rigcon.SetRetargetRoot("root");
				}

				for (auto& t : table) {
					if ((t.mask & (1 << 1)) == 0) {
					//if ((t.mask & (1 << ik_no)) == 0) {
							continue;
					}
					if (AddedChainList.Contains(t.chain)) {
						continue;
					}
					if (t.chain == TEXT("LeftThumb") || (t.chain == TEXT("RightThumb"))) {
						bool b0 = (t.s1 == TEXT("leftThumbProximal"))  || (t.s1 == TEXT("rightThumbProximal"));
						bool b1 = (t.s1 == TEXT("leftThumbMetacarpal")) || (t.s1 == TEXT("rightThumbMetacarpal"));

						if (Options::Get().IsVRM10Model() && b0) {
							continue;
						}
						if (Options::Get().IsVRM0Model() && b1) {
							continue;
						}
					}

					TT conv;
					for (auto& modelName : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {
						if (modelName.Key == "" || modelName.Value == "") {
							continue;
						}
						if (t.s1.ToLower() == modelName.Key.ToLower()) {
							conv.s1 = modelName.Value;
						}
						if (t.s2.ToLower() == modelName.Key.ToLower()) {
							conv.s2 = modelName.Value;
						}
					}
					if (conv.s1 == "" || conv.s2 == "") {
						// for ik bone
						if (UniGLBGetRefSkeleton(sk).FindBoneIndex(*t.s1) >= 0) {
							conv.s1 = t.s1;
						}
						if (UniGLBGetRefSkeleton(sk).FindBoneIndex(*t.s2) >= 0) {
							conv.s2 = t.s2;
						}
					}
					if (conv.s1 == "" || conv.s2 == "") continue;

					{
						FString s2 = conv.s2;
						if (t.chain == TEXT("Spine")) {
							// neck parent
							for (auto& modelName : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {
								if (modelName.Key == "neck") {
									auto& ref = UniGLBGetRefSkeleton(sk);
									// Post-GASP the source bone name (modelName.Value, e.g. "neck") is renamed to
									// the Manny name ("neck_01"); also try the Manny neck. Guard -1 so a missing
									// bone never indexes the array (GetParentIndex(-1) crash). If neither resolves,
									// keep s2 = conv.s2 (the table's spine end, e.g. spine_05) which is correct.
									int32 index = ref.FindRawBoneIndex(*modelName.Value);
									if (index == INDEX_NONE) index = ref.FindRawBoneIndex(TEXT("neck_01"));
									const int32 pidx = (index != INDEX_NONE) ? ref.GetParentIndex(index) : INDEX_NONE;
									if (pidx != INDEX_NONE) {
										s2 = ref.GetBoneName(pidx).ToString();
									}
								}
							}
						}
						rigcon.UniGLBAddRetargetChain(*t.chain, *conv.s1, *s2);
						AddedChainList.Add(t.chain);
					}
				}
				//rigcon.LocalSolverSetup(uniGLBAssetList, ik_no);
				rigcon.LocalSolverSetup(uniGLBAssetList, 1);

				for (auto& modelName : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {
					if (modelName.Key == "" || modelName.Value == "") {
						continue;
					}
					if (modelName.Key == TEXT("hips")) {
						rigcon.SetRetargetRoot(*modelName.Value);
					}
				}
			} // ik_no
		} // skeleton ik


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
		{
			struct RTGdata{
				FString NewAssetName;
				TArray<FString> BaseIKRigName;
				FString BaseSKName;
				FString GenerateFooter;
				int ModelType;
			};

			RTGdata rtgDataTable[3];

			rtgDataTable[0].NewAssetName = FString(TEXT("RTG_")) + uniGLBAssetList->BaseFileName;
			rtgDataTable[1].NewAssetName = FString(TEXT("RTG_UE4_")) + uniGLBAssetList->BaseFileName;
			rtgDataTable[2].NewAssetName = FString(TEXT("RTG_UEFN_")) + uniGLBAssetList->BaseFileName;
			
			// Prefer the official Game Animation Sample rigs (present in this project); fall back to the
			// stock /Game/Characters template paths. Only if none resolve is an IK rig regenerated.
			rtgDataTable[0].BaseIKRigName.Add(TEXT("/Game/GameAnimationSample/Characters/UE5_Mannequins/Rigs/IK_UE5_Mannequin_Retarget.IK_UE5_Mannequin_Retarget"));
			rtgDataTable[0].BaseIKRigName.Add(TEXT("/Game/Characters/Mannequins/Rigs/IK_Mannequin.IK_Mannequin"));
			rtgDataTable[0].BaseIKRigName.Add(TEXT("/Game/Characters/UE5_Mannequins/Rigs/IK_UE5_Mannequin_Retarget.IK_UE5_Mannequin_Retarget"));
			rtgDataTable[1].BaseIKRigName.Add(TEXT("/Game/GameAnimationSample/Characters/UE4_Mannequin/Rigs/IK_UE4_Mannequin_Retarget.IK_UE4_Mannequin_Retarget"));
			rtgDataTable[1].BaseIKRigName.Add(TEXT("/Game/Characters/Mannequin_UE4/Rigs/IK_UE4_Mannequin.IK_UE4_Mannequin"));
			rtgDataTable[1].BaseIKRigName.Add(TEXT("/Game/Characters/UE4_Mannequin/Rigs/IK_UE4_Mannequin_Retarget.IK_UE4_Mannequin_Retarget"));
			rtgDataTable[2].BaseIKRigName.Add(TEXT("/Game/GameAnimationSample/Characters/UEFN_Mannequin/Rigs/IK_UEFN_Mannequin.IK_UEFN_Mannequin"));
			rtgDataTable[2].BaseIKRigName.Add(TEXT("/Game/Characters/UEFN_Mannequin/Rigs/IK_UEFN_Mannequin.IK_UEFN_Mannequin"));

			if (USkeletalMesh* ResolvedManny = UniGLB_ResolveMannySkeletalMesh()) {
				rtgDataTable[0].BaseSKName = ResolvedManny->GetPathName();
			} else {
				UE_LOG(LogUniGLBLoader, Warning, TEXT("ConvertIKRig: no Manny SkeletalMesh resolved; UE5 retargeter will fall back to a stock path that may not exist and be skipped."));
				rtgDataTable[0].BaseSKName = TEXT("/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple.SKM_Manny_Simple");
			}
			// UE4 mannequin mesh: Game Animation Sample first (present here), then the stock template path.
			if (FSoftObjectPath(TEXT("/Game/GameAnimationSample/Characters/UE4_Mannequin/Meshes/SK_UE4_Mannequin.SK_UE4_Mannequin")).TryLoad()) {
				rtgDataTable[1].BaseSKName = TEXT("/Game/GameAnimationSample/Characters/UE4_Mannequin/Meshes/SK_UE4_Mannequin.SK_UE4_Mannequin");
			} else {
				rtgDataTable[1].BaseSKName = TEXT("/Game/Characters/UE4_Mannequin/Meshes/SK_UE4_Mannequin.SK_UE4_Mannequin");
			}
			rtgDataTable[2].BaseSKName = "";


			rtgDataTable[0].GenerateFooter = TEXT("UE5Mannequin");
			rtgDataTable[1].GenerateFooter = TEXT("UE4Mannequin");
			rtgDataTable[2].GenerateFooter = "";

			rtgDataTable[0].ModelType = 0;	// mannnequin UE5
			rtgDataTable[1].ModelType = 0;	// mannnequin UE4
			rtgDataTable[2].ModelType = 1;	// UEFN mannnequin

			bool bGenerated[3] = {};


			for (int ikr_no = 0; ikr_no < 3; ikr_no++) {


				RTGdata& rtgData = rtgDataTable[ikr_no];

				if (bGenerated[ikr_no]) {
					continue;
				}

				auto *uniGLB_ikrig = table_rig_ik[rtgData.ModelType];

				UObject* uobjectIK = nullptr;

				for (auto rigName : rtgData.BaseIKRigName) {
					FSoftObjectPath r(rigName);
					uobjectIK = r.TryLoad();
					if (uobjectIK) {
						break;
					}
				}

				if (uobjectIK == nullptr) {
					if (ikr_no == 0) {
#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
						// IKRig 生成
						uobjectIK = GenerateMannequinIK(uniGLBAssetList, rtgDataTable[ikr_no].BaseSKName, rtgDataTable[ikr_no].GenerateFooter);
#endif
					}
				}

				if (uobjectIK == nullptr) {
					// ベースのIKRigが無ければスキップ
					continue;
				}

				FString name = rtgData.NewAssetName;
				UIKRetargeter* ikr = UniGLB_NewObject<UIKRetargeter>(uniGLBAssetList->Package, *name, RF_Public | RF_Standalone);

#if WITH_EDITOR
				ikr->TargetMeshOffset.Set(100, 0, 0);
#endif

				auto SourceOrTargetVRM = ERetargetSourceOrTarget::Target;
				auto SourceOrTargetMannequin = ERetargetSourceOrTarget::Source;

				if (Options::Get().IsVRMAModel() || Options::Get().IsBVHModel() || Options::Get().IsRetargetAnimToManny()) {
					SourceOrTargetVRM = ERetargetSourceOrTarget::Source;
					SourceOrTargetMannequin = ERetargetSourceOrTarget::Target;
				}

				SimpleRetargeterController c = SimpleRetargeterController(ikr);
				c.SetIKRig(SourceOrTargetVRM, uniGLB_ikrig);

				if (uobjectIK) {
					auto r2 = Cast<UIKRigDefinition>(uobjectIK);
					if (r2) {
						c.SetIKRig(SourceOrTargetMannequin, r2);
					}
				}

				if (uniGLBAssetList && uniGLBAssetList->UniGLBMetaObject) {

					auto& humanoidBoneTable = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable;
					TArray<FString> KeyArray;
					TArray<FString> ValueArray;
					humanoidBoneTable.GenerateKeyArray(KeyArray);
					humanoidBoneTable.GenerateValueArray(ValueArray);

					auto FindKeyByValue = [humanoidBoneTable](const FString& SearchValue)
						{
							for (const auto& Pair : humanoidBoneTable)
							{
								if (Pair.Value.Compare(SearchValue, ESearchCase::IgnoreCase) == 0)
								{
									return Pair.Key;
								}
							}
							return FString("");
						};

					UniGLBRetargetData retargetData;
					retargetData.Setup(uniGLBAssetList,
						UniGLBConverter::Options::Get().IsVRMModel(),
						UniGLBConverter::Options::Get().IsBVHModel(),
						UniGLBConverter::Options::Get().IsPMXModel());

					auto FindRotData = [retargetData](const FString& boneVRM, FRotator& rot) {
						for (auto& a : retargetData.retargetTable) {
							if (a.BoneVRM.Compare(boneVRM, ESearchCase::IgnoreCase)) continue;

							rot = a.rot;
							return true;
						}
						return false;
						};

					{
						//name
						FName PoseName = "POSE_A";
						const FName NewPoseName = c.CreateRetargetPose(PoseName, SourceOrTargetVRM);
						FIKRetargetPose* NewPose = c.GetRetargetPosesByName(SourceOrTargetVRM, NewPoseName);
						if (NewPose == nullptr) continue;

						FReferenceSkeleton& RefSkeleton = sk->GetRefSkeleton();
						const TArray<FTransform>& RefPose = RefSkeleton.GetRefBonePose();
#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
						auto rigc = UIKRigController::GetController(uniGLB_ikrig);
						const FName RetargetRootBoneName = rigc->GetRetargetRoot();
#else
						const FName RetargetRootBoneName = "";
#endif
						for (int32 BoneIndex = 0; BoneIndex < RefSkeleton.GetNum(); ++BoneIndex)
						{
							auto BoneName = RefSkeleton.GetBoneName(BoneIndex);

							auto str = FindKeyByValue(BoneName.ToString());
							if (str == "") {
								continue;
							}
							FRotator rot;
							if (FindRotData(*str, rot) == false) {
								continue;
							}


							// record a global space translation offset for the root bone
							if (BoneName == RetargetRootBoneName)
							{
								//	FTransform GlobalRefTransform = FAnimationRuntime::GetComponentSpaceTransform(RefSkeleton, RefPose, BoneIndex);
								//	FTransform GlobalImportedTransform = PoseAsset->GetComponentSpaceTransform(BoneName, LocalBoneTransformFromPose);
								//	NewPose.SetRootTranslationDelta(GlobalImportedTransform.GetLocation() - GlobalRefTransform.GetLocation());
							}

							// record a local space delta rotation (if there is one)

							const FTransform& LocalRefTransform = RefPose[BoneIndex];
							const FTransform& LocalImportedTransform = FTransform(rot, FVector(0, 0, 0), FVector(1, 1, 1));
							//const FQuat DeltaRotation = LocalRefTransform.GetRotation().Inverse() * LocalImportedTransform.GetRotation();

							FQuat DeltaRotation = FQuat(rot);
							if (UniGLBConverter::Options::Get().IsVRM10Model()) {

								FTransform dstTrans;
								auto dstIndex = BoneIndex;
								while (dstIndex >= 0)
								{
									dstTrans = RefSkeleton.GetRefBonePose()[dstIndex].GetRelativeTransform(dstTrans);
									dstIndex = RefSkeleton.GetParentIndex(dstIndex);
									if (dstIndex < 0) {
										break;
									}
								}

								//DeltaRotation = LocalRefTransform.GetRotation().Inverse() * DeltaRotation * LocalRefTransform.GetRotation();
								//DeltaRotation = LocalRefTransform.GetRotation() * DeltaRotation * LocalRefTransform.GetRotation().Inverse();
								//DeltaRotation = dstTrans.GetRotation() * DeltaRotation * dstTrans.GetRotation().Inverse();
								DeltaRotation = dstTrans.GetRotation().Inverse() * DeltaRotation * dstTrans.GetRotation();
							}

							const float DeltaAngle = FMath::RadiansToDegrees(DeltaRotation.GetAngle());
							constexpr float MinAngleThreshold = 0.05f;
							if (DeltaAngle >= MinAngleThreshold)
							{
								NewPose->SetDeltaRotationForBone(BoneName, DeltaRotation);
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
								NewPose->SortHierarchically(ikr->GetIKRig(SourceOrTargetVRM)->GetSkeleton());
							}
						}
					}

#if UniGLB_USE_AUTOALIGN

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
					{
						UIKRetargeterController* cp = UIKRetargeterController::GetController(ikr);
						//UIKRetargeterController& c = *cp;
						cp->AddDefaultOps();
					}
					c.SetCurrentRetargetPose(UIKRetargeter::GetDefaultPoseName(), SourceOrTargetVRM);
					c.SetCurrentRetargetPose(UIKRetargeter::GetDefaultPoseName(), SourceOrTargetMannequin);

					// 自動で姿勢を作る。

					if (UniGLBConverter::Options::Get().IsBVHModel()) {
						// bvhは bvh側をalignする
						c.AutoAlignAllBones(SourceOrTargetVRM);
					}else{
						// 足首はそのまま。自動設定がうまく動作しないため。
						c.AutoAlignAllBones(SourceOrTargetMannequin);
						c.SetRotationOffsetForRetargetPoseBone(TEXT("foot_l"), FQuat::Identity, SourceOrTargetMannequin);
						c.SetRotationOffsetForRetargetPoseBone(TEXT("foot_r"), FQuat::Identity, SourceOrTargetMannequin);
					}
#endif
				}
				c.SetChainSetting();

				bGenerated[ikr_no] = true;
			} // loop
		}
	} // ikrig

	return true;

}

