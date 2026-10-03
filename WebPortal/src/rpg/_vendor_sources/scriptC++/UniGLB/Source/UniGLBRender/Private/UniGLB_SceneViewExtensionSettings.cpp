// Fill out your copyright notice in the Description page of Project Settings.


#include "UniGLB_SceneViewExtensionSettings.h"
#include "UniGLB_RenderSubsystem.h"
#include "Engine/World.h"

// Sets default values
AUniGLBSceneViewExtensionSettings::AUniGLBSceneViewExtensionSettings()
{
 	// Set this actor to call Tick() every frame.  You can turn this off to improve performance if you don't need it.
	PrimaryActorTick.bCanEverTick = false;

}

// Called when the game starts or when spawned
void AUniGLBSceneViewExtensionSettings::BeginPlay()
{
	Super::BeginPlay();
	
}

// Called every frame
void AUniGLBSceneViewExtensionSettings::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

}

void AUniGLBSceneViewExtensionSettings::OnConstruction(const FTransform& Transform) {
	Super::OnConstruction(Transform);
}

