// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_CineCameraActor.h"
#include "UniGLB_CineCameraComponent.h"
#include "Misc/EngineVersionComparison.h"

AUniGLBCineCameraActor::AUniGLBCineCameraActor(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer
		.SetDefaultSubobjectClass<UUniGLBCineCameraComponent>(TEXT("CameraComponent"))
	)
{
}


UUniGLBCineCameraComponent* AUniGLBCineCameraActor::GetUniGLBCineCameraComponent() const {
	return Cast<UUniGLBCineCameraComponent>(GetCineCameraComponent());
}
