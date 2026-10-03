// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "Engine/DataAsset.h"
#include "UniGLB_ImportMaterialSet.generated.h"

class UMaterialInterface;

UCLASS(BlueprintType)
class UNIGLB_API UUniGLBImportMaterialSet : public UDataAsset{

	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material")
	UMaterialInterface* Opaque;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material")
	UMaterialInterface* OpaqueTwoSided;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material")
	UMaterialInterface* Translucent;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material")
	UMaterialInterface* TranslucentTwoSided;
};

