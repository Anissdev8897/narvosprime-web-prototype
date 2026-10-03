// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"

//#if WITH_EDITOR
//#include "UnrealEd.h"
//#include "AssetTypeActions_Base.h"
//#endif

#include "UniGLB_1LicenseObject.generated.h"

class UTexture2D;
/**
 * 
 */

USTRUCT(BlueprintType, meta = (AutoExpandCategories = "License"))
struct FUniGLBLicenseStringDataPair {
	GENERATED_USTRUCT_BODY()

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License")
	FString key;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License")
	FString value;
};

USTRUCT(BlueprintType, meta = (AutoExpandCategories = "License"))
struct FUniGLBLicenseStringDataArray {
	GENERATED_USTRUCT_BODY()

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License")
	FString key;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License")
	TArray<FString> value;
};

USTRUCT(BlueprintType, meta = (AutoExpandCategories = "License"))
struct FUniGLBLicenseBoolDataPair {
	GENERATED_USTRUCT_BODY()

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License")
	FString key;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License")
	bool value = false;
};

UCLASS(Blueprintable, BlueprintType, meta = (AutoExpandCategories = "License"))
class UNIGLB_API UUniGLB1LicenseObject : public UObject
{
	GENERATED_BODY()

public:

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = Information)
	UTexture2D* thumbnail = nullptr;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License")
	TArray<FUniGLBLicenseStringDataPair> LicenseString;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License")
	TArray<FUniGLBLicenseStringDataArray> LicenseStringArray;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License")
	TArray<FUniGLBLicenseBoolDataPair> LicenseBool;

	
};

