// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "BoneContainer.h"
#include "BonePose.h"
#include "BoneControllers/AnimNode_ModifyBone.h"
#include "Misc/EngineVersionComparison.h"

#include "UniGLB_AnimNode_SpringBone.generated.h"

class USkeletalMeshComponent;
class UUniGLBMetaObject;
class UUniGLBAssetListObject;

namespace UniGLBSpringBone {
	class UniGLBSpringManagerBase;
}


/**
*	Simple controller that replaces or adds to the translation/rotation of a single bone.
*/
USTRUCT(BlueprintInternalUseOnly)
struct UNIGLB_API FAnimNode_UniGLBSpringBone : public FAnimNode_SkeletalControlBase
{
	GENERATED_USTRUCT_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	bool EnableAutoSearchMetaData = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta=(PinHiddenByDefault))
	const UUniGLBMetaObject *UniGLBMetaObject = nullptr;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TSoftObjectPtr<UUniGLBMetaObject> UniGLBMetaObject_Internal = nullptr;
	TSoftObjectPtr<UUniGLBAssetListObject> UniGLBAssetListObject_Internal = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	float gravityScale = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	FVector gravityAdd = FVector::ZeroVector;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	float stiffnessScale = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	float stiffnessAdd = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	float randomWindRange = 0.2f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	float windScale = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	int loopc = 1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	int collisionCheckLoopCount = 2;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	bool bIgnorePhysicsResetOnTeleport = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta=(PinHiddenByDefault))
	bool bIgnorePhysicsCollision = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta=(PinHiddenByDefault))
	bool bIgnoreVRMCollision = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	bool bIgnoreWindDirectionalSource = false;

	//
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	TArray<FName> NoWindBoneNameList;

	TSharedPtr<UniGLBSpringBone::UniGLBSpringManagerBase> SpringManager;

	float CurrentDeltaTime = 0.f;

	bool bCallByAnimInstance = false;
	TArray<FBoneTransform> BoneTransformsSpring;
	bool IsSpringInit() const;

	FAnimNode_UniGLBSpringBone();

	// FAnimNode_Base interface
	virtual void GatherDebugData(FNodeDebugData& DebugData) override;
	// End of FAnimNode_Base interface

	// FAnimNode_SkeletalControlBase interface
	virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;
	virtual void Initialize_AnyThread_local(const FAnimationInitializeContext& Context);
	virtual void CacheBones_AnyThread(const FAnimationCacheBonesContext& Context) override;
//	virtual void Update_AnyThread(const FAnimationUpdateContext& Context) override;
	virtual void EvaluateSkeletalControl_AnyThread(FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) override;
	virtual void EvaluateComponentPose_AnyThread(FComponentSpacePoseContext& Output) override;
	virtual bool IsValidToEvaluate(const USkeleton* Skeleton, const FBoneContainer& RequiredBones) override;

	virtual bool NeedsDynamicReset() const override { return true; }
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.
	virtual void ResetDynamics(ETeleportType InTeleportType) override;

	virtual void UpdateInternal(const FAnimationUpdateContext& Context)override;
	// End of FAnimNode_SkeletalControlBase interface

	virtual void ConditionalDebugDraw(FPrimitiveDrawInterface* PDI, USkeletalMeshComponent* PreviewSkelMeshComp, bool bPreviewForeground = false) const;

private:
	// FAnimNode_SkeletalControlBase interface
	virtual void InitializeBoneReferences(const FBoneContainer& RequiredBones) override;
	// End of FAnimNode_SkeletalControlBase interface
};
