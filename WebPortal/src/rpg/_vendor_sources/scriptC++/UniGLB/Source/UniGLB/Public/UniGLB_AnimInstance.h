// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimInstanceProxy.h"
#include "Misc/EngineVersionComparison.h"

#include "UniGLB_AnimInstance.generated.h"

class UUniGLBMetaObject;
class USkeleton;

UENUM(BlueprintType)
enum class EUniGLBBlendShapeGroup : uint8
{
	BSG_Neutoral		UMETA(DisplayName="00_Neutoral"),
	BSG_A			UMETA(DisplayName="01_A"),
	BSG_I			UMETA(DisplayName="02_I"),
	BSG_U			UMETA(DisplayName="03_U"),
	BSG_E			UMETA(DisplayName="04_E"),
	BSG_O			UMETA(DisplayName="05_O"),
	BSG_Blink		UMETA(DisplayName="06_Blink"),
	BSG_Joy			UMETA(DisplayName="07_Joy"),
	BSG_Angry		UMETA(DisplayName="08_Angry"),
	BSG_Sorrow		UMETA(DisplayName="09_Sorrow"),
	BSG_Fun			UMETA(DisplayName="10_Fun"),
	BSG_LookUp		UMETA(DisplayName="11_LookUp"),
	BSG_LookDown	UMETA(DisplayName="12_LookDown"),
	BSG_LookLeft	UMETA(DisplayName="13_LookLeft"),
	BSG_LookRight	UMETA(DisplayName="14_LookRight"),
	BSG_Blink_L		UMETA(DisplayName="15_Blink_L"),
	BSG_Blink_R		UMETA(DisplayName="16_Blink_R"),
	Num				UMETA(Hidden)
};


USTRUCT()
struct UNIGLB_API FUniGLBAnimInstanceProxy : public FAnimInstanceProxy {

public:
	GENERATED_BODY()

		FUniGLBAnimInstanceProxy()
	{
	}

	FUniGLBAnimInstanceProxy(UAnimInstance* InAnimInstance)
		: FAnimInstanceProxy(InAnimInstance)
	{
	}

	virtual void Initialize(UAnimInstance* InAnimInstance) override;
	virtual bool Evaluate(FPoseContext& Output) override;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
	virtual void UpdateAnimationNode(const FAnimationUpdateContext& InContext);
};

/**
 * 
 */
UCLASS(Blueprintable, BlueprintType)
class UNIGLB_API UUniGLBAnimInstance : public UAnimInstance
{
	GENERATED_UCLASS_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	UUniGLBMetaObject *MetaObject;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	USkeleton *BaseSkeleton;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	USkeletalMeshComponent *BaseSkeletalMeshComponent;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Tracking)
	FTransform TransHandLeft;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Tracking)
	FTransform TransHandRight;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Tracking)
	FTransform TransHead;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Tracking)
	USceneComponent *ComponentHandLeft;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Tracking)
	USceneComponent *ComponentHandRight;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Tracking)
	USceneComponent *ComponentHead;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Tracking)
		USceneComponent *ComponentHandJointTargetLeft;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Tracking)
		USceneComponent *ComponentHandJointTargetRight;

protected:
	virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override;
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

	//virtual USkeleton* GetTargetSkeleton() const override;

	UFUNCTION(BlueprintCallable, Category="Animation")
	void SetMorphTargetVRM(EUniGLBBlendShapeGroup type, float Value);

	
	UFUNCTION(BlueprintCallable, Category = "Animation")
	void SetUniGLBData(USkeletalMeshComponent *baseSkeletalMesh, UUniGLBMetaObject *meta);

};
