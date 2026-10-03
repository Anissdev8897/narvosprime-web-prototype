// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "UObject/Object.h"
#include "Factories/ImportSettings.h"
#include "UniGLB_Convert.h"
#include "UniGLB_1LicenseObject.h"

#include "UniGLB_ImportUI.generated.h"

DECLARE_DELEGATE(FOnResolveFbxReImport);

UCLASS(config=EditorPerProjectUserSettings, AutoExpandCategories=(FTransform), HideCategories=Object, MinimalAPI)
class UUniGLBImportUI : public UObject, public IImportSettingsParser
{
	GENERATED_UCLASS_BODY()

public:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Thumbnail"))
	UTexture2D *Thumbnail;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Title / Author (VRM metadata)"))
	FString TitleAuthor;

	/** Target the UEFN (Unreal Editor for Fortnite) Mannequin conventions during import. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB Universal", meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "UEFN mode"))
	bool bUEFN = false;

	// Native target skeleton mode: build a UE5 Mannequin + GASP-compatible skeleton and inject Manny
	// directly. When checked, options incompatible with a pre-built skeleton target (renamed mesh,
	// IK bone, morph normal) are greyed out and forced off.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB Universal", meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Native Manny/GASP (UE5 Mannequin + GASP compatible)"))
	bool bNativeMannyGASP = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB Universal", meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Universal Manny/GASP Import (FBX/GLB non-VRM)"))
	bool bUniversalMannyGASP = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB Universal", meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Retarget Animation to Manny (bake)"))
	bool bRetargetAnimToManny = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB Universal", meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Auto-skin to Manny [NOT YET WIRED]", ToolTip = "NOT FUNCTIONAL — reserved for future implementation. Use Universal Manny GASP instead."))
	bool bAutoSkinToManny = false;

	/** When enabled, assets are placed in typed subfolders (MATERIALS/, TEXTURES/, MESH/, etc.)
	 *  instead of being created flat in the import root. Keeps the Content Browser clean. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB Universal", meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Organize into subfolders [NOT YET WIRED]", ToolTip = "NOT FUNCTIONAL — subfolder organization not yet implemented in import pipeline."))
	bool bOrganizeIntoSubfolders = true;

	/** When enabled, reuses existing project materials from the specified folder instead of
	 *  generating new MI_* materials per import. Useful for sharing materials across projects. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB Universal", meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Use project materials [NOT YET WIRED]", ToolTip = "NOT FUNCTIONAL — project material reuse not yet implemented in import pipeline."))
	bool bUseProjectMaterials = false;

	/** Folder where project materials are searched when bUseProjectMaterials is true.
	 *  Default: /Game/00/vroidmaterials (configurable). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB Universal", meta = (ImportType = "StaticMesh|SkeletalMesh", EditCondition = "bUseProjectMaterials", DisplayName = "Project materials folder"))
	FDirectoryPath ProjectMaterialFolder;

	/** Geodesic voxel resolution for the fallback skin bind (Universal path). Higher = more
	 *  accurate on massive/thick-limbed characters, at the cost of import time. 0 = auto-heuristic
	 *  (scales with mesh bounding box). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = "UniGLB Universal",
		meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Voxel Resolution (0=auto)", ClampMin = "0", ClampMax = "1024",
		EditCondition = "bUniversalMannyGASP"))
	int32 VoxelResolution = 0;

	/** Max bone influences per vertex for the geodesic fallback bind. 4 for mobile, 8 for desktop. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = "UniGLB Universal",
		meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Max Influences (geodesic)", ClampMin = "1", ClampMax = "12",
		EditCondition = "bUniversalMannyGASP"))
	int32 GeodesicMaxInfluences = 8;

	/** Stiffness for geodesic voxel bind. Lower = softer falloff across joints. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = "UniGLB Universal",
		meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Bind Stiffness", ClampMin = "0.01", ClampMax = "1.0",
		EditCondition = "bUniversalMannyGASP"))
	float BindStiffness = 0.2f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "RetargetPose A-pose (Off to T-pose)"))
	bool bAPoseRetarget = true;

	/** Reduce bone map to <= 75 bones, for mobile/low-end target platforms. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Reduce bonemap <= 75 (mobile)"))
	bool bMobileBone = false;

	/** Material Type */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Mesh)
	EUniGLBImportMaterialType MaterialType;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
	static const bool UniGLB_UseUE5Mat = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Use UE5 Material"))
	bool bUseUE5Material = UniGLB_UseUE5Mat;

	/** Outline Material*/
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "GenerateOutlineMaterial"))
	bool bGenerateOutlineMaterial = true;

	/** Force Override */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Force Override (as New Asset)"))
	bool bForceOverride = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Model scale"))
	float ModelScale = 1.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Animation Translate scale"))
	float AnimationTranslateScale = 1.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Animation Play Rate Scale"))
	float PlayRateScale = 1.0f;

	/** Remove RootBone Rotation */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Remove RootBone Rotation"))
	bool bRemoveRootBoneRotation = true;

	/** Remove RootBone Position */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Remove RootBone Position"))
	bool bRemoveRootBonePosition = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "VRM 1.0 Convert to Restpose from Bindpose"))
	bool bVrm10UseBindToRestPose = true;

	/** Remove Local Rotation for VRM 1.0 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "VRM 1.0 Remove Local Rotation"))
	bool bVrm10RemoveLocalRotation = false;

	/** Use Bindpose for VRM 1.0 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "VRM 1.0 Bindpose"))
	bool bVrm10Bindpose = false;

	/** Force Original Bone Name */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Force original bone name"))
	bool bForceOriginalBoneName = false;

		/** Duplicate mesh and renamed humanoid bone */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName= "Generate renamed humanoid mesh"))
	bool bGenerateHumanoidRenamedMesh = false;

	/** Add IK Bone */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Generate IK Bone"))
	bool bGenerateIKBone = false;

	/** Add RigIK asset*/
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Generate RigIK Asset"))
	bool bGenerateRigIK = true;

	/** Remove Physics asset */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "No physics asset"))
	bool bSkipPhysics = false;

	/** Remove Retargeter asset */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "No Retargeter asset"))
	bool bSkipRetargeter = false;

	/** Remove MorphTarget */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "No MorphTarget"))
	bool bSkipMorphTarget = false;

	/** Use MorphTarget Normal */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Enable MorphTarget Normal(TangentZDelta)"))
	bool bEnableMorphTargetNormal = false;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
	static const bool UniGLB_UseBC7 = true;


	/** Force Original MorphTarget Name Mode */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Force original morphtarget name"))
	bool bForceOriginalMorphTargetName = false;

	/** Use Strict MorphTarget Name Mode */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Remove BlendShapeGroup prefix for old VRM file"))
	bool bRemoveBlendShapeGroupPrefix = false;

	/** Use Opaque instead of translucent */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Force Opaque"))
	bool bForceOpaque = false;

	/** Use TwoSided */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Force TwoSided"))
	bool bForceTwoSided = false;

	/** Save as single uasset file */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "Single uasset file"))
	bool bSingleUAssetFile = false;

	/** Use GridTexture by Default */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Texture] Use DummyGrid by DefaultBaseTexture"))
	bool bDefaultGridTextureMode = false;

	/** Use BC7 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Texture] Use BC7 for BaseTexture"))
	bool bBC7Mode = UniGLB_UseBC7;

	/** Generate mipmap (be careful of MatCap texture)*/
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Texture] Generate Mipmap"))
	bool bMipmapGenerateMode = false;

	/** Merge material using same parameter */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Optimize] Merge material"))
	bool bMergeMaterial = false;

	/** Merge primitives using same material */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Optimize] Merge primitive"))
	bool bMergePrimitive = false;

	/** Use optimized MaterialInstance */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Optimize] use opt material"))
	bool bOptimizeMaterial = true;

	/** Remove degenerate triangles */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Optimize] remove degenerate triangles"))
	bool bRemoveDegenerateTriangles = false;

	/** BoneWeight influence */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Optimize] Bone Weight Influence Num"))
	int BoneWeightInfluenceNum = 8;

	/** Remove bone has no mesh */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Optimize] Remove bone used DCC tool"))
	bool bSimpleRoot = true;

	/** Remove bone has no mesh */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category = Mesh, meta = (ImportType = "StaticMesh|SkeletalMesh", DisplayName = "[Optimize] Use ActiveBone List"))
	bool bActiveBone = true;

	// "Delete bone without mesh": kept functional (read by UniGLBConvert.cpp) but intentionally not a
	// UPROPERTY -- not meant to be user-facing in the import dialog.
	bool bSkipNoMeshBone = false;

	// The 4 members below are internal/developer debug switches consumed by UniGLBConvert.cpp
	// (bIgnoreVRMValidation, bDebugOneBone, bDebugNoMesh, bDebugNoMaterial). They are intentionally
	// NOT UPROPERTY: exposing "[Debug] One bone only" / "[Debug] No Mesh" / "[Debug] No Material" in
	// the end-user import dialog invited accidental mesh-destroying misclicks (support tickets) with
	// no corresponding end-user benefit. The functionality itself is preserved for internal/developer
	// use -- flip these via debugger/temporary code edit, not via the shipped UI.
	bool bIgnoreVRMValidation = false;
	bool bDebugOneBone = false;
	bool bDebugNoMesh = false;
	bool bDebugNoMaterial = false;

	/** Skeleton to use for imported asset. When importing a mesh, leaving this as "None" will create a new skeleton. When importing an animation this MUST be specified to import the asset.
	 *  NOTE: to target the UE5 Mannequin / GASP, do NOT pick the Mannequin here - tick "Native Manny/GASP" above and leave this empty. Picking a UE5 Mannequin skeleton here is auto-redirected to the Native Manny/GASP path. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, AdvancedDisplay, Category=Mesh, meta=(ImportType="SkeletalMesh"))
	class USkeleton* Skeleton;

	//
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VRM License")
	TArray<FUniGLBLicenseBoolDataPair> LicenseBool;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VRM License")
	TArray<FUniGLBLicenseStringDataPair> LicenseString;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VRM License")
	TArray<FUniGLBLicenseStringDataArray> LicenseStringArray;

	//
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
		FString allowedUserName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
		FString violentUsageName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
		FString sexualUsageName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
		FString commercialUsageName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Personation/CharacterizationPermission")
		FString otherPermissionUrl;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Redistribution/ModificationsLicense")
		FString licenseName;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "License_Redistribution/ModificationsLicense")
		FString otherLicenseUrl;

private:
	UPROPERTY()
	FUniGLBImportOptionData data;
public:
	const FUniGLBImportOptionData *GenerateOptionData();

	UFUNCTION(BlueprintCallable, Category = Miscellaneous)
	void ResetToDefault();

	virtual bool CanEditChange(const FProperty* InProperty) const override;
#if WITH_EDITOR
	virtual void PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent) override;
#endif

	/** IImportSettings Interface */
	virtual void ParseFromJson(TSharedRef<class FJsonObject> ImportSettingsJson) override;

	/* Whether this UI is construct for a reimport */
	bool bIsReimport;
};


