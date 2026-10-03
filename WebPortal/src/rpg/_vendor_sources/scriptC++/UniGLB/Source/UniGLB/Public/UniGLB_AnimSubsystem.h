// Copyright (c) 2026 hanibes. MIT License. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/EngineSubsystem.h"
#include "Misc/EngineVersionComparison.h"
#include "UniGLB_AnimSubsystem.generated.h"


// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(4, 22, 0)] all below target floor (5, 7, 0)).


USTRUCT()
struct FUniGLBTransformData {
	GENERATED_USTRUCT_BODY()

public:
	int port = 0;

//	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = UniGLB)
	UPROPERTY()
	TMap<FString, FTransform> BoneTransform;

//	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = UniGLB)
	UPROPERTY()
	TMap<FString, FTransform> RawData;
};

UCLASS()
class UNIGLB_API UUniGLB_AnimSubsystem : public UEngineSubsystem
{
	GENERATED_BODY()

	FCriticalSection cs;

public:

//	TMap<FString, FTransform>;

	TArray<FUniGLBTransformData> baseData;

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	void Clear();

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	void GetBoneByIndex(int index, TMap<FString, FTransform>&trans);

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	void GetBoneByPort(int port, TMap<FString, FTransform>& trans);

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	void GetRawdataByIndex(int index, TMap<FString, FTransform>& trans);

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	void GetRawdataByPort(int port, TMap<FString, FTransform>& trans);


	UFUNCTION(BlueprintCallable, Category = UniGLB)
	void SetBoneTransform(int port, const TMap<FString, FTransform>& trans);

	UFUNCTION(BlueprintCallable, Category = UniGLB)
	void SetRawData(int port, const TMap<FString, FTransform>& trans);

};
