// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "Engine/AssetUserData.h"
#include "UniGLB_AssetUserData.generated.h"

class UUniGLBAssetListObject;

UCLASS(BlueprintType)
class UNIGLB_API UUniGLBAssetUserData : public UAssetUserData
{
	GENERATED_BODY()

public:

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	TObjectPtr<UUniGLBAssetListObject> UniGLBAssetListObject = nullptr;

};
