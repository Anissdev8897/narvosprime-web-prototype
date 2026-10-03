// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Engine/EngineTypes.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Misc/EngineVersionComparison.h"
#include "Engine/Scene.h"
#include "LiveLinkTypes.h"
#include "Components/SkeletalMeshComponent.h"
#include "UniGLB_Util.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "AssetRegistry/AssetData.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0), (5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "CineCameraComponent.h"

#include "UniGLB_BPFunctionLibrary.generated.h"

class UTextureRenderTarget2D;
class UMaterialInstanceConstant;
class UAnimationAsset;
class USkeleton;

// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(4, 20, 0)] all below target floor (5, 7, 0)).

UENUM(BlueprintType)
enum class EUniGLBWidgetMode : uint8
{
	WM_Translate,
	WM_Rotate,
	WM_Scale,
};


/**
 * 
 */
UCLASS()
class UNIGLB_API UUniGLBBPFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()
	
public:
	UFUNCTION(BlueprintCallable,Category="UniGLB")
	static void UniGLBTransMatrix(const FTransform &transform, TArray<FLinearColor> &matrix, TArray<FLinearColor> &matrix_inv);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static void UniGLBGetMorphTargetList(const USkeletalMesh *target, TArray<FString> &morphTargetList);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static bool UniGLBGetRefBoneTransform(const USkeleton *target, const FName boneName, FTransform &boneTransform);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static void UniGLBGetHumanoidBoneNameList(TArray<FString> &BoneNameListString, TArray<FName> &BoneNameListName);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static void UniGLBGetEpicSkeletonBoneNameList(TArray<FString>& BoneNameListString, TArray<FName>& BoneNameListName);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBGetEpicSkeletonToHumanoid(TMap<FString, FString>& table);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static bool UniGLBGetHumanoidParentBone(const FName boneName, FName &parentBoneName);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBInitAnim(USkeletalMeshComponent *target);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBUpdateRefPose(USkeletalMeshComponent* target, bool bForceAlignGlobal, bool bForceUE4Humanoid);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static void UniGLBGetMaterialPropertyOverrides(const UMaterialInterface *Material, TEnumAsByte<EBlendMode> &BlendMode, TEnumAsByte<EMaterialShadingModel> &ShadingModel, bool &IsTwoSided, bool &IsMasked);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static void UniGLBGetMobileMode(bool &IsMobile, bool &IsAndroid, bool &IsIOS);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject", UnsafeDuringActorConstruction = "true"))
	static void UniGLBDrawMaterialToRenderTarget(UObject* WorldContextObject, UTextureRenderTarget2D* TextureRenderTarget, UMaterialInterface* Material);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBUpdateTextureProperty(UTexture* Texture);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBChangeMaterialParent(UMaterialInstanceConstant *dst, UMaterialInterface* NewParent, USkeletalMesh *UseSkeletalMesh);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBChangeMaterialTexture(UMaterialInstanceConstant *dst, FName texName, UTexture *texture);

	// mat begin
	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBChangeMaterialSkipEditChange(UMaterialInstanceConstant *material, USkeletalMesh *UseSkeletalMesh, bool bSkip);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBChangeMaterialShadingModel(UMaterialInstanceConstant *material, EMaterialShadingModel ShadingModel, bool bOverride, bool bForce);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBChangeMaterialBlendMode(UMaterialInstanceConstant *material, EBlendMode BlendMode, bool bOverride, bool bForce);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBChangeMaterialScalarParameter(UMaterialInstanceConstant *material, FName paramName, float param, bool bEnable);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBChangeMaterialVectorParameter(UMaterialInstanceConstant *material, FName paramName, FLinearColor param, bool bEnable);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBChangeMaterialStaticSwitch(UMaterialInstanceConstant *material, FName paramName, bool bEnable);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (DevelopmentOnly))
	static void UniGLBGetMaterialStaticSwitch(UMaterialInstance* material, FName paramName, bool &bHasParam, bool &bEnable);

	// mat end

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static UObject* UniGLBDuplicateAsset(UObject *src, FString name, UObject *thisOwner);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBSetMaterial(USkeletalMesh *target, int no, UMaterialInterface *material);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBSetImportedBounds(USkeletalMesh *target, FVector min, FVector max);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static bool UniGLBGetAssetsByPackageName(FName PackageName, TArray<FAssetData>& OutAssetData, bool bIncludeOnlyOnDiskAssets = false);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBSetIsDirty(UObject *obj);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static UTextureRenderTarget2D* UniGLBCreateRenderTarget2D(UObject* WorldContextObject, int32 Width = 256, int32 Height = 256, ETextureRenderTargetFormat Format = RTF_RGBA16f, FLinearColor ClearColor = FLinearColor::Black);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static bool UniGLBRenderingThreadEnable(bool bEnable);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static int UniGLBGetMeshSectionNum(const USkeletalMesh* mesh);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static bool UniGLBRemoveMeshSection(USkeletalMesh* mesh, int LODIndex, int SectionIndex);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static bool UniGLBGetShadowEnable(const USkeletalMesh *mesh, int MaterialIndex);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBSetLightingChannelPrim(UPrimitiveComponent *prim, bool channel0, bool channel1, bool channel2);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBSetLightingChannelLight(ULightComponent *light, bool channel0, bool channel1, bool channel2);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBSetCastRaytracedShadow(ULightComponent *light, bool bEnable);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBSetShadowSlopeBias(ULightComponent *light, float bias=0.5f);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBSetSpecularScale(ULightComponent* light, float scale=1.0f);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBSetPostProcessSettingAO(FPostProcessSettings& OutSettings, const FPostProcessSettings& InSettings, bool bOverride, float AOIntensity, float Radius, bool bRayTracing = true);

	UFUNCTION(BlueprintPure, Category = "UniGLB", meta = (DynamicOutputParam = "filmback"))
	static bool UniGLBGetCameraFilmback(UCineCameraComponent *CineCamera, FCameraFilmbackSettings &filmback);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static bool UniGLBSetCameraFilmback(UCineCameraComponent *CineCamera, const FCameraFilmbackSettings &filmback);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static bool UniGLBSetPostProcessSettingFromCineCamera(FPostProcessSettings &OutSettings, const FPostProcessSettings &InSettings, const UCineCameraComponent *CineCamera);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBSetPostProcessToneCurveAmount(FPostProcessSettings& OutSettings, const FPostProcessSettings& InSettings, bool bOverride, float Amount);

	UFUNCTION(BlueprintPure, Category = "UniGLB", meta = (DynamicOutputParam = "Settings"))
	static void UniGLBMakeCameraTrackingFocusSettings(AActor *ActorToTrack, FVector RelativeOffset, bool bDrawDebugTrackingFocusPoint, FCameraTrackingFocusSettings &Settings);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (DynamicOutputParam = "Settings"))
	static void UniGLBSetActorLabel(AActor *Actor, const FString& NewActorLabel);

	UFUNCTION(BlueprintPure, Category = "UniGLB", meta = (WorldContext = "WorldContextObject", DynamicOutputParam = "transform"))
	static void UniGLBGetCameraTransform(const UObject* WorldContextObject, int32 PlayerIndex, bool bGameOnly, FTransform &transform, float &fovDegree);

	UFUNCTION(BlueprintPure, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBGetPlayMode(bool &bPlay, bool &bSIE, bool &bIsEditor);

	UFUNCTION(BlueprintPure, Category = "UniGLB", meta = (WorldContext = "WorldContextObject", DynamicOutputParam = "skeleton"))
	static bool UniGLBGetAnimationAssetData(const UAnimationAsset *animAsset, USkeleton *&skeleton);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBExecuteConsoleCommand(UObject* WorldContextObject, const FString &cmd);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static bool UniGLBSetTransparentWindow(bool bEnable, FLinearColor crKey);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static bool UniGLBAddTickPrerequisite(UActorComponent *dst, UActorComponent *src, bool bRemove);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBAllowTranslucentSelection(bool bEnable);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject"))
	static void UniGLBSetWidgetMode(const EUniGLBWidgetMode mode);

	//UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (DynamicOutputParam = "PropertyNames|PropertyValues|FrameNo"))
	//static bool UniGLBLiveLinkEvaluate(const FName Subject, TArray<FName> &PropertyNames, TArray<float> &PropertyValues, int &FrameNo);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (DevelopmentOnly))
	static bool UniGLBBakeAnim(const USkeletalMeshComponent* skc, const FString& FilePath, const FString& AssetFileName);

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject", DeterminesOutputType = "UObjectClass", DynamicOutputParam = "OutActors"))
	static void UniGLBGetAllActorsHasSceneComponent(const UObject* WorldContextObject, TSubclassOf<UObject> UObjectClass, TArray<AActor*>& OutActors);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static void UniGLBGetUEVersion(int& major, int& minor, int& patch) {
		major = ENGINE_MAJOR_VERSION;
		minor = ENGINE_MINOR_VERSION;
		patch = ENGINE_PATCH_VERSION;
	}

	UFUNCTION(BlueprintCallable, Category = "UniGLB", meta = (WorldContext = "WorldContextObject", DynamicOutputParam = "RigNodeName"))
	static void UniGLBGetRigNodeNameFromBoneName(const USkeleton *skeleton, const FName &boneName, FName &RigNodeName);

	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBSetPerBoneMotionBlur(USkinnedMeshComponent* SkinnedMesh, bool bUsePerBoneMotionBlur);
	
	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static void UniGLBGetIKRigDefinition(UObject *retargeter, UObject *& src, UObject *& target);
	//static void GetIKRigDefinition(UIKRetargeter, UIKRigDefinition * &src, UIKRigDefinition * &target)

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static void UniGLBGetPreviewMesh(UObject* target, USkeletalMesh*& mesh);

	UFUNCTION(BlueprintPure, Category = "UniGLB", meta = (DynamicOutputParam = "skeletalmesh"))
	static void UniGLBGetSkeletalMeshFromSkinnedMeshComponent(const USkinnedMeshComponent* target, USkeletalMesh*& skeletalmesh);

	UFUNCTION(BlueprintPure, Category = "UniGLB", meta = (DynamicOutputParam = "AssetName"))
	static void UniGLBGetTopLevelAssetName(const FAssetData& target, FName& AssetName);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static UUniGLBAssetListObject* GetUniGLBAssetListObjectFromAsset(const UObject *Asset);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static bool UniGLBIsMovieRendering();

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static bool UniGLBIsTemporaryObject(const UObject *obj);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static bool UniGLBIsEditorPreviewObject(const UObject* obj);

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	static void UniGLBGetViewportSize(FIntPoint &ViewportSize, FIntPoint &BufferSize);

};


