// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_SceneCaptureComponent.h"
#include "SceneViewExtension.h"
#include "Runtime/Engine/Public/SceneView.h"
#include "Engine/TextureRenderTarget2D.h"
#include "ScreenPass.h"
#include "Kismet/GameplayStatics.h"

#include "UniGLBRender.h"
#include "UniGLB_BPFunctionLibrary.h"
#include "Misc/EngineVersionComparison.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "PostProcess/PostProcessMaterialInputs.h"



class FUniGLBSceneCaptureSceneViewExtension : public ISceneViewExtension, public TSharedFromThis<FUniGLBSceneCaptureSceneViewExtension, ESPMode::ThreadSafe>
{
public:
	FUniGLBSceneCaptureSceneViewExtension(const FAutoRegister& AutoRegister)
	{ }

	virtual ~FUniGLBSceneCaptureSceneViewExtension() = default;

	virtual void BeginRenderViewFamily(FSceneViewFamily& InViewFamily) override {};

	virtual void SetupViewFamily(FSceneViewFamily& InViewFamily) override {};
	virtual void SetupView(FSceneViewFamily& InViewFamily, FSceneView& InView) override
	{
	}

	virtual void PostRenderBasePassDeferred_RenderThread(FRDGBuilder& GraphBuilder, FSceneView& InView, const FRenderTargetBindingSlots& RenderTargets, TRDGUniformBufferRef<FSceneTextureUniformParameters> SceneTextures)
	{
		if (InView.bIsSceneCapture == false) return;
		FRDGTextureRef DstRDGTex = nullptr;
		FRDGTextureRef SrcRDGTex = nullptr;


		if (CaptureComponentWeak.IsValid() == false) return;
		if (CaptureComponentWeak->RenderTargetA == nullptr) return;
		if (CaptureComponentWeak->RenderTargetB == nullptr) return;

		//DstRDGTex = RegisterExternalTexture(GraphBuilder, CaptureComponentWeak->RenderTargetA->GetRenderTargetResource()->GetTexture2DRHI(), TEXT("UniGLB_CopyDst"));
		for (auto &a : RenderTargets.Output) {
			if (a.GetTexture() == nullptr) continue;
			FString s = a.GetTexture()->Name;
			if (s.Contains("BufferC")) {
				SrcRDGTex = a.GetTexture();
			}
		}
		if (SrcRDGTex) {
			FUniGLBRenderModule::AddCopyPass(GraphBuilder, FIntPoint(InView.UnscaledViewRect.Width(), InView.UnscaledViewRect.Height()), SrcRDGTex, CaptureComponentWeak->RenderTargetA);
		}

		SrcRDGTex = nullptr;
		//DstRDGTex = RegisterExternalTexture(GraphBuilder, CaptureComponentWeak->RenderTargetA->GetRenderTargetResource()->GetTexture2DRHI(), TEXT("UniGLB_CopyDst"));
		for (auto& a : RenderTargets.Output) {
			if (a.GetTexture() == nullptr) continue;
			FString s = a.GetTexture()->Name;
			if (s.Contains("BufferA")) {
				SrcRDGTex = a.GetTexture();
			}
		}

		if (SrcRDGTex) {
			FUniGLBRenderModule::AddCopyPass(GraphBuilder, FIntPoint(InView.UnscaledViewRect.Width(), InView.UnscaledViewRect.Height()), SrcRDGTex, CaptureComponentWeak->RenderTargetB);
		}

	}

	virtual void SubscribeToPostProcessingPass(EPostProcessingPass PassId, const FSceneView& View, FAfterPassCallbackDelegateArray& InOutPassCallbacks, bool bIsPassEnabled)
	{
		if (PassId == EPostProcessingPass::Tonemap)
		{
			//InOutPassCallbacks.Add(FAfterPassCallbackDelegate::CreateRaw(this, &FUniGLBSceneCaptureSceneViewExtension::PostProcessPassAfterTonemap_RenderThread));
		}
	}

	FScreenPassTexture PostProcessPassAfterTonemap_RenderThread(FRDGBuilder& GraphBuilder, const FSceneView& InView, const FPostProcessMaterialInputs& InOutInputs)
	{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
		return InOutInputs.ReturnUntouchedSceneColorForPostProcessing(GraphBuilder);
	}

public:
	TWeakObjectPtr<UUniGLBSceneCaptureComponent2D> CaptureComponentWeak;
};


UUniGLBSceneCaptureComponent2D::UUniGLBSceneCaptureComponent2D(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
}

void UUniGLBSceneCaptureComponent2D::OnRegister()
{
	Super::OnRegister();
#if WITH_EDITORONLY_DATA
	if (ProxyMeshComponent)
	{
		ProxyMeshComponent->DestroyComponent();
		ProxyMeshComponent = nullptr;
	}
#endif
	if (!SceneViewExtension.IsValid())
	{
		SceneViewExtension = FSceneViewExtensions::NewExtension<FUniGLBSceneCaptureSceneViewExtension>();
		SceneViewExtension->CaptureComponentWeak = this;
	}
}

void UUniGLBSceneCaptureComponent2D::OnUnregister()
{
	Super::OnUnregister();

	if (SceneViewExtension.IsValid())
	{
		SceneViewExtensions.Remove(SceneViewExtension);
		SceneViewExtension.Reset();
	}

	//CineCameraComponent = nullptr;
}

void UUniGLBSceneCaptureComponent2D::OnAttachmentChanged()
{
}

void UUniGLBSceneCaptureComponent2D::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	FTransform transform;
	float fovDegree;
	UUniGLBBPFunctionLibrary::UniGLBGetCameraTransform(this, 0, false, transform, fovDegree);

	float fov = fovDegree;

	{
		bool b1, b2, b3;
		UUniGLBBPFunctionLibrary::UniGLBGetPlayMode(b1, b2, b3);
		if (b1 == true && b2 == false) {
			auto* c = UGameplayStatics::GetPlayerCameraManager(this, 0);
		
			float ar_current = (float)RenderTargetA->SizeX / RenderTargetA->SizeY;
			float HalfX_game = FMath::DegreesToRadians(fovDegree / 2);

			float HalfY = FMath::Atan(FMath::Tan(HalfX_game) / c->ViewTarget.POV.AspectRatio);
			float HalfX_new = FMath::Atan(ar_current * FMath::Tan(HalfY));
			fov = 2.f * FMath::RadiansToDegrees(HalfX_new);
		}
	}

	this->FOVAngle = fov;

}

