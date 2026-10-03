// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_CameraCheckComponent.h"

#if WITH_EDITOR
#include "Editor.h"
#include "EditorViewportClient.h"
#include "LevelEditorViewport.h"
#endif




UUniGLBCameraCheckComponent::UUniGLBCameraCheckComponent(const FObjectInitializer& ObjectInitializer)
	:Super(ObjectInitializer)
{
}

void UUniGLBCameraCheckComponent::OnRegister() {
	Super::OnRegister();
	SetCameraCheck(true);
}
void UUniGLBCameraCheckComponent::OnUnregister() {
	SetCameraCheck(false);
	Super::OnUnregister();
}

#if WITH_EDITOR
void UUniGLBCameraCheckComponent::OnCameraTransformChanged(const FVector&, const FRotator&, ELevelViewportType, int32) {
	OnCameraMove.Broadcast();
}
#endif

void UUniGLBCameraCheckComponent::SetCameraCheck(bool bCheckOn) {
#if WITH_EDITOR
	if (bCheckOn) {
		if (handle.IsValid()) {
			FEditorDelegates::OnEditorCameraMoved.Remove(handle);
		}
		handle = FEditorDelegates::OnEditorCameraMoved.AddUObject(this, &UUniGLBCameraCheckComponent::OnCameraTransformChanged);
	} else {
		if (handle.IsValid()) {
			FEditorDelegates::OnEditorCameraMoved.Remove(handle);
			handle.Reset();
		}
	}
#endif
}

