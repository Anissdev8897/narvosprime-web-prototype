// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "CineCameraActor.h"

#include "UniGLB_CineCameraActor.generated.h"


UCLASS(ClassGroup = Common, hideCategories = (Input, Rendering, AutoPlayerActivation), showcategories = ("Input|MouseInput", "Input|TouchInput"), Blueprintable)
class UNIGLB_API AUniGLBCineCameraActor : public ACineCameraActor
{
	GENERATED_BODY()

public:
	// Ctor
	AUniGLBCineCameraActor(const FObjectInitializer& ObjectInitializer);

	UFUNCTION(BlueprintCallable, Category = "Camera")
		UUniGLBCineCameraComponent* GetUniGLBCineCameraComponent() const;

public:

};
