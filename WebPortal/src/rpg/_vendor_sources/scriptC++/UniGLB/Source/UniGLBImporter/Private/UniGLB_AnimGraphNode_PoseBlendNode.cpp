// Copyright Epic Games, Inc. All Rights Reserved.

#include "UniGLB_AnimGraphNode_PoseBlendNode.h"
#include "EdGraphSchema_K2_Actions.h"
#include "Modules/ModuleManager.h"
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "ToolMenus.h"

#include "AnimGraphCommands.h"
#include "BlueprintActionFilter.h"
#include "BlueprintActionDatabaseRegistrar.h"
#include "BlueprintNodeSpawner.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "AssetRegistry/ARFilter.h"
#include "AssetRegistry/AssetRegistryModule.h"

#define LOCTEXT_NAMESPACE "PoseBlendNode"

/////////////////////////////////////////////////////
// UAnimGraphNode_UniGLBPoseBlendNode

UAnimGraphNode_UniGLBPoseBlendNode::UAnimGraphNode_UniGLBPoseBlendNode(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
}

void UAnimGraphNode_UniGLBPoseBlendNode::GetAllAnimationSequencesReferred(TArray<UAnimationAsset*>& AnimationAssets) const
{
	if (Node.PoseAsset)
	{
		HandleAnimReferenceCollection(Node.PoseAsset, AnimationAssets);
	}
}

void UAnimGraphNode_UniGLBPoseBlendNode::ReplaceReferredAnimations(const TMap<UAnimationAsset*, UAnimationAsset*>& AnimAssetReplacementMap)
{
	HandleAnimReferenceReplacement(Node.PoseAsset, AnimAssetReplacementMap);
}

FText UAnimGraphNode_UniGLBPoseBlendNode::GetTooltipText() const
{
	// FText::Format() is slow, so we utilize the cached list title
	return GetNodeTitle(ENodeTitleType::ListView);
}

FText UAnimGraphNode_UniGLBPoseBlendNode::GetNodeTitleForPoseAsset(ENodeTitleType::Type TitleType, UPoseAsset* InPoseAsset) const
{
	FFormatNamedArguments Args;
	Args.Add(TEXT("PoseAssetName"), FText::FromString(InPoseAsset->GetName()));

	return FText::Format(LOCTEXT("PoseByName_Title", "UniGLB {PoseAssetName}"), Args);
}

FText UAnimGraphNode_UniGLBPoseBlendNode::GetNodeTitle(ENodeTitleType::Type TitleType) const
{
	if (Node.EnableAutoSearchMetaData)
	{
		// we may have a valid variable connected or default pin value
		UEdGraphPin* PosePin = FindPin(GET_MEMBER_NAME_STRING_CHECKED(FAnimNode_UniGLBPoseBlendNode, PoseAsset));
		if (PosePin && PosePin->LinkedTo.Num() > 0)
		{
			return LOCTEXT("PoseByName_TitleVariable", "UniGLB Pose");
		}
		else if (PosePin && PosePin->DefaultObject != nullptr)
		{
			return GetNodeTitleForPoseAsset(TitleType, CastChecked<UPoseAsset>(PosePin->DefaultObject));
		}
		else
		{
			return LOCTEXT("PoseByName_TitleNONE", "UniGLB Pose (Auto Search)");
		}
	}
	else
	{
		return LOCTEXT("PoseByName_TitleVariable", "UniGLB Pose");
		//return GetNodeTitleForPoseAsset(TitleType, Node.PoseAsset);
	}
}

void UAnimGraphNode_UniGLBPoseBlendNode::GetMenuActions(FBlueprintActionDatabaseRegistrar& InActionRegistrar) const
{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	GetMenuActionsHelper(
		InActionRegistrar,
		GetClass(),
		{ UPoseAsset::StaticClass() },
		{ },
		[](const FAssetData& InAssetData, UClass* InClass)
		{
			if (InAssetData.IsValid())
			{
				return GetTitleGivenAssetInfo(FText::FromName(InAssetData.AssetName));
			}
			else
			{
				return LOCTEXT("PlayerDesc", "UniGLB Evaluate Pose");
			}
		},
		[](const FAssetData& InAssetData, UClass* InClass)
		{
			if (InAssetData.IsValid())
			{
				return GetTitleGivenAssetInfo(FText::FromName(InAssetData.AssetName));
			}
			else
			{
				return LOCTEXT("PlayerDescTooltip", "UniGLB Evaluate Pose Asset");
			}
		},
		[](UEdGraphNode* InNewNode, bool bInIsTemplateNode, const FAssetData InAssetData)
		{
			UAnimGraphNode_AssetPlayerBase::SetupNewNode(InNewNode, bInIsTemplateNode, InAssetData);
		});
}

FText UAnimGraphNode_UniGLBPoseBlendNode::GetTitleGivenAssetInfo(const FText& AssetName)
{
	FFormatNamedArguments Args;
	Args.Add(TEXT("AssetName"), AssetName);

	return FText::Format(LOCTEXT("PoseAssetNodeTitle", "Evaluate Pose {AssetName}"), Args);
}

FText UAnimGraphNode_UniGLBPoseBlendNode::GetMenuCategory() const
{
	return LOCTEXT("PoseAssetCategory_Label", "Animation|Poses");
}

bool UAnimGraphNode_UniGLBPoseBlendNode::DoesSupportTimeForTransitionGetter() const
{
	return false;
}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
void UAnimGraphNode_UniGLBPoseBlendNode::GetNodeContextMenuActions(UToolMenu* Menu, UGraphNodeContextMenuContext* Context) const
{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	if (!Context->bIsDebugging)
	{
		// add an option to convert to single frame
		{
			FToolMenuSection& Section = Menu->AddSection("AnimGraphNodePoseBlender", LOCTEXT("PoseBlenderHeading", "Pose Blender"));
			Section.AddMenuEntry(FAnimGraphCommands::Get().ConvertToPoseByName);
		}
	}
}

EAnimAssetHandlerType UAnimGraphNode_UniGLBPoseBlendNode::SupportsAssetClass(const UClass* AssetClass) const
{
	if (AssetClass->IsChildOf(UPoseAsset::StaticClass()))
	{
		return EAnimAssetHandlerType::PrimaryHandler;
	}
	else
	{
		return EAnimAssetHandlerType::NotSupported;
	}
}


////
void UAnimGraphNode_UniGLBPoseBlendNode::ValidateAnimNodeDuringCompilation(USkeleton* ForSkeleton, FCompilerResultsLog& MessageLog) {
}
void UAnimGraphNode_UniGLBPoseBlendNode::PreloadRequiredAssets() {
}
UAnimationAsset* UAnimGraphNode_UniGLBPoseBlendNode::GetAnimationAsset() const {
	UPoseAsset* PoseAsset = GetPoseHandlerNode()->PoseAsset;
	UEdGraphPin* PoseAssetPin = FindPin(GET_MEMBER_NAME_STRING_CHECKED(FAnimNode_PoseHandler, PoseAsset));
	if (PoseAssetPin != nullptr && PoseAsset == nullptr)
	{
		PoseAsset = Cast<UPoseAsset>(PoseAssetPin->DefaultObject);
	}

	return PoseAsset;
}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
TSubclassOf<UAnimationAsset> UAnimGraphNode_UniGLBPoseBlendNode::GetAnimationAssetClass() const {
	return UPoseAsset::StaticClass();
}
void UAnimGraphNode_UniGLBPoseBlendNode::OnOverrideAssets(IAnimBlueprintNodeOverrideAssetsContext& InContext) const {
	/*
		if (InContext.GetAssets().Num() > 0)
		{
			if (UPoseAsset* PoseAsset = Cast<UPoseAsset>(InContext.GetAssets()[0]))
			{
				FAnimNode_PoseHandler& AnimNode = InContext.GetAnimNode<FAnimNode_PoseHandler>();
				AnimNode.SetPoseAsset(PoseAsset);
			}
		}
		*/
}

void UAnimGraphNode_UniGLBPoseBlendNode::SetAnimationAsset(UAnimationAsset* Asset) {
	if (UPoseAsset* PoseAsset = Cast<UPoseAsset>(Asset))
	{
		GetPoseHandlerNode()->PoseAsset = PoseAsset;
	}
}

////
#undef LOCTEXT_NAMESPACE
