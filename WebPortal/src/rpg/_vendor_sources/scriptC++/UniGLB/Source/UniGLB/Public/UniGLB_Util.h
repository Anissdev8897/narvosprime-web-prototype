// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Misc/EngineVersionComparison.h"
#include "UObject/ObjectMacros.h"
#include "Engine/Texture.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "Engine/SkinnedAssetCommon.h"
#include "Engine/SkinnedAsset.h"

#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "UniGLB_Util.generated.h"

class USkeleton;
struct FReferenceSkeleton;
class UMorphTarget;
class UPhysicsAsset;
struct FSkeletalMaterial;

// skeleton begin

template<typename T>
USkeleton* UniGLBGetSkeleton(T* t){
	if (t == nullptr) return nullptr;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetSkeleton();
}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
template<typename T>
USkeleton* UniGLBGetSkeleton(TObjectPtr<T> t) {
	return t->GetSkeleton();
}

template<typename T>
const USkeleton* UniGLBGetSkeleton(const T* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetSkeleton();
}

template<typename T>
void UniGLBSetSkeleton(T* t, USkeleton *sk) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	t->SetSkeleton(sk);
}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
template<typename T>
void UniGLBSetSkeleton(TObjectPtr<T> t, USkeleton* sk) {
	t->SetSkeleton(sk);
}

//skeleton end

// refskeleton begin

template<typename T>
FReferenceSkeleton& UniGLBGetRefSkeleton(T* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetRefSkeleton();
}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
template<typename T>
FReferenceSkeleton& UniGLBGetRefSkeleton(TObjectPtr<T> t) {
	return t->GetRefSkeleton();
}

template<typename T>
const FReferenceSkeleton& UniGLBGetRefSkeleton(const T* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetRefSkeleton();
}

template<typename T>
void UniGLBSetRefSkeleton(T* t, const FReferenceSkeleton& refsk) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	t->SetRefSkeleton(refsk);
}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
template<typename T>
void UniGLBSetRefSkeleton(TObjectPtr<T> t, const FReferenceSkeleton& refsk) {
	t->SetRefSkeleton(refsk);
}

//refskeleton end

// morph targets
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
template<typename T>
TArray<TObjectPtr<UMorphTarget>>& UniGLBGetMorphTargets(T * t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetMorphTargets();
}


template<typename T>
const TArray<UMorphTarget*>& UniGLBGetMorphTargets(const T* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetMorphTargets();
}

// materials

template<typename T>
TArray<FSkeletalMaterial>& UniGLBGetMaterials(T* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetMaterials();
}

// physics

template<typename T>
void UniGLBSetPhysicsAsset(T* t, UPhysicsAsset *pa) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	t->SetPhysicsAsset(pa);
}


template<typename T>
UPhysicsAsset* UniGLBGetPhysicsAsset(T* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetPhysicsAsset();
}

// nodemappingdata
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
template<typename T>
TArray<TObjectPtr<class UNodeMappingContainer>>& UniGLBGetNodeMappingData(T * t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetNodeMappingData();
}

template<typename T>
const TArray<class UNodeMappingContainer*>& UniGLBGetNodeMappingData(const T* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetNodeMappingData();
}

// retargetbase


template<typename T>
void UniGLBSetRetargetBasePose(T* t, TArray<FTransform>& pose) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0), (5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
	// no old retarget pose.
}


template<typename T>
TArray<FTransform>& UniGLBGetRetargetBasePose(T* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetRetargetBasePose();
}

template<typename T>
const TArray<FTransform>& UniGLBGetRetargetBasePose(const T* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return t->GetRetargetBasePose();
}


// key
template<typename T>
void UniGLBSetUseLegacyMeshDerivedDataKey(T* t, bool b) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 27, 0), (5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
	// ue5.4 no action
}


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
UNIGLB_API void UniGLBAddRetargetChain(class UIKRigController* con, FName name, FName begin, FName end);


//template<typename T>
FORCEINLINE  USkeletalMesh *UniGLBGetSkeletalMeshAsset(USkeletalMeshComponent* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return (t->GetSkeletalMeshAsset());
}
FORCEINLINE  const USkeletalMesh* UniGLBGetSkeletalMeshAsset(const USkeletalMeshComponent* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return (t->GetSkeletalMeshAsset());
}
FORCEINLINE  USkeletalMesh *UniGLBGetSkeletalMeshAsset(TWeakObjectPtr<USkeletalMeshComponent> t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return (t->GetSkeletalMeshAsset());
}
FORCEINLINE  const USkeletalMesh* UniGLBGetSkeletalMeshAsset(TWeakObjectPtr<const USkeletalMeshComponent> t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return (t->GetSkeletalMeshAsset());
}

//template<>
FORCEINLINE  USkeletalMesh *UniGLBGetSkinnedAsset(USkinnedMeshComponent* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return Cast<USkeletalMesh>(t->GetSkinnedAsset());
}
//template<>
FORCEINLINE  USkeletalMesh *UniGLBGetSkinnedAsset(const USkinnedMeshComponent* t) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return Cast<USkeletalMesh>(t->GetSkinnedAsset());
}


// 
//


UENUM(BlueprintType)
enum class EUniGLBImportMaterialType : uint8
{
	UniGLBIMT_Auto				UMETA(DisplayName = "Auto(MToon Unlit)"),
	UniGLBIMT_MToon			UMETA(DisplayName = "MToon Lit"),
	UniGLBIMT_MToonUnlit		UMETA(DisplayName = "MToon Unlit"),
	UniGLBIMT_SSS				UMETA(DisplayName = "Subsurface"),
	UniGLBIMT_SSSProfile		UMETA(DisplayName = "Subsurface Profile"),
	UniGLBIMT_Unlit			UMETA(DisplayName = "Unlit"),
	UniGLBIMT_glTF				UMETA(DisplayName = "PBR(glTF2)"),
	UniGLBIMT_UEFNLit			UMETA(DisplayName = "UEFN(Lit)"),
	UniGLBIMT_UEFNUnlit		UMETA(DisplayName = "UEFN(Unlit)"),
	UniGLBIMT_UEFNSSSProfile	UMETA(DisplayName = "UEFN(SSSProfile)"),
	UniGLBIMT_Custom			UMETA(DisplayName = "Custom"),

	UniGLBIMT_MAX,
};

UENUM(BlueprintType)
enum class EUniGLBImportTextureCompressType : uint8
{
	UniGLBITC_Auto				UMETA(DisplayName = "Auto(DXT1)"),
	UniGLBITC_DXT1				UMETA(DisplayName = "DXT1"),
	UniGLBITC_BC7				UMETA(DisplayName = "BC7"),
	UniGLBITC_NoCompression	UMETA(DisplayName = "NoCompression"),

	UniGLBITC_MAX,
};

USTRUCT(BlueprintType)
struct UNIGLB_API FUniGLBImportOptionData {
public:
	GENERATED_BODY()

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
	static const bool UniGLB_UseBC7 = true;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
	static const bool UniGLB_UseUE5Mat = true;


	void init();

	bool bUEFN = false;

	bool bNativeMannyGASP = false;

	bool bUniversalMannyGASP = true;

	bool bRetargetAnimToManny = false;

	bool bAutoSkinToManny = false;

	bool bOrganizeIntoSubfolders = true;

	bool bUseProjectMaterials = false;

	FDirectoryPath ProjectMaterialFolder;

	int32 VoxelResolution = 0;

	int32 GeodesicMaxInfluences = 8;

	float BindStiffness = 0.2f;

	bool bAPoseRetarget = true;

	bool bMobileBone = false;

	int BoneWeightInfluenceNum = 8;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	EUniGLBImportMaterialType MaterialType = EUniGLBImportMaterialType::UniGLBIMT_Auto;

	bool bForceOverride = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	float ModelScale = 1.0f;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	float AnimationTranslateScale = 1.0f;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	float PlayRateScale = 1.0f;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bRemoveRootBoneRotation = true;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bRemoveRootBonePosition = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bVrm10RemoveLocalRotation = true;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bVrm10UseBindToRestPose = true;

	bool bVrm10Bindpose = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bForceOriginalBoneName = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bGenerateHumanoidRenamedMesh = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bGenerateIKBone = false;

	bool bGenerateRigIK = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bSkipPhysics = true;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bSkipRetargeter = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bSkipMorphTarget = false;

	bool bEnableMorphTargetNormal = false;
	
	bool bForceOriginalMorphTargetName = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bRemoveBlendShapeGroupPrefix = false;
	

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bForceOpaque= false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bForceTwoSided = false;

	bool bSingleUAssetFile = false;

	bool bDefaultGridTextureMode = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bBC7Mode = UniGLB_UseBC7;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bMipmapGenerateMode = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bUseUE5Material = UniGLB_UseUE5Mat;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bGenerateOutlineMaterial = true;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bMergeMaterial = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bMergePrimitive = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "UniGLB")
	bool bRemoveDegenerateTriangles = false;

	bool bSimpleRoot = true;

	bool bActiveBone = true;

	bool bSkipNoMeshBone = false;

	// Internal/developer debug switches (see UniGLBImportUI.h for the matching rationale). Intentionally
	// NOT UPROPERTY: this struct is BlueprintType and passed as a runtime-load option (LoadVRMFileAsync
	// etc.), so a UPROPERTY here would expose "ignore VRM validation" / "one bone only" / "no mesh" /
	// "no material" as editable pins on the public Blueprint API -- functionality is preserved, editor
	// visibility is not.
	bool bIgnoreVRMValidation = false;
	bool bDebugOneBone = false;
	bool bDebugNoMesh = false;
	bool bDebugNoMaterial = false;

	UPROPERTY()
	class USkeleton* Skeleton = nullptr;

};



class UNIGLB_API UniGLBUtil {
	//GENERATED_UCLASS_BODY()
public:
	struct UniGLBBoneTable {
		FString BoneUE4;
		FString BoneVRM;
	};
	static const TArray<UniGLBBoneTable> table_ue4_vrm;
	static const TArray<UniGLBBoneTable> table_ue4_pmx;
	static bool GetReplacedPMXBone(FString &replaced, const FString &base);

	static const TArray<FString> uniGLB_humanoid_bone_list;
	static const TArray<FName> uniGLB_humanoid_bone_list_name;

	static const TArray<FString> uniGLB_humanoid_parent_list;

	static const TArray<FString> ue4_humanoid_bone_list;
	static const TArray<FName> ue4_humanoid_bone_list_name;

	struct FImportImage
	{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.
		TArray64<uint8> RawData;
		ETextureSourceFormat Format = TSF_Invalid;
		TextureCompressionSettings CompressionSettings = TC_Default;
		int32 NumMips;
		int32 SizeX = 0;
		int32 SizeY = 0;
		bool SRGB = true;

		static int32 GetBytesPerPixel(ETextureSourceFormat Format)
		{
			int32 BytesPerPixel = 0;
			switch (Format)
			{
			case TSF_G8:		BytesPerPixel = 1; break;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
			case TSF_G16:		BytesPerPixel = 2; break;
			case TSF_BGRA8:		BytesPerPixel = 4; break;
			case TSF_BGRE8:		BytesPerPixel = 4; break;
			case TSF_RGBA16:	BytesPerPixel = 8; break;
			case TSF_RGBA16F:	BytesPerPixel = 8; break;
			default:			BytesPerPixel = 0; break;
			}
			return BytesPerPixel;
		}


		void Init2DWithParams(int32 InSizeX, int32 InSizeY, ETextureSourceFormat InFormat, bool InSRGB);
		void Init2DWithOneMip(int32 InSizeX, int32 InSizeY, ETextureSourceFormat InFormat, const void* InData = nullptr) {
			SizeX = InSizeX;
			SizeY = InSizeY;
			NumMips = 1;
			Format = InFormat;
			RawData.AddUninitialized((int64)SizeX * SizeY * GetBytesPerPixel(Format));
			if (InData)
			{
				FMemory::Memcpy(RawData.GetData(), InData, RawData.Num());
			}
		}
		void Init2DWithMips(int32 InSizeX, int32 InSizeY, int32 InNumMips, ETextureSourceFormat InFormat, const void* InData = nullptr);

		int64 GetMipSize(int32 InMipIndex) const;
		void* GetMipData(int32 InMipIndex);
	};


	static bool IsNoSafeName(const FString& str);
	static FString GetSafeNewName(const FString& str);
	static FString MakeName(const FString& str, bool IsJoint = false);
	static FName GetSanitizedName(const FString& str);

	static int32 GetDirectChildBones(FReferenceSkeleton& refs, int32 ParentBoneIndex, TArray<int32>& Children);

	static class UUniGLBAssetListObject* GetAssetListObjectAny(const UObject* obj);
	static class UUniGLBAssetListObject* GetAssetListObject(const USkeletalMesh *);

	static void CloseEditorWindowByFolderPath(const UObject* obj);

	static int GetChildBone(const USkeleton* skeleton, const int32 ParentBoneIndex, bool recursive, TArray<int32>& Children);
	static int GetChildBone(const USkeleton* skeleton, const int32 ParentBoneIndex, TArray<int32>& Children) {
		return GetChildBone(skeleton, ParentBoneIndex, true, Children);
	}

};

class UNIGLB_API UniGLBRetargetData {
public:

	struct RetargetParts {
		FString BoneUE4;
		FString BoneVRM;
		FString BoneModel;

		FRotator rot;
		bool operator==(const RetargetParts& a) const{
			return BoneUE4.Compare(a.BoneUE4, ESearchCase::IgnoreCase) == 0;
		}
	};
	class UUniGLBAssetListObject* uniGLBAssetList = nullptr;
	TArray<RetargetParts> retargetTable;

	void Setup(class UUniGLBAssetListObject* uniGLBAssetList, bool bVRM, bool bBVH, bool bPMX);
	void UpdateBoneName();
	void Remove(FString BoneUE4);
};


