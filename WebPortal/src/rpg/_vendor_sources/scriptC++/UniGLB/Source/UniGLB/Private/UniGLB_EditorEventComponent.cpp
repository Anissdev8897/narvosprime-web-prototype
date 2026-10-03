// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_EditorEventComponent.h"
#include "Misc/EngineVersionComparison.h"

// WITH_UNIGLB_SEQUENCER is defined by UniGLB.Build.cs, set to 1 only when LevelSequence /
// LevelSequenceEditor / Sequencer modules are actually present (LevelSequenceEditor is
// "Optional" in UniGLB.uplugin, so a client project may disable it).
#if WITH_EDITOR && WITH_UNIGLB_SEQUENCER
#include "Editor.h"
#include "EditorViewportClient.h"
#include "LevelEditorViewport.h"
#include "Engine/Selection.h"

#include "ILevelSequenceEditorToolkit.h"
#include "LevelSequenceEditorBlueprintLibrary.h"
#include "MovieSceneSequencePlayer.h"
#include "LevelSequence.h"
#include "ISequencer.h"
#elif WITH_EDITOR
#include "Editor.h"
#include "EditorViewportClient.h"
#include "LevelEditorViewport.h"
#include "Engine/Selection.h"
#endif




UUniGLBEditorEventComponent::UUniGLBEditorEventComponent(const FObjectInitializer& ObjectInitializer)
	:Super(ObjectInitializer)
{
}

void UUniGLBEditorEventComponent::OnRegister() {
	Super::OnRegister();
}
void UUniGLBEditorEventComponent::OnUnregister() {
	Super::OnUnregister();
}

void UUniGLBEditorEventComponent::OnSelectionChangeFunc(UObject *obj) {
#if WITH_EDITOR
	if (GEditor == nullptr) return;
	bool bFound = false;
	USelection* Selection = Cast<USelection>(obj);
	if (Selection == GEditor->GetSelectedComponents() || Selection == GEditor->GetSelectedActors()){
		for (int32 Idx = 0; Idx < Selection->Num(); Idx++)
		{
			const auto *a = Selection->GetSelectedObject(Idx);
			if (a == this->GetOwner()) {
				bFound = true;
				break;
			}
		}
		if (bFound && Selection->Num() == 1) {
			OnSelectionChange.Broadcast(false);
		}
	}
#endif
}
void UUniGLBEditorEventComponent::OnSelectionObjectFunc(UObject *obj) {
#if WITH_EDITOR
	if (GEditor == nullptr) return;
	bool bFound = false;
	USelection* Selection = Cast<USelection>(obj);
	if (Selection == GEditor->GetSelectedComponents() || Selection == GEditor->GetSelectedActors()) {

		for (int32 Idx = 0; Idx < Selection->Num(); Idx++)
		{
			if (Selection->GetSelectedObject(Idx) == this->GetOwner()) {
				bFound = true;
				break;
			}
		}
	}
	if (bFound) {
		OnSelectionObject.Broadcast(false);
	}
#endif
}

void UUniGLBEditorEventComponent::SetSelectCheck(bool bCheckOn) {
#if WITH_EDITOR
	USelection::SelectionChangedEvent.AddUObject(this, &UUniGLBEditorEventComponent::OnSelectionChangeFunc);
	USelection::SelectObjectEvent.AddUObject(this, &UUniGLBEditorEventComponent::OnSelectionObjectFunc);
	//SelectObjectEvent
	if (bCheckOn) {
		//GEditor->OnEndCameraMovement.Assign(OnCameraMove)
		//if (GEditor->GetActiveViewport()) {
		//	FEditorViewportClient* ViewportClient = StaticCast<FEditorViewportClient*>(GEditor->GetActiveViewport()->GetClient());
		//	if (ViewportClient) {
		//		ViewportClient->SetActorLock(this->GetOwner());
		//	}
		//}
		//GCurrentLevelEditingViewportClient->SetActorLock(this->GetOwner());
		//GEditor->OnEndCameraMovement().AddUObject(this, &UUniGLBCameraCheckComponent::OnCameraTransformChanged);
		//GEditor->OnBeginCameraMovement().AddUObject(this, &UUniGLBCameraCheckComponent::OnCameraTransformChanged);
		//handle = FEditorDelegates::OnEditorCameraMoved.AddUObject(this, &UUniGLBCameraCheckComponent::OnCameraTransformChanged);
	} else {
		//if (handle.IsValid()) {
			//FEditorDelegates::OnEditorCameraMoved.Remove(handle);
	//	}
		//GEditor->OnEndCameraMovement().Remove
	}
	//FOnEndTransformCamera& () { return OnEndCameraTransformEvent; }
#endif
}

void UUniGLBEditorEventComponent::OnGlobalTimeChangeFunc() {
#if WITH_EDITOR && WITH_UNIGLB_SEQUENCER
	auto mm = ULevelSequenceEditorBlueprintLibrary::GetGlobalPosition();
	int32 t = mm.Timecode.Frames;
	OnGlobalTimeChange.Broadcast((float)t);
#endif
}


void UUniGLBEditorEventComponent::SetGlobalTimeCheck(bool bCheckOn) {
#if WITH_EDITOR && WITH_UNIGLB_SEQUENCER
	{
		if (GEditor == nullptr) return;
		auto *LevelSeq = ULevelSequenceEditorBlueprintLibrary::GetCurrentLevelSequence();
		if (LevelSeq == nullptr) return;

		IAssetEditorInstance* AssetEditor = GEditor->GetEditorSubsystem<UAssetEditorSubsystem>()->FindEditorForAsset(LevelSeq, false);
		if (AssetEditor == nullptr) return;

		ILevelSequenceEditorToolkit* LevelSequenceEditor = static_cast<ILevelSequenceEditorToolkit*>(AssetEditor);

		if (LevelSequenceEditor == nullptr){
			return;
		}
		TWeakPtr<ISequencer> seq = LevelSequenceEditor->GetSequencer();

		if (seq.IsValid()) {
			seq.Pin()->OnGlobalTimeChanged().AddUObject(this, &UUniGLBEditorEventComponent::OnGlobalTimeChangeFunc);
		}
	}
#endif
}



void UUniGLBEditorEventComponent::OnPIEEventFunc(EUniGLB_PIEEvent e) {
#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
	OnPIEEvent.Broadcast(e);
#endif
}

void UUniGLBEditorEventComponent::OnBeginPIE(const bool bIsSimulating) {
	OnPIEEventFunc(EUniGLB_PIEEvent::BeginPIE);
}
void UUniGLBEditorEventComponent::OnEndPIE(const bool bIsSimulating) {
	OnPIEEventFunc(EUniGLB_PIEEvent::EndPIE);
}


void UUniGLBEditorEventComponent::SetPIEEventCheck(bool bCheckOn) {
#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
	{
		FEditorDelegates::BeginPIE.AddUObject(this, &UUniGLBEditorEventComponent::OnBeginPIE);
		FEditorDelegates::EndPIE.AddUObject(this, &UUniGLBEditorEventComponent::OnEndPIE);

	}
#endif
}

