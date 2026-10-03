// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_AssetListThumbnailRenderer.h"
#include "Engine/EngineTypes.h"
#include "CanvasItem.h"
#include "Engine/Texture2D.h"
#include "Engine/SkeletalMesh.h"
#include "CanvasTypes.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Brushes/SlateColorBrush.h"
#include "EditorFramework/AssetImportData.h"

#include "ThumbnailRendering/SkeletalMeshThumbnailRenderer.h"

#include "UniGLB_AssetListObject.h"
#include "UniGLB_LicenseObject.h"
#include "UniGLB_1LicenseObject.h"
#include "UniGLB_MetaObject.h"

//////////////////////////////////////////////////////////////////////////
// UPaperSpriteThumbnailRenderer

UClass* FAssetTypeActions_UniGLBAssetList::GetSupportedClass() const {
	return UUniGLBAssetListObject::StaticClass();
}
FText FAssetTypeActions_UniGLBAssetList::GetName() const {
	return NSLOCTEXT("AssetTypeActions", "FAssetTypeActions_UniGLBAssetList", "UniGLB Asset List");
}

UClass* FAssetTypeActions_UniGLBLicense::GetSupportedClass() const {
	return UUniGLBLicenseObject::StaticClass();
}
FText FAssetTypeActions_UniGLBLicense::GetName() const {
	return NSLOCTEXT("AssetTypeActions", "FAssetTypeActions_UniGLBLicense", "UniGLB License");
}

UClass* FAssetTypeActions_UniGLB1License::GetSupportedClass() const {
	return UUniGLB1LicenseObject::StaticClass();
}
FText FAssetTypeActions_UniGLB1License::GetName() const {
	return NSLOCTEXT("AssetTypeActions", "FAssetTypeActions_UniGLB1License", "UniGLB1 License");
}

UClass* FAssetTypeActions_UniGLBMeta::GetSupportedClass() const {
	return UUniGLBMetaObject::StaticClass();
}
FText FAssetTypeActions_UniGLBMeta::GetName() const {
	return NSLOCTEXT("AssetTypeActions", "FAssetTypeActions_UniGLBMeta", "UniGLB Meta");
}

TSharedPtr<SWidget> FAssetTypeActions_UniGLBBase::GetThumbnailOverlay(const FAssetData& AssetData) const {

	return nullptr; // サムネイルで描画するためスキップ
	/*
	FString str;
	FColor col(0, 0, 0, 0);

	if (str.Len() == 0) {
		TWeakObjectPtr<UUniGLBAssetListObject> a = Cast<UUniGLBAssetListObject>(AssetData.GetAsset());
		if (a.Get()) {
			str = TEXT(" AssetList ");
		}
	}
	if (str.Len() == 0){
		TWeakObjectPtr<UUniGLBLicenseObject> a = Cast<UUniGLBLicenseObject>(AssetData.GetAsset());
		if (a.Get()) {
			str = TEXT(" License ");
			//col.A = 128;
		}
	}
	if (str.Len() == 0) {
		TWeakObjectPtr<UUniGLB1LicenseObject> a = Cast<UUniGLB1LicenseObject>(AssetData.GetAsset());
		if (a.Get()) {
			str = TEXT(" License ");
			//col.A = 128;
		}
	}
	if (str.Len() == 0) {
		TWeakObjectPtr<UUniGLBMetaObject> a = Cast<UUniGLBMetaObject>(AssetData.GetAsset());
		if (a.Get()) {
			str = TEXT(" Meta ");
			//col.A = 128;
		}
	}

	FText txt = FText::FromString(str);
	return SNew(SBorder)
		.HAlign(HAlign_Left)
		.VAlign(VAlign_Top)
		//.Padding(FMargin(4))
		//.Padding(FMargin(4))
		//.BorderImage(new FSlateColorBrush(FColor::White))
		.BorderImage(new FSlateColorBrush(col))
		//.AutoWidth()
		[
			SNew(STextBlock)
			.Text(txt)
			.HighlightText(txt)
			.HighlightColor(FColor(64,64,64))
			//.ShadowOffset(FVector2D(1.0f, 1.0f))
		];

	//return FAssetTypeActions_Base::GetThumbnailOverlay(AssetData);
	*/
}


UUniGLBAssetListThumbnailRenderer::UUniGLBAssetListThumbnailRenderer(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
}

void UUniGLBAssetListThumbnailRenderer::GetThumbnailSize(UObject* Object, float Zoom, uint32& OutWidth, uint32& OutHeight) const {
	UUniGLBAssetListObject* a = Cast<UUniGLBAssetListObject>(Object);

	if (a) {
		if (a->UniGLBLicenseObject) {
			auto tex = a->SmallThumbnailTexture;
			if (tex == nullptr) {
				tex = a->UniGLBLicenseObject->thumbnail;
			}
			if (tex) {
				//return Super::GetThumbnailSize(tex, Zoom, OutWidth, OutHeight);
			}
		}
		if (a->UniGLB1LicenseObject) {
			auto tex = a->SmallThumbnailTexture;
			if (tex == nullptr) {
				tex = a->UniGLB1LicenseObject->thumbnail;
			}
			if (tex) {
				//return Super::GetThumbnailSize(tex, Zoom, OutWidth, OutHeight);
			}
		}
	}
	Super::GetThumbnailSize(Object, Zoom, OutWidth, OutHeight);
}


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 25, 0)] (target floor (5, 7, 0)); kept #else branch only.
void UUniGLBAssetListThumbnailRenderer::Draw(UObject* Object, int32 X, int32 Y, uint32 Width, uint32 Height, FRenderTarget* RenderTarget, FCanvas* Canvas, bool bAdditionalViewFamily)
{
	UTexture2D *tex = nullptr;
	USkeletalMesh *sk = nullptr;

	if (tex == nullptr){
		UUniGLBAssetListObject* a = Cast<UUniGLBAssetListObject>(Object);
		if (a) {
			tex = a->SmallThumbnailTexture;
			if (tex == nullptr) {
				if (a->UniGLBLicenseObject) {
					tex = a->UniGLBLicenseObject->thumbnail;
				}
				if (a->UniGLB1LicenseObject) {
					tex = a->UniGLB1LicenseObject->thumbnail;
				}
			}
			if (a->SkeletalMesh) {
				sk = a->SkeletalMesh;
			}
		}
	}
	if (tex == nullptr) {
		TArray<UObject*> ret;
		{
			UUniGLBMetaObject* a = Cast<UUniGLBMetaObject>(Object);
			if (a) {
				sk = a->SkeletalMesh;
				if (a->UniGLBAssetListObject) {
					tex = a->UniGLBAssetListObject->SmallThumbnailTexture;
				}
			}
		}
		{
			UUniGLBLicenseObject* a = Cast<UUniGLBLicenseObject>(Object);
			if (a) {
				UPackage *pk = a->GetOutermost();
				GetObjectsWithOuter(pk, ret);
				// no sk
				tex = a->thumbnail;
			}
		}
		{
			UUniGLB1LicenseObject* a = Cast<UUniGLB1LicenseObject>(Object);
			if (a) {
				UPackage* pk = a->GetOutermost();
				GetObjectsWithOuter(pk, ret);
				// no sk
				tex = a->thumbnail;
			}
		}

		for (auto *obj : ret) {
			UUniGLBAssetListObject* t = Cast<UUniGLBAssetListObject>(obj);
			if (t == nullptr) {
				continue;
			}
			sk = t->SkeletalMesh;
			if (t->SmallThumbnailTexture) tex = t->SmallThumbnailTexture;
			break;
		}
	}

	
	FString str = "none";
	bool bDark = false;

	if (Object->IsA(UUniGLBAssetListObject::StaticClass())) {
		str = TEXT(" AssetList ");
	} else if (Object->IsA(UUniGLBMetaObject::StaticClass())) {
		str = TEXT(" Meta ");
		bDark = true;
	} else if (Object->IsA(UUniGLBLicenseObject::StaticClass())) {
		str = TEXT(" License ");
		bDark = true;
	} else if (Object->IsA(UUniGLB1LicenseObject::StaticClass())) {
		str = TEXT(" License ");
		bDark = true;
	}

	auto DrawText = [&str, &Width, &Height, &Canvas, &bDark](){
		FText ChannelText = FText::FromString(str);

		FVector2D Position(Width / 24, Height / 24);
		//FCanvasTextItem TextItem(Position, ChannelText, GEngine->GetLargeFont(), FLinearColor::Black);
		FCanvasTextItem TextItem(Position, ChannelText, FSlateFontInfo(UEngine::GetMediumFont(), 32), FLinearColor::Black);

		TextItem.DisableShadow();
		TextItem.Scale = FVector2D(Width / 256.0f, Height / 256.0f);

		if (Width < 128) {
			int ss = 32 * Width / 256;
			TextItem.Scale = FVector2D(1, 1);
			TextItem.SlateFontInfo.GetValue().Size = ss;
			TextItem.SlateFontInfo.GetValue().FontObject = UEngine::GetTinyFont();
		}


		TextItem.Draw(Canvas); // サイズ取得のため一度描画する

		if (bDark){
			FCanvasTileItem BackgroundItem(FVector2D(0,0), FVector2D(Width, Height), FLinearColor(0, 0, 0, 0.5));
			BackgroundItem.BlendMode = SE_BLEND_AlphaBlend;
			Canvas->DrawItem(BackgroundItem);
		}
		{
			float DPIScale = Canvas->GetDPIScale();

			FVector2D TextSize = TextItem.DrawnSize;

			FVector2D Padding(2.0f, 1.0f);
			FVector2D BackgroundSize = TextSize + Padding * 2.0f;
			FVector2D BackgroundPosition = Position - Padding;


			FCanvasTileItem BackgroundItem(BackgroundPosition, BackgroundSize, FLinearColor(0.258, 0.539, 0.068, 0.9));
			//BackgroundItem.BlendMode = SE_BLEND_Opaque;
			BackgroundItem.BlendMode = SE_BLEND_AlphaBlend;
			Canvas->DrawItem(BackgroundItem);

		}

		TextItem.Draw(Canvas);
	};

	// skeleton thumbnail
	if (tex == nullptr) {
		if (IsValid(meshThumbnail) == false) {
			meshThumbnail = NewObject<USkeletalMeshThumbnailRenderer>(this);
		}
		if (sk) {
			if (UniGLBGetSkeleton(sk)) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 25, 0)] (target floor (5, 7, 0)); kept #else branch only.
				meshThumbnail->Draw((UObject*)(sk), X, Y, Width, Height, RenderTarget, Canvas, bAdditionalViewFamily);
				DrawText();
				return;
			}
		}
	}

	auto obj = Object;

	if (tex) {
		obj = tex;
	}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 25, 0)] (target floor (5, 7, 0)); kept #else branch only.
	Super::Draw(obj, X, Y, Width, Height, RenderTarget, Canvas, bAdditionalViewFamily);

	DrawText();
}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 5, 0)] (target floor (5, 7, 0)); kept #else branch only.
bool UUniGLBAssetListThumbnailRenderer::CanVisualizeAsset(UObject* Object)
{

	if (UUniGLBLicenseObject* a = Cast<UUniGLBLicenseObject>(Object)) {
		if (a->thumbnail == nullptr) {
		//	return false;
		}
	}
	if (UUniGLB1LicenseObject* a = Cast<UUniGLB1LicenseObject>(Object)) {
		if (a->thumbnail == nullptr) {
		//	return false;
		}
	}

	return true;
	//return UTextureThumbnailRenderer::CanVisualizeAsset(Object);
}

