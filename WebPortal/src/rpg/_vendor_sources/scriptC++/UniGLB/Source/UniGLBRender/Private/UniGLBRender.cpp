// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.

#include "UniGLBRender.h"
#include "CoreMinimal.h"
#include "UniGLBRenderLog.h"
#include "Interfaces/IPluginManager.h"
#include "Modules/ModuleManager.h"
#include "Misc/Paths.h"
#include "ShaderCore.h"
#include "Internationalization/Internationalization.h"


#include "UniGLB_BPFunctionLibrary.h"
#include "UniGLB_RenderSubsystem.h"
#include "UniGLB_ExtensionRimFilterData.h"
#include "RenderGraphBuilder.h"
#include "RenderGraphResources.h"
#include "RenderGraphUtils.h"
#include "EngineModule.h"
#include "Engine/TextureRenderTarget2D.h"
#include "TextureResource.h"
#include "Engine/SkeletalMesh.h"
#include "RendererInterface.h"
#include "ScreenPass.h"
#include "SceneRenderTargetParameters.h"
#include "Slate/SceneViewport.h"
#include "ScreenRendering.h"
#include "SceneView.h"


#define LOCTEXT_NAMESPACE "UniGLBRender"

DEFINE_LOG_CATEGORY(LogUniGLBRender);

// FPostOpaqueRenderParameters::View (public RendererInterface.h) is typed as const FViewInfo*,
// but FViewInfo's full definition (establishing its FSceneView base) lives only in the private
// Renderer module header. FViewInfo has FSceneView as its sole, non-virtual, first base class,
// so the pointer value is unchanged by the upcast; reinterpret_cast avoids pulling in that
// private header just to satisfy the type system for this always-valid conversion.
bool FUniGLBRenderModule::isCaptureTarget(const FSceneView* View) {

	bool bCapture = false;

	bool bPlay = false;
	bool bSIE = false;
	bool bEditor = false;
	UUniGLBBPFunctionLibrary::UniGLBGetPlayMode(bPlay, bSIE, bEditor);

	UWorld* World = View->Family->Scene->GetWorld();
	if (World) {
		EWorldType::Type WorldType = World->WorldType;

		if (bPlay) {
			switch (WorldType) {
			case EWorldType::Game:
			case EWorldType::PIE:
				bCapture = true;
				break;
			}
		} else {
			switch (WorldType) {
			case EWorldType::Editor:
				bCapture = true;
				break;
			}
		}
	}
	if (View->bIsGameView) {
		bCapture = true;
	}
	if (View->bIsOfflineRender) {
		bCapture = true;
	}
	if (View->bIsSceneCapture) {
		bCapture = false;
	}

	return bCapture;
}

void FUniGLBRenderModule::AddCopyPass(FRDGBuilder &GraphBuilder, FIntPoint ViewRectSize, FRDGTextureRef SrcRDGTex, TObjectPtr<UTextureRenderTarget2D> RenderTarget) {

	if (SrcRDGTex == nullptr) {
		return;
	}
	if (RenderTarget == nullptr) {
		return;
	}

	//FPostOpaqueRenderParameters& Parameters
	//const FIntPoint ViewRectSize = FIntPoint(Parameters.ViewportRect.Width(), Parameters.ViewportRect.Height());

	AddPass(GraphBuilder, RDG_EVENT_NAME("UniGLBAddCopyPass"), [ViewRectSize, SrcRDGTex, RenderTarget](FRHICommandListImmediate& RHICmdList)
		{
			if (SrcRDGTex == nullptr) return;
			if (SrcRDGTex->GetRHI() == nullptr) return;

			const FIntPoint TargetSize(RenderTarget->GetRenderTargetResource()->GetSizeX(), RenderTarget->GetRenderTargetResource()->GetSizeY());

			FRHITexture* DestRenderTarget = RenderTarget->GetRenderTargetResource()->GetTextureRHI();

			FRHIRenderPassInfo RPInfo(DestRenderTarget, ERenderTargetActions::Load_Store);
			RHICmdList.BeginRenderPass(RPInfo, TEXT("UniGLB_Copy"));
			{
				RHICmdList.SetViewport(0, 0, 0.0f, TargetSize.X, TargetSize.Y, 1.0f);

				const ERHIFeatureLevel::Type FeatureLevel = GMaxRHIFeatureLevel;
				FGlobalShaderMap* ShaderMap = GetGlobalShaderMap(FeatureLevel);
				TShaderMapRef<FScreenVS> VertexShader(ShaderMap);
				TShaderMapRef<FScreenPS> PixelShader(ShaderMap);

				FGraphicsPipelineStateInitializer GraphicsPSOInit;
				RHICmdList.ApplyCachedRenderTargets(GraphicsPSOInit);
				GraphicsPSOInit.BlendState = TStaticBlendState<>::GetRHI();
				GraphicsPSOInit.RasterizerState = TStaticRasterizerState<>::GetRHI();
				GraphicsPSOInit.DepthStencilState = TStaticDepthStencilState<false, CF_Always>::GetRHI();
				GraphicsPSOInit.BoundShaderState.VertexDeclarationRHI = GFilterVertexDeclaration.VertexDeclarationRHI;
				GraphicsPSOInit.BoundShaderState.VertexShaderRHI = static_cast<FRHIVertexShader*>(VertexShader.GetRHIShaderBase(SF_Vertex));
				GraphicsPSOInit.BoundShaderState.PixelShaderRHI = static_cast<FRHIPixelShader*>(PixelShader.GetRHIShaderBase(SF_Pixel));
				GraphicsPSOInit.PrimitiveType = PT_TriangleList;
				SetGraphicsPipelineState(RHICmdList, GraphicsPSOInit, 0);

				FRHITexture* SceneTexture = SrcRDGTex->GetRHI()->GetTexture2D();

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
				FRHIBatchedShaderParameters& BatchedParameters = RHICmdList.GetScratchShaderParameters();
				PixelShader->SetParameters(BatchedParameters, TStaticSamplerState<SF_Bilinear>::GetRHI(), SceneTexture);
				RHICmdList.SetBatchedShaderParameters(RHICmdList.GetBoundPixelShader(), BatchedParameters);
				IRendererModule* RendererModule = &FModuleManager::GetModuleChecked<IRendererModule>(TEXT("Renderer"));
				RendererModule->DrawRectangle(
					RHICmdList,
					0, 0,									// Dest X, Y
					TargetSize.X, TargetSize.Y,				// Dest Width, Height
					0, 0,									// Source U, V
					ViewRectSize.X, ViewRectSize.Y,			// Source USize, VSize
					TargetSize,								// Target buffer size
					FIntPoint(SceneTexture->GetSizeX(), SceneTexture->GetSizeY()),	// Source texture size
					VertexShader,
					EDRF_Default);
			}
			RHICmdList.EndRenderPass();
		});
}


//////////////////////////////////////////////////////////////////////////
// FSpriterImporterModule

#if WITH_EDITOR
void FUniGLBRenderModule::OnMapChange(UWorld* World, EMapChangeType ChangeType) {
	if (ChangeType == EMapChangeType::TearDownWorld)
	{
		CaptureList.Empty();
	}
}

void FUniGLBRenderModule::OnPIEEvent(bool bPIEBegin, bool bPIEEnd) {
	bIsPlay = bPIEBegin;
}
#endif


void FUniGLBRenderModule::StartupModule(){
	FString PluginShaderDir = FPaths::Combine(IPluginManager::Get().FindPlugin(TEXT("UniGLB"))->GetBaseDir(), TEXT("Shaders"));

	AddShaderSourceDirectoryMapping(TEXT("/UniGLBShaders"), PluginShaderDir);

	GetRendererModule().RegisterPostOpaqueRenderDelegate(FPostOpaqueRenderDelegate::CreateRaw(this, &FUniGLBRenderModule::OnPostOpaque));
	GetRendererModule().RegisterOverlayRenderDelegate(FPostOpaqueRenderDelegate::CreateRaw(this, &FUniGLBRenderModule::OnOverlay));

#if WITH_EDITOR
#else
	bIsPlay = true;
#endif
}

void FUniGLBRenderModule::ShutdownModule(){
}

void FUniGLBRenderModule::OnPostOpaque(FPostOpaqueRenderParameters& Parameters) {

	if (CaptureList.Num() == 0) return;

	if (isCaptureTarget(reinterpret_cast<const FSceneView*>(Parameters.View)) == false) {
		return;
	}

	{
		TArray<TObjectPtr<UTextureRenderTarget2D>> keys;
		CaptureList.GetKeys(keys);
		for (auto k : keys) {
			if (IsValid(k) == false) {
				CaptureList.Remove(k);
				continue;
			}
			if (k->GetRenderTargetResource() == nullptr) {
				CaptureList.Remove(k);
				continue;
			}
			if (k->GetRenderTargetResource()->GetTexture2DRHI() == nullptr) {
				CaptureList.Remove(k);
				continue;
			}
		}
	}

	FRDGTextureRef DstRDGTex = nullptr;
	FRDGTextureRef SrcRDGTex = nullptr;

	for (auto c : CaptureList) {
		if (c.Key == nullptr) {
			continue;
		}
		if (c.Key->GetRenderTargetResource() == nullptr) {
			continue;
		}

		DstRDGTex = RegisterExternalTexture(*(Parameters.GraphBuilder), c.Key->GetRenderTargetResource()->GetTexture2DRHI(), TEXT("UniGLB_CopyDst"));
		switch (c.Value) {
		case EUniGLB_CaptureSource::ColorTexturePostOpaque:
			SrcRDGTex = Parameters.ColorTexture;
			break;
		case EUniGLB_CaptureSource::DepthTexture:
			SrcRDGTex = Parameters.DepthTexture;
			break;
		case EUniGLB_CaptureSource::NormalTexture:
			SrcRDGTex = Parameters.NormalTexture;
			break;
		case EUniGLB_CaptureSource::VelocityTexture:
			SrcRDGTex = Parameters.VelocityTexture;
			break;
			//case EUniGLB_CaptureSource::SmallDepthTexture:
			//	SrcRDGTex = Parameters.SmallDepthTexture;
			//	break;
		default:
			break;
		}

		if (SrcRDGTex == nullptr && Parameters.SceneTexturesUniformParams == nullptr) continue;
		switch (c.Value) {
		case EUniGLB_CaptureSource::SceneColorTexturePostOpaque:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->SceneColorTexture;
			break;
		case EUniGLB_CaptureSource::SceneDepthTexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->SceneDepthTexture;
			break;
			//case EUniGLB_CaptureSource::ScenePartialDepthTexture:
			//	SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->ScenePartialDepthTexture;
			//	break;

				// GBuffer
		case EUniGLB_CaptureSource::GBufferATexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->GBufferATexture;
			break;
		case EUniGLB_CaptureSource::GBufferBTexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->GBufferBTexture;
			break;
		case EUniGLB_CaptureSource::GBufferCTexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->GBufferCTexture;
			break;
		case EUniGLB_CaptureSource::GBufferDTexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->GBufferDTexture;
			break;
		case EUniGLB_CaptureSource::GBufferETexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->GBufferETexture;
			break;
		case EUniGLB_CaptureSource::GBufferFTexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->GBufferFTexture;
			break;
		case EUniGLB_CaptureSource::GBufferVelocityTexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->GBufferVelocityTexture;
			break;
		case EUniGLB_CaptureSource::ScreenSpaceAOTexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->ScreenSpaceAOTexture;
			break;
		case EUniGLB_CaptureSource::CustomDepthTexture:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->CustomDepthTexture;
			break;
		default:
			break;
		}

		if (DstRDGTex && SrcRDGTex) {
			/*
			FScreenPassRenderTarget DstTex(DstRDGTex, ERenderTargetLoadAction::EClear);
			FScreenPassTexture SrcTex(SrcRDGTex);

			AddDrawTexturePass(
				*(Parameters.GraphBuilder),
				*Parameters.View,
				SrcTex,
				DstTex
			);
			*/
			FUniGLBRenderModule::AddCopyPass(*Parameters.GraphBuilder, FIntPoint(Parameters.ViewportRect.Width(), Parameters.ViewportRect.Height()), SrcRDGTex, c.Key);
		}
	}
}
void FUniGLBRenderModule::OnOverlay(FPostOpaqueRenderParameters& Parameters) {
	if (CaptureList.Num() == 0) return;

	if (isCaptureTarget(reinterpret_cast<const FSceneView*>(Parameters.View)) == false) {
		return;
	}

	for (auto c : CaptureList) {
		if (c.Key == nullptr) {
			continue;
		}
		if (c.Key->GetRenderTargetResource() == nullptr) {
			continue;
		}

		FRDGTextureRef DstRDGTex = nullptr;
		FRDGTextureRef SrcRDGTex = nullptr;

		DstRDGTex = RegisterExternalTexture(*(Parameters.GraphBuilder), c.Key->GetRenderTargetResource()->GetTexture2DRHI(), TEXT("UniGLB_CopyDst"));
		switch (c.Value) {
		case EUniGLB_CaptureSource::ColorTextureOverlay:
			SrcRDGTex = Parameters.ColorTexture;
			break;
		default:
			break;
		}

		if (SrcRDGTex == nullptr && Parameters.SceneTexturesUniformParams == nullptr) continue;
		switch (c.Value) {
		case EUniGLB_CaptureSource::SceneColorTextureOverlay:
			SrcRDGTex = Parameters.SceneTexturesUniformParams->GetParameters()->SceneColorTexture;
			break;
		default:
			break;
		}

		if (DstRDGTex && SrcRDGTex) {
			/*
			FScreenPassRenderTarget DstTex(DstRDGTex, ERenderTargetLoadAction::EClear);
			FScreenPassTexture SrcTex(SrcRDGTex);
			AddDrawTexturePass(
				*(Parameters.GraphBuilder),
				*Parameters.View,
				SrcTex,
				DstTex);
			*/

			FUniGLBRenderModule::AddCopyPass(*Parameters.GraphBuilder, FIntPoint(Parameters.ViewportRect.Width(), Parameters.ViewportRect.Height()), SrcRDGTex, c.Key);
		}
	}
}


//////////////////////////////////////////////////////////////////////////

IMPLEMENT_MODULE(FUniGLBRenderModule, UniGLBRender);

//////////////////////////////////////////////////////////////////////////

#undef LOCTEXT_NAMESPACE
