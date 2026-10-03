// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.


#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "BoneContainer.h"
#include "BonePose.h"
#include "BoneControllers/AnimNode_ModifyBone.h"

#include "UniGLB_AnimNode_CopyHandBone.generated.h"

class USkeletalMeshComponent;
class UUniGLBMetaObject;

/**
*	Simple controller that replaces or adds to the translation/rotation of a single bone.
*/
USTRUCT(BlueprintInternalUseOnly)
struct UNIGLB_API FAnimNode_UniGLBCopyHandBone : public FAnimNode_SkeletalControlBase
{
	GENERATED_USTRUCT_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category=Skeleton, meta=(PinShownByDefault))
	USkeletalMeshComponent *SkeletalMeshComponentLeft = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category=Skeleton, meta=(PinShownByDefault))
	USkeletalMeshComponent *SkeletalMeshComponentRight = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta=(PinShownByDefault))
	UUniGLBMetaObject *UniGLBMetaObject = nullptr;

	FAnimNode_UniGLBCopyHandBone();

	// FAnimNode_Base interface
	virtual void GatherDebugData(FNodeDebugData& DebugData) override;
	// End of FAnimNode_Base interface

	// FAnimNode_SkeletalControlBase interface
	virtual void EvaluateSkeletalControl_AnyThread(FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) override;
	virtual bool IsValidToEvaluate(const USkeleton* Skeleton, const FBoneContainer& RequiredBones) override;
	// End of FAnimNode_SkeletalControlBase interface

private:
	// FAnimNode_SkeletalControlBase interface
	virtual void InitializeBoneReferences(const FBoneContainer& RequiredBones) override;
	// End of FAnimNode_SkeletalControlBase interface
};
