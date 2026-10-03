// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_AnimGraphNode_Constraint.h"
#include "Misc/EngineVersionComparison.h"
#include "UnrealWidget.h"
#include "AnimNodeEditModes.h"
#include "AnimationRuntime.h"
#include "Animation/AnimInstance.h"
#include "Kismet2/CompilerResultsLog.h"
#include "Components/SkeletalMeshComponent.h"
#include "UniGLB_MetaObject.h"
#include "UniGLB_Util.h"

/////////////////////////////////////////////////////
// UAnimGraphNode_ModifyBone

#define LOCTEXT_NAMESPACE "A3Nodesaaaa"
////////////////////

UAnimGraphNode_UniGLBConstraint::UAnimGraphNode_UniGLBConstraint(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	CurWidgetMode = UE::Widget::EWidgetMode::WM_Rotate;
}

void UAnimGraphNode_UniGLBConstraint::ValidateAnimNodePostCompile(FCompilerResultsLog& MessageLog, UAnimBlueprintGeneratedClass* CompiledClass, int32 CompiledNodeIndex) {

	if (Node.UniGLBMetaObject_Internal == nullptr) {
		//MessageLog.Warning(*LOCTEXT("UniGLBNoMetaObject", "@@ - You must set UniGLBMetaObject").ToString(), this);
	} else {
		if (Node.UniGLBMetaObject_Internal->SkeletalMesh) {
			if (UniGLBGetSkeleton(Node.UniGLBMetaObject_Internal->SkeletalMesh) != CompiledClass->GetTargetSkeleton()) {
				MessageLog.Warning(*LOCTEXT("UniGLBDifferentSkeleton", "@@ - You must set UniGLBMetaObject has same skeleton").ToString(), this);
			}
		}
		if (CompiledClass->GetTargetSkeleton()->GetReferenceSkeleton().GetRawBoneNum() <= 0) {
			MessageLog.Warning(*LOCTEXT("UniGLBNoBone", "@@ - Skeleton bad data").ToString(), this);
		}
	}

	Super::ValidateAnimNodePostCompile(MessageLog, CompiledClass, CompiledNodeIndex);
}

void UAnimGraphNode_UniGLBConstraint::ValidateAnimNodeDuringCompilation(USkeleton* ForSkeleton, FCompilerResultsLog& MessageLog)
{
	Super::ValidateAnimNodeDuringCompilation(ForSkeleton, MessageLog);
}

FText UAnimGraphNode_UniGLBConstraint::GetControllerDescription() const
{
	if (Node.EnableAutoSearchMetaData) {
		return LOCTEXT("UniGLBConstraint", "UniGLBConstraint(auto)");
	} else {
		return LOCTEXT("UniGLBConstraint", "UniGLBConstraint");
	}
}

FText UAnimGraphNode_UniGLBConstraint::GetTooltipText() const
{
	return LOCTEXT("AnimGraphNode_UniGLBConstraint_Tooltip", "UniGLBCopyHandBone");
}

FText UAnimGraphNode_UniGLBConstraint::GetNodeTitle(ENodeTitleType::Type TitleType) const
{
	return GetControllerDescription();
}

void UAnimGraphNode_UniGLBConstraint::CopyNodeDataToPreviewNode(FAnimNode_Base* InPreviewNode)
{
	FAnimNode_UniGLBConstraint* node = static_cast<FAnimNode_UniGLBConstraint*>(InPreviewNode);

	// no copy
}

FEditorModeID UAnimGraphNode_UniGLBConstraint::GetEditorMode() const
{
	return Super::GetEditorMode();
}

void UAnimGraphNode_UniGLBConstraint::Draw(FPrimitiveDrawInterface* PDI, USkeletalMeshComponent * PreviewSkelMeshComp) const
{
	if (PreviewSkelMeshComp)
	{
		/*
		if (FAnimNode_UniGLBSpringBone* ActiveNode = GetActiveInstanceNode<FAnimNode_UniGLBSpringBone>(PreviewSkelMeshComp->GetAnimInstance()))
		{
			if (bPreviewLive) {
				ActiveNode->ConditionalDebugDraw(PDI, PreviewSkelMeshComp, bPreviewForeground);
			}
		}
		*/
		if (bPreviewLive) {
			Node.ConditionalDebugDraw(PDI, PreviewSkelMeshComp, bPreviewForeground);
		}
	}
}


void UAnimGraphNode_UniGLBConstraint::CopyPinDefaultsToNodeData(UEdGraphPin* InPin)
{
}



#undef LOCTEXT_NAMESPACE
