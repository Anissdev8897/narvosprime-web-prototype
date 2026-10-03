// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

/*
#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
//#include "BoneControllers/AnimNode_ModifyBone.h"
#include "UniGLB_AnimNode_PoseBlendNode.h"
#include "EdGraph/EdGraphNodeUtils.h"
#include "AnimGraphNode_PoseBlendNode.h"

#include "UnrealWidget.h"
#include "AnimNodeEditMode.h"

#include "UniGLB_AnimGraphNode_PoseBlendNode.generated.h" 

class FCompilerResultsLog;
class FPrimitiveDrawInterface;
class USkeletalMeshComponent;

UCLASS(meta=(Keywords = "UniGLB"))
class UAnimGraphNode_UniGLBPoseBlendNode : public UAnimGraphNode_PoseBlendNode
{
	GENERATED_UCLASS_BODY()

	//UPROPERTY(EditAnywhere, Category=Settings)
	//FAnimNode_UniGLBPoseBlendNode Node;

	UPROPERTY(EditAnywhere, Category = Preview)
	bool bPreviewLive = true;

	UPROPERTY(EditAnywhere, Category = Preview)
	bool bPreviewForeground = true;

public:
	// UEdGraphNode interface
	virtual FText GetNodeTitle(ENodeTitleType::Type TitleType) const override;
	virtual FText GetTooltipText() const override;
	virtual FText GetMenuCategory() const;
	// End of UEdGraphNode interface

	// UAnimGraphNode_Base interface
	virtual void PreloadRequiredAssets() override;
	UAnimationAsset* GetAnimationAsset() const override;
	virtual TSubclassOf<UAnimationAsset> GetAnimationAssetClass() const override;
	virtual void OnOverrideAssets(IAnimBlueprintNodeOverrideAssetsContext& InContext) const override {}
	virtual void SetAnimationAsset(UAnimationAsset* Asset) override;

	virtual bool DoesSupportTimeForTransitionGetter() const override { return true; }

	virtual void GetAllAnimationSequencesReferred(TArray<UAnimationAsset*>& AnimationAssets) const override;
	virtual void ReplaceReferredAnimations(const TMap<UAnimationAsset*, UAnimationAsset*>& AnimAssetReplacementMap) override;

	virtual void GetMenuActions(FBlueprintActionDatabaseRegistrar& ActionRegistrar) const override;
	virtual EAnimAssetHandlerType SupportsAssetClass(const UClass* AssetClass) const override;

	virtual void GetNodeContextMenuActions(class UToolMenu* Menu, class UGraphNodeContextMenuContext* Context) const override {}

protected:
	// UAnimGraphNode_Base interface
	virtual void ValidateAnimNodeDuringCompilation(USkeleton* ForSkeleton, FCompilerResultsLog& MessageLog) override;
	//	virtual FEditorModeID GetEditorMode() const override;
	virtual void CopyNodeDataToPreviewNode(FAnimNode_Base* InPreviewNode) override;
	virtual void CopyPinDefaultsToNodeData(UEdGraphPin* InPin) override;
	// End of UAnimGraphNode_Base interface

private:
	FNodeTitleTextTable CachedNodeTitles;

	// storing current widget mode 
	int32 CurWidgetMode;

	static FText GetTitleGivenAssetInfo2(const FText& AssetName);

};
*/


// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "AnimGraphNode_PoseHandler.h"
//#include "AnimNodes/AnimNode_PoseBlendNode.h"
#include "UniGLB_AnimNode_PoseBlendNode.h"
#include "UniGLB_AnimGraphNode_PoseBlendNode.generated.h" 

class FBlueprintActionDatabaseRegistrar;

UCLASS(MinimalAPI)
class UAnimGraphNode_UniGLBPoseBlendNode : public UAnimGraphNode_PoseHandler
{
	GENERATED_UCLASS_BODY()

	UPROPERTY(EditAnywhere, Category = Settings)
	FAnimNode_UniGLBPoseBlendNode Node;

	// UEdGraphNode interface
	virtual FText GetNodeTitle(ENodeTitleType::Type TitleType) const override;
	virtual FText GetTooltipText() const override;
	virtual FText GetMenuCategory() const override;
	// End of UEdGraphNode

	// UAnimGraphNode_Base interface
	// Interface to support transition getter
	virtual bool DoesSupportTimeForTransitionGetter() const override;
	virtual void GetAllAnimationSequencesReferred(TArray<UAnimationAsset*>& AnimationAssets) const override;
	virtual void ReplaceReferredAnimations(const TMap<UAnimationAsset*, UAnimationAsset*>& AnimAssetReplacementMap) override;
	virtual void GetMenuActions(FBlueprintActionDatabaseRegistrar& ActionRegistrar) const override;
	virtual EAnimAssetHandlerType SupportsAssetClass(const UClass* AssetClass) const override;
	// End of UAnimGraphNode_Base

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
	// UK2Node interface
	virtual void GetNodeContextMenuActions(class UToolMenu* Menu, class UGraphNodeContextMenuContext* Context) const override;
	// End of UK2Node interface

private:
	FText GetNodeTitleForPoseAsset(ENodeTitleType::Type TitleType, UPoseAsset* InPoseAsset) const;

private:
	static FText GetTitleGivenAssetInfo(const FText& AssetName);

	/** Used for filtering in the Blueprint context menu when the pose asset this node uses is unloaded */
	FString UnloadedSkeletonName;

protected:
	virtual FAnimNode_PoseHandler* GetPoseHandlerNode() override { return &Node; }
	virtual const FAnimNode_PoseHandler* GetPoseHandlerNode() const override { return &Node; }


protected:
	virtual void ValidateAnimNodeDuringCompilation(USkeleton* ForSkeleton, FCompilerResultsLog& MessageLog) override;
public:
	virtual void PreloadRequiredAssets() override;
	UAnimationAsset* GetAnimationAsset() const override;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	virtual TSubclassOf<UAnimationAsset> GetAnimationAssetClass() const override;
	virtual void OnOverrideAssets(IAnimBlueprintNodeOverrideAssetsContext & InContext) const override; 
	virtual void SetAnimationAsset(UAnimationAsset* Asset) override;


// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(4, 26, 0), (5, 0, 0)] all below target floor (5, 7, 0)).
};
