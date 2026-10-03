// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_CineCameraComponent.h"
#include "UniGLB_DrawFrustumComponent.h"
#include "Misc/EngineVersionComparison.h"

void UUniGLBCineCameraComponent::GetCameraView(float DeltaTime, FMinimalViewInfo& DesiredView) {
	Super::GetCameraView(DeltaTime, DesiredView);
	DesiredView.OffCenterProjectionOffset = OffCenterProjectionOffset;
}

void UUniGLBCineCameraComponent::OnRegister()
{
#if WITH_EDITORONLY_DATA
	AActor* MyOwner = GetOwner();
	if ((MyOwner != nullptr) && !IsRunningCommandlet())
	{
		if (DrawFrustum == nullptr)
		{
			DrawFrustum = NewObject<UUniGLBDrawFrustumComponent>(MyOwner, NAME_None, RF_Transactional | RF_TextExportTransient);
			DrawFrustum->SetupAttachment(this);
			DrawFrustum->CreationMethod = CreationMethod;
			DrawFrustum->RegisterComponentWithWorld(GetWorld());

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 21, 0)] (target floor (5, 7, 0)); kept #else branch only.
			DrawFrustum->SetIsVisualizationComponent(true);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
			DrawFrustum->bFrustumEnabled = bDrawFrustumAllowed;
		}
	}

	RefreshVisualRepresentation();
#endif	// WITH_EDITORONLY_DATA

	Super::OnRegister();
}

#if WITH_EDITORONLY_DATA
void UUniGLBCineCameraComponent::RefreshVisualRepresentation()
{
	if (DrawFrustum != nullptr)
	{
		UUniGLBDrawFrustumComponent* v = Cast< UUniGLBDrawFrustumComponent>(DrawFrustum);
		v->OffCenterProjectionOffset = OffCenterProjectionOffset;
	}
	Super::RefreshVisualRepresentation();
}

#endif
