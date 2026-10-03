// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.


#include "UniGLB_ModelActor.h"


// Sets default values
AUniGLBModelActor::AUniGLBModelActor(const FObjectInitializer& ObjectInitializer)
	:Super(ObjectInitializer)
{
 	// Set this actor to call Tick() every frame.  You can turn this off to improve performance if you don't need it.
	PrimaryActorTick.bCanEverTick = true;
}

// Called when the game starts or when spawned
void AUniGLBModelActor::BeginPlay()
{
	Super::BeginPlay();
	
}

// Called every frame
void AUniGLBModelActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

}

