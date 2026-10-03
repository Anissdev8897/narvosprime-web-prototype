// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Components/PoseableMeshComponent.h"
#include "Misc/CoreDelegates.h"

#if WITH_EDITOR
#include "Editor/UnrealEdTypes.h"
#endif


#include "UniGLB_CameraCheckComponent.generated.h"

/**
 * 
 */
UCLASS(meta=(BlueprintSpawnableComponent))
class UNIGLB_API UUniGLBCameraCheckComponent : public UActorComponent
{
	GENERATED_UCLASS_BODY()
	
public:

	DECLARE_DYNAMIC_MULTICAST_DELEGATE(FUniGLBCameraCheckDelegate);

	UPROPERTY(BlueprintAssignable)
	FUniGLBCameraCheckDelegate OnCameraMove;

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (DynamicOutputParam = "OutUniGLBAsset"))
	void SetCameraCheck(bool bCheckOn);

public:
	void OnRegister() override;
	void OnUnregister() override;

private:
#if WITH_EDITOR
	void OnCameraTransformChanged(const FVector&, const FRotator&, ELevelViewportType, int32);
#endif

	FDelegateHandle handle;
};
