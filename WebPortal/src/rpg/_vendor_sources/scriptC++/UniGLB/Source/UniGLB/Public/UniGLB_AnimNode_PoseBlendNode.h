// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "BoneContainer.h"
#include "BonePose.h"
#include "AnimNodes/AnimNode_PoseBlendNode.h"
#include "Misc/EngineVersionComparison.h"

#include "UniGLB_AnimNode_PoseBlendNode.generated.h"

class UUniGLBMetaObject;
class UUniGLBAssetListObject;

/**
*	Simple controller that replaces or adds to the translation/rotation of a single bone.
*/
USTRUCT(BlueprintInternalUseOnly)
struct UNIGLB_API FAnimNode_UniGLBPoseBlendNode : public FAnimNode_PoseBlendNode
{
	GENERATED_USTRUCT_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	bool EnableAutoSearchMetaData = true;

	//UPROPERTY(EditAnywhere, EditFixedSize, BlueprintReadWrite, Category = Links)
	//FPoseLink SourcePose;

	//UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta=(PinHiddenByDefault))
	//const UUniGLBMetaObject *UniGLBMetaObject = nullptr;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TSoftObjectPtr<UUniGLBMetaObject> UniGLBMetaObject_Internal = nullptr;
	TSoftObjectPtr<UUniGLBAssetListObject> UniGLBAssetListObject_Internal = nullptr;
	//TSoftObjectPtr<FPoseLink> SourcePose_Internal = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	bool bRemovePoseCurve = false;


	bool bCallInitialized = false;

	bool bCallByAnimInstance = false;

	FAnimNode_UniGLBPoseBlendNode();

	// FAnimNode_SkeletalControlBase interface
	virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;

	virtual void Evaluate_AnyThread(FPoseContext& Output) override;


private:
};
