// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimInstanceProxy.h"
#include "Animation/AnimNodeBase.h"
#include "Misc/EngineVersionComparison.h"

#include "UniGLB_AnimInstanceCopy.generated.h"

class UUniGLBAssetListObject;
struct FAnimNode_UniGLBSpringBone;
struct FAnimNode_UniGLBConstraint;

USTRUCT()
struct UNIGLB_API FUniGLBAnimInstanceCopyProxy : public FAnimInstanceProxy {

public:
	GENERATED_BODY()

	float CurrentDeltaTime = 0.f;
	bool bIgnoreVRMSwingBone = false;
	bool bIgnoreVRMConstraint = false;
	bool bIgnoreWindDirectionalSource = false;
	int CalcCount = 0;
	TSharedPtr<FAnimNode_UniGLBSpringBone> Node_SpringBone;
	TSharedPtr<FAnimNode_UniGLBConstraint> Node_Constraint;

	bool bUseAnimStop = false;
	bool bAnimStop = false;
	bool bIgnoreCenterLocation = false;
	FVector CenterLocationScaleByHeightScale = { 1.f, 1.f, 1.f };
	FVector CenterLocationOffset = {0.f, 0.f, 0.f};
	bool bCopyStop = false;
	FCompactHeapPose CachedPose;

	FUniGLBAnimInstanceCopyProxy();

	FUniGLBAnimInstanceCopyProxy(UAnimInstance* InAnimInstance);

	virtual void Initialize(UAnimInstance* InAnimInstance) override;
	virtual bool Evaluate(FPoseContext& Output) override;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
	virtual void UpdateAnimationNode(const FAnimationUpdateContext& InContext);
};

/**
 * 
 */
UCLASS(Blueprintable, BlueprintType)
class UNIGLB_API UUniGLBAnimInstanceCopy : public UAnimInstance
{
	GENERATED_UCLASS_BODY()

public:

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category= Rendering, meta = (NeverAsPin))
	bool bUseAttachedParent = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	USkeletalMeshComponent *SrcSkeletalMeshComponent;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	USkinnedMeshComponent* SrcAsSkinnedMeshComponent;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	UUniGLBAssetListObject *SrcUniGLBAssetList;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	UUniGLBMetaObject* SrcUniGLBMetaOverride;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	UUniGLBAssetListObject *DstUniGLBAssetList;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	UUniGLBMetaObject *DstUniGLBMetaForCustomSpring;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FName> InitialMorphName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<float> InitialMorphValue;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	bool bUseAnimStop = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	bool bAnimStop = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	bool bCopyStop = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	bool bIgnoreCenterLocation = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FVector CenterLocationScaleByHeightScale = {1.f, 1.f, 1.f};

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FVector CenterLocationOffset = { 0.f, 0.f, 0.f };

protected:
	virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override;

	FUniGLBAnimInstanceCopyProxy *myProxy = nullptr;
	bool bIgnoreVRMSwingBone = false;
	bool bIgnoreWindDirectionalSource = false;
public:
	virtual void NativeInitializeAnimation()override;
	// Native update override point. It is usually a good idea to simply gather data in this step and 
	// for the bulk of the work to be done in NativeUpdateAnimation.
	virtual void NativeUpdateAnimation(float DeltaSeconds)override;
	// Native Post Evaluate override point
	virtual void NativePostEvaluateAnimation()override;
	// Native Uninitialize override point
	virtual void NativeUninitializeAnimation()override;

	// Executed when begin play is called on the owning component
	virtual void NativeBeginPlay()override;

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetSkeletalMeshCopyData(UUniGLBAssetListObject *dstAssetList, USkeletalMeshComponent *srcSkeletalMesh, USkinnedMeshComponent* srcSkinnedMesh, UUniGLBAssetListObject *srcAssetList, UUniGLBMetaObject* srcUniGLBMetaOption);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetSkeletalMeshCopyDataForCustomSpring(UUniGLBMetaObject *dstMetaForCustomSpring);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetVrmSpringBoneParam(float gravityScale = 1.f, FVector gravityAdd = FVector::ZeroVector, float stiffnessScale = 1.f, float stiffnessAdd = 0.f, float randomWindRange = 0.2f);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetVrmSpringBoneBool(bool bIgnoreVrmSpringBone = false, bool bIgnorePhysicsCollision = false, bool bIgnoreVRMCollision = false, bool bIgnoreWind = false);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetVrmSpringBoneIgnoreWingBone(const TArray<FName> &boneNameList);

	FUniGLBAnimInstanceCopyProxy *GetProxy() { return myProxy; }
};
