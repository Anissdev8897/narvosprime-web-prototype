// Fill out your copyright notice in the Description page of Project Settings.


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
// Genuinely required here (unlike UniGLBRender.cpp / UniGLBSceneViewExtension.cpp, from which the same
// private include was removed as dead weight): OnResolvedSceneColor_RenderThread takes a
// `const FSceneTextures&` by value/reference, and FSceneTextures is declared in this PRIVATE Renderer
// header, not in any public one. This is the actual "first motif de casse a chaque montee moteur"
// (Renderer/Private is not part of UE's public API contract and can move/rename between versions);
// removing it would require dropping OnResolvedSceneColor_RenderThread's FSceneTextures parameter
// (a public UCLASS-header signature change) which is out of scope for this pass without a build to verify.
#include "Runtime/Renderer/Private/SceneRendering.h"
#include "SceneRenderTargetParameters.h"
#include "Slate/SceneViewport.h"
#include "ScreenRendering.h"
// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(5, 4, 0)] all below target floor (5, 7, 0)).


#if WITH_EDITOR
#include "LevelEditor.h"
#endif

void UUniGLB_RenderSubsystem::Initialize(FSubsystemCollectionBase& Collection) {
	Super::Initialize(Collection);

	// generate
	SceneViewExtension = FSceneViewExtensions::NewExtension<FUniGLBSceneViewExtension>();
}

void UUniGLB_RenderSubsystem::Deinitialize() {

	{
		FScopeLock lock(&cs_rim);
		RimFilterData.Empty();
	}
	Super::Deinitialize();
}

void UUniGLB_RenderSubsystem::OnResolvedSceneColor_RenderThread(FRDGBuilder& GraphBuilder, const FSceneTextures& SceneTextures) {
}


#if WITH_EDITOR
void UUniGLB_RenderSubsystem::OnMapChange(UWorld* World, EMapChangeType ChangeType) {
	FUniGLBRenderModule* m = FModuleManager::GetModulePtr<FUniGLBRenderModule>("UniGLBRender");
	if (m != nullptr) {
		m->OnMapChange(World, ChangeType);
	}
}

void UUniGLB_RenderSubsystem::OnPIEEvent(bool bPIEBegin, bool bPIEEnd) {
	FUniGLBRenderModule* m = FModuleManager::GetModulePtr<FUniGLBRenderModule>("UniGLBRender");
	if (m != nullptr) {
		m->OnPIEEvent(bPIEBegin, bPIEEnd);
	}
}
#endif


void UUniGLB_RenderSubsystem::RenderPre(FRDGBuilder& GraphBuilder) {
}
void UUniGLB_RenderSubsystem::RenderPost(FRDGBuilder& GraphBuilder) {
}

void UUniGLB_RenderSubsystem::AddCaptureTexture(UTextureRenderTarget2D* Texture, EUniGLB_CaptureSource CaptureSource) {
	if (Texture == nullptr) return;

	FUniGLBRenderModule* m = FModuleManager::GetModulePtr<FUniGLBRenderModule>("UniGLBRender");
	if (m != nullptr){
		m->CaptureList.FindOrAdd(Texture) = CaptureSource;
	}


#if WITH_EDITOR
	if (HandleTearDown.IsValid() == false){
		if (FModuleManager::Get().IsModuleLoaded("LevelEditor"))
		{
			FLevelEditorModule& LevelEditor = FModuleManager::GetModuleChecked<FLevelEditorModule>("LevelEditor");

				
			HandleTearDown = LevelEditor.OnMapChanged().AddUObject(this, &UUniGLB_RenderSubsystem::OnMapChange);
					/*
				HandleTearDown = LevelEditor.OnMapChanged().AddLambda([&](UWorld* World, EMapChangeType ChangeType)
				{
					if (ChangeType == EMapChangeType::TearDownWorld)
					{
						CaptureList.Empty();
					}
				});
				*/
		}
	}

	if (bInitPIE == false) {
		bInitPIE = true;
		FEditorDelegates::BeginPIE.AddLambda([&](const bool bIsSimulating) {
			this->OnPIEEvent(true, false);
			});
		FEditorDelegates::EndPIE.AddLambda([&](const bool bIsSimulating) {
			this->OnPIEEvent(false, true);
			});
	}
#endif
}

void UUniGLB_RenderSubsystem::RemoveCaptureTexture(UTextureRenderTarget2D* Texture) {
	FUniGLBRenderModule* m = FModuleManager::GetModulePtr<FUniGLBRenderModule>("UniGLBRender");
	if (m != nullptr) {
		m->CaptureList.Remove(Texture);
	}
}

void UUniGLB_RenderSubsystem::RemoveAllCaptureTexture() {
	FUniGLBRenderModule* m = FModuleManager::GetModulePtr<FUniGLBRenderModule>("UniGLBRender");
	if (m != nullptr) {
		m->CaptureList.Empty();
	}
}


void UUniGLB_RenderSubsystem::ResetSceneTextureExtentHistory() {
	::ResetSceneTextureExtentHistory();
}

void UUniGLB_RenderSubsystem::SetViewExtension(bool bEnable) {
}

void UUniGLB_RenderSubsystem::AddRimFilterData(class UUniGLBExtensionRimFilterData* FilterData) {
	FScopeLock lock(&cs_rim);
	RimFilterData.AddUnique(FilterData);
}

void UUniGLB_RenderSubsystem::RemoveRimFilterData(class UUniGLBExtensionRimFilterData* FilterData) {
	FScopeLock lock(&cs_rim);
	RimFilterData.Remove(FilterData);
}

void UUniGLB_RenderSubsystem::RemoveRimFilterDataByPriority(int Priority) {
	FScopeLock lock(&cs_rim);
	if (Priority < 0) {
		RimFilterData.Empty();
		return;
	}
	RimFilterData.RemoveAll([&Priority](const TWeakObjectPtr<UUniGLBExtensionRimFilterData>& Item) {
		if (Item.IsValid() == false) return true;
		return Item->Priority == Priority;
		});
}

TArray<UUniGLBExtensionRimFilterData::FFilterData> UUniGLB_RenderSubsystem::GenerateFilterData() {
	FScopeLock lock(&cs_rim);

	RimFilterData.RemoveAll([](const TWeakObjectPtr<UUniGLBExtensionRimFilterData>& Item) {
		return !Item.IsValid();
		});

	RimFilterData.Sort([](const TWeakObjectPtr<UUniGLBExtensionRimFilterData>& A, const TWeakObjectPtr<UUniGLBExtensionRimFilterData>& B)
		{
			return A->Priority < B->Priority;
		});

	TArray<UUniGLBExtensionRimFilterData::FFilterData> f;
	for (auto& a : RimFilterData) {
		auto d = a->GetFilterData();
		if (d.bUseFilter == false) continue;
		f.Add(MoveTemp(d));
	}
	return MoveTemp(f);
}


