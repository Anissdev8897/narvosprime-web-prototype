// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "BoneContainer.h"
#include "BonePose.h"
#include "BoneControllers/AnimNode_ModifyBone.h"
#include "Misc/EngineVersionComparison.h"

#include "UniGLB_AnimNode_Constraint.generated.h"

class UUniGLBMetaObject;
class UUniGLBAssetListObject;

/**
*	Simple controller that replaces or adds to the translation/rotation of a single bone.
*/
USTRUCT(BlueprintInternalUseOnly)
struct UNIGLB_API FAnimNode_UniGLBConstraint : public FAnimNode_SkeletalControlBase
{
	GENERATED_USTRUCT_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	bool EnableAutoSearchMetaData = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta=(PinHiddenByDefault))
	const UUniGLBMetaObject *UniGLBMetaObject = nullptr;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TSoftObjectPtr<UUniGLBMetaObject> UniGLBMetaObject_Internal = nullptr;
	TSoftObjectPtr<UUniGLBAssetListObject> UniGLBAssetListObject_Internal = nullptr;


	bool bCallInitialized = false;

	bool bCallByAnimInstance = false;

	FAnimNode_UniGLBConstraint();

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

	virtual void UpdateInternal(const FAnimationUpdateContext& Context)override;
	// End of FAnimNode_SkeletalControlBase interface

	virtual void ConditionalDebugDraw(FPrimitiveDrawInterface* PDI, USkeletalMeshComponent* PreviewSkelMeshComp, bool bPreviewForeground = false) const;

private:
	// FAnimNode_SkeletalControlBase interface
	virtual void InitializeBoneReferences(const FBoneContainer& RequiredBones) override;
	// End of FAnimNode_SkeletalControlBase interface
};
