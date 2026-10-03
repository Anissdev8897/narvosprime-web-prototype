// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/EngineSubsystem.h"
#include "Misc/EngineVersionComparison.h"
#include "UniGLB_SceneViewExtension.h"
#include "UniGLB_ExtensionRimFilterData.h"
#include "UniGLBRender.h"

#if WITH_EDITOR
#include "UnrealEdMisc.h"
#endif

#include "UniGLB_RenderSubsystem.generated.h"



// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(4, 22, 0)] all below target floor (5, 7, 0)).


UCLASS()
class UNIGLBRENDER_API UUniGLB_RenderSubsystem : public UEngineSubsystem
{

	GENERATED_BODY()

	FDelegateHandle HandleTearDown;
	bool bInitPIE = false;

public:

	//// rim filter
	FCriticalSection cs_rim;

	TArray< TWeakObjectPtr<class UUniGLBExtensionRimFilterData> > RimFilterData;

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void AddRimFilterData(class UUniGLBExtensionRimFilterData *FilterData);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void RemoveRimFilterData(class UUniGLBExtensionRimFilterData* FilterData);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void RemoveRimFilterDataByPriority(int Priotiry = -1);

	TArray<struct UUniGLBExtensionRimFilterData::FFilterData> GenerateFilterData();

	////

	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	void RenderPre(FRDGBuilder& GraphBuilder);
	void RenderPost(FRDGBuilder& GraphBuilder);

	void OnPostOpaque(FPostOpaqueRenderParameters& Parameters);
	void OnOverlay(FPostOpaqueRenderParameters& Parameters);
	void OnResolvedSceneColor_RenderThread(FRDGBuilder& GraphBuilder, const FSceneTextures& SceneTextures);

#if WITH_EDITOR
	void OnMapChange(UWorld* World, EMapChangeType ChangeType);

	void OnPIEEvent(bool bPIEBegin, bool bPIEEnd);
#endif

	// keep class
	TSharedPtr<class FUniGLBSceneViewExtension, ESPMode::ThreadSafe> SceneViewExtension;

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void AddCaptureTexture(UTextureRenderTarget2D *Texture, EUniGLB_CaptureSource CaptureSource = EUniGLB_CaptureSource::ColorTextureOverlay);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void RemoveCaptureTexture(UTextureRenderTarget2D* Texture);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void RemoveAllCaptureTexture();

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void ResetSceneTextureExtentHistory();

	//
	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	void SetViewExtension(bool bEnable);
};
