// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.


#include "UniGLB_AnimInstanceCopy.h"
#include "UniGLB_MetaObject.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLB_Util.h"
#include "UniGLB_BPFunctionLibrary.h"
#include "Animation/AnimNodeBase.h"
//#include "BoneControllers/AnimNode_Fabrik.h"
//#include "BoneControllers/AnimNode_TwoBoneIK.h"
//#include "BoneControllers/AnimNode_SplineIK.h"
#include "UniGLB_AnimNode_SpringBone.h"
#include "UniGLB_AnimNode_Constraint.h"

// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(5, 4, 0)] all below target floor (5, 7, 0)).


namespace {
	// for UE4.19-4.22
	template<class BaseType, class PoseType>
	static void ConvertToLocalPoses(const BaseType &basePose, PoseType& OutPose)
	{
		checkSlow(basePose.GetPose().IsValid());
		OutPose = basePose.GetPose();

		// now we need to convert back to local bases
		// only convert back that has been converted to mesh base
		// if it was local base, and if it hasn't been modified
		// that is still okay even if parent is changed, 
		// that doesn't mean this local has to change
		// go from child to parent since I need parent inverse to go back to local
		// root is same, so no need to do Index == 0
		const FCSPose<FCompactPose>::BoneIndexType RootBoneIndex(0);
		if (basePose.GetComponentSpaceFlags()[RootBoneIndex])
		{
			OutPose[RootBoneIndex] = basePose.GetPose()[RootBoneIndex];
		}

		const int32 NumBones = basePose.GetPose().GetNumBones();
		for (int32 Index = NumBones - 1; Index > 0; Index--)
		{
			const FCSPose<FCompactPose>::BoneIndexType BoneIndex(Index);
			if (basePose.GetComponentSpaceFlags()[BoneIndex])
			{
				const FCSPose<FCompactPose>::BoneIndexType ParentIndex = basePose.GetPose().GetParentBoneIndex(BoneIndex);
				OutPose[BoneIndex].SetToRelativeTransform(OutPose[ParentIndex]);
				OutPose[BoneIndex].NormalizeRotation();
			}
		}
	}
}

FUniGLBAnimInstanceCopyProxy::FUniGLBAnimInstanceCopyProxy()
{
	if (Node_SpringBone.Get() == nullptr) {
		Node_SpringBone = MakeShareable(new FAnimNode_UniGLBSpringBone());
	}
	if (Node_Constraint.Get() == nullptr) {
		Node_Constraint = MakeShareable(new FAnimNode_UniGLBConstraint());
	}
}

FUniGLBAnimInstanceCopyProxy::FUniGLBAnimInstanceCopyProxy(UAnimInstance* InAnimInstance)
	: FAnimInstanceProxy(InAnimInstance)
{
	if (Node_SpringBone.Get() == nullptr) {
		Node_SpringBone = MakeShareable(new FAnimNode_UniGLBSpringBone());
	}
	if (Node_Constraint.Get() == nullptr) {
		Node_Constraint = MakeShareable(new FAnimNode_UniGLBConstraint());
	}
	
}


void FUniGLBAnimInstanceCopyProxy::Initialize(UAnimInstance* InAnimInstance) {
}
bool FUniGLBAnimInstanceCopyProxy::Evaluate(FPoseContext& Output) {

	if (bCopyStop) {
		return false;
	}

	if (bAnimStop && bUseAnimStop) {
		Output.Pose.CopyBonesFrom(CachedPose);
		return true;
	}


	//Output.ResetToRefPose();

	UUniGLBAnimInstanceCopy *animInstance = Cast<UUniGLBAnimInstanceCopy>(GetAnimInstanceObject());
	if (animInstance == nullptr) {
		return false;
	}
	if (animInstance->DstUniGLBAssetList == nullptr) {
	//if (animInstance->SrcUniGLBAssetList == nullptr || animInstance->DstUniGLBAssetList == nullptr) {
			return false;
	}

	const UUniGLBMetaObject *srcMeta = animInstance->SrcUniGLBMetaOverride;
	if (srcMeta == nullptr){
		if (animInstance->SrcUniGLBAssetList) {
			srcMeta = animInstance->SrcUniGLBAssetList->UniGLBMetaObject;
		}
	}

	const UUniGLBMetaObject *dstMeta = animInstance->DstUniGLBAssetList->UniGLBMetaObject;
	if (dstMeta) {
		if (animInstance->DstUniGLBMetaForCustomSpring) {
			dstMeta = animInstance->DstUniGLBMetaForCustomSpring;
		}
	}

	if (dstMeta == nullptr) {
	//if (srcMeta == nullptr || dstMeta == nullptr) {
		return false;
	}


	auto srcSkeletalMeshComp = animInstance->SrcSkeletalMeshComponent;
	auto srcAsSkinnedMeshComp = animInstance->SrcAsSkinnedMeshComponent;

	if (srcAsSkinnedMeshComp == nullptr) {
		if (srcSkeletalMeshComp == nullptr || srcSkeletalMeshComp->GetAnimInstance() == nullptr) {
			return false;
		}
	}
	if (UniGLBGetSkinnedAsset(srcAsSkinnedMeshComp) == nullptr) {
		return false;
	}

	// ref pose
	const auto &dstRefSkeletonTransform = UniGLBGetRefSkeleton( UniGLBGetSkinnedAsset(GetSkelMeshComponent()) ).GetRefBonePose();
	const auto &srcRefSkeletonTransform = UniGLBGetRefSkeleton( UniGLBGetSkinnedAsset(srcAsSkinnedMeshComp) ).GetRefBonePose();

	auto &pose = Output.Pose;

	// morph copy
	if (srcSkeletalMeshComp && srcSkeletalMeshComp->GetAnimInstance()){
		EAnimCurveType types[] = {
			EAnimCurveType::AttributeCurve,
			EAnimCurveType::MaterialCurve,
			EAnimCurveType::MorphTargetCurve,
		};

		for (int i = 0; i < 3; ++i) {
			const TMap<FName, float>& t = srcSkeletalMeshComp->GetAnimInstance()->GetAnimationCurveList(types[i]);
			for (auto& a : t) {
				GetSkelMeshComponent()->SetMorphTarget(a.Key, a.Value, true);
			}
		}
	}

	float HeightScale = 1.f;
	bool bUniqueRootBone = true;
	int BoneCount = 0;
	for (const auto &t : UniGLBUtil::uniGLB_humanoid_bone_list) {
		FName srcName, dstName;
		srcName = dstName = NAME_None;

		++BoneCount;
		{
			if (srcMeta) {
				auto a = srcMeta->humanoidBoneTable.Find(t);
				if (a) {
					srcName = **a;
				}
			} else {
				for (auto &bonemap : UniGLBUtil::table_ue4_vrm) {
					if (bonemap.BoneVRM == t) {
						srcName = *bonemap.BoneUE4;
					}
				}
			}
		}
		//auto srcName = srcSkeletalMeshComp->SkeletalMesh->Skeleton->GetRigBoneMapping(t);
		if (srcName == NAME_None) {
			continue;
		}

		{
			auto a = dstMeta->humanoidBoneTable.Find(t);
			if (a) {
				dstName = **a;
			}
		}
		//auto dstName = GetSkelMeshComponent()->SkeletalMesh->Skeleton->GetRigBoneMapping(t);
		if (dstName == NAME_None) {
			continue;
		}

		auto dstIndex = GetSkelMeshComponent()->GetBoneIndex(dstName);
		if (dstIndex < 0) {
			continue;
		}
		auto srcIndex = srcAsSkinnedMeshComp->GetBoneIndex(srcName);
		if (srcIndex < 0) {
			continue;
		}


		const auto srcCurrentTrans = srcAsSkinnedMeshComp->GetSocketTransform(srcName, RTS_ParentBoneSpace);
		const auto srcRefTrans = srcRefSkeletonTransform[srcIndex];
		const auto dstRefTrans = dstRefSkeletonTransform[dstIndex];

		FTransform dstTrans = dstRefTrans;

		{
			FQuat diff = srcCurrentTrans.GetRotation()*srcRefTrans.GetRotation().Inverse();
			dstTrans.SetRotation(dstTrans.GetRotation()*diff);
		}
		//dstTrans.SetLocation(dstRefTrans.GetLocation());// +srcCurrentTrans.GetLocation() - srcRefTrans.GetLocation());

		//FVector newLoc = dstTrans.GetLocation();
		if (BoneCount == 1) {
			if (bIgnoreCenterLocation) {
				dstTrans.SetTranslation(CenterLocationOffset);
			} else {
				int32_t p = dstIndex;
				float HipHeight = 0;
				while (p != INDEX_NONE) {

					HipHeight += dstRefSkeletonTransform[p].GetLocation().Z;
					p = UniGLBGetRefSkeleton( UniGLBGetSkinnedAsset(GetSkelMeshComponent()) ).GetParentIndex(p);
				}
				//FVector diff = srcCurrentTrans.GetLocation() - srcRefTrans.GetLocation();
				//FVector scale = dstRefTrans.GetLocation() / srcRefTrans.GetLocation();
				FVector diff = srcCurrentTrans.GetLocation() - srcRefTrans.GetLocation();
				HeightScale = HipHeight / srcRefTrans.GetLocation().Z;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
				FVector ComponentScale = Output.AnimInstanceProxy->GetSkelMeshComponent()->GetRelativeScale3D();
				if (ComponentScale.X == 0.f) {
					ComponentScale.X = 0.001f;
				}
				if (ComponentScale.Y == 0.f) {
					ComponentScale.Y = 0.001f;
				}
				if (ComponentScale.Z == 0.f) {
					ComponentScale.Z = 0.001f;
				}

				dstTrans.SetTranslation(
					(dstRefTrans.GetLocation() + FMath::Lerp(diff, diff * HeightScale, CenterLocationScaleByHeightScale)) / ComponentScale
					+ CenterLocationOffset
				);
				if (dstIndex == 0) {
					bUniqueRootBone = false;
				}
			}
		}

		FCompactPose::BoneIndexType bi(dstIndex);
		pose[bi] = dstTrans;
	}

	// root bone
	if (bUniqueRootBone){
		FCompactPose::BoneIndexType bi(0);
		const auto srcTrans = srcAsSkinnedMeshComp->GetSocketTransform(srcAsSkinnedMeshComp->GetBoneName(0), RTS_ParentBoneSpace);

		auto t = srcTrans;
		if (bIgnoreCenterLocation) {
			t.SetTranslation(CenterLocationOffset);
		}else{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
			FVector ComponentScale = Output.AnimInstanceProxy->GetSkelMeshComponent()->GetRelativeScale3D();
			if (ComponentScale.X == 0.f) {
				ComponentScale.X = 0.001f;
			}
			if (ComponentScale.Y == 0.f) {
				ComponentScale.Y = 0.001f;
			}
			if (ComponentScale.Z == 0.f) {
				ComponentScale.Z = 0.001f;
			}

			t.SetTranslation(
				(FMath::Lerp(t.GetTranslation(), t.GetTranslation() * HeightScale, CenterLocationScaleByHeightScale)) / ComponentScale
				+ CenterLocationOffset
			);
		}
		pose[bi] = t;
	}

	// constraint
	if (bIgnoreVRMConstraint == false) {
//	if (0){
		bool bCalc = true;
		{
			bool bPlay, bSIE, bEditor;
			bPlay = bSIE = bEditor = true;
			UUniGLBBPFunctionLibrary::UniGLBGetPlayMode(bPlay, bSIE, bEditor);
			if (bPlay == false) {
				bCalc = false;
			}
		}

		if (bCalc) {
			if (Node_Constraint.Get() == nullptr) {
				Node_Constraint = MakeShareable(new FAnimNode_UniGLBConstraint());
			}

			if (Node_Constraint.Get()) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 22, 0)] (target floor (5, 7, 0)); kept #else branch only.
				if (animInstance->PendingDynamicResetTeleportType != ETeleportType::None)
				{
					Node_Constraint->ResetDynamics(animInstance->PendingDynamicResetTeleportType);
				}

				auto& constraint = *Node_Constraint.Get();

				PRAGMA_DISABLE_DEPRECATION_WARNINGS
					constraint.UniGLBMetaObject_Internal = dstMeta;
PRAGMA_ENABLE_DEPRECATION_WARNINGS
				constraint.bCallByAnimInstance = true;

				FAnimationInitializeContext InitContext(this);

				if (constraint.	bCallInitialized  == false) {
					constraint.Initialize_AnyThread(InitContext);
					constraint.ComponentPose.SetLinkNode(&constraint);
				}

				{
					FComponentSpacePoseContext InputCSPose(this);
					InputCSPose.Pose.InitPose(Output.Pose);
					constraint.EvaluateComponentSpace_AnyThread(InputCSPose);
					ConvertToLocalPoses(InputCSPose.Pose, Output.Pose);
				}

			}
		}
	}
	else {
		Node_Constraint = nullptr;
	}



	if (bIgnoreVRMSwingBone == false) {
	//if (0){
		bool bCalc = true;
		{
			bool bPlay, bSIE, bEditor;
			bPlay = bSIE = bEditor = true;
			UUniGLBBPFunctionLibrary::UniGLBGetPlayMode(bPlay, bSIE, bEditor);
			if (bPlay == false) {
				bCalc = false;
			}
		}

		if (bCalc) {
			if (Node_SpringBone.Get() == nullptr) {
				Node_SpringBone = MakeShareable(new FAnimNode_UniGLBSpringBone());
			}

			if (Node_SpringBone.Get()) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 22, 0)] (target floor (5, 7, 0)); kept #else branch only.
				if(animInstance->PendingDynamicResetTeleportType != ETeleportType::None)
				{
					Node_SpringBone->ResetDynamics(animInstance->PendingDynamicResetTeleportType);
				}

				auto& springBone = *Node_SpringBone.Get();

				PRAGMA_DISABLE_DEPRECATION_WARNINGS
					springBone.UniGLBMetaObject_Internal = dstMeta;
PRAGMA_ENABLE_DEPRECATION_WARNINGS
				springBone.bCallByAnimInstance = true;
				springBone.CurrentDeltaTime = CurrentDeltaTime;

				FAnimationInitializeContext InitContext(this);

				if (springBone.IsSpringInit() == false) {
					springBone.Initialize_AnyThread_local(InitContext);
					springBone.ComponentPose.SetLinkNode(&springBone);
					CalcCount = 0;
					springBone.CurrentDeltaTime = 1.f / 20.f;
				}
				if (CalcCount < 3) {
					FVector bak = springBone.gravityAdd;
					++CalcCount;
					FComponentSpacePoseContext InputCSPose(this);
					for (int i = 0; i < 20; ++i) {
						InputCSPose.Pose.InitPose(Output.Pose);
						springBone.EvaluateComponentSpace_AnyThread(InputCSPose);
						ConvertToLocalPoses(InputCSPose.Pose, Output.Pose);
					}
					springBone.gravityAdd = bak;

				} else {
					FComponentSpacePoseContext InputCSPose(this);
					InputCSPose.Pose.InitPose(Output.Pose);
					springBone.EvaluateComponentSpace_AnyThread(InputCSPose);
					ConvertToLocalPoses(InputCSPose.Pose, Output.Pose);
				}

			}
		}
	} else {
		Node_SpringBone = nullptr;
	}


	if (bUseAnimStop) {
		CachedPose.CopyBonesFrom(Output.Pose);
	}

	return true;
}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
void FUniGLBAnimInstanceCopyProxy::UpdateAnimationNode(const FAnimationUpdateContext& InContext) {
	CurrentDeltaTime = InContext.GetDeltaTime();
}

/////

UUniGLBAnimInstanceCopy::UUniGLBAnimInstanceCopy(const FObjectInitializer& ObjectInitializer)
	:Super(ObjectInitializer)
{
}

FAnimInstanceProxy* UUniGLBAnimInstanceCopy::CreateAnimInstanceProxy() {
	myProxy = new FUniGLBAnimInstanceCopyProxy(this);
	myProxy->bIgnoreVRMSwingBone = bIgnoreVRMSwingBone;
	myProxy->bIgnoreWindDirectionalSource = bIgnoreWindDirectionalSource;
	return myProxy;
}


void UUniGLBAnimInstanceCopy::NativeInitializeAnimation() {
	for (int i = 0; i < FMath::Min(InitialMorphValue.Num(), InitialMorphName.Num()); ++i) {
		SetMorphTarget(InitialMorphName[i], InitialMorphValue[i]);
	}
}
void UUniGLBAnimInstanceCopy::NativeUpdateAnimation(float DeltaSeconds) {
}
void UUniGLBAnimInstanceCopy::NativePostEvaluateAnimation() {
	myProxy->bUseAnimStop = bUseAnimStop;
	myProxy->bAnimStop = bAnimStop;
	myProxy->bIgnoreCenterLocation = bIgnoreCenterLocation;
	myProxy->CenterLocationScaleByHeightScale = CenterLocationScaleByHeightScale;
	myProxy->CenterLocationOffset= CenterLocationOffset;
	myProxy->bCopyStop = bCopyStop;
}
void UUniGLBAnimInstanceCopy::NativeUninitializeAnimation() {
	if (GetOwningComponent()) {
		GetOwningComponent()->ClearMorphTargets();
	}

	if (!SrcSkeletalMeshComponent && bUseAttachedParent)
	{
		USkeletalMeshComponent* TargetMesh = GetOwningComponent();

		// Walk up the attachment chain until we find a skeletal mesh component
		USkeletalMeshComponent* ParentMeshComponent = nullptr;
		for (USceneComponent* AttachParentComp = TargetMesh->GetAttachParent(); AttachParentComp != nullptr; AttachParentComp = AttachParentComp->GetAttachParent())
		{
			ParentMeshComponent = Cast<USkeletalMeshComponent>(AttachParentComp);
			if (ParentMeshComponent)
			{
				break;
			}
		}
		if (ParentMeshComponent == nullptr) {
			AActor *targetActor = nullptr;
			AActor *myActor = TargetMesh->GetOwner();
			for (USceneComponent* AttachParentComp = TargetMesh->GetAttachParent(); AttachParentComp != nullptr; AttachParentComp = AttachParentComp->GetAttachParent()) {
				targetActor = AttachParentComp->GetOwner();
				if (targetActor != myActor) {
					break;
				}
				targetActor = nullptr;
			}
			if (targetActor) {
				TArray<USkeletalMeshComponent*> c;
				targetActor->GetComponents<USkeletalMeshComponent>(c);
				if (c.IsValidIndex(0)) {
					ParentMeshComponent = c[0];
				}
			}
		}

		if (ParentMeshComponent)
		{
			SrcSkeletalMeshComponent = ParentMeshComponent;
		}
	}
	if (SrcAsSkinnedMeshComponent == nullptr) {
		SrcAsSkinnedMeshComponent = SrcSkeletalMeshComponent;
	}
}
void UUniGLBAnimInstanceCopy::NativeBeginPlay() {
	if (GetOwningComponent()) {
		GetOwningComponent()->ClearMorphTargets();
	}
}

void UUniGLBAnimInstanceCopy::SetSkeletalMeshCopyData(UUniGLBAssetListObject *dstAssetList,
	USkeletalMeshComponent *srcSkeletalMesh, USkinnedMeshComponent* srcSkinnedMesh, UUniGLBAssetListObject *srcAssetList, UUniGLBMetaObject* srcUniGLBMeta) {

	SrcSkeletalMeshComponent = srcSkeletalMesh;
	SrcAsSkinnedMeshComponent = srcSkinnedMesh;
	SrcUniGLBAssetList = srcAssetList;
	DstUniGLBAssetList = dstAssetList;
	SrcUniGLBMetaOverride = srcUniGLBMeta;

	if (SrcAsSkinnedMeshComponent == nullptr) {
		SrcAsSkinnedMeshComponent = SrcSkeletalMeshComponent;
	}
}

void UUniGLBAnimInstanceCopy::SetSkeletalMeshCopyDataForCustomSpring(UUniGLBMetaObject *dstMetaForCustomSpring) {
	DstUniGLBMetaForCustomSpring = dstMetaForCustomSpring;
}



void UUniGLBAnimInstanceCopy::SetVrmSpringBoneParam(float gravityScale, FVector gravityAdd, float stiffnessScale, float stiffnessAdd, float randomWindRange) {
	if (myProxy == nullptr) return;
	auto a = myProxy->Node_SpringBone.Get();
	if (a == nullptr) return;

	a->gravityScale = gravityScale;
	a->gravityAdd = gravityAdd;
	a->stiffnessScale = stiffnessScale;
	a->stiffnessAdd = stiffnessAdd;
	a->randomWindRange = randomWindRange;
}

void UUniGLBAnimInstanceCopy::SetVrmSpringBoneBool(bool bIgnoreVrmSpringBone, bool bIgnorePhysicsCollision, bool bIgnoreVRMCollision, bool bIgnoreWind) {
	if (myProxy == nullptr) return;
	auto a = myProxy->Node_SpringBone.Get();
	if (a == nullptr) return;

	this->bIgnoreVRMSwingBone = bIgnoreVrmSpringBone;
	myProxy->bIgnoreVRMSwingBone = bIgnoreVrmSpringBone;
	a->bIgnorePhysicsCollision = bIgnorePhysicsCollision;
	a->bIgnoreVRMCollision = bIgnoreVRMCollision;
	a->bIgnoreWindDirectionalSource = bIgnoreWind;
}

void UUniGLBAnimInstanceCopy::SetVrmSpringBoneIgnoreWingBone(const TArray<FName> &boneNameList) {
	if (myProxy == nullptr) return;
	auto a = myProxy->Node_SpringBone.Get();
	if (a == nullptr) return;

	a->NoWindBoneNameList = boneNameList;
}


