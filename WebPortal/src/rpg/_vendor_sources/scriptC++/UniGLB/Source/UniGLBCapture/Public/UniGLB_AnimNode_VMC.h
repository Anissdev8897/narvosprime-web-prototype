// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "BoneContainer.h"
#include "BonePose.h"
#include "BoneControllers/AnimNode_ModifyBone.h"
#include "Misc/EngineVersionComparison.h"

#include "UniGLB_AnimNode_VMC.generated.h"

class USkeletalMeshComponent;
class UUniGLBMetaObject;
class UUniGLBAssetListObject;

/**
*	Simple controller that replaces or adds to the translation/rotation of a single bone.
*/
USTRUCT(BlueprintInternalUseOnly)
struct UNIGLBCAPTURE_API FAnimNode_UniGLBVMC : public FAnimNode_SkeletalControlBase
{
	GENERATED_USTRUCT_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	bool EnableAutoSearchMetaData = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta=(PinHiddenByDefault))
	const UUniGLBMetaObject *UniGLBMetaObject = nullptr;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TSoftObjectPtr<UUniGLBMetaObject> UniGLBMetaObject_Internal = nullptr;
	TSoftObjectPtr<UUniGLBAssetListObject> UniGLBAssetListObject_Internal = nullptr;

	//UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinShownByDefault))
	//TMap<FString, FTransform> BoneTrans;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinShownByDefault))
	bool bUseRemoteCenterPos = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinShownByDefault))
	float ModelRelativeScale = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinShownByDefault))
	bool bIgnoreLocalRotation = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinShownByDefault))
	FString ServerAddress = "0.0.0.0";

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinShownByDefault))
	int Port = 39539;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinShownByDefault))
	bool bApplyPerfectSync = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Skeleton, meta = (PinHiddenByDefault))
	bool bForceUpdate = false;

	bool bCreateServer = false;

	TArray<FTransform> RefSkeletonTransform_global;

	FAnimNode_UniGLBVMC();
	virtual ~FAnimNode_UniGLBVMC();

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
