// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Engine/EngineTypes.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Misc/EngineVersionComparison.h"

#include "UniGLB_EditorBPFunctionLibrary.generated.h"

class UTextureRenderTarget2D;
class UMaterialInstanceConstant;
class UAnimationAsset;
class USkeleton;

/**
 * 
 */
UCLASS()
class UNIGLBEDITOR_API UUniGLBEditorBPFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()
	
public:

	//UFUNCTION(BlueprintCallable,Category="UniGLB", meta = (DevelopmentOnly))
	//static bool UniGLBBakeAnim(const USkeletalMeshComponent *skc, const FString &FilePath, const FString &AssetFileName);


	//UFUNCTION(BlueprintCallable,Category="UniGLB")
	//static void UniGLBTransMatrix(const FTransform &transform, TArray<FLinearColor> &matrix, TArray<FLinearColor> &matrix_inv);

	//UFUNCTION(BlueprintPure, Category = "UniGLB")
	//static void UniGLBGetMorphTargetList(const USkeletalMesh *target, TArray<FString> &morphTargetList);


	UFUNCTION(BlueprintCallable, Category = "UniGLB")
	static int EvaluateCurvesFromSequence(const UMovieSceneSequence* Seq, float FrameNo, TArray<FString>& names, TArray<float>& curves);
};
