// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Components/PoseableMeshComponent.h"
#include "UniGLB_PoseableMeshComponent.generated.h"

/**
 * 
 */
UCLASS(Blueprintable, meta=(BlueprintSpawnableComponent))
class UNIGLB_API UUniGLBPoseableMeshComponent : public UPoseableMeshComponent
{
	GENERATED_UCLASS_BODY()
	
	
public:

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	bool bUseParentAsLeader = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	bool bUseDefaultMaterial = false;

	void OnRegister() override;

	UFUNCTION(BlueprintImplementableEvent, Category = "UniGLB")
	void Init();

	virtual void RefreshBoneTransforms(FActorComponentTickFunction* TickFunction = NULL) override;

	UFUNCTION(BlueprintCallable, Category = "Components|PoseableMesh")
	void UniGLBCopyPoseAndMorphFromSkeletalComponent(USkeletalMeshComponent* InComponentToCopy);

	virtual void TickComponent(float DeltaTime, enum ELevelTick TickType, FActorComponentTickFunction *ThisTickFunction) override;

	virtual void UpdateLeader();

	virtual void InitializeComponent() override;
	virtual void OnAttachmentChanged() override;

#if WITH_EDITOR
	virtual void PostEditChangeProperty(struct FPropertyChangedEvent& PropertyChangedEvent) override;
	virtual void PostEditChangeChainProperty(struct FPropertyChangedChainEvent& PropertyChangedEvent) override;
#endif

};
