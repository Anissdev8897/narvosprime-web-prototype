// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "CineCameraComponent.h"

#include "UniGLB_CineCameraComponent.generated.h"


UCLASS(Blueprintable, ClassGroup = Camera, meta=(BlueprintSpawnableComponent))
class UNIGLB_API UUniGLBCineCameraComponent : public UCineCameraComponent
{
	GENERATED_BODY()
	
public:

	virtual void OnRegister() override;
#if WITH_EDITORONLY_DATA
	// Refreshes the visual components to match the component state
	virtual void RefreshVisualRepresentation() override;
#endif


	virtual void GetCameraView(float DeltaTime, FMinimalViewInfo& DesiredView) override;

	UPROPERTY(Interp, EditAnywhere, BlueprintReadWrite, Category = "UniGLB Camera Settings")
	FVector2D OffCenterProjectionOffset;

};
