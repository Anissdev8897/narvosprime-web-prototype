// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_AnimGraphNode_RetargetFromMannequin.h"
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

UAnimGraphNode_UniGLBRetargetFromMannequin::UAnimGraphNode_UniGLBRetargetFromMannequin(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	CurWidgetMode = UE::Widget::EWidgetMode::WM_Rotate;
}

void UAnimGraphNode_UniGLBRetargetFromMannequin::ValidateAnimNodePostCompile(FCompilerResultsLog& MessageLog, UAnimBlueprintGeneratedClass* CompiledClass, int32 CompiledNodeIndex) {

	if (Node.UniGLBMetaObject == nullptr) {
		//MessageLog.Warning(*LOCTEXT("UniGLBNoMetaObject", "@@ - You must set UniGLBMetaObject").ToString(), this);
	} else {
		if (Node.UniGLBMetaObject->SkeletalMesh) {
			if (UniGLBGetSkeleton(Node.UniGLBMetaObject->SkeletalMesh) != CompiledClass->GetTargetSkeleton()) {
				MessageLog.Warning(*LOCTEXT("UniGLBDifferentSkeleton", "@@ - You must set UniGLBMetaObject has same skeleton").ToString(), this);
			}
		}
		if (CompiledClass->GetTargetSkeleton()->GetReferenceSkeleton().GetRawBoneNum() <= 0) {
			MessageLog.Warning(*LOCTEXT("UniGLBNoBone", "@@ - Skeleton bad data").ToString(), this);
		}
	}

	Super::ValidateAnimNodePostCompile(MessageLog, CompiledClass, CompiledNodeIndex);
}

void UAnimGraphNode_UniGLBRetargetFromMannequin::ValidateAnimNodeDuringCompilation(USkeleton* ForSkeleton, FCompilerResultsLog& MessageLog)
{
	Super::ValidateAnimNodeDuringCompilation(ForSkeleton, MessageLog);
}

FText UAnimGraphNode_UniGLBRetargetFromMannequin::GetControllerDescription() const
{
	return LOCTEXT("UniGLBRetargetFromMannequin", "UniGLBRetargetFromMannequin");
}

FText UAnimGraphNode_UniGLBRetargetFromMannequin::GetTooltipText() const
{
	return LOCTEXT("AnimGraphNode_UniGLBRetargetFromMannequin_Tooltip", "UniGLBCopyHandBone");
}

FText UAnimGraphNode_UniGLBRetargetFromMannequin::GetNodeTitle(ENodeTitleType::Type TitleType) const
{
	return GetControllerDescription();
}

void UAnimGraphNode_UniGLBRetargetFromMannequin::CopyNodeDataToPreviewNode(FAnimNode_Base* InPreviewNode)
{
	FAnimNode_UniGLBRetargetFromMannequin* node = static_cast<FAnimNode_UniGLBRetargetFromMannequin*>(InPreviewNode);

	// no copy
}

FEditorModeID UAnimGraphNode_UniGLBRetargetFromMannequin::GetEditorMode() const
{
	return Super::GetEditorMode();
}

void UAnimGraphNode_UniGLBRetargetFromMannequin::Draw(FPrimitiveDrawInterface* PDI, USkeletalMeshComponent * PreviewSkelMeshComp) const
{
}


void UAnimGraphNode_UniGLBRetargetFromMannequin::CopyPinDefaultsToNodeData(UEdGraphPin* InPin)
{
}



#undef LOCTEXT_NAMESPACE
