// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once
#include "Engine/LatentActionManager.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "UniGLB_CaptureManager.generated.h"

class UUniGLBMocopiReceiver;

UCLASS()
class UNIGLBCAPTURE_API UUniGLBCaptureManager : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()
	
public:
	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static UUniGLBMocopiReceiver* CreateUniGLBMocopiReceiver(FString ReceiveIPAddress, int32 Port, bool bMulticastLoopback, bool bStartListening, FString ServerName, UObject* Outer = nullptr);


};
