// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "UObject/Object.h"
#include "Misc/EngineVersionComparison.h"
#include "Engine/SkeletalMesh.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "Misc/FieldAccessor.h"

#include "UniGLB_Util.h"
#include "UniGLB_Json.h"

// assimp includes moved to Private/UniGLBAssimpScene.h; public header keeps only forward declarations.
// All .cpp consumers that need aiScene / aiMesh / VRMMaterial must #include "UniGLBAssimpScene.h".

//#include "UniGLB_Convert.generated.h"

struct aiScene;
namespace VRM { struct VRMMaterial; }
class UTexture2D;
class UMaterialInterface;
class USkeletalMesh;
class UUniGLBAssetListObject;
class UUniGLBLicenseObject;
class UUniGLB1LicenseObject;
class UPackage;


class UNIGLBLOADER_API UniGLBConverter {

	bool InitJSON(const uint8* pData, size_t pFileDataSize);

public:

	UniGLBJson jsonData;
	const aiScene* aiData = nullptr;

	char* GetMatName(int matNo) const;
	char* GetMatShaderName(int matNo) const;
	int GetMatNum() const;
	int GetMatCullMode(int matNo) const;
	int GetMatZWrite(int matNo) const;

	int GetThumbnailTextureIndex() const;

	bool GetMatParam(VRM::VRMMaterial &m, int matNo) const;


	static bool IsImportMode();
	static void SetImportMode(bool bImportMode);
	static FString NormalizeFileName(const char *str);
	static FString NormalizeFileName(const FString &str);

	static bool NormalizeBoneName(const aiScene *mScenePtr);

	bool Init(const uint8* pFileData, size_t dataSize, const aiScene*);
	bool ValidateSchema();

	bool ConvertTextureAndMaterial(UUniGLBAssetListObject *uniGLBAssetList);
	bool ConvertModel(UUniGLBAssetListObject *uniGLBAssetList);
	bool ConvertMorphTarget(UUniGLBAssetListObject *uniGLBAssetList);

	void GetUniGLBMeta(const aiScene *mScenePtr, UUniGLBLicenseObject *& a, UUniGLB1LicenseObject *& b);
	bool ConvertUniGLBFirst(UUniGLBAssetListObject* uniGLBAssetList, const uint8* pData, size_t dataSize);
	bool ConvertUniGLBMeta(UUniGLBAssetListObject *uniGLBAssetList, const aiScene *mScenePtr, const uint8* pData, size_t dataSize);
	bool ConvertUniGLBMetaPost(UUniGLBAssetListObject* uniGLBAssetList, const aiScene* mScenePtr, const uint8* pData, size_t dataSize);

	bool ConvertHumanoid(UUniGLBAssetListObject *uniGLBAssetList);
	bool ConvertRig(UUniGLBAssetListObject *uniGLBAssetList);
	bool ConvertIKRig(UUniGLBAssetListObject* uniGLBAssetList);
	bool RetargetAnimToManny(UUniGLBAssetListObject* uniGLBAssetList);
	bool AutoSkinToManny(UUniGLBAssetListObject* uniGLBAssetList);
	bool AutoRigToManny(UUniGLBAssetListObject* uniGLBAssetList);
	bool AdaptToMannyPostImport(UUniGLBAssetListObject* uniGLBAssetList);
	bool ConvertPose(UUniGLBAssetListObject* uniGLBAssetList);

	UPackage *CreatePackageFromImportMode(UPackage *p, const FString &name);

	class UNIGLBLOADER_API Options {
	public:
		static Options & Get();

		const FUniGLBImportOptionData *ImportOption = nullptr;
		void SetUniGLBOption(const FUniGLBImportOptionData *p) {
			ImportOption = p;
		}

		class USkeleton *GetSkeleton();
		bool IsSimpleRootBone() const;

		bool IsActiveBone() const;

		bool IsSkipPhysics() const;
		bool IsNativeMannyGASP() const;
		bool IsUniversalMannyGASP() const;
		bool IsRetargetAnimToManny() const;
		bool IsAutoSkinToManny() const;
		int32 GetVoxelResolution() const;
		int32 GetGeodesicMaxInfluences() const;
		float GetBindStiffness() const;
		bool IsSkipRetargeter() const;

		bool IsSkipNoMeshBone() const;

		bool IsSkipMorphTarget() const;

		bool IsEnableMorphTargetNormal() const;

		bool IsForceOriginalMorphTargetName() const;

		bool IsRemoveBlendShapeGroupPrefix() const;

		bool IsRemoveRootBoneRotation() const;
		bool IsRemoveRootBonePosition() const;

		bool IsVRM10RemoveLocalRotation() const;
		bool IsVRM10BindToRestPose() const;

		bool IsVRM10Bindpose() const;

		bool IsForceOriginalBoneName() const;
		bool IsGenerateHumanoidRenamedMesh() const;

		bool IsGenerateIKBone() const;
		bool IsGenerateRigIK() const;

		bool IsDebugIgnoreVRMValidation() const;
		bool IsDebugOneBone() const;
		bool IsDebugNoMesh() const;
		bool IsDebugNoMaterial() const;

		bool IsMobileBone() const;

		int GetBoneWeightInfluenceNum() const;

		bool IsForceOpaque() const;
		bool IsForceTwoSided() const;

		bool IsSingleUAssetFile() const;

		bool IsDefaultGridTextureMode() const;
		bool IsBC7Mode() const;
		bool IsMipmapGenerateMode() const;

		bool IsGenerateOutlineMaterial() const;
		bool IsMergeMaterial() const;

		bool IsMergePrimitive() const;

		bool IsOptimizeMaterial() const;

		bool IsOptimizeVertex() const;

		bool IsRemoveDegenerateTriangles() const;

		void ClearModelType();

		bool IsUE5Material() const;

		bool IsVRMModel() const;
		bool IsVRM0Model() const;
		bool IsVRM10Model() const;

		void SetVRM0Model(bool bVRM);
		void SetVRM10Model(bool bVRM);

		bool IsVRMAModel() const;
		void SetVRMAModel(bool bVRMA);

		bool IsBVHModel() const;
		void SetBVHModel(bool bBVH);

		bool IsPMXModel() const;
		void SetPMXModel(bool bPMX);

		bool IsNoMesh() const;
		void SetNoMesh(bool bNoMesh);

		bool IsForceOverride() const;
		float GetModelScale() const;

		float GetAnimationTranslateScale() const;

		float GetAnimationPlayRateScale() const;

		bool IsAPoseRetarget() const;

		bool IsOrganizeIntoSubfolders() const;
		bool IsUseProjectMaterials() const;
		const FDirectoryPath& GetProjectMaterialFolder() const;

		EUniGLBImportMaterialType GetMaterialType() const;
		void SetMaterialType(EUniGLBImportMaterialType type);
	};
};

class UNIGLBLOADER_API UniGLBLoaderUtil {
public:
	static UTexture2D* CreateTexture(int32 InSizeX, int32 InSizeY, FString name, UPackage* package);
	static UTexture2D* CreateTextureFromImage(FString name, UPackage* package, const void* Buffer, const size_t Length, bool GenerateMip = false, bool bNormal = false, bool bNormalGreenFlip = false);

	static bool LoadImageFromMemory(const void* Buffer, const size_t Length, UniGLBUtil::FImportImage& OutImage);
};


class UNIGLBLOADER_API UniGLBConvert {
public:
	UniGLBConvert();
	~UniGLBConvert();
};

extern FString UniGLB_GetPackagePath(UPackage* Outer);
extern UPackage* UniGLB_CreatePackage(UPackage* Outer, FName Name);

template< class T >
T* UniGLB_NewObject(UObject* Outer, FName Name, EObjectFlags Flags = RF_NoFlags, UObject* Template = nullptr, bool bCopyTransientsFromClassDefaults = false, FObjectInstancingGraph* InInstanceGraph = nullptr) {
	UPackage* pkg = Cast<UPackage>(Outer);
	if (UniGLBConverter::Options::Get().IsSingleUAssetFile() == false) {
		pkg = UniGLB_CreatePackage(pkg, Name);
	}
	decltype(auto) r = NewObject<T>(pkg, Name, Flags, Template, bCopyTransientsFromClassDefaults, InInstanceGraph);
	r->MarkPackageDirty();
	return r;
}

template< class T >
T* UniGLB_NewObject(UObject* Outer, UClass* Class, FName Name, EObjectFlags Flags = RF_NoFlags, UObject* Template = nullptr, bool bCopyTransientsFromClassDefaults = false, FObjectInstancingGraph* InInstanceGraph = nullptr) {
	UPackage* pkg = Cast<UPackage>(Outer);
	if (UniGLBConverter::Options::Get().IsSingleUAssetFile() == false) {
		pkg = UniGLB_CreatePackage(pkg, Name);
	}
	decltype(auto) r = NewObject<T>(pkg, Class, Name, Flags, Template, bCopyTransientsFromClassDefaults, InInstanceGraph);
	r->MarkPackageDirty();
	return r;
}

template< class T >
T* UniGLB_DuplicateObject(const T *src, UPackage* Outer, FName Name) {
	UPackage* pkg = Outer;
	if (UniGLBConverter::Options::Get().IsSingleUAssetFile() == false) {
		pkg = UniGLB_CreatePackage(Outer, Name);
	}
	decltype(auto) r = DuplicateObject<T>(src, pkg, Name);
	r->MarkPackageDirty();
	return r;
}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
extern UObject* UniGLB_StaticDuplicateObject(UObject const* SourceObject, UObject* DestOuter, const FName DestName = NAME_None, EObjectFlags FlagMask = RF_AllFlags, UClass* DestClass = nullptr, EDuplicateMode::Type DuplicateMode = EDuplicateMode::Normal, EInternalObjectFlags InternalFlagsMask = EInternalObjectFlags_AllFlags);


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
template<typename T>
TFieldPtrAccessor<FTexturePlatformData> GetPlatformData(T* t) {
	return t->GetPlatformData();
}
template<typename T, typename U>
void SetPlatformData(T* t, U* u) {
	t->SetPlatformData(u);
}

