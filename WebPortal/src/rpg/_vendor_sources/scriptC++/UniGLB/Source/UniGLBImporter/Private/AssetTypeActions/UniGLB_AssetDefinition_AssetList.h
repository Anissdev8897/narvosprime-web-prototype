// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "AssetDefinitionDefault.h"
#include "ContentBrowserMenuContexts.h"


#include "UniGLB_AssetListObject.h"

#include "UniGLB_AssetDefinition_AssetList.generated.h"


UCLASS()
class UNIGLBIMPORTER_API UAssetDefinition_UniGLBAssetList : public UAssetDefinitionDefault
{
	GENERATED_BODY()

public:
	virtual FLinearColor GetAssetColor() const override { return FLinearColor( FColor(255, 223, 255) ); }
	virtual FText GetAssetDisplayName() const override { return NSLOCTEXT("AssetTypeActions", "AssetTypeActions_UniGLBAssetList", "UniGLB Asset List"); }
	virtual TSoftClassPtr<UObject> GetAssetClass() const override { return UUniGLBAssetListObject::StaticClass(); }
	//virtual TSharedPtr<SWidget> GetThumbnailOverlay(const FAssetData& InAssetData) const override;
	//virtual bool GetThumbnailActionOverlay(const FAssetData& InAssetData, FAssetActionThumbnailOverlayInfo& OutActionOverlayInfo) const override;

	virtual UThumbnailInfo* LoadThumbnailInfo(const FAssetData& InAssetData) const override;
};
