// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.


#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"
#include "Engine/TextureRenderTarget2D.h"
#include "RendererInterface.h"

//#include "UniGLBImporterModule.h"

//DECLARE_LOG_CATEGORY_EXTERN(LogUniGLBRender, Verbose, All);

//#define SPRITER_IMPORT_ERROR(FormatString, ...) \
//	if (!bSilent) { UE_LOG(LogUniGLBRender, Warning, FormatString, __VA_ARGS__); }
//#define SPRITER_IMPORT_WARNING(FormatString, ...) \
//	if (!bSilent) { UE_LOG(LogUniGLBRender, Warning, FormatString, __VA_ARGS__); }

UENUM()
enum EUniGLB_CaptureSource : int
{
	ColorTexturePostOpaque,
	ColorTextureOverlay,
	ColorTexturePreTonemap,
	ColorTexturePostTonemap,
	ColorTextureLastPass,
	DepthTexture,
	NormalTexture,
	VelocityTexture,
	//SmallDepthTexture,

	SceneColorTexturePostOpaque,
	SceneColorTextureOverlay,
	SceneDepthTexture,
	//ScenePartialDepthTexture,

	// GBuffer
	GBufferATexture,
	GBufferBTexture,
	GBufferCTexture,
	GBufferDTexture,
	GBufferETexture,
	GBufferFTexture,
	GBufferVelocityTexture,

	// SSAO
	ScreenSpaceAOTexture,

	// Custom Depth / Stencil
	CustomDepthTexture,

	//CaptureSource_MAX,
};


class FUniGLBRenderModule : public FDefaultModuleImpl
{

	FDelegateHandle HandleTearDown;
	bool bIsPlay = false;

public:
	// Plain C++ module class (not UCLASS/UObject) -- UPROPERTY has no effect here and is not
	// reflected to Blueprint. UHT already flags this as deprecated inside a skipped block.
	TMap<TObjectPtr<UTextureRenderTarget2D>, TEnumAsByte<EUniGLB_CaptureSource> > CaptureList;


	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

	void OnPostOpaque(FPostOpaqueRenderParameters& Parameters);
	void OnOverlay(FPostOpaqueRenderParameters& Parameters);

#if WITH_EDITOR
	void OnMapChange(UWorld* World, EMapChangeType ChangeType);

	void OnPIEEvent(bool bPIEBegin, bool bPIEEnd);
#endif

	static void AddCopyPass(FRDGBuilder& GraphBuilder, FIntPoint ViewRectSize, FRDGTextureRef SrcRDGTex, TObjectPtr<UTextureRenderTarget2D> RenderTarget);
	static bool isCaptureTarget(const FSceneView* View);
};
