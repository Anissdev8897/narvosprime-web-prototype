// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_BoneCheckComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Misc/EngineVersionComparison.h"

#if WITH_EDITOR
#include "Editor.h"
#include "EditorViewportClient.h"
#include "LevelEditorViewport.h"
#endif




UUniGLBBoneCheckComponent::UUniGLBBoneCheckComponent(const FObjectInitializer& ObjectInitializer)
	:Super(ObjectInitializer)
{

}

void UUniGLBBoneCheckComponent::OnRegister() {
	Super::OnRegister();

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.

	USkeletalMeshComponent* skc = Cast<USkeletalMeshComponent>(this->GetAttachParent());
	if (skc == nullptr) return;

	//USkeletalMeshComponent* c;
	//c->RegisterOnBoneTransformsFinalizedDelegate
	skc->RegisterOnBoneTransformsFinalizedDelegate(
	FOnBoneTransformsFinalizedMultiCast::FDelegate::CreateUObject(this, &UUniGLBBoneCheckComponent::OnTargetTransformUpdate));
}
void UUniGLBBoneCheckComponent::OnUnregister() {
	Super::OnUnregister();
}

void UUniGLBBoneCheckComponent::OnTargetTransformUpdate() {
	OnBoneTransform.Broadcast();
}

