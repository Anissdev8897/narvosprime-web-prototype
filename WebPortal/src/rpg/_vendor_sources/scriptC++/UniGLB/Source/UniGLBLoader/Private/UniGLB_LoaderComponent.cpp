// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.
// ApplicationLifecycleComponent.cpp: Component to handle receiving notifications from the OS about application state (activated, suspended, termination, etc)


#include "UniGLB_LoaderComponent.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLB_LoaderBPFunctionLibrary.h"

#include "Misc/CoreDelegates.h"


UUniGLBLoaderComponent::UUniGLBLoaderComponent(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
}

void UUniGLBLoaderComponent::OnRegister()
{
	Super::OnRegister();
}

void UUniGLBLoaderComponent::OnUnregister()
{
	Super::OnUnregister();
}

bool UUniGLBLoaderComponent::LoadVRMFile(const UUniGLBAssetListObject *InUniGLBAsset, UUniGLBAssetListObject *&OutUniGLBAsset, FString filepath) {
	return UUniGLBLoaderBPFunctionLibrary::LoadVRMFileLocal(InUniGLBAsset, OutUniGLBAsset, filepath);
}

bool UUniGLBLoaderComponent::LoadVRMFileAsync(const UUniGLBAssetListObject *InUniGLBAsset, FString filepath) {

	UUniGLBLoaderBPFunctionLibrary::LoadVRMFileLocal(InUniGLBAsset, AssetList, filepath);
	bResultQueue = true;
	return true;
}

void UUniGLBLoaderComponent::TickComponent(float DeltaTime, enum ELevelTick TickType, FActorComponentTickFunction *ThisTickFunction) {
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (bResultQueue) {
		bResultQueue = false;
		OnFinishLoad.Broadcast(AssetList);
	}
}
