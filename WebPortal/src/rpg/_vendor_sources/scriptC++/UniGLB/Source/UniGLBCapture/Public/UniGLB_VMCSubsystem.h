// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/EngineSubsystem.h"
#include "Misc/EngineVersionComparison.h"
#include "UObject/StrongObjectPtr.h"

#include "OSCServer.h"
#include "UniGLB_VMCObject.h"

#include "UniGLB_VMCSubsystem.generated.h"


// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(4, 22, 0)] all below target floor (5, 7, 0)).


UCLASS()
class UNIGLBCAPTURE_API UUniGLB_VMCSubsystem : public UEngineSubsystem
{
	GENERATED_BODY()

public:

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	bool CreateVMCServer(const FString ServerAddress, int port);

	void ClearData(const FString ServerAddress, int port);

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	void DestroyVMCServer(const FString ServerAddress, int port);

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	void DestroyVMCServerAll();

	UUniGLBVMCObject* FindOrAddServer(const FString ServerAddress, int port);

	TArray< TStrongObjectPtr<UUniGLBVMCObject> > VMCObjectList;

	bool CopyVMCData(FVMCData& DstData, FString ServerAddress, int port);

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	bool GetVMCData(TMap<FString, FTransform> &BoneData, TMap<FString, float> &CurveData, FString ServerAddress, int port);


	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

private:
};
