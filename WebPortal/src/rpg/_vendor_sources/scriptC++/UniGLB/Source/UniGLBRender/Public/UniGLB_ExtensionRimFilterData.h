// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UniGLB_ExtensionRimFilterData.generated.h"


UCLASS(BlueprintType)
class UNIGLBRENDER_API UUniGLBExtensionRimFilterData : public UObject
{
	GENERATED_UCLASS_BODY()

	struct FFilterData {
		bool bUseFilter = false;
		int Priority = 0;

		bool bUseCustomLighPosition = false;
		FVector LightPosition;
		FVector LightDirection;

		bool bUseCustomLighColor = false;
		FLinearColor LightColor;
		float LightScale = 100.f;
		float RimEdgeFade = 1.f;

		bool bUseBinaryEdge = false;
		float RimEdgeBinaryRange = 0.2f;

		float SampleScreenScale = 0.25f;
		float SampleScale = 1.5;

		int CustomStencilMask = 0xFFFF;

	};

public:	
	// Sets default values for this actor's properties
	//UUniGLBExtensionRimFilterData();

protected:
	// Called when the game starts or when spawned
	//virtual void BeginPlay() override;

public:	

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	bool bUseFilter = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	int Priority = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	bool bUseCustomLighPosition = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	FVector LightPosition;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	FVector LightDirection;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	float LightScale = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	float RimEdgeFade = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	bool bUseBinaryEdge = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	float RimEdgeBinaryRange = 0.2f;


	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	bool bUseCustomLighColor = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	FLinearColor LightColor;


	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	float SampleScreenScale = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	float SampleScale = 1.0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	int CustomStencilMask = 0xFFFF;

	// Called every frame
	//virtual void Tick(float DeltaTime) override;

	//UObject::UObject(const FObjectInitializer& ObjectInitializer)
	//	virtual void OnConstruction(const FTransform& Transform) override;
	//virtual void BeginDestroy() override;
	virtual void PostInitProperties() override;

	FFilterData GetFilterData() {
		FFilterData d;

		d.bUseFilter = bUseFilter;
		d.Priority = Priority;

		d.bUseCustomLighPosition = bUseCustomLighPosition;
		d.LightPosition = LightPosition;
		d.LightDirection = LightDirection;

		d.bUseCustomLighColor = bUseCustomLighColor;
		d.LightColor = LightColor;
		d.LightScale = LightScale;
		d.RimEdgeFade = RimEdgeFade;

		d.bUseBinaryEdge = bUseBinaryEdge;
		d.RimEdgeBinaryRange = RimEdgeBinaryRange;

		d.SampleScreenScale = SampleScreenScale;
		d.SampleScale = SampleScale;

		d.CustomStencilMask = CustomStencilMask;

		return d;
	}
};
