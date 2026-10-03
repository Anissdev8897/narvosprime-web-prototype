// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "Engine/SkeletalMesh.h"
#include "Animation/Skeleton.h"
#include "UniGLB_ImportMaterialSet.h"
#include "UniGLB_Util.h"
#include "UniGLB_AssetListObject.generated.h"

class UMaterialInterface;
class UTexture2D;
class USkeletalMesh;
class USkeleton;
class UUniGLBMetaObject;
class UUniGLBLicenseObject;
class UUniGLB1LicenseObject;
struct FUniGLBReturnedData;
class UNodeMappingContainer;

/**
 * 
 */
UCLASS(Blueprintable, BlueprintType)
class UNIGLB_API UUniGLBAssetListObject : public UObject
{
	GENERATED_UCLASS_BODY()

public:

	void CopyMember(UUniGLBAssetListObject *dst) const;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InOption")
	bool bAssetSave = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InOption")
	bool bSkipMorphTarget=false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* MtoonLitSet;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* MtoonUnlitSet;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* SSSSet;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* SSSProfileSet;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* UnlitSet;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* GLTFSet;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* UEFNUnlitSet;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* UEFNLitSet;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* UEFNSSSProfileSet;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UUniGLBImportMaterialSet* CustomSet;


	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Lit")
	UMaterialInterface* BaseMToonLitOpaqueMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Lit")
	UMaterialInterface* BaseMToonLitTranslucentMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Lit")
	UMaterialInterface* OptMToonLitOpaqueMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Lit")
	UMaterialInterface* OptMToonLitOpaqueTwoSidedMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Lit")
	UMaterialInterface* OptMToonLitTranslucentMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Lit")
	UMaterialInterface* OptMToonLitTranslucentTwoSidedMaterial;

	// unlit

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_unlit")
	UMaterialInterface* BaseMToonUnlitOpaqueMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_unlit")
	UMaterialInterface* BaseMToonUnlitTranslucentMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Unlit")
	UMaterialInterface* OptMToonUnlitOpaqueMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Unlit")
	UMaterialInterface* OptMToonUnlitOpaqueTwoSidedMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Unlit")
	UMaterialInterface* OptMToonUnlitTranslucentMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon_Unlit")
	UMaterialInterface* OptMToonUnlitTranslucentTwoSidedMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial_MToon")
	UMaterialInterface* OptMToonOutlineMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UMaterialInterface* BaseUnlitOpaqueMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UMaterialInterface* BaseUnlitTranslucentMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "InMaterial")
	UMaterialInterface* BasePBROpaqueMaterial;

	//

	//UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	//USkeleton* BaseSkeleton;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	USkeletalMesh* BaseSkeletalMesh;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UUniGLBMetaObject* UniGLBMetaObject;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UUniGLBMetaObject* UniGLBHumanoidMetaObject;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UUniGLBMetaObject* UniGLBMannequinMetaObject;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UUniGLBLicenseObject* UniGLBLicenseObject;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UUniGLB1LicenseObject* UniGLB1LicenseObject;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	USkeletalMesh* SkeletalMesh;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	TArray<UTexture2D*> Textures;

#if WITH_EDITORONLY_DATA
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UTexture2D* SmallThumbnailTexture;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UObject* SSSProfile;
#endif

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	EUniGLBImportMaterialType ImportMode;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	TArray<UMaterialInterface*> Materials;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	TArray<UMaterialInterface*> OutlineMaterials;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UNodeMappingContainer *HumanoidRig;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UPoseAsset *PoseBody;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	UPoseAsset *PoseFace;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	TArray<bool> MaterialFlag_Translucent;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	TArray<bool> MaterialFlag_TwoSided;

	// no uproperty
	TArray<bool> MaterialFlag_Opaque;
	TMap<FString, FTransform> Pose_bind;
	TMap<FString, FTransform> Pose_tpose;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	FTransform model_root_transform;

	//TArray<FTransform> poseGlobal_bindpose;	// bone
	//TArray<FTransform> poseGlobal_tpose;	// node


	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	EUniGLBImportTextureCompressType Texture_CompressType = EUniGLBImportTextureCompressType::UniGLBITC_Auto;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Out")
	TArray<EUniGLBImportTextureCompressType> Texture_CompressTypeList;

	UPROPERTY()
	UPackage *Package;

	UPROPERTY()
	UUniGLBAssetListObject* ReimportBase;

	UPROPERTY()
	FString FileFullPathName;

	UPROPERTY()
	FString OrigFileName;

	UPROPERTY()
	FString BaseFileName;

	// Sub-project B: set during import when an "adapt to Manny" (auto-skin/rig) pass is requested. The adapt
	// runs POST-import (OnAssetPostImport) on the fully-built mesh to avoid the mid-import MeshConversion crash.
	UPROPERTY(Transient)
	bool bUniGLBPendingAdapt = false;

	// Sub-project B adapt mode (transient, import-time only). Set alongside bUniGLBPendingAdapt so the
	// POST-import dispatcher (AdaptToMannyPostImport) knows which adapt to run, instead of guessing from
	// the bone count. FitMannyFromMesh = the unrecognized-rig auto-rig fallback (delete rig -> fit Manny
	// to the mesh -> geodesic re-skin).
	enum class EUniGLBAdapt : uint8 { None = 0, FitMannyFromMesh = 1 };
	EUniGLBAdapt UniGLBAdaptMode = EUniGLBAdapt::None;

	UPROPERTY()
	USkeletalMesh* UE4SkeletalMesh;

	UPROPERTY()
	USkeletalMesh* HumanoidSkeletalMesh;

	TMap<int, int> MaterialMergeTable;

	TMap<FString, FString> MaterialNameOrigToAsset;
	TMap<FString, int> MaterialNameAssetToMatNo;

	TArray<bool> MaterialHasAlphaCutoff;

	TArray<bool> MaterialHasMToon;

	TSharedPtr<FUniGLBReturnedData> MeshReturnedData;
	//FUniGLBReturnedData *Result;

#if WITH_EDITORONLY_DATA

//#if	UE_VERSION_OLDER_THAN(5,0,0)
//	typedef LocalImportData UAssetImportData;
//#else
//	typedef LocalImportData TObjectPtr<class UAssetImportData>
//#endif

	// UniGLB_PRECOMPILE_500
	UPROPERTY(VisibleAnywhere, Instanced, Category = ImportSettings)
	class UAssetImportData *AssetImportData = nullptr;
	//TObjectPtr<class UAssetImportData> AssetImportData;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	//TObjectPtr<class UAssetImportData> AssetImportData;

#endif


#if WITH_EDITOR


	virtual void GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const override;
	// Import data for this 
	void WaitUntilAsyncPropertyReleased() const;


	class UAssetImportData* GetAssetImportData() const
	{
		//WaitUntilAsyncPropertyReleased(ESkeletalMeshAsyncProperties::AssetImportData);
		PRAGMA_DISABLE_DEPRECATION_WARNINGS
			return AssetImportData;
		PRAGMA_ENABLE_DEPRECATION_WARNINGS
	}

	void SetAssetImportData(class UAssetImportData* InAssetImportData)
	{
		//WaitUntilAsyncPropertyReleased(ESkeletalMeshAsyncProperties::AssetImportData);
		PRAGMA_DISABLE_DEPRECATION_WARNINGS
			AssetImportData = InAssetImportData;
		PRAGMA_ENABLE_DEPRECATION_WARNINGS
	}
#endif

};
