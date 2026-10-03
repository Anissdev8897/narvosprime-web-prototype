// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "AssetDefinitionDefault.h"
#include "ContentBrowserMenuContexts.h"

#include "UniGLB_1LicenseObject.h"

#include "UniGLB_AssetDefinition_AssetList.h"
#include "UniGLB_AssetDefinition_1License.generated.h"


UCLASS()
class UNIGLBIMPORTER_API UAssetDefinition_UniGLB1License : public UAssetDefinition_UniGLBAssetList
{
	GENERATED_BODY()

public:
	virtual FLinearColor GetAssetColor() const override { return UAssetDefinition_UniGLBAssetList::GetAssetColor(); }
	virtual FText GetAssetDisplayName() const override { return NSLOCTEXT("AssetTypeActions", "AssetTypeActions_UniGLB1License", "UniGLB VRM License (1.0)"); }
	virtual TSoftClassPtr<UObject> GetAssetClass() const override { return UUniGLB1LicenseObject::StaticClass(); }
	//virtual bool GetThumbnailActionOverlay(const FAssetData& InAssetData, FAssetActionThumbnailOverlayInfo& OutActionOverlayInfo) const override {
	//	return UAssetDefinition_UniGLBAssetList::GetThumbnailActionOverlay(InAssetData, OutActionOverlayInfo);
	//}
};
