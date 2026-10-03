// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UniGLB_ModelActor.generated.h"

class USkeletalMesh;

UCLASS()
class UNIGLB_API AUniGLBModelActor : public AActor
{
	GENERATED_UCLASS_BODY()

public:	
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	UMaterialInterface* BaseOpaqueMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	UMaterialInterface* BaseTransparentMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<UTexture2D*> Textures;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
		TArray<UMaterialInterface*> Materials;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	USkeletalMesh* SkeletalMesh;

protected:
	// Called when the game starts or when spawned
	virtual void BeginPlay() override;

public:	
	// Called every frame
	virtual void Tick(float DeltaTime) override;

	//virtual void OnConstruction(const FTransform& Transform)override;

	
	
};
