// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_AssetDefinition_AssetList.h"
#include "ContentBrowserMenuContexts.h"
#include "ToolMenus.h"
#include "Editor.h"
#include "Styling/AppStyle.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Images/SImage.h"

#include "ThumbnailRendering/SceneThumbnailInfo.h"

#include "UniGLB_MetaObject.h"
#include "UniGLB_LicenseObject.h"
#include "UniGLB_1LicenseObject.h"
#include "UniGLB_AssetListObject.h"

#define LOCTEXT_NAMESPACE "AssetTypeActions"


UThumbnailInfo* UAssetDefinition_UniGLBAssetList::LoadThumbnailInfo(const FAssetData& InAssetData) const
{
	return UE::Editor::FindOrCreateThumbnailInfo(InAssetData.GetAsset(), USceneThumbnailInfo::StaticClass());
}

//TSharedPtr<SWidget> UAssetDefinition_UniGLBAssetList::GetThumbnailOverlay(const FAssetData& AssetData) const {
//	return nullptr;
//}



//bool UAssetDefinition_UniGLBAssetList::GetThumbnailActionOverlay(const FAssetData& InAssetData, FAssetActionThumbnailOverlayInfo& OutActionOverlayInfo) const
//{
//	return false;
//}


#undef LOCTEXT_NAMESPACE
