// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"

//#if WITH_EDITOR
//#include "UnrealEd.h"
//#include "AssetTypeActions_Base.h"
//#endif

#include "UniGLB_LicenseObject.generated.h"

class UTexture2D;
/**
 * 
 */
UCLASS(Blueprintable, BlueprintType)
class UNIGLB_API UUniGLBLicenseObject : public UObject
{
	GENERATED_BODY()

public:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = Information)
	FString title;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = Information)
	FString version;
	
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = Information)
	FString author;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = Information)
	FString contactInformation;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = Information)
	FString reference;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = Information)
	UTexture2D *thumbnail;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
	FString allowedUserName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
		FString violentUsageName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
		FString sexualUsageName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
		FString commercialUsageName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
		FString otherPermissionUrl;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Redistribution/ModificationsLicense")
		FString licenseName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Redistribution/ModificationsLicense")
		FString otherLicenseUrl;
	
};

/*
#if WITH_EDITOR
class FAssetTypeActions_UniGLBLicenseObject : public FAssetTypeActions_Base
{
public:
	virtual FText GetName() const override
	{ return NSLOCTEXT("AssetTypeActions", "AssetTypeActions_MyAsset", "MyAsset"); }
	virtual FColor GetTypeColor() const override { return FColor::White; }
	virtual uint32 GetCategories() override { return EAssetTypeCategories::Misc; }
	virtual UClass* GetSupportedClass() const override {
		return UUniGLBLicenseObject::StaticClass();
	};
	virtual bool IsImportedAsset() const override { return false; }
};
#endif
*/

