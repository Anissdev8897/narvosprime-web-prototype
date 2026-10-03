// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UniGLB_SceneViewExtensionSettings.generated.h"

UCLASS()
class UNIGLBRENDER_API AUniGLBSceneViewExtensionSettings : public AActor
{
	GENERATED_BODY()
	
public:	
	// Sets default values for this actor's properties
	AUniGLBSceneViewExtensionSettings();

protected:
	// Called when the game starts or when spawned
	virtual void BeginPlay() override;

public:	

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	bool bUseExtension = false;


	// Called every frame
	virtual void Tick(float DeltaTime) override;

	virtual void OnConstruction(const FTransform& Transform) override;
};
