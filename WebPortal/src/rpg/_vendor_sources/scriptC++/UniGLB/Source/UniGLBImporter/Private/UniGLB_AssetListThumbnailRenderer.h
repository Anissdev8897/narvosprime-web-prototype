// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "ThumbnailRendering/TextureThumbnailRenderer.h"
#include "Misc/EngineVersionComparison.h"

#include "AssetTypeActions_Base.h"
#include "UniGLB_AssetListThumbnailRenderer.generated.h"

class FCanvas;
class FRenderTarget;

class FAssetTypeActions_UniGLBBase : public FAssetTypeActions_Base {

	virtual uint32 GetCategories() override { return EAssetTypeCategories::Misc; }
	virtual TSharedPtr<SWidget> GetThumbnailOverlay(const FAssetData& AssetData) const override;
	virtual FColor GetTypeColor() const override { return FColor(255, 223, 255); }
};


class FAssetTypeActions_UniGLBAssetList : public FAssetTypeActions_UniGLBBase
{
public:
	// IAssetTypeActions Implementation
	virtual FText GetName() const override;
	virtual UClass* GetSupportedClass() const override;
	virtual bool IsImportedAsset() const override { return true; }
};
class FAssetTypeActions_UniGLBLicense : public FAssetTypeActions_UniGLBBase
{
public:
	// IAssetTypeActions Implementation
	virtual FText GetName() const override;
	virtual UClass* GetSupportedClass() const override;
};
class FAssetTypeActions_UniGLB1License : public FAssetTypeActions_UniGLBBase
{
public:
	// IAssetTypeActions Implementation
	virtual FText GetName() const override;
	virtual UClass* GetSupportedClass() const override;
};
class FAssetTypeActions_UniGLBMeta : public FAssetTypeActions_UniGLBBase
{
public:
	// IAssetTypeActions Implementation
	virtual FText GetName() const override;
	virtual UClass* GetSupportedClass() const override;
};



UCLASS()
class UUniGLBAssetListThumbnailRenderer : public UTextureThumbnailRenderer
{
	GENERATED_UCLASS_BODY()

	// UThumbnailRenderer interface
	virtual void GetThumbnailSize(UObject* Object, float Zoom, uint32& OutWidth, uint32& OutHeight) const override;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 25, 0)] (target floor (5, 7, 0)); kept #else branch only.
	virtual void Draw(UObject* Object, int32 X, int32 Y, uint32 Width, uint32 Height, FRenderTarget*, FCanvas* Canvas, bool bAdditionalViewFamily) override;
	// End of UThumbnailRenderer interface

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 5, 0)] (target floor (5, 7, 0)); kept #else branch only.
	virtual bool CanVisualizeAsset(UObject* Object) override;

protected:
	//void DrawFrame(class UPaperSprite* Sprite, int32 X, int32 Y, uint32 Width, uint32 Height, FRenderTarget*, FCanvas* Canvas, FBoxSphereBounds* OverrideRenderBounds);

	//void DrawGrid(int32 X, int32 Y, uint32 Width, uint32 Height, FCanvas* Canvas);
	UPROPERTY()
	class USkeletalMeshThumbnailRenderer *meshThumbnail = nullptr;
};
