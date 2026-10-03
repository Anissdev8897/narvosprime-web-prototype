// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Engine/EngineTypes.h"


#include "UniGLB_NetworkBPFunctionLibrary.generated.h"

UCLASS()
class UNIGLB_API UUniGLBNetworkBPFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBGetIPAddressTable(TArray<FString> &AddressTable);
};