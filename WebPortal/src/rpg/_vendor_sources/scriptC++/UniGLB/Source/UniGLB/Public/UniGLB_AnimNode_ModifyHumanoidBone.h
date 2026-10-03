// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "BoneContainer.h"
#include "BonePose.h"
#include "BoneControllers/AnimNode_ModifyBone.h"

#include "UniGLB_AnimNode_ModifyHumanoidBone.generated.h"

class UUniGLBAssetListObject;
class USkeletalMeshComponent;

USTRUCT(BlueprintType)
struct FUniGLBBoneTransform
{
	GENERATED_USTRUCT_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	TArray<FTransform> Transform;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	TArray<bool> bEnableRotation;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	TArray<bool> bEnableTranslation;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	TArray<FName> UniGLBHumanoidBoneName;
};


/**
*	Simple controller that replaces or adds to the translation/rotation of a single bone.
*/
USTRUCT(BlueprintInternalUseOnly)
struct UNIGLB_API FAnimNode_UniGLBModifyHumanoidBone : public FAnimNode_SkeletalControlBase
{
	GENERATED_USTRUCT_BODY()

		/** Name of bone to control. This is the main bone chain to modify from. **/
	//UPROPERTY(EditAnywhere, Category=SkeletalControl) 
		//FBoneReference BoneToModify;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	UUniGLBAssetListObject *UniGLBAssetList = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = SkeletalControl, meta = (PinShownByDefault))
	FUniGLBBoneTransform HumanoidBoneTransform;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = SkeletalControl, meta = (PinShownByDefault))
	FUniGLBBoneTransform ExtBoneTransform;

	/** Whether and how to modify the translation of this bone. */
	//UPROPERTY(EditAnywhere, Category=Translation)
	//TEnumAsByte<EBoneModificationMode> TranslationMode;

	/** Whether and how to modify the translation of this bone. */
	//UPROPERTY(EditAnywhere, Category=Rotation)
	//TEnumAsByte<EBoneModificationMode> RotationMode;


	/** Reference frame to apply Translation in. */
	//UPROPERTY(EditAnywhere, Category=Translation)
	//TEnumAsByte<enum EBoneControlSpace> TranslationSpace;

	/** Reference frame to apply Rotation in. */
	//UPROPERTY(EditAnywhere, Category=Rotation)
	TEnumAsByte<enum EBoneControlSpace> RotationSpace;

	FAnimNode_UniGLBModifyHumanoidBone();

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
