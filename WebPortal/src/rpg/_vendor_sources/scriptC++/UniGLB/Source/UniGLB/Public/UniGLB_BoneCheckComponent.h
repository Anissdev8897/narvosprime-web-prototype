// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "UniGLB_BoneCheckComponent.generated.h"


UCLASS(Blueprintable, meta=(BlueprintSpawnableComponent))
class UNIGLB_API UUniGLBBoneCheckComponent : public USceneComponent
{
	GENERATED_UCLASS_BODY()
	
public:

	DECLARE_DYNAMIC_MULTICAST_DELEGATE(FUniGLBBoneCheckDelegate);

	UPROPERTY(BlueprintAssignable)
	FUniGLBBoneCheckDelegate OnBoneTransform;

	virtual void OnRegister() override;
	virtual void OnUnregister() override;

	void OnTargetTransformUpdate();


	//virtual void GetCameraView(float DeltaTime, FMinimalViewInfo& DesiredView) override;

};
