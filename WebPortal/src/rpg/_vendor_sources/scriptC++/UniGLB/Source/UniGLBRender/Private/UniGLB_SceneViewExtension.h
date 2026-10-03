// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Misc/EngineVersionComparison.h"
#include "SceneViewExtension.h"


class FUniGLBSceneViewExtension : public FSceneViewExtensionBase
{
	enum ECapturePass{
		PreTonemap,
		PostTonemap,
		LastPass,
	};
public:

	FUniGLBSceneViewExtension(const FAutoRegister& AutoRegister);

	virtual void SetupViewFamily(FSceneViewFamily& InViewFamily) override {}
	virtual void SetupView(FSceneViewFamily& InViewFamily, FSceneView& InView) override {}
	virtual void BeginRenderViewFamily(FSceneViewFamily& InViewFamily) override {}
	virtual void PreRenderViewFamily_RenderThread(FRDGBuilder& RHICmdList, FSceneViewFamily& InViewFamily) override {}

	virtual void PreRenderView_RenderThread(FRDGBuilder& RHICmdList, FSceneView& InView) override {}
	virtual void PreInitViews_RenderThread(FRDGBuilder& GraphBuilder) override {}

	virtual void PostRenderBasePassDeferred_RenderThread(FRDGBuilder& GraphBuilder, FSceneView& InView, const FRenderTargetBindingSlots& RenderTargets, TRDGUniformBufferRef<FSceneTextureUniformParameters> SceneTextures) override;
	//virtual void PostRenderBasePassMobile_RenderThread(FRHICommandList& RHICmdList, FSceneView& InView) override {};

	virtual void PrePostProcessPass_RenderThread(FRDGBuilder& GraphBuilder, const FSceneView& View, const FPostProcessingInputs& Inputs) override;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
	virtual void SubscribeToPostProcessingPass(EPostProcessingPass Pass, const FSceneView& InView, FPostProcessingPassDelegateArray& InOutPassCallbacks, bool bIsPassEnabled);

	//virtual void PostRenderViewFamily_RenderThread(FRDGBuilder& GraphBuilder, FSceneViewFamily& InViewFamily) override {}
	//virtual void PostRenderView_RenderThread(FRDGBuilder& GraphBuilder, FSceneView& InView) override;


	virtual int32 GetPriority() const override { return 100; }
	virtual bool IsActiveThisFrame_Internal(const FSceneViewExtensionContext& Context) const override;

	FScreenPassTexture PreTonemap_RenderThread(FRDGBuilder& GraphBuilder, const FSceneView& View, const FPostProcessMaterialInputs& InOutInputs);
	FScreenPassTexture AfterTonemap_RenderThread(FRDGBuilder& GraphBuilder, const FSceneView& View, const FPostProcessMaterialInputs& InOutInputs);
	FScreenPassTexture LastPass_RenderThread(FRDGBuilder& GraphBuilder, const FSceneView& View, const FPostProcessMaterialInputs& InOutInputs);

	FScreenPassTexture Pass_RenderThread(FRDGBuilder& GraphBuilder, const FSceneView& View, const FPostProcessMaterialInputs& InOutInputs, ECapturePass Pass);
};
