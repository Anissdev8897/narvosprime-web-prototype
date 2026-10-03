// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_ImportUI.h"
#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "UObject/Object.h"
#include "Factories/ImportSettings.h"
#include "Animation/Skeleton.h"
#include "UniGLB_Convert.h"

// The project standard is the UE5 Mannequin skeleton. Detect whether a user-selected Skeleton
// is a UE5 Mannequin by its bone signature (pelvis + spine_01..03 + clavicle/thigh/upperarm l/r).
// VRoid (J_Bip_*) and other humanoid rigs do not use these UE bone names, so this never
// false-positives on a non-Manny skeleton.
static bool UniGLB_SkeletonIsUE5Mannequin(const USkeleton* Skeleton) {
	if (Skeleton == nullptr) {
		return false;
	}
	const FReferenceSkeleton& Ref = Skeleton->GetReferenceSkeleton();
	static const TCHAR* const Sig[] = {
		TEXT("pelvis"), TEXT("spine_01"), TEXT("spine_02"), TEXT("spine_03"),
		TEXT("clavicle_l"), TEXT("clavicle_r"), TEXT("thigh_l"), TEXT("thigh_r"),
		TEXT("upperarm_l"), TEXT("upperarm_r"),
	};
	for (const TCHAR* Name : Sig) {
		if (Ref.FindBoneIndex(FName(Name)) == INDEX_NONE) {
			return false;
		}
	}
	return true;
}

bool UUniGLBImportUI::CanEditChange(const FProperty* InProperty) const
{
	// When the Native Manny/GASP target mode is checked, grey out options that are incompatible
	// with a pre-built skeleton target:
	//   - Generate renamed humanoid mesh (native target doesn't rename bones)
	//   - Generate IK Bone (native target already has the correct skeleton)
	//   - Enable MorphTarget Normal (tangent delta incompatible with Manny injection)
	const bool bNative = bNativeMannyGASP;

	if (bNative && InProperty)
	{
		const FName PropertyName = InProperty->GetFName();
		static const TSet<FName> NativeIncompatible = {
			GET_MEMBER_NAME_CHECKED(UUniGLBImportUI, bGenerateHumanoidRenamedMesh),
			GET_MEMBER_NAME_CHECKED(UUniGLBImportUI, bGenerateIKBone),
			GET_MEMBER_NAME_CHECKED(UUniGLBImportUI, bEnableMorphTargetNormal),
		};
		if (NativeIncompatible.Contains(PropertyName))
		{
			return false; // greyed out
		}
	}

	return Super::CanEditChange(InProperty);
}

#if WITH_EDITOR
void UUniGLBImportUI::PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent)
{
	Super::PostEditChangeProperty(PropertyChangedEvent);

	const FName PropertyName = PropertyChangedEvent.GetPropertyName();

	// Native Manny/GASP and Universal Manny/GASP are mutually exclusive pipelines.
	// Enabling either one clears the other so the dispatch is always unambiguous.
	if (PropertyName == GET_MEMBER_NAME_CHECKED(UUniGLBImportUI, bNativeMannyGASP) && bNativeMannyGASP)
	{
		bUniversalMannyGASP = false;
	}
	if (PropertyName == GET_MEMBER_NAME_CHECKED(UUniGLBImportUI, bUniversalMannyGASP) && bUniversalMannyGASP)
	{
		bNativeMannyGASP = false;
	}
}
#endif

const FUniGLBImportOptionData* UUniGLBImportUI::GenerateOptionData() {

	FUniGLBImportOptionData &d = data;

#define c(a)  d.a = a;

	d.init();

	c(bUEFN);

	c(bNativeMannyGASP);

	c(bUniversalMannyGASP);

	c(bRetargetAnimToManny);

	c(bAutoSkinToManny);

	c(bOrganizeIntoSubfolders);

	c(bUseProjectMaterials);

	c(ProjectMaterialFolder);

	c(VoxelResolution);

	c(GeodesicMaxInfluences);

	c(BindStiffness);

	c(bAPoseRetarget);

	c(bMobileBone);

	c(MaterialType);

	c(bForceOverride);

	c(ModelScale);

	c(AnimationTranslateScale);

	c(PlayRateScale);

	c(bRemoveRootBoneRotation);

	c(bRemoveRootBonePosition);

	c(bVrm10RemoveLocalRotation);

	c(bVrm10UseBindToRestPose);

	c(bVrm10Bindpose);

	c(bForceOriginalBoneName);

	c(bGenerateHumanoidRenamedMesh);

	c(bGenerateIKBone);

	c(bGenerateRigIK);

	c(bSkipPhysics);

	c(bSkipRetargeter);

	c(bSkipMorphTarget);

	c(bEnableMorphTargetNormal);

	c(bForceOriginalMorphTargetName);

	c(bRemoveBlendShapeGroupPrefix);

	c(bForceOpaque);

	c(bForceTwoSided);

	c(bSingleUAssetFile);

	c(bDefaultGridTextureMode);

	c(bBC7Mode);

	c(bMipmapGenerateMode);

	c(bUseUE5Material);

	c(bGenerateOutlineMaterial);

	c(bMergeMaterial);

	c(bMergePrimitive);

	c(bRemoveDegenerateTriangles);

	c(BoneWeightInfluenceNum);

	c(bSimpleRoot);

	c(bActiveBone);

	c(bSkipNoMeshBone);

	c(bIgnoreVRMValidation);

	c(bDebugOneBone);

	c(bDebugNoMesh);

	c(bDebugNoMaterial);

	c(Skeleton);

	// --- Manny standard normalisation ----------------------------------------------------------
	// Selecting a Skeleton in the field below is the most natural way a user expresses "target the
	// Mannequin", but that field is for RE-IMPORT onto a model's own skeleton; the importer's
	// bone-match guard (UniGLBConvertModel.cpp ~902) rejects a foreign skeleton (e.g. 1/151 bones match)
	// and the import fails with "Failed to create asset". Redirect to the intended path instead:
	if (d.Skeleton != nullptr && UniGLB_SkeletonIsUE5Mannequin(d.Skeleton)) {
		// User picked a UE5 Mannequin: treat as a Native Manny/GASP request. Clearing the field makes
		// the guard skip and a fresh skeleton get built; ProcessNativeMannyGASP then injects Manny.
		// Do NOT override an explicit Universal choice (its dispatch is checked separately).
		UE_LOG(LogTemp, Display,
			TEXT("UniGLB: selected Skeleton '%s' is a UE5 Mannequin; routing import through Native Manny/GASP (Skeleton field cleared)."),
			*d.Skeleton->GetName());
		d.Skeleton = nullptr;
		if (!d.bUniversalMannyGASP) {
			d.bNativeMannyGASP = true;
		}
	}
	else if (d.Skeleton != nullptr && (d.bNativeMannyGASP || d.bUniversalMannyGASP)) {
		// Any Manny/GASP mode builds its own Manny topology and ignores an assigned skeleton; a
		// non-null Skeleton here only trips the bone-match guard, so clear it.
		UE_LOG(LogTemp, Display,
			TEXT("UniGLB: 'Skeleton' field ignored in Manny/GASP import mode (cleared)."));
		d.Skeleton = nullptr;
	}

	// When the Native target mode is active, force-incompatible options off (they are greyed out in
	// the UI via CanEditChange, but this is a safety net in case they were set before a Native mode).
	if (d.bNativeMannyGASP)
	{
		d.bGenerateHumanoidRenamedMesh = false;
		d.bGenerateIKBone = false;
		d.bEnableMorphTargetNormal = false;
	}
	// -------------------------------------------------------------------------------------------

	// Anim retarget mode needs the IK Rig + IK Retargeter (RTG_) assets that ConvertIKRig builds,
	// so force IK rig generation on for this import.
	if (d.bRetargetAnimToManny)
	{
		d.bGenerateRigIK = true;
	}

	return &data;
}

