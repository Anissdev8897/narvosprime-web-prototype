// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_AnimGraphNode_ModifyHumanoidBone.h"
#include "Misc/EngineVersionComparison.h"
#include "UnrealWidget.h"
#include "AnimNodeEditModes.h"
#include "Kismet2/CompilerResultsLog.h"

/////////////////////////////////////////////////////
// UAnimGraphNode_ModifyBone

#define LOCTEXT_NAMESPACE "A3Nodesaaaa"

UAnimGraphNode_UniGLBModifyHumanoidBone::UAnimGraphNode_UniGLBModifyHumanoidBone(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	CurWidgetMode = UE::Widget::EWidgetMode::WM_Rotate;
}

void UAnimGraphNode_UniGLBModifyHumanoidBone::ValidateAnimNodeDuringCompilation(USkeleton* ForSkeleton, FCompilerResultsLog& MessageLog)
{
	// Temporary fix where skeleton is not fully loaded during AnimBP compilation and thus virtual bone name check is invalid UE-39499 (NEED FIX) 
	if (ForSkeleton && !ForSkeleton->HasAnyFlags(RF_NeedPostLoad))
	{
	}

	Super::ValidateAnimNodeDuringCompilation(ForSkeleton, MessageLog);
}

FText UAnimGraphNode_UniGLBModifyHumanoidBone::GetControllerDescription() const
{
	return LOCTEXT("UniGLBModifyHumanoidBone", "UniGLBTransform (Modify) Humanoid Bone");
}

FText UAnimGraphNode_UniGLBModifyHumanoidBone::GetTooltipText() const
{
	return LOCTEXT("AnimGraphNode_ModifyBone_Tooltip", "The Transform Bone node alters the transform - i.e. Translation, Rotation, or Scale - of the bone");
}

FText UAnimGraphNode_UniGLBModifyHumanoidBone::GetNodeTitle(ENodeTitleType::Type TitleType) const
{
	return GetControllerDescription();
}

void UAnimGraphNode_UniGLBModifyHumanoidBone::CopyNodeDataToPreviewNode(FAnimNode_Base* InPreviewNode)
{
	FAnimNode_UniGLBModifyHumanoidBone* ModifyBone = static_cast<FAnimNode_UniGLBModifyHumanoidBone*>(InPreviewNode);

	// copies Pin values from the internal node to get data which are not compiled yet
	//ModifyBone->Transform = Node.Transform;
	//ModifyBone->UniGLBAssetList = Node.UniGLBAssetList;
	//ModifyBone->bEnableRotation = Node.bEnableRotation;
}

//FEditorModeID UAnimGraphNode_UniGLBModifyHumanoidBone::GetEditorMode() const
//{
//	return AnimNodeEditModes::ModifyBone;
//}

void UAnimGraphNode_UniGLBModifyHumanoidBone::CopyPinDefaultsToNodeData(UEdGraphPin* InPin)
{
}

#undef LOCTEXT_NAMESPACE
