// Fill out your copyright notice in the Description page of Project Settings.


#include "UniGLB_ExtensionRimFilterData.h"
#include "UniGLB_RenderSubsystem.h"
#include "Engine/World.h"

// Sets default values
UUniGLBExtensionRimFilterData::UUniGLBExtensionRimFilterData(const FObjectInitializer& ObjectInitializer)
	:Super(ObjectInitializer)
{
 	// Set this actor to call Tick() every frame.  You can turn this off to improve performance if you don't need it.
	//PrimaryActorTick.bCanEverTick = false;

}


/*
void UUniGLBExtensionRimFilterData::BeginDestroy() {
	UUniGLB_RenderSubsystem* s = GEngine->GetEngineSubsystem<UUniGLB_RenderSubsystem>();
	if (s == nullptr) return;

	s->RemoveRimFilterData(this);

	Super::BeginDestroy();
}
*/


void UUniGLBExtensionRimFilterData::PostInitProperties() {
	Super::PostInitProperties();

	if (GEngine == nullptr) return;

	if (!HasAnyFlags(RF_ClassDefaultObject)) {
		// インスタンスの場合
		UUniGLB_RenderSubsystem* s = GEngine->GetEngineSubsystem<UUniGLB_RenderSubsystem>();
		if (s == nullptr) return;

		s->AddRimFilterData(this);
	}
}

// Called every frame
//void UUniGLBExtensionRimFilterData::Tick(float DeltaTime)
//{
//	Super::Tick(DeltaTime);
//}

/*
void UUniGLBExtensionRimFilterData::OnConstruction(const FTransform& Transform) {
	Super::OnConstruction(Transform);

	//UUniGLB_RenderSubsystem* s = UWorld::GetSubsystem<UUniGLB_RenderSubsystem>(GetWorld());
	UUniGLB_RenderSubsystem* s = GEngine->GetEngineSubsystem<UUniGLB_RenderSubsystem>();
	if (s == nullptr) return;

	s->bUsePostRenderBasePass = bUseExtension;

}
*/

