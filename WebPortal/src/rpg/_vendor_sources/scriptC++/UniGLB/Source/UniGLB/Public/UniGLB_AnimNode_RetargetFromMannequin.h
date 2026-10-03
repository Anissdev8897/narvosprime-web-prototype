// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "BoneContainer.h"
#include "BonePose.h"
#include "BoneControllers/AnimNode_ModifyBone.h"
#include "Misc/EngineVersionComparison.h"

#include "UniGLB_AnimNode_RetargetFromMannequin.generated.h"

class USkeletalMeshComponent;
class UUniGLBMetaObject;

/**
*	Simple controller that replaces or adds to the translation/rotation of a single bone.
*/
USTRUCT(BlueprintInternalUseOnly)
struct UNIGLB_API FAnimNode_UniGLBRetargetFromMannequin : public FAnimNode_SkeletalControlBase
{
	GENERATED_USTRUCT_BODY()

	/* If SourceMeshComponent is not valid, and if this is true, it will look for attached parent as a source */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category= Skeleton, meta = (NeverAsPin))
	bool bUseAttachedParent = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinShownByDefault))
	TWeakObjectPtr<USkeletalMeshComponent> srcMannequinMesh= nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta=(PinHiddenByDefault))
	UUniGLBMetaObject *UniGLBMetaObject = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	bool bIgnoreCenterLocation = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	FVector CenterLocationScaleByHeightScale = { 1.0f, 1.0f, 1.0f }; // FVector(1.0f, 1.0f, 1.0f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	FVector CenterLocationOffset = { 0.0f, 0.0f, 0.0f }; // FVector(1.0f, 1.0f, 1.0f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	UUniGLBMetaObject *MannequinUniGLBMetaObject = nullptr;

	FAnimNode_UniGLBRetargetFromMannequin();

	UPROPERTY()
	USkeletalMesh *srcSkeletalMesh = nullptr;
	UPROPERTY()
	USkeletalMesh *dstSkeletalMesh = nullptr;

	TArray<FTransform> srcRefSkeletonCompTransform;
	TArray<FTransform> dstRefSkeletonCompTransform;
	TArray<FTransform> dstCurrentSkeletonCompTransform;

	void UpdateCache(FComponentSpacePoseContext& Output);

	// FAnimNode_Base interface
	virtual void GatherDebugData(FNodeDebugData& DebugData) override;
	// End of FAnimNode_Base interface

	// FAnimNode_SkeletalControlBase interface
	virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;
	virtual void CacheBones_AnyThread(const FAnimationCacheBonesContext& Context) override;
//	virtual void Update_AnyThread(const FAnimationUpdateContext& Context) override;
	virtual void EvaluateSkeletalControl_AnyThread(FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) override;
	virtual void EvaluateComponentPose_AnyThread(FComponentSpacePoseContext& Output) override;
	virtual bool IsValidToEvaluate(const USkeleton* Skeleton, const FBoneContainer& RequiredBones) override;

	virtual bool NeedsDynamicReset() const override { return true; }
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.
	virtual void ResetDynamics(ETeleportType InTeleportType) override;

	virtual bool HasPreUpdate() const override { return true; }
	virtual void PreUpdate(const UAnimInstance* InAnimInstance) override;
	virtual void UpdateInternal(const FAnimationUpdateContext& Context)override;
	// End of FAnimNode_SkeletalControlBase interface

	virtual void ConditionalDebugDraw(FPrimitiveDrawInterface* PDI, USkeletalMeshComponent* PreviewSkelMeshComp, bool bPreviewForeground = false) const;

private:
	// FAnimNode_SkeletalControlBase interface
	virtual void InitializeBoneReferences(const FBoneContainer& RequiredBones) override;
	// End of FAnimNode_SkeletalControlBase interface
};
