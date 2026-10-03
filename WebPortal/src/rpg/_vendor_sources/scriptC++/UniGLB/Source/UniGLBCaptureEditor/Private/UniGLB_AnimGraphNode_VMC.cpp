// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_AnimGraphNode_VMC.h"
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


UAnimGraphNode_UniGLBVMC::UAnimGraphNode_UniGLBVMC(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	CurWidgetMode = UE::Widget::EWidgetMode::WM_Rotate;
}

void UAnimGraphNode_UniGLBVMC::ValidateAnimNodePostCompile(FCompilerResultsLog& MessageLog, UAnimBlueprintGeneratedClass* CompiledClass, int32 CompiledNodeIndex) {

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

void UAnimGraphNode_UniGLBVMC::ValidateAnimNodeDuringCompilation(USkeleton* ForSkeleton, FCompilerResultsLog& MessageLog)
{
	// Temporary fix where skeleton is not fully loaded during AnimBP compilation and thus virtual bone name check is invalid UE-39499 (NEED FIX) 
	if (ForSkeleton && !ForSkeleton->HasAnyFlags(RF_NeedPostLoad))
	{
		if (Node.UniGLBMetaObject == nullptr) {
			//MessageLog.Warning(*LOCTEXT("UniGLBNoMetaObject", "@@ - You must set UniGLBMetaObject").ToString(), this);
		} else {
			if (Node.UniGLBMetaObject->SkeletalMesh){
				if (UniGLBGetSkeleton(Node.UniGLBMetaObject->SkeletalMesh) != ForSkeleton) {
			//		MessageLog.Warning(*LOCTEXT("UniGLBDifferentSkeleton", "@@ - You must set UniGLBMetaObject has same skeleton").ToString(), this);
				}
			}
			if (ForSkeleton->GetReferenceSkeleton().GetRawBoneNum() <= 0) {
			//	MessageLog.Warning(*LOCTEXT("UniGLBNoBone", "@@ - Skeleton bad data").ToString(), this);
			}
		}


		/*
		//if (ForSkeleton->GetReferenceSkeleton().FindBoneIndex(Node.BoneToModify.BoneName) == INDEX_NONE)
		if (ForSkeleton->GetReferenceSkeleton().FindBoneIndex(Node.BoneNameToModify) == INDEX_NONE)
		{
			//if (Node.BoneToModify.BoneName == NAME_None)
			if (Node.BoneNameToModify == NAME_None)
			{
				MessageLog.Warning(*LOCTEXT("NoBoneSelectedToModify", "@@ - You must pick a bone to modify").ToString(), this);
			}
			else
			{
				FFormatNamedArguments Args;
				//Args.Add(TEXT("BoneName"), FText::FromName(Node.BoneToModify.BoneName));
				Args.Add(TEXT("BoneName"), FText::FromName(Node.BoneNameToModify));

				FText Msg = FText::Format(LOCTEXT("NoBoneFoundToModify", "@@ - Bone {BoneName} not found in Skeleton"), Args);

				MessageLog.Warning(*Msg.ToString(), this);
			}
		}
		*/
	}

	//if ((Node.TranslationMode == BMM_Ignore) && (Node.RotationMode == BMM_Ignore) && (Node.ScaleMode == BMM_Ignore))
	{
	//	MessageLog.Warning(*LOCTEXT("NothingToModify", "@@ - No components to modify selected.  Either Rotation, Translation, or Scale should be set to something other than Ignore").ToString(), this);
	}

	Super::ValidateAnimNodeDuringCompilation(ForSkeleton, MessageLog);
}

FText UAnimGraphNode_UniGLBVMC::GetControllerDescription() const
{
	return LOCTEXT("UniGLBVMC", "UniGLBVMC");
}

FText UAnimGraphNode_UniGLBVMC::GetTooltipText() const
{
	return LOCTEXT("AnimGraphNode_UniGLBVMC_Tooltip", "UniGLBVMC");
}

FText UAnimGraphNode_UniGLBVMC::GetNodeTitle(ENodeTitleType::Type TitleType) const
{
	return GetControllerDescription();
	//if ((TitleType == ENodeTitleType::ListView || TitleType == ENodeTitleType::MenuTitle) && (Node.SpringBone.BoneName == NAME_None))
	//{
	//	return GetControllerDescription();
	//}

	/*
	FFormatNamedArguments Args;
	Args.Add(TEXT("ControllerDescription"), GetControllerDescription());
	Args.Add(TEXT("Server"), FText::FromString(Node.ServerAddress));
	Args.Add(TEXT("Port"), FText::FromString(FString::FromInt(Node.Port)));

	if (TitleType == ENodeTitleType::ListView || TitleType == ENodeTitleType::MenuTitle)
	{
		CachedNodeTitles.SetCachedTitle(TitleType, FText::Format(LOCTEXT("AnimGraphNode_UniGLBVMC_ListTitle", "{ControllerDescription} - {Server}:{Port}"), Args), this);
	}
	else
	{
		CachedNodeTitles.SetCachedTitle(TitleType, FText::Format(LOCTEXT("AnimGraphNode_UniGLBVMC_ListTitle", "{ControllerDescription}\n{Server}:{Port}"), Args), this);
	}

	return CachedNodeTitles[TitleType];
	*/

}

//void UAnimGraphNode_UniGLBVMC::CopyNodeDataToPreviewNode(FAnimNode_Base* InPreviewNode)
//{
//}

FEditorModeID UAnimGraphNode_UniGLBVMC::GetEditorMode() const
{
	return Super::GetEditorMode();
}

void UAnimGraphNode_UniGLBVMC::Draw(FPrimitiveDrawInterface* PDI, USkeletalMeshComponent * PreviewSkelMeshComp) const
{
	if (PreviewSkelMeshComp)
	{
		if (FAnimNode_UniGLBVMC* ActiveNode = GetActiveInstanceNode<FAnimNode_UniGLBVMC>(PreviewSkelMeshComp->GetAnimInstance()))
		{
			if (bPreviewLive) {
				//ActiveNode->ConditionalDebugDraw(PDI, PreviewSkelMeshComp, bPreviewForeground);
			}
		}
	}
}

#undef LOCTEXT_NAMESPACE
