// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once


#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimInstanceProxy.h"
#include "Animation/AnimNodeBase.h"
#include "Misc/EngineVersionComparison.h"

// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(5, 2, 0)] all below target floor (5, 7, 0)).

#include "Retargeter/IKRetargeter.h"
#include "UniGLB_AnimInstanceRetargetFromMannequin.generated.h"

class UUniGLBAssetListObject;
struct FAnimNode_UniGLBSpringBone;
struct FAnimNode_UniGLBConstraint;
struct FAnimNode_RetargetPoseFromMesh;

USTRUCT()
struct UNIGLB_API FUniGLBAnimInstanceRetargetFromMannequinProxy : public FAnimInstanceProxy {

public:
	GENERATED_BODY()

	float CurrentDeltaTime = 0.f;
	bool bUseRetargeter = false;
	bool bIgnoreVRMSwingBone = false;
	bool bIgnoreVRMConstraint = false;
	bool bIgnoreWindDirectionalSource = false;
	int CalcCount = 0;
	TSharedPtr<FAnimNode_UniGLBSpringBone> Node_SpringBone;
	TSharedPtr<FAnimNode_UniGLBConstraint> Node_Constraint;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
	//TWeakObjectPtr<USkeletalMeshComponent> RetargetSourceMeshComponent = nullptr;
	TSoftObjectPtr<UIKRetargeter> Retargeter;
	TSharedPtr<FAnimNode_RetargetPoseFromMesh> Node_Retarget;

	void CustomInitialize();

	FCompactHeapPose CachedPose;

	FUniGLBAnimInstanceRetargetFromMannequinProxy();

	FUniGLBAnimInstanceRetargetFromMannequinProxy(UAnimInstance* InAnimInstance);

	virtual void Initialize(UAnimInstance* InAnimInstance) override;
	virtual bool Evaluate(FPoseContext& Output) override;

	virtual void UpdateAnimationNode(const FAnimationUpdateContext& InContext);

	virtual void PreUpdate(UAnimInstance* InAnimInstance, float DeltaSeconds);
};

/**
 * 
 */
UCLASS(Blueprintable, BlueprintType)
class UNIGLB_API UUniGLBAnimInstanceRetargetFromMannequin : public UAnimInstance
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

	virtual bool CanRunParallelWork() const { return false; }

	FUniGLBAnimInstanceRetargetFromMannequinProxy *myProxy = nullptr;
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
	virtual void PreUpdateAnimation(float DeltaSeconds) override;

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetRetargetData(bool bUseRetargeter, UIKRetargeter *IKRetargeter);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetUniGLBAssetList(UUniGLBAssetListObject *dstAssetList);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetSkeletalMeshCopyDataForCustomSpring(UUniGLBMetaObject *dstMetaForCustomSpring);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetVrmSpringBoneParam(float gravityScale = 1.f, FVector gravityAdd = FVector::ZeroVector, float stiffnessScale = 1.f, float stiffnessAdd = 0.f, float randomWindRange = 0.2f);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetVrmSpringBoneBool(bool bIgnoreVrmSpringBone = false, bool bIgnorePhysicsCollision = false, bool bIgnoreVRMCollision = false, bool bIgnoreWind = false);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetVrmSpringBoneIgnoreWingBone(const TArray<FName> &boneNameList);

	FUniGLBAnimInstanceRetargetFromMannequinProxy*GetProxy() { return myProxy; }
};
