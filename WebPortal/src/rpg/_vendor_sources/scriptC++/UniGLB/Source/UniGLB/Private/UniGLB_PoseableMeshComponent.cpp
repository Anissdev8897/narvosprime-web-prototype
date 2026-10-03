// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_PoseableMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "UniGLB_AnimInstance.h"
#include "UniGLB_Util.h"




UUniGLBPoseableMeshComponent::UUniGLBPoseableMeshComponent(const FObjectInitializer& ObjectInitializer)
	:Super(ObjectInitializer)
{
	PrimaryComponentTick.bCanEverTick = true;

	// for morph curve copy
	bTickInEditor = true;
}

void UUniGLBPoseableMeshComponent::OnRegister() {
	Super::OnRegister();

	if (bUseDefaultMaterial) {
		this->OverrideMaterials.Empty();
	}
	Init();
	UpdateLeader();
}

#if WITH_EDITOR
void UUniGLBPoseableMeshComponent::PostEditChangeProperty(struct FPropertyChangedEvent& PropertyChangedEvent) {
	Super::PostEditChangeProperty(PropertyChangedEvent);
	UpdateLeader();
}
void UUniGLBPoseableMeshComponent::PostEditChangeChainProperty(struct FPropertyChangedChainEvent& PropertyChangedEvent) {
	Super::PostEditChangeChainProperty(PropertyChangedEvent);
}
#endif

void UUniGLBPoseableMeshComponent::OnAttachmentChanged() {
	Super::OnAttachmentChanged();
}

void UUniGLBPoseableMeshComponent::InitializeComponent() {
	Super::InitializeComponent();
}

void UUniGLBPoseableMeshComponent::UpdateLeader() {

	if (bUseParentAsLeader) {
		USkinnedMeshComponent* skin = Cast<USkinnedMeshComponent>(this->GetAttachParent());
		USkeletalMeshComponent* skel = Cast<USkeletalMeshComponent>(skin);
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
		SetLeaderPoseComponent(skin);
		UniGLBCopyPoseAndMorphFromSkeletalComponent(skel);
	}
}

void UUniGLBPoseableMeshComponent::TickComponent(float DeltaTime, enum ELevelTick TickType, FActorComponentTickFunction *ThisTickFunction) {
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	USkinnedMeshComponent* MPCPtr = LeaderPoseComponent.Get();

	if (MPCPtr) {
		MorphTargetWeights = MPCPtr->MorphTargetWeights;
		ActiveMorphTargets = MPCPtr->ActiveMorphTargets;
	}
}

void UUniGLBPoseableMeshComponent::UniGLBCopyPoseAndMorphFromSkeletalComponent(USkeletalMeshComponent* InComponentToCopy) {
	if (InComponentToCopy && UniGLBGetSkinnedAsset(InComponentToCopy)) {
		Super::CopyPoseFromSkeletalComponent(InComponentToCopy);

		MorphTargetWeights = InComponentToCopy->MorphTargetWeights;
		ActiveMorphTargets = InComponentToCopy->ActiveMorphTargets;
	}
}

void UUniGLBPoseableMeshComponent::RefreshBoneTransforms(FActorComponentTickFunction* TickFunction)
{
	Super::RefreshBoneTransforms(TickFunction);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	USkinnedMeshComponent* MPCPtr = LeaderPoseComponent.Get();
	if (MPCPtr) {
		MorphTargetWeights = MPCPtr->MorphTargetWeights;
		ActiveMorphTargets = MPCPtr->ActiveMorphTargets;
	}
}
