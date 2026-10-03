// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "AssetDefinitionDefault.h"
#include "ContentBrowserMenuContexts.h"

#include "UniGLB_LicenseObject.h"

#include "UniGLB_AssetDefinition_AssetList.h"
#include "UniGLB_AssetDefinition_License.generated.h"


UCLASS()
class UNIGLBIMPORTER_API UAssetDefinition_UniGLBLicense : public UAssetDefinition_UniGLBAssetList
{
	GENERATED_BODY()

public:
	virtual FLinearColor GetAssetColor() const override { return UAssetDefinition_UniGLBAssetList::GetAssetColor(); }
	virtual FText GetAssetDisplayName() const override { return NSLOCTEXT("AssetTypeActions", "AssetTypeActions_UniGLBLicense", "UniGLB VRM License (0.x)"); }
	virtual TSoftClassPtr<UObject> GetAssetClass() const override { return UUniGLBLicenseObject::StaticClass(); }
	//virtual bool GetThumbnailActionOverlay(const FAssetData& InAssetData, FAssetActionThumbnailOverlayInfo& OutActionOverlayInfo) const override {
	//	return UAssetDefinition_UniGLBAssetList::GetThumbnailActionOverlay(InAssetData, OutActionOverlayInfo);
	//}
};
