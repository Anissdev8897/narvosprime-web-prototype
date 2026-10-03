// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once
#include "Engine/LatentActionManager.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "UniGLB_Convert.h"
#include "UniGLB_Util.h"
#include "UniGLB_LoaderBPFunctionLibrary.generated.h"

UENUM(BlueprintType)
enum class EUniGLBPathType : uint8
{
	Absolute,
	Relative
};


USTRUCT(BlueprintType)
struct FMeshInfo_UniGLB
{
	GENERATED_USTRUCT_BODY()

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		TArray<FVector> Vertices;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		TArray<FVector> Normals;

	//UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		TArray<uint32> Triangles;
	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		TArray<int32> Triangles2;


//	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
	TArray< TArray<FVector2D> > UV0;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		TArray<FLinearColor> VertexColors;

//	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
//		TArray<FProcMeshTangent> MeshTangents;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		TArray<FVector> Tangents;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		FTransform RelativeTransform;

	TArray<bool> vertexUseFlag;
	TArray<uint32_t> vertexIndexOptTable;
	uint32_t useVertexCount = 0;
};

USTRUCT(BlueprintType)
struct FUniGLBReturnedData
{
	GENERATED_USTRUCT_BODY()

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		bool bSuccess = false;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		int32 NumMeshes = 0;

	UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
		TArray<FMeshInfo_UniGLB> meshInfo;

	//UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "ReturnedData")
	//TMap<struct aiMesh*, uint32_t> meshToIndex;
};




/**
 * 
 */
UCLASS()
class UNIGLBLOADER_API UUniGLBLoaderBPFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()
	
public:

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static bool UniGLBSetLoadMaterialType(EUniGLBImportMaterialType type);

	UFUNCTION(BlueprintCallable,Category="UniGLB", meta = (DynamicOutputParam = "OutUniGLBAsset"))
	static bool LoadVRMFile(const class UUniGLBAssetListObject *InUniGLBAsset, class UUniGLBAssetListObject *&OutUniGLBAsset, const FString filepath, const FUniGLBImportOptionData &OptionForRuntimeLoad);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (Latent, DynamicOutputParam = "OutUniGLBAsset", WorldContext = "WorldContextObject", LatentInfo = "LatentInfo"))
	static void LoadVRMFileAsync(const UObject* WorldContextObject, const class UUniGLBAssetListObject* InUniGLBAsset, class UUniGLBAssetListObject*& OutUniGLBAsset, const FString filepath, const FUniGLBImportOptionData& OptionForRuntimeLoad, struct FLatentActionInfo LatentInfo);


	static bool LoadVRMFileLocal(const class UUniGLBAssetListObject* InUniGLBAsset, class UUniGLBAssetListObject*& OutUniGLBAsset, const FString filepath);

	static bool LoadVRMFileFromMemoryDefaultOption(UUniGLBAssetListObject*& OutUniGLBAsset, const FString filepath, const uint8* pData, size_t dataSize);
	static bool LoadVRMFileFromMemory(const UUniGLBAssetListObject* InUniGLBAsset, UUniGLBAssetListObject*& OutUniGLBAsset, const FString filepath, const uint8* pFileData, size_t dataSize);

	static void SetImportMode(bool bImportMode, class UPackage *package);

	// Native Manny/GASP: rename to UE bones, rebuild to Manny topology, bake mesh to A-pose.
	static void ProcessNativeMannyGASP(class UUniGLBAssetListObject* InUniGLBAsset);

	//static void SetCopySkeletalMeshAnimation(bool bImportMode, class UPackage *package);

	///
	UFUNCTION(BlueprintCallable,Category="UniGLB")
	static bool UniGLBReTransformHumanoidBone(class USkeletalMeshComponent *targetHumanoidSkeleton, const class UUniGLBMetaObject *meta, const class USkeletalMeshComponent *displaySkeleton);

	//static void ReTransformHumanoidBone(USkeleton *targetHumanoidSkeleton, const UUniGLBMetaObject *meta, const USkeleton *displaySkeleton) {

	///
	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static bool CopyPhysicsAsset(USkeletalMesh *dstMesh, const USkeletalMesh *srcMesh, bool bResetCollisionTransform=true);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static bool CopyVirtualBone(USkeletalMesh *dstMesh, const USkeletalMesh *srcMesh);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static bool CreateTailBone(USkeletalMesh *skeletalMesh, const TArray<FString> &boneName);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (DynamicOutputParam = "RigIK"))
	static void UniGLBGenerateEpicSkeletonToHumanoidIKRig(USkeletalMesh* srcSkeletalMesh, UObject*& outRigIK, UObject*& outIKRetargeter, UObject* targetRigIK);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (DynamicOutputParam = "RigIK"))
	static void UniGLBGenerateIKRetargeterPose(UObject * IKRetargeter, UObject* targetRigIK, UPoseAsset* targetPose);

	static bool IsValidUniGLBFile(FString filepath);
	static void GetUniGLBMeta(FString filepath, UUniGLBLicenseObject*& a, UUniGLB1LicenseObject*& b);
};
